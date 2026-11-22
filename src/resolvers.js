// Resolver for the Jira issue panel (UI Kit).
import Resolver from '@forge/resolver';
import { panelData, reindexAll, indexIssue } from './analysis.js';
import { markNotRelated, getSettings, saveSettings } from './store.js';
import { getIssue } from './atlassian.js';

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

resolver.define('getSettings', async () => getSettings());
resolver.define('saveSettings', async (req) => saveSettings(req.payload || {}));

export const handler = resolver.getDefinitions();
