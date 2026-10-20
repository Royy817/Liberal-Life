'use strict';
const crypto = require('node:crypto');
const auth = require('./auth.cjs');
const domain = require('./domain.cjs');
const { getDb } = require('./db.cjs');
const { InputError } = domain;
function createHandler(options = {}) {
  const env = options.env || process.env;
  const secure = options.secure === undefined ? env.NODE_ENV !== 'development' : options.secure;
  const database = options.db || { query: (...args) => getDb().query(...args) };
  const users = auth.accounts(env.ADMIN_ACCOUNTS);
  const configured = Boolean((options.db || env.DATABASE_URL) && users.length && env.ADMIN_SECRET && env.ADMIN_SECRET.length >= 32);
  const query = async (...args) => { const result = await database.query(...args); return Array.isArray(result) ? result : result.rows; };
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://local');
      const action = url.searchParams.get('action') || 'session';
      const method = req.method;
      if (!['GET', 'POST', 'PATCH'].includes(method)) throw new InputError('この操作は利用できません。', 405);
      if (method !== 'GET') {
        const origin = req.headers.origin;
        const expected = (secure ? 'https://' : 'http://') + req.headers.host;
        if (origin !== expected || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '') || req.headers['sec-fetch-site'] === 'cross-site') throw new InputError('操作元を確認できません。ページを開き直してください。', 403);
      }
      if (!configured) return send(503, { error: '管理用データベースと管理者ログインの設定が必要です。設定完了まで記録できません。', configured: false });
      let body = {};
      if (method !== 'GET') {
        if (req.body !== undefined) {
          if (Buffer.byteLength(JSON.stringify(req.body)) > 32768) throw new InputError('入力が長すぎます。', 413);
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else {
          let size = 0; const chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 32768) throw new InputError('入力が長すぎます。', 413); chunks.push(chunk); }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('入力形式を確認してください。');
      }
      if (action === 'login' && method === 'POST') {
        // Distributed throttling: per IP and globally, shared across instances.
        const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
        const key = crypto.createHmac('sha256', env.ADMIN_SECRET).update(ip).digest('hex');
        for (const [bucket, maximum] of [[key, 8], ['global', 100]]) {
          const [limit] = await query(`INSERT INTO life_login_limits(key, attempts, expires_at) VALUES ($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN life_login_limits.expires_at < now() THEN 1 ELSE life_login_limits.attempts+1 END, expires_at=CASE WHEN life_login_limits.expires_at < now() THEN now()+interval '15 minutes' ELSE life_login_limits.expires_at END RETURNING attempts`, [bucket]);
          if (limit.attempts > maximum) { res.setHeader('Retry-After', '900'); throw new InputError('試行回数が多いため、15分後にお試しください。', 429); }
        }
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length > 128) throw new InputError('ログイン情報を確認してください。', 401);
        const account = users.find(a => a.username === body.username);
        const valid = await auth.verifyPassword(password, (account || users[0]).hash);
        if (!account || !valid) throw new InputError('ログイン情報を確認してください。', 401);
        // A fresh login replaces any old session for this browser.
        const previous = auth.sessionToken(req);
        if (previous) await query('DELETE FROM life_sessions WHERE token_hash=$1', [auth.digest(previous)]);
        const raw = auth.token(), csrf = auth.token();
        await query('INSERT INTO life_sessions(token_hash,username,account_hash,csrf,expires_at) VALUES ($1,$2,$3,$4,now()+interval \'8 hours\')', [auth.digest(raw), account.username, auth.digest(account.hash), csrf]);
        res.setHeader('Set-Cookie', auth.cookie(raw, secure));
        return send(200, { username: account.username, csrf });
      }
      const raw = auth.sessionToken(req);
      const sessions = raw ? await query('SELECT username,account_hash,csrf FROM life_sessions WHERE token_hash=$1 AND expires_at>now()', [auth.digest(raw)]) : [];
      const session = sessions[0];
      if (!session || !users.some(a => a.username === session.username && auth.digest(a.hash) === session.account_hash)) {
        if (action === 'session' && method === 'GET') return send(200, { authenticated: false, configured: true });
        throw new InputError('ログインしてください。', 401);
      }
      if (method !== 'GET' && req.headers['x-csrf-token'] !== session.csrf) throw new InputError('操作を確認できません。ページを開き直してください。', 403);
      if (action === 'session' && method === 'GET') return send(200, { authenticated: true, username: session.username, csrf: session.csrf });
      if (action === 'logout' && method === 'POST') {
        await query('DELETE FROM life_sessions WHERE token_hash=$1', [auth.digest(raw)]);
        res.setHeader('Set-Cookie', auth.cookie('', secure, true)); return send(200, { ok: true });
      }
      if (action === 'referrers' && method === 'GET') return send(200, { referrers: await query('SELECT code,name,active,version FROM life_referrers ORDER BY created_at DESC') });
      if (action === 'referrers' && ['POST', 'PATCH'].includes(method)) {
        const r = domain.referrer(body);
        let rows;
        if (method === 'POST') rows = await query(`WITH changed AS (INSERT INTO life_referrers(code,name,active) VALUES ($1,$2,$3) RETURNING *) , logged AS (INSERT INTO life_audit(actor,action,entity_id) SELECT $4,'referrer_created',code FROM changed) SELECT code,name,active,version FROM changed`, [r.code,r.name,r.active,session.username]);
        else rows = await query(`WITH changed AS (UPDATE life_referrers SET name=$2,active=$3,version=version+1 WHERE code=$1 AND version=$4 RETURNING *), logged AS (INSERT INTO life_audit(actor,action,entity_id) SELECT $5,'referrer_updated',code FROM changed) SELECT code,name,active,version FROM changed`, [r.code,r.name,r.active,body.version,session.username]);
        if (!rows.length) throw new InputError('他の担当者が更新しました。再読み込みして確認してください。',409);
        return send(200, { referrer: rows[0] });
      }
      if ((action === 'cases' || action === 'export') && method === 'GET') {
        const rows = await query('SELECT id,data,version FROM life_cases ORDER BY created_at DESC LIMIT 10001');
        if (rows.length > 10000) throw new InputError('案件数が上限を超えました。運営者へご連絡ください。',413);
        const cases = rows.map(r => ({ ...r.data, id:r.id, version:r.version }));
        if (action === 'export') { res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="aiplun-cases.csv"'); res.end(domain.csv(cases)); return; }
        return send(200,{ cases });
      }
      if (action === 'cases' && ['POST','PATCH'].includes(method)) {
        const data = domain.caseData(body);
        if (data.referrerCode) {
          const found = await query('SELECT code,active FROM life_referrers WHERE code=$1',[data.referrerCode]);
          if (!found.length) throw new InputError('紹介者コードが登録されていません。紹介者を先に登録してください。');
          if (!found[0].active && method === 'POST') throw new InputError('停止中の紹介者です。状態を確認してください。');
        }
        const key = method === 'POST' ? domain.id() : body.id;
        if (!/^C-[0-9a-f-]{36}$/.test(key || '')) throw new InputError('案件IDを確認してください。');
        let rows;
        if (method === 'POST') rows = await query(`WITH changed AS (INSERT INTO life_cases(id,consultation_id,referrer_code,data) VALUES($1,$2,$3,$4::jsonb) RETURNING *), logged AS (INSERT INTO life_audit(actor,action,entity_id,stage) SELECT $5,'case_created',id,data->>'stage' FROM changed) SELECT id,data,version FROM changed`,[key,data.consultationId || null,data.referrerCode || null,JSON.stringify(data),session.username]);
        else rows = await query(`WITH changed AS (UPDATE life_cases SET consultation_id=$2,referrer_code=$3,data=$4::jsonb,version=version+1,updated_at=now() WHERE id=$1 AND version=$5 RETURNING *), logged AS (INSERT INTO life_audit(actor,action,entity_id,stage) SELECT $6,'case_updated',id,data->>'stage' FROM changed) SELECT id,data,version FROM changed`,[key,data.consultationId || null,data.referrerCode || null,JSON.stringify(data),body.version,session.username]);
        if (!rows.length) throw new InputError('他の担当者が更新しました。再読み込みして確認してください。',409);
        return send(200,{ case:{...rows[0].data,id:rows[0].id,version:rows[0].version} });
      }
      if (action === 'room-inquiries' && method === 'GET') {
        const rows=await query('SELECT id,profile,stage,version,created_at,updated_at FROM life_room_inquiries ORDER BY created_at DESC LIMIT 200');
        return send(200,{inquiries:rows});
      }
      if (action === 'room-inquiries' && method === 'PATCH') {
        if(!/^R-[0-9a-f-]{36}$/.test(body.id||'')||!['new','contacting','introduced','closed'].includes(body.stage)||!Number.isSafeInteger(body.version)||body.version<1)throw new InputError('相談ID・対応状況を確認してください。');
        const rows=await query(`WITH changed AS (UPDATE life_room_inquiries SET stage=$2,version=version+1,updated_at=now() WHERE id=$1 AND version=$3 RETURNING id,profile,stage,version,created_at,updated_at),logged AS (INSERT INTO life_audit(actor,action,entity_id,stage) SELECT $4,'room_updated',id,stage FROM changed) SELECT * FROM changed`,[body.id,body.stage,body.version,session.username]);
        if(!rows.length)throw new InputError('別の担当者が更新しました。再読み込みしてください。',409);
        return send(200,{inquiry:rows[0]});
      }
      if (action === 'room-delete' && method === 'POST') {
        if(!/^R-[0-9a-f-]{36}$/.test(body.id||'')||!Number.isSafeInteger(body.version)||body.version<1)throw new InputError('相談IDを確認してください。');
        const rows=await query(`WITH changed AS (DELETE FROM life_room_inquiries WHERE id=$1 AND version=$2 RETURNING id),logged AS (INSERT INTO life_audit(actor,action,entity_id) SELECT $3,'room_deleted',id FROM changed) SELECT id FROM changed`,[body.id,body.version,session.username]);
        if(!rows.length)throw new InputError('記録が更新・削除されています。再読み込みしてください。',409);
        return send(200,{ok:true});
      }
      if (action === 'audit' && method === 'GET') return send(200,{ audit:await query('SELECT actor,action,entity_id,stage,created_at FROM life_audit ORDER BY id DESC LIMIT 100') });
      if (action === 'delete' && method === 'POST') {
        if (!/^C-[0-9a-f-]{36}$/.test(body.id || '')) throw new InputError('案件IDを確認してください。');
        const rows = await query(`WITH changed AS (DELETE FROM life_cases WHERE id=$1 AND version=$2 RETURNING id), logged AS (INSERT INTO life_audit(actor,action,entity_id) SELECT $3,'case_deleted',id FROM changed) SELECT id FROM changed`,[body.id,body.version,session.username]);
        if (!rows.length) throw new InputError('記録が更新・削除されています。再読み込みしてください。',409);
        return send(200,{ok:true});
      }
      throw new InputError('この操作は利用できません。',404);
    } catch (error) {
      if (error.code === '23505') return send(409,{error:'同じ紹介者コードまたは相談IDが登録済みです。既存の記録を確認してください。'});
      if (error instanceof InputError) return send(error.status,{error:error.message});
      if (error instanceof SyntaxError) return send(400,{error:'入力形式を確認してください。'});
      // Never return connection strings, SQL, raw requests or case data in errors/logs.
      send(503,{error:'保存先に接続できませんでした。保存は完了していません。設定または接続を確認してください。'});
    }
  };
}
module.exports = { createHandler };
