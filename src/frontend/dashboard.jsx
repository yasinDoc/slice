import React, { useEffect, useState, useCallback } from 'react';
import ForgeReconciler, {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Strong,
  Lozenge,
  SectionMessage,
  Spinner,
  Button,
  Link,
  Badge,
  EmptyState,
  DynamicTable,
  StackBarChart,
  HorizontalBarChart,
  DonutChart,
  Tabs,
  Tab,
  TabList,
  TabPanel,
  xcss,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const card = xcss({
  padding: 'space.200',
  borderRadius: 'border.radius.200',
  backgroundColor: 'elevation.surface.raised',
  boxShadow: 'elevation.shadow.raised',
});
const tile = xcss({
  padding: 'space.200',
  borderRadius: 'border.radius.200',
  backgroundColor: 'color.background.neutral.subtle',
  borderColor: 'color.border',
  borderStyle: 'solid',
  borderWidth: 'border.width',
  minWidth: '160px',
});

const place = (loc) =>
  !loc ? '–' : loc.startsWith('ward-') ? `Ward ${loc.slice(5).toUpperCase()}` : loc.toUpperCase();

function Stat({ label, value, hint, appearance }) {
  return (
    <Box xcss={tile}>
      <Stack space="space.050">
        <Text size="small" color="color.text.subtle">
          {label}
        </Text>
        <Heading size="large">{String(value)}</Heading>
        {hint && <Lozenge appearance={appearance || 'default'}>{hint}</Lozenge>}
      </Stack>
    </Box>
  );
}

function SignalCard({ s, projectKey }) {
  const [state, setState] = useState({ busy: false });
  const publish = async () => {
    setState({ busy: true });
    try {
      const res = await invoke('publishBrief', { projectKey, signalId: s.id });
      setState({ busy: false, url: res.url, created: res.created });
    } catch (e) {
      setState({ busy: false, error: e.message || String(e) });
    }
  };
  return (
    <Box xcss={card}>
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center" shouldWrap>
          <Lozenge appearance="removed" isBold>
            Signal
          </Lozenge>
          <Strong>{s.title}</Strong>
          {s.harmCount > 0 && <Lozenge appearance="moved">{`${s.harmCount} reached the patient`}</Lozenge>}
        </Inline>
        <Inline space="space.100" shouldWrap>
          {s.layers.map((l) => (
            <Lozenge key={l.layer} appearance={l.holes > 0 ? 'removed' : 'success'}>
              {l.holes > 0 ? `${l.layer} ${l.holes}/${l.of}` : `${l.layer} held`}
            </Lozenge>
          ))}
        </Inline>
        <Text size="small" color="color.text.subtle">
          {`Top causes: ${s.layers.filter((l) => l.top).map((l) => l.top).join(' · ') || 'not recorded'}`}
        </Text>
        <Inline space="space.075" shouldWrap>
          {s.keys.map((k) => (
            <Link key={k} href={`/browse/${k}`}>
              {k}
            </Link>
          ))}
          <Text size="small" color="color.text.subtlest">{`${s.firstSeen} → ${s.lastSeen}`}</Text>
        </Inline>
        {s.actions?.length > 0 && (
          <Stack space="space.050">
            <Inline space="space.100" alignBlock="center" shouldWrap>
              <Text size="small">
                <Strong>Actions:</Strong>
              </Text>
              {s.actions.map((a) => (
                <Inline key={a.key} space="space.050" alignBlock="center">
                  <Link href={`/browse/${a.key}`}>{a.key}</Link>
                  <Lozenge appearance={a.done ? 'success' : 'inprogress'}>{a.status}</Lozenge>
                  {a.strength && <Lozenge>{a.strength}</Lozenge>}
                </Inline>
              ))}
            </Inline>
            {s.impact && (
              <Text size="small" color={s.impact.verdict === 'fewer' ? 'color.text.success' : s.impact.verdict === 'more' ? 'color.text.danger' : 'color.text.subtle'}>
                {`Did it work? ${s.impact.text}`}
              </Text>
            )}
          </Stack>
        )}
        <Inline space="space.100" alignBlock="center" shouldWrap>
          {state.url ? (
            <Link href={state.url} openNewTab>
              {state.created ? 'Brief published in Confluence ↗' : 'Open existing brief in Confluence ↗'}
            </Link>
          ) : (
            <Button spacing="compact" onClick={publish} isDisabled={state.busy}>
              {state.busy ? 'Publishing…' : 'Publish brief to Confluence'}
            </Button>
          )}
          {state.error && <Text color="color.text.danger">{state.error}</Text>}
        </Inline>
      </Stack>
    </Box>
  );
}

function App() {
  const context = useProductContext();
  const projectKey = context?.extension?.project?.key;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await invoke('getDashboard', { projectKey }));
    } catch (e) {
      setError(e.message || String(e));
    }
  }, [projectKey]);

  useEffect(() => {
    if (projectKey) load();
  }, [projectKey, load]);

  const run = (name) => async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await invoke(name);
      if (name === 'loadDemo') {
        setNotice(
          `Demo data ready: ${res.reports.created} reports created (${res.reports.skipped} already there). ` +
            (res.protocols.error
              ? `Protocol pages skipped: ${res.protocols.error}`
              : `${res.protocols.created} protocol pages in Confluence space ${res.protocols.space}.`)
        );
      }
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const reindex = run('reindexAll');
  const loadDemo = run('loadDemo');

  if (error && !data)
    return (
      <SectionMessage appearance="error" title="Slice could not load the dashboard">
        <Text>{error}</Text>
      </SectionMessage>
    );
  if (!data) return <Spinner label="Stacking the slices" size="large" />;

  if (!data.configured)
    return (
      <EmptyState
        header="Slice isn't watching this project"
        description={`Slice analyses safety reports in: ${data.projectKeys.join(', ')}. A Jira admin can add ${data.projectKey} in Apps → Slice settings.`}
      />
    );

  const t = data.totals;
  return (
    <Stack space="space.300">
      <Stack space="space.050">
        <Heading size="xlarge">Slice · patient safety signals</Heading>
        <Text color="color.text.subtle">
          {`Where the Swiss cheese holes are lining up in ${data.projectKey}, over the last ${data.windowDays} days. Blame-free pattern detection for safety learning; not clinical advice.`}
        </Text>
      </Stack>

      <Inline space="space.200" shouldWrap>
        <Stat label="Reports (window)" value={t.reports} hint={`${t.allTime} all time`} />
        <Stat label="Active signals" value={t.signals} hint={t.signals ? 'needs review' : 'all clear'} appearance={t.signals ? 'removed' : 'success'} />
        <Stat label="Near-misses caught" value={t.nearMiss} hint="the slice held" appearance="success" />
        <Stat label="Reached the patient" value={t.reachedPatient} hint={t.reachedPatient ? 'review first' : 'none'} appearance={t.reachedPatient ? 'moved' : 'success'} />
        <Stat label="Identifiers redacted" value={t.redactions} hint="never stored" appearance="inprogress" />
      </Inline>

      <Tabs id="slice-tabs">
        <TabList>
          <Tab>{`Signals (${data.signals.length})`}</Tab>
          <Tab>Swiss cheese</Tab>
          <Tab>Trends</Tab>
          <Tab>Latest reports</Tab>
        </TabList>

        <TabPanel>
          <Box paddingBlock="space.200">
            {data.signals.length ? (
              <Stack space="space.200">
                {data.signals.map((s) => (
                  <SignalCard key={s.id} s={s} projectKey={data.projectKey} />
                ))}
                <Text size="small" color="color.text.subtle">
                  Open any report and ask the Slice agent in Rovo to "draft an RCA" for the full investigation.
                </Text>
              </Stack>
            ) : (
              <EmptyState header="No signals right now" description="No group of similar reports has reached the threshold. Slice keeps watching every new report." />
            )}
          </Box>
        </TabPanel>

        <TabPanel>
          <Box paddingBlock="space.200">
            <Stack space="space.300">
              <Text>
                Each report is mapped onto Reason's four defensive layers. A <Strong>hole</Strong> means a contributing
                factor in that layer. When the same holes keep appearing, they line up, and the next one may reach a patient.
              </Text>
              <HorizontalBarChart
                title="Reports with a hole in each layer"
                data={data.layers}
                xAccessor="layer"
                yAccessor="holes"
                colorAccessor="layer"
              />
              {data.topFactors.length > 0 && (
                <HorizontalBarChart
                  title="Most frequent contributing factors"
                  data={data.topFactors}
                  xAccessor="factor"
                  yAccessor="count"
                />
              )}
              {data.defences.length > 0 && (
                <HorizontalBarChart
                  title="The slices that held (what caught the error)"
                  data={data.defences}
                  xAccessor="defence"
                  yAccessor="count"
                />
              )}
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel>
          <Box paddingBlock="space.200">
            <Stack space="space.300">
              <StackBarChart
                title="Reports per week"
                subtitle="Near-misses vs reports where harm reached the patient"
                data={data.weekly}
                xAccessor="week"
                yAccessor="count"
                colorAccessor="type"
              />
              <Inline space="space.300" shouldWrap>
                {data.categories.length > 0 && (
                  <DonutChart
                    title="By category"
                    data={data.categories}
                    labelAccessor="category"
                    valueAccessor="count"
                    colorAccessor="category"
                  />
                )}
                {data.locations.length > 0 && (
                  <HorizontalBarChart
                    title="Hotspots"
                    data={data.locations.map((l) => ({ ...l, location: place(l.location) }))}
                    xAccessor="location"
                    yAccessor="count"
                  />
                )}
              </Inline>
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel>
          <Box paddingBlock="space.200">
            <DynamicTable
              head={{
                cells: [
                  { key: 'key', content: 'Report' },
                  { key: 'date', content: 'Event date' },
                  { key: 'summary', content: 'Summary (redacted)' },
                  { key: 'category', content: 'Category' },
                  { key: 'where', content: 'Where' },
                  { key: 'outcome', content: 'Outcome' },
                ],
              }}
              rows={data.latest.map((r) => ({
                key: r.key,
                cells: [
                  { key: 'key', content: <Link href={`/browse/${r.key}`}>{r.key}</Link> },
                  { key: 'date', content: r.date },
                  { key: 'summary', content: r.summary },
                  { key: 'category', content: r.category },
                  { key: 'where', content: place(r.location) },
                  {
                    key: 'outcome',
                    content: <Lozenge appearance={r.outcome === 'near-miss' ? 'success' : 'removed'}>{r.outcome}</Lozenge>,
                  },
                ],
              }))}
            />
          </Box>
        </TabPanel>
      </Tabs>

      {notice && (
        <SectionMessage appearance="success">
          <Text>{notice}</Text>
        </SectionMessage>
      )}
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Button onClick={load} isDisabled={busy}>
          Refresh
        </Button>
        <Button appearance="subtle" onClick={reindex} isDisabled={busy}>
          {busy ? 'Working…' : 'Re-index all reports'}
        </Button>
        {data.isAdmin && (
          <Button appearance="subtle" onClick={loadDemo} isDisabled={busy}>
            Load demo data
          </Button>
        )}
        {error && <Text color="color.text.danger">{error}</Text>}
        <Badge>{`as of ${data.asOf}`}</Badge>
      </Inline>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
