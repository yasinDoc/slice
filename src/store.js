// Forge KVS persistence. Only redacted records are ever stored.
import { kvs, WhereConditions } from '@forge/kvs';

export const DEFAULT_SETTINGS = {
  projectKeys: ['SAFE'],
  commentOnSignal: true,
  minSignalCount: 3,
  windowDays: 90,
  thankReporters: true,
  supportNote: true,
  supportUrl: '',
};

export async function getSettings() {
  const s = await kvs.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

/** Whitelist and clamp settings coming from the UI. Throws on invalid input. */
export function validateSettings(input) {
  const out = {};
  if (input.projectKeys !== undefined) {
    const keys = (Array.isArray(input.projectKeys) ? input.projectKeys : String(input.projectKeys).split(','))
      .map((k) => String(k).trim().toUpperCase())
      .filter(Boolean);
    if (!keys.length || keys.some((k) => !/^[A-Z][A-Z0-9_]{1,9}$/.test(k))) {
      throw new Error('Project keys must look like SAFE or ICU_2 (letters, digits, underscore).');
    }
    out.projectKeys = [...new Set(keys)].slice(0, 10);
  }
  const int = (v, min, max, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  if (input.minSignalCount !== undefined) out.minSignalCount = int(input.minSignalCount, 2, 20, 'Reports per signal');
  if (input.windowDays !== undefined) out.windowDays = int(input.windowDays, 14, 365, 'Look-back window');
  if (input.commentOnSignal !== undefined) out.commentOnSignal = Boolean(input.commentOnSignal);
  if (input.thankReporters !== undefined) out.thankReporters = Boolean(input.thankReporters);
  if (input.supportNote !== undefined) out.supportNote = Boolean(input.supportNote);
  if (input.supportUrl !== undefined) {
    const url = String(input.supportUrl).trim();
    if (url && (!/^https:\/\/[^\s"'<>]{3,300}$/.test(url))) {
      throw new Error('Staff support link must be an https:// address.');
    }
    out.supportUrl = url;
  }
  return out;
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await kvs.set('settings', next);
  return next;
}

export const saveRecord = (record) => kvs.set(`report:${record.key}`, record);
export const getRecord = (key) => kvs.get(`report:${key}`);
export const deleteRecord = (key) => kvs.delete(`report:${key}`);

/** All stored report records. Fine for hackathon scale (hundreds to low thousands). */
export async function allRecords() {
  const out = [];
  let cursor;
  do {
    let q = kvs.query().where('key', WhereConditions.beginsWith('report:')).limit(100);
    if (cursor) q = q.cursor(cursor);
    const page = await q.getMany();
    for (const r of page.results || []) out.push(r.value);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

// Forge KVS keys allow only [a-zA-Z0-9:._\s-#]. Signal ids contain "|" and may contain
// other characters (device names), so map anything else to "_".
export const safeKey = (s) => String(s).replace(/[^a-zA-Z0-9:._\s#-]/g, '_').slice(0, 400);

export const getAlert = (signalId) => kvs.get(safeKey(`alert:${signalId}`));
export const saveAlert = (signalId, value) => kvs.set(safeKey(`alert:${signalId}`), value);

export async function getFeedback(key) {
  return (await kvs.get(`feedback:${key}`)) || { notRelated: [] };
}

export async function markNotRelated(key, otherKey) {
  const fb = await getFeedback(key);
  if (!fb.notRelated.includes(otherKey)) fb.notRelated.push(otherKey);
  await kvs.set(`feedback:${key}`, fb);
  return fb;
}

/** Action items Slice created: { key, from, text, strength, createdAt }. */
export const saveActionItem = (item) => kvs.set(`action:${item.key}`, item);
export const getActionItem = (key) => kvs.get(`action:${key}`);
/** Action items whose reporters have already been thanked (once per action). */
export const getThanked = (key) => kvs.get(`thanked:${key}`);
export const saveThanked = (key, value) => kvs.set(`thanked:${key}`, value);

export async function allActionItems() {
  const out = [];
  let cursor;
  do {
    let q = kvs.query().where('key', WhereConditions.beginsWith('action:')).limit(100);
    if (cursor) q = q.cursor(cursor);
    const page = await q.getMany();
    for (const r of page.results || []) out.push(r.value);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}
