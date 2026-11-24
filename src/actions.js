// Rovo action handlers. Each receives (payload, context); inputs are top-level keys
// on payload, and the Jira issue context is at payload.context.jira.
import { similarFor, signals, protocolsFor, rcaDraft, ensureRecord, brief, publishSignalBrief } from './analysis.js';
import { sliceProfile, CATEGORIES } from './engine/index.js';
import { createIssue, linkIssues, visibleKeys, getIssue } from './atlassian.js';
import { saveActionItem } from './store.js';

function issueKeyFrom(payload) {
  const key = payload?.issueKey || payload?.context?.jira?.issueKey;
  if (!key) throw new Error('No issue key. Open a safety report or pass issueKey (e.g. SAFE-12).');
  return String(key).trim().toUpperCase();
}

/** Throws if the invoking user cannot see the issue. */
async function assertCanView(key) {
  await getIssue(key, { asUser: true });
}

const fail = (e) => ({ error: e.message });

export async function findSimilarReports(payload) {
  try {
    const key = issueKeyFrom(payload);
    await assertCanView(key);
    const { record, matches } = await similarFor(key, { limit: Number(payload?.limit) || 8 });
    return {
      report: brief(record),
      similarCount: matches.length,
      similar: matches.map((m) => ({ ...brief(m.record), score: m.score, why: m.reasons.join('; ') })),
    };
  } catch (e) {
    return fail(e);
  }
}

export async function getSafetySignals(payload) {
  try {
    const list = await signals({ location: payload?.location, category: payload?.category, days: Number(payload?.days) || undefined });
    const allowed = await visibleKeys([...new Set(list.flatMap((s) => s.keys))]);
    return {
      signals: list
        .map((s) => ({ ...s, keys: s.keys.filter((k) => allowed.has(k)) }))
        .filter((s) => s.keys.length > 0)
        .slice(0, 10)
        .map((s) => ({
          signalId: s.id,
          projectKey: (s.keys[0] || '').split('-')[0],
          title: s.title,
          count: s.count,
          firstSeen: s.firstSeen,
          lastSeen: s.lastSeen,
          reportsReachingPatient: s.harmCount,
          reports: s.keys,
          layersWithHoles: s.slices.filter((l) => l.holes > 0).map((l) => `${l.short}: ${l.factors.map((f) => f.label).join(', ')}`),
        })),
      categories: CATEGORIES.map((c) => c.id),
    };
  } catch (e) {
    return fail(e);
  }
}

export async function explainSlices(payload) {
  try {
    const key = issueKeyFrom(payload);
    await assertCanView(key);
    const { record, matches } = await similarFor(key, { limit: 10 });
    const own = sliceProfile([record]);
    const cluster = sliceProfile([record, ...matches.map((m) => m.record)]);
    return {
      report: brief(record),
      thisReport: own.map((l) => ({ layer: l.short, hole: l.holes > 0, factors: l.factors.map((f) => f.label) })),
      acrossSimilarReports: cluster.map((l) => ({ layer: l.short, reportsWithHole: l.holes, of: l.of, factors: l.factors })),
      sliceThatHeld: record.defences,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function findProtocols(payload) {
  try {
    const key = issueKeyFrom(payload);
    await assertCanView(key);
    const record = await ensureRecord(key);
    const protocols = await protocolsFor(record);
    return { protocols, note: 'Protocols not reviewed in more than 24 months are marked stale.' };
  } catch (e) {
    return fail(e);
  }
}

export async function draftRca(payload) {
  try {
    const key = issueKeyFrom(payload);
    await assertCanView(key);
    return await rcaDraft(key);
  } catch (e) {
    return fail(e);
  }
}

export async function createSafetyAction(payload) {
  try {
    const key = issueKeyFrom(payload);
    await assertCanView(key);
    if (!payload?.summary) throw new Error('summary is required');
    const projectKey = payload.projectKey || key.split('-')[0];
    const created = await createIssue({
      projectKey,
      summary: payload.summary,
      description: `${payload.description || ''}\n\nRaised from safety report ${key} via Slice. Strength: ${payload.strength || 'not set'}.`,
      labels: ['slice-action'],
    });
    await linkIssues(key, created.key).catch((e) => console.warn('link failed', e.message));
    await saveActionItem({
      key: created.key,
      from: key,
      text: payload.summary,
      strength: payload.strength || null,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    return { created: created.key, linkedTo: key };
  } catch (e) {
    return fail(e);
  }
}

export async function publishSignalBriefAction(payload) {
  try {
    if (!payload?.signalId) throw new Error('signalId is required. Call get-safety-signals first and pass its signalId.');
    const projectKey = String(payload.projectKey || payload.context?.jira?.projectKey || 'SAFE').toUpperCase();
    const res = await publishSignalBrief(projectKey, payload.signalId);
    return { published: res.created, alreadyExisted: !res.created, url: res.url, title: res.title };
  } catch (e) {
    return fail(e);
  }
}
