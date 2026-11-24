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
      <Stack space="space.050">
        <Heading size="large">Slice settings</Heading>
        <Text>Choose which projects hold patient-safety reports and how sensitive signal detection is.</Text>
      </Stack>
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
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
