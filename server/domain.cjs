'use strict';
const { randomUUID } = require('node:crypto');
const stages = ['intake', 'consent_wait', 'consented', 'referred', 'won', 'rewarded', 'paid', 'lost'];
const channels = ['sns', 'direct', 'friend', 'other', 'unknown'];
const categories = ['career', 'rent', 'utility'];
class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InputError(label + 'を確認してください。');
  const clean = value.trim();
  if (required && !clean) throw new InputError(label + 'を入力してください。');
  return clean;
}
function date(value, label, required = false) {
  if (value === '' || value === undefined) { if (required) throw new InputError(label + 'を入力してください。'); return ''; }
  const parsed = typeof value === 'string' ? new Date(value + 'T00:00:00Z') : new Date(NaN);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new InputError(label + 'を確認してください。');
  return value;
}
function referrer(input) {
  const code = text(input.code, 40, '紹介者コード', true);
  if (!/^[a-zA-Z0-9_-]{2,40}$/.test(code)) throw new InputError('紹介者コードは英数字・ハイフン・アンダースコアの2〜40文字です。');
  if (typeof input.active !== 'boolean') throw new InputError('紹介者の状態を確認してください。');
  return { code, name: text(input.name, 40, '管理用の紹介者名', true), active: input.active };
}
function caseData(input) {
  if (!categories.includes(input.category) || !channels.includes(input.channel) || !stages.includes(input.stage)) throw new InputError('カテゴリー・流入経路・進捗を確認してください。');
  const out = { label: text(input.label, 60, '管理用ラベル', true), category: input.category, channel: input.channel, stage: input.stage,
    source: text(input.source || '', 40, '流入元'), timing: text(input.timing || '', 40, '希望時期'),
    receivedAt: date(input.receivedAt, '相談受付日', true), consentAt: date(input.consentAt, '同意取得日'),
    referredAt: date(input.referredAt, '有効紹介日'), wonAt: date(input.wonAt, '成約日'),
    rewardedAt: date(input.rewardedAt, '報酬確定日'), paidAt: date(input.paidAt, '入金日'),
    provider: text(input.provider || '', 60, '共有先'), sharedItems: text(input.sharedItems || '', 120, '共有項目'),
    referrerCode: text(input.referrerCode || '', 40, '紹介者コード'), consultationId: text(input.consultationId || '', 64, '相談ID') };
  if (out.referrerCode && !/^[a-zA-Z0-9_-]{2,40}$/.test(out.referrerCode)) throw new InputError('紹介者コードを確認してください。');
  if (out.consultationId && !(/^(?:AL-[a-zA-Z0-9-]{6,60}|R-[0-9a-f-]{36})$/.test(out.consultationId))) throw new InputError('相談IDを確認してください。');
  out.reward = input.reward === '' || input.reward === null || input.reward === undefined ? null : Number(input.reward);
  if (out.reward !== null && (!Number.isSafeInteger(out.reward) || out.reward < 0 || out.reward > 100000000)) throw new InputError('紹介報酬は0〜100,000,000円の整数で入力してください。');
  const rank = stages.indexOf(out.stage);
  const dates = ['receivedAt', 'consentAt', 'referredAt', 'wonAt', 'rewardedAt', 'paidAt'];
  const required = [true, rank >= 2 && rank <= 6, rank >= 3 && rank <= 6, rank >= 4 && rank <= 6, rank >= 5 && rank <= 6, rank === 6];
  for (let i = 0; i < dates.length; i++) if (required[i] && !out[dates[i]]) throw new InputError('進捗に対応する日付を入力してください。');
  let last = '';
  for (const key of dates) if (out[key]) { if (last && out[key] < last) throw new InputError('日付は受付・同意・紹介・成約・報酬確定・入金の順にしてください。'); last = out[key]; }
  if (out.referredAt && (!out.consentAt || !out.provider || !out.sharedItems)) throw new InputError('紹介前の同意取得日・共有先・共有項目が必要です。');
  if (out.consentAt && (!out.provider || !out.sharedItems)) throw new InputError('同意の対象となる共有先・共有項目を入力してください。');
  if (out.wonAt && !out.referredAt || out.rewardedAt && !out.wonAt || out.paidAt && !out.rewardedAt) throw new InputError('前の段階の日付も入力してください。');
  if ((out.rewardedAt || rank >= 5 && rank <= 6) && out.reward === null) throw new InputError('確定した紹介報酬を入力してください。');
  // Avoid recording future milestones while the case is in an earlier stage.
  if (rank < 7) for (let i = 1; i < dates.length; i++) if (out[dates[i]] && rank < i + 1) throw new InputError('入力済みの日付に対応する進捗を選んでください。');
  return out;
}
function id() { return 'C-' + randomUUID(); }
function csv(rows) {
  const fields = ['id', 'consultationId', 'label', 'category', 'referrerCode', 'channel', 'source', 'stage', 'receivedAt', 'consentAt', 'provider', 'sharedItems', 'referredAt', 'wonAt', 'rewardedAt', 'reward', 'paidAt'];
  const cell = value => { let v = value == null ? '' : String(value); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replaceAll('"', '""') + '"'; };
  return '\uFEFF' + [fields.map(cell).join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\r\n');
}
module.exports = { InputError, caseData, referrer, id, csv, stages, channels };
