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
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const CATEGORY = {
  infusion: 'Infusion / IV pump',
  medication: 'Medication',
  specimen: 'Specimen labelling',
  identification: 'Patient ID',
  falls: 'Falls',
  handover: 'Handover',
  equipment: 'Equipment',
  procedure: 'Procedure',
  diagnostic: 'Diagnostic',
  other: 'Other',
};

const place = (loc) =>
  !loc ? null : loc.startsWith('ward-') ? `Ward ${loc.slice(5).toUpperCase()}` : loc.toUpperCase();

function Slices({ slices, title }) {
  return (
    <Stack space="space.150">
      <Text>
        <Strong>{title}</Strong>
      </Text>
      <Text size="small" color="color.text.subtle">
        Red = a hole in that defensive layer. Green = the layer held.
      </Text>
      {slices.map((l) => (
        <Stack key={l.layer} space="space.025">
          <Inline space="space.100" alignBlock="center">
            <Lozenge appearance={l.holes > 0 ? 'removed' : 'success'} isBold={l.holes > 0}>
              {l.short}
            </Lozenge>
            {l.of > 1 && <Text size="small" color="color.text.subtle">{`${l.holes}/${l.of} reports`}</Text>}
          </Inline>
          <Text size="small">
            {l.holes > 0
              ? l.factors.map((f) => (l.of > 1 ? `${f.label} (${f.count})` : f.label)).join(' · ')
              : 'No hole found in this layer'}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

function App() {
  const context = useProductContext();
  const issueKey = context?.extension?.issue?.key;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState({});

  const call = useCallback(
    async (name, extra = {}) => {
      setBusy(true);
      setError(null);
      try {
        const res = await invoke(name, { issueKey, ...extra });
        if (res && res.indexed !== undefined) {
          setData(await invoke('getPanel', { issueKey }));
        } else {
          setData(res);
        }
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    },
    [issueKey]
  );

  useEffect(() => {
    if (issueKey) call('getPanel');
  }, [issueKey, call]);

  if (!issueKey || (!data && !error)) return <Spinner label="Reading the slices" />;
  if (error && !data)
    return (
      <SectionMessage appearance="error" title="Slice could not analyse this report">
        <Text>{error}</Text>
      </SectionMessage>
    );

  if (data.notWatched)
    return (
      <Text size="small" color="color.text.subtle">
        {`Slice only analyses safety-report projects. ${data.projectKey} isn't one. A Jira admin can add it in Slice settings.`}
      </Text>
    );

  if (data.actionItem)
    return (
      <SectionMessage appearance="information" title="Slice action item">
        <Text>
          {data.from ? `This is a ${data.strength || ''} system fix raised from safety report ${data.from}. ` : 'This is a system fix raised by Slice. '}
          It is tracked on the Slice safety signals dashboard, which shows whether the pattern recurs less once it's done.
        </Text>
        {data.from && <Link href={`/browse/${data.from}`}>{`Open ${data.from}`}</Link>}
      </SectionMessage>
    );

  const { record, similar, signal, slices, ownSlices, protocols } = data;
  const recommendations = data.recommendations || [];
  const done = { ...(data.existingActions || {}), ...created };
  const stale = protocols.filter((p) => p.stale);

  return (
    <Stack space="space.200">
      {signal ? (
        <SectionMessage appearance="warning" title={`Signal: ${signal.title}`}>
          <Text>
            The holes are lining up. This report is one of {signal.count} similar reports
            {signal.harmCount ? `, ${signal.harmCount} of which reached the patient` : ''}. Review the
            fixes below, or publish a brief for the safety committee from the Slice safety signals page.
          </Text>
        </SectionMessage>
      ) : similar.length ? (
        <SectionMessage appearance="information" title={`${similar.length} similar report${similar.length > 1 ? 's' : ''} found`}>
          <Text>Not a signal yet. Slice will alert you if more arrive.</Text>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="success" title="No similar reports yet">
          <Text>This looks like a first report. Thank you for the good catch.</Text>
        </SectionMessage>
      )}

      {data.support && (
        <SectionMessage appearance="information" title="Looking after the team">
          <Text>
            This incident reached the patient. If you were involved, it is normal to feel affected, and
            you are not alone. Slice looks at systems, never individuals.
          </Text>
          {data.support.url ? (
            <Link href={data.support.url} openNewTab>
              Staff support and wellbeing
            </Link>
          ) : (
            <Text size="small" color="color.text.subtle">
              Talk to your line manager or occupational health. An admin can add a support link in Slice settings.
            </Text>
          )}
        </SectionMessage>
      )}

      <Inline space="space.100" shouldWrap>
        {record.language === 'bn' && <Lozenge appearance="inprogress">বাংলা</Lozenge>}
        <Lozenge appearance="new">{CATEGORY[record.category] || record.category}</Lozenge>
        {place(record.location) && <Lozenge>{place(record.location)}</Lozenge>}
        {record.device && <Lozenge>{record.device}</Lozenge>}
        {record.drug && <Lozenge>{record.drug}</Lozenge>}
        {record.shift && <Lozenge>{record.shift} shift</Lozenge>}
        <Lozenge appearance={record.outcome === 'near-miss' ? 'success' : record.outcome === 'no-harm' ? 'moved' : 'removed'}>{record.outcome}</Lozenge>
        {record.redactions > 0 && <Badge appearance="primary">{`${record.redactions} identifiers redacted`}</Badge>}
      </Inline>

      <Slices slices={similar.length ? slices : ownSlices} title={similar.length ? `Swiss cheese across ${similar.length + 1} similar reports` : 'Swiss cheese layers in this report'} />

      {record.defences.length > 0 && (
        <Text>
          <Strong>The slice that held: </Strong>
          {record.defences.join(', ')}
        </Text>
      )}

      {recommendations.length > 0 && (
        <Stack space="space.100">
          <Heading size="small">Recommended system fixes</Heading>
          <Text size="small" color="color.text.subtle">
            Strongest first (action hierarchy). Create a linked action item once your safety lead agrees.
          </Text>
          {recommendations.map((r) => (
            <Stack key={r.text} space="space.050">
              <Inline space="space.100" alignBlock="center">
                <Lozenge appearance={r.strength === 'strong' ? 'success' : r.strength === 'intermediate' ? 'inprogress' : 'default'}>
                  {r.strength}
                </Lozenge>
                <Text size="small" color="color.text.subtlest">{`addresses: ${r.addresses}`}</Text>
              </Inline>
              <Text>{r.text}</Text>
              {done[r.text] ? (
                <Link href={`/browse/${done[r.text]}`}>{`Created ${done[r.text]}`}</Link>
              ) : (
                <Inline>
                <Button
                  spacing="compact"
                  isDisabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const res = await invoke('createAction', { issueKey, text: r.text, strength: r.strength, addresses: r.addresses });
                      setCreated((c) => ({ ...c, [r.text]: res.created }));
                    } catch (e) {
                      setError(e.message || String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Create action
                </Button>
                </Inline>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      {similar.length > 0 && (
        <Stack space="space.100">
          <Heading size="small">Similar reports</Heading>
          {similar.map((s) => (
            <Box key={s.key}>
              <Inline space="space.100" alignBlock="center" shouldWrap>
                <Link href={`/browse/${s.key}`}>{s.key}</Link>
                <Text>{s.date}</Text>
                <Badge>{`${Math.round(s.score * 100)}%`}</Badge>
                <Button appearance="subtle" spacing="compact" isDisabled={busy} onClick={() => call('notRelated', { otherKey: s.key })}>
                  Not related
                </Button>
              </Inline>
              <Text>{s.summary}</Text>
              <Text size="small" color="color.text.subtlest">
                {s.reasons.join(' · ')}
              </Text>
            </Box>
          ))}
        </Stack>
      )}

      {protocols.length > 0 && (
        <Stack space="space.100">
          <Heading size="small">Protocols</Heading>
          {protocols.map((p) => (
            <Inline key={p.title} space="space.100" alignBlock="center" shouldWrap>
              {p.url ? <Link href={p.url}>{p.title}</Link> : <Text>{p.title}</Text>}
              {p.stale === true && <Lozenge appearance="moved">{`stale · ${p.ageMonths} months`}</Lozenge>}
              {p.stale === false && <Lozenge appearance="success">current</Lozenge>}
            </Inline>
          ))}
          {stale.length > 0 && <Text>A related protocol has not been reviewed in over 24 months.</Text>}
        </Stack>
      )}

      <Inline space="space.100">
        <Button isDisabled={busy} onClick={() => call('refresh')}>
          Re-analyse
        </Button>
        <Button appearance="subtle" isDisabled={busy} onClick={() => call('reindexAll')}>
          Index all past reports
        </Button>
      </Inline>
      {error && <Text color="color.text.danger">{error}</Text>}
      <Text size="small" color="color.text.subtlest">
        Blame-free pattern detection for safety learning. Not clinical advice.
      </Text>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
