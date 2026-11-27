import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Stack,
  Inline,
  Heading,
  Text,
  Textfield,
  Toggle,
  Label,
  HelperMessage,
  Button,
  SectionMessage,
  Spinner,
} from '@forge/react';
import { invoke } from '@forge/bridge';

function App() {
  const [form, setForm] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    invoke('getSettings')
      .then(({ settings, isAdmin }) => {
        setIsAdmin(isAdmin);
        setForm({ ...settings, projectKeys: settings.projectKeys.join(', ') });
      })
      .catch((e) => setMsg({ type: 'error', text: e.message }));
  }, []);

  if (!form) return msg ? <SectionMessage appearance="error"><Text>{msg.text}</Text></SectionMessage> : <Spinner />;

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { settings } = await invoke('saveSettings', {
        projectKeys: form.projectKeys,
        minSignalCount: Number(form.minSignalCount),
        windowDays: Number(form.windowDays),
        commentOnSignal: form.commentOnSignal,
        thankReporters: form.thankReporters,
        supportNote: form.supportNote,
        supportUrl: form.supportUrl || '',
      });
      setForm({ ...settings, projectKeys: settings.projectKeys.join(', ') });
      setMsg({ type: 'success', text: 'Saved. Open the Slice dashboard and click "Re-index all reports" to apply new projects.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack space="space.300">
      <Text>Choose which projects hold patient-safety reports and how sensitive signal detection is.</Text>
      {!isAdmin && (
        <SectionMessage appearance="warning" title="Read only">
          <Text>Only Jira administrators can change these settings.</Text>
        </SectionMessage>
      )}

      <Stack space="space.100">
        <Label labelFor="projectKeys">Safety report projects</Label>
        <Textfield id="projectKeys" value={form.projectKeys} onChange={set('projectKeys')} isDisabled={!isAdmin} />
        <HelperMessage>Comma-separated project keys, e.g. SAFE, ICU_SAFETY</HelperMessage>
      </Stack>

      <Inline space="space.300">
        <Stack space="space.100">
          <Label labelFor="minSignalCount">Reports per signal</Label>
          <Textfield id="minSignalCount" type="number" value={String(form.minSignalCount)} onChange={set('minSignalCount')} isDisabled={!isAdmin} />
          <HelperMessage>2–20. Lower means earlier, noisier alerts.</HelperMessage>
        </Stack>
        <Stack space="space.100">
          <Label labelFor="windowDays">Look-back window (days)</Label>
          <Textfield id="windowDays" type="number" value={String(form.windowDays)} onChange={set('windowDays')} isDisabled={!isAdmin} />
          <HelperMessage>14–365</HelperMessage>
        </Stack>
      </Inline>

      <Inline space="space.100" alignBlock="center">
        <Toggle id="commentOnSignal" isChecked={form.commentOnSignal} onChange={() => setForm({ ...form, commentOnSignal: !form.commentOnSignal })} isDisabled={!isAdmin} />
        <Label labelFor="commentOnSignal">Comment on a report when it joins a signal</Label>
      </Inline>

      <Inline space="space.100" alignBlock="center">
        <Toggle id="thankReporters" isChecked={form.thankReporters} onChange={() => setForm({ ...form, thankReporters: !form.thankReporters })} isDisabled={!isAdmin} />
        <Label labelFor="thankReporters">Thank reporters when a fix from their pattern is done</Label>
      </Inline>

      <Inline space="space.100" alignBlock="center">
        <Toggle id="supportNote" isChecked={form.supportNote} onChange={() => setForm({ ...form, supportNote: !form.supportNote })} isDisabled={!isAdmin} />
        <Label labelFor="supportNote">Show a staff support note on reports where harm reached the patient</Label>
      </Inline>

      <Stack space="space.100">
        <Label labelFor="supportUrl">Staff support link (optional)</Label>
        <Textfield id="supportUrl" value={form.supportUrl || ''} onChange={set('supportUrl')} isDisabled={!isAdmin} placeholder="https://intranet.example.org/staff-wellbeing" />
        <HelperMessage>Your organisation's wellbeing or peer-support page. Must start with https://</HelperMessage>
      </Stack>

      {msg && (
        <SectionMessage appearance={msg.type}>
          <Text>{msg.text}</Text>
        </SectionMessage>
      )}
      <Inline>
        <Button appearance="primary" onClick={save} isDisabled={!isAdmin || busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </Button>
      </Inline>

      <Stack space="space.100">
        <Heading size="medium">Demo data</Heading>
        <Text>
          {`Creates 34 synthetic near-miss reports (fictional devices, no real patients) in ${form.projectKeys.split(',')[0].trim()}, and a "Clinical Protocols" Confluence space with 4 protocol pages, two of them overdue for review. Safe to run twice: nothing is duplicated.`}
        </Text>
        {demo && (
          <SectionMessage appearance={demo.error ? 'error' : 'success'}>
            <Text>
              {demo.error
                ? demo.error
                : `Reports created: ${demo.reports.created} (already there: ${demo.reports.skipped}). ` +
                  (demo.protocols.error
                    ? `Protocol pages skipped: ${demo.protocols.error}`
                    : `Protocol pages created: ${demo.protocols.created} in space ${demo.protocols.space}. `) +
                  `Indexed ${demo.indexed} reports. Open the project's "Slice safety signals" page.`}
            </Text>
          </SectionMessage>
        )}
        <Inline>
          <Button
            onClick={async () => {
              setBusy(true);
              setDemo(null);
              try {
                setDemo(await invoke('loadDemo'));
              } catch (e) {
                setDemo({ error: e.message });
              } finally {
                setBusy(false);
              }
            }}
            isDisabled={!isAdmin || busy}
          >
            {busy ? 'Working…' : 'Load demo data'}
          </Button>
        </Inline>
      </Stack>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
