'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const token = () => crypto.randomBytes(32).toString('hex');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 128) throw new Error('Password must be 16–128 characters');
  const salt = token();
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, hash) {
  const [salt, hex] = hash.split(':');
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}
function accounts(value) {
  try {
    const list = JSON.parse(value || '[]');
    if (!Array.isArray(list) || !list.length || list.length > 10) return [];
    for (const a of list) if (!/^[a-zA-Z0-9_-]{2,40}$/.test(a.username) || !/^[a-f0-9]{64}:[a-f0-9]{128}$/.test(a.hash)) return [];
    if (new Set(list.map(a => a.username)).size !== list.length) return [];
    return list;
  } catch { return []; }
}
function cookie(value, secure, remove = false) {
  return 'life_admin=' + value + '; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '') + '; Max-Age=' + (remove ? 0 : 28800);
}
function sessionToken(req) {
  const raw = (req.headers.cookie || '').split(';').find(x => x.trim().startsWith('life_admin='));
  const value = raw ? raw.trim().slice('life_admin='.length) : '';
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
module.exports = { token, digest, passwordHash, verifyPassword, accounts, cookie, sessionToken };
