// Forge KVS persistence. Only redacted records are ever stored.
import { kvs, WhereConditions } from '@forge/kvs';

export const DEFAULT_SETTINGS = {
  projectKeys: ['SAFE'],
  commentOnSignal: true,
  minSignalCount: 3,
  windowDays: 90,
};

export async function getSettings() {
  const s = await kvs.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
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

export const getAlert = (signalId) => kvs.get(`alert:${encodeURIComponent(signalId)}`);
export const saveAlert = (signalId, value) => kvs.set(`alert:${encodeURIComponent(signalId)}`, value);

export async function getFeedback(key) {
  return (await kvs.get(`feedback:${key}`)) || { notRelated: [] };
}

export async function markNotRelated(key, otherKey) {
  const fb = await getFeedback(key);
  if (!fb.notRelated.includes(otherKey)) fb.notRelated.push(otherKey);
  await kvs.set(`feedback:${key}`, fb);
  return fb;
}
