# Slice: design

> Most harm in hospitals shows up first as a near-miss that nobody connected to the others.
> Slice connects them.

## 1. The problem

Hospitals ask staff to report near-misses: errors caught before they reached a patient,
or that caused no harm. Each report is reviewed on its own. When the same failure finally
does harm a patient, the investigation usually finds earlier reports of the same thing.
They were filed in different weeks, by different people, in slightly different words.

James Reason's **Swiss cheese model** explains why. Every safety system is a stack of
defensive layers (the "slices"). Each layer has holes, and harm happens when the holes in
every layer line up. Near-miss reports show where the holes are, but only if someone
reads them side by side.

## 2. What Slice does

| Step | What happens | Where |
|---|---|---|
| **Capture** | Staff file a near-miss as a Jira or JSM work item in the safety project (`SAFE` by default) | Jira / JSM |
| **Protect** | Patient identifiers (names, MRNs, DOB, phone, email, bed numbers) are redacted before anything is stored | `src/engine/redact.js` |
| **Understand** | Each report is turned into facets: category, location, device, drug, shift, contributing factors, and the defence that caught it | `src/engine/extract.js` |
| **Slice** | Contributing factors are mapped onto Reason's four layers: organisation, supervision, preconditions, unsafe acts | `src/engine/lexicon.js` |
| **Connect** | Each new report is compared with the history and grouped into signals ("4th pump-rate error on Ward 6 in 30 days") | `src/engine/similarity.js`, `signals.js` |
| **Check protocols** | Matching Confluence protocols are found and flagged if their review date is more than 24 months old | `src/engine/rca.js` |
| **Investigate** | Rovo drafts a root cause analysis with system-level fixes ranked by strength (hierarchy of controls) | Rovo agent + `draft-rca` |
| **Act** | After a human approves, Slice creates linked Jira action items (panel button or Rovo) | `createAction`, `create-safety-action` |
| **Oversee** | Project dashboard: signals, Swiss cheese profile, top causes, defences that held, weekly trend | `jira:projectPage`, `src/engine/dashboard.js` |

## 3. Principles

1. **Blame-free.** Slice looks for system causes. It never ranks, scores or names individuals.
   The agent prompt forbids it.
2. **Humans decide.** Slice drafts and suggests. People approve every change. The only
   automatic write is a signal comment with a label, and that can be switched off.
3. **No patient data stored.** Redaction runs before storage. Only redacted text and
   facets are kept in Forge storage.
4. **Runs on Atlassian.** No external egress. The pattern engine is deterministic and
   explainable, and runs inside Forge. All language generation goes through Rovo.
5. **Not clinical decision support.** Slice supports safety learning and quality
   improvement. It does not advise on the care of individual patients.
6. **Explainable.** Every match shows its reasons ("same device · same ward · night shift").

## 4. Architecture

```
 Jira / JSM work item (SAFE project)
        │ avi:jira:created|updated:issue
        ▼
 trigger ──▶ indexer: redact → extract → store record (Forge KVS)
                        │
                        ▼
              signal check ──▶ (optional) comment + label "slice-signal"

 Rovo agent "Slice" ─┐
 Rovo skill safety-rca┼──▶ action modules ──▶ engine (pure JS) ◀── KVS records
 rovo:mcp (external) ─┘                         │
                                                └──▶ Confluence CQL (protocols)
 Jira issue panel / project dashboard / admin settings (UI Kit) ──▶ resolver ──▶ same engine
```

The engine (`src/engine/*`) is pure JavaScript with no Forge imports, so it is unit-tested
with `node --test`.

### Data model (KVS)

| Key | Value |
|---|---|
| `report:<ISSUE-KEY>` | `{ key, summary, text, eventDate, category, location, device, deviceModel, drug, shift, outcome, factors[], defences[], tokens[], redactions }`, all redacted |
| `alert:<signalId>` | `{ keys[], count, at }`: reports already alerted for this signal (one comment per report) |
| `settings` | `{ projectKeys: ["SAFE"], commentOnSignal: true, minSignalCount: 3, windowDays: 90 }` |
| `feedback:<ISSUE-KEY>` | `{ helpful, notRelated[] }`, used to suppress wrong matches |

### Similarity

The score between two reports is a weighted sum (weights in `similarity.js`):

| Facet | Weight |
|---|---|
| category | 0.30 |
| device (model match counts in full; a generic device type counts 60%) | 0.20 |
| location | 0.15 |
| drug | 0.10 |
| contributing factors (Jaccard) | 0.10 |
| shift | 0.05 |
| text (term cosine) | 0.10 |

A report counts as "similar" at a score of 0.45 or more. A **signal** is three or more
similar reports within 90 days that share a category and a location, device or drug.

### Recommendation strength

The strength levels follow the action hierarchy used in safety science (strongest first):

- **Strong:** forcing functions, physical redesign, removing the hazard.
  Examples: separate storage, smart-pump hard limits.
- **Intermediate:** standardisation, checklists, redundancy.
  Examples: an independent double check, barcode scanning.
- **Weak:** training, a new policy, warnings.

Slice always suggests at least one strong or intermediate action before any weak one.

## 5. Bonus-prize mapping

| Bonus | Module |
|---|---|
| Best Agents | `rovo:agent` Slice, plus reusable `action` modules and the `rovo:skill` safety-rca |
| Best MCP | `rovo:mcp` exposes the read-only safety tools to external MCP clients |
| Teamwork Graph | Planned: links reports, protocols, wards and actions in the graph |
| Marketplace | The no-egress, no-PHI design is built with a listing in mind |

## 6. Roadmap

- [x] Engine: redaction, extraction, Swiss cheese layers, similarity, signals, RCA draft
- [x] Forge: trigger indexing, Rovo agent, actions, skill, MCP, issue panel
- [x] Synthetic seed data with deliberate clusters
- [x] Project dashboard, admin settings (admin-only, validated), one-click demo data
- [x] Recommended fixes with one-click linked action items in the panel
- [ ] Assignable investigator (`rovo:agentConnector`, which needs a remote A2A service)
- [ ] Confluence "Safety signal" report page per signal
- [ ] Teamwork Graph objects for reports and protocols
- [ ] Before/after view: did a fix reduce repeat reports in that pattern?
- [ ] Feedback-driven tuning of similarity weights
