// Resolver for the Jira issue panel (UI Kit).
import ResolverPkg from '@forge/resolver';
import { panelData, reindexAll, indexIssue, dashboardData } from './analysis.js';
import { markNotRelated, getSettings, saveSettings, validateSettings } from './store.js';
import { getIssue, isJiraAdmin } from './atlassian.js';
import { createSafetyAction } from './actions.js';

// Works both bundled by Forge and under plain Node ESM (CommonJS interop).
const Resolver = ResolverPkg.default ?? ResolverPkg;
const resolver = new Resolver();

const issueKey = (req) => req.payload?.issueKey || req.context?.extension?.issue?.key;

resolver.define('getPanel', async (req) => {
  const key = issueKey(req);
  await getIssue(key, { asUser: true }); // permission check
  return panelData(key);
});

resolver.define('refresh', async (req) => {
  const key = issueKey(req);
  await getIssue(key, { asUser: true });
  await indexIssue(key);
  return panelData(key);
});

resolver.define('reindexAll', async () => ({ indexed: await reindexAll() }));

resolver.define('notRelated', async (req) => {
  const key = issueKey(req);
  await getIssue(key, { asUser: true });
  await markNotRelated(key, req.payload.otherKey);
  return panelData(key);
});

// Create a linked Jira action item for an approved fix (runs as the user).
resolver.define('createAction', async (req) => {
  const key = issueKey(req);
  await getIssue(key, { asUser: true });
  const { text, strength, addresses } = req.payload || {};
  if (!text) throw new Error('Missing action text.');
  const res = await createSafetyAction({
    issueKey: key,
    summary: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    description: `${text}\n\nAddresses: ${addresses || 'contributing factors in related reports'}.`,
    strength,
  });
  if (res.error) throw new Error(res.error);
  return res;
});

resolver.define('getDashboard', async (req) => {
  const projectKey = req.payload?.projectKey || req.context?.extension?.project?.key;
  if (!projectKey) throw new Error('Open Slice from a project.');
  return dashboardData(projectKey);
});

resolver.define('getSettings', async () => ({ settings: await getSettings(), isAdmin: await isJiraAdmin() }));

resolver.define('saveSettings', async (req) => {
  if (!(await isJiraAdmin())) throw new Error('Only Jira administrators can change Slice settings.');
  const saved = await saveSettings(validateSettings(req.payload || {}));
  return { settings: saved, isAdmin: true };
});

export const handler = resolver.getDefinitions();
