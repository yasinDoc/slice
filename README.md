<p align="center"><img src="assets/slice-icon.svg" width="80" alt="Slice logo: four cheese slices with the holes lined up"></p>

<h1 align="center">Slice</h1>

<p align="center"><b>Hospital near-misses, connected before the holes line up.</b><br>
A patient-safety learning app for Jira, Confluence and Rovo, built on Atlassian Forge.</p>

---

Most harm to patients in hospital shows up first as a **near-miss**: an error caught in time.
Staff report them, but each report is reviewed alone. When the same failure finally harms
someone, the investigation finds the earlier warnings, filed weeks apart in different words.

James Reason's **Swiss cheese model** says every safety system is a stack of defensive layers.
Each has holes, and harm happens when the holes line up. **Slice reads every near-miss report,
works out which layers had holes, and tells you when the same holes keep appearing.**

> 🧀 *Slice signal: 5 infusion / IV pump reports involving VitaFlow 300 in Ward 6 in 78 days.*
> *Preconditions 5/5 (confusing device interface, interruption, fatigue) · Unsafe acts 5/5 (wrong rate).*
> *The slice that held: smart-pump dose limit ×3. The related protocol was last reviewed 56 months ago.*

Codegeist 2026 entry · **Apps for Specialized Industries (healthcare)** · bonus tracks:
**Best Agents** (Rovo agent, actions and skill) and **Best MCP** (`rovo:mcp`).

## What it does

| | |
|---|---|
| 🔒 **Redacts first** | Names, MRNs, DOB, phone numbers, emails and bed numbers are removed before anything is stored |
| 🏷️ **Understands the report** | Category, ward, device model, drug, shift, outcome, contributing factors, and the defence that caught it |
| 🧀 **Slices it** | Maps factors onto Reason's layers: organisation, supervision, preconditions, unsafe acts |
| 🔗 **Connects the dots** | Explainable similarity ("same device model · same ward · night shift") and automatic **signals** |
| 📄 **Checks protocols** | Finds Confluence pages labelled `protocol` and flags any not reviewed in 24 months |
| 🤖 **Drafts the RCA** | The Rovo agent writes a blame-free root cause analysis, with fixes ranked strong → weak |
| ✅ **Turns it into work** | After a human approves, it creates linked Jira action items |

### Principles
- **Blame-free.** Slice looks at systems, never individuals. The agent refuses to rank staff.
- **No patient data stored.** Only redacted text and facets go into Forge storage.
- **Runs on Atlassian.** No external egress. Pattern detection is deterministic and explainable.
- **Humans decide.** Slice drafts. People approve.
- **Not clinical decision support.** It is for safety learning and quality improvement only.

## Forge modules

| Module | Purpose |
|---|---|
| `rovo:agent` **Slice** | Conversational safety analyst |
| `action` × 6 | `find-similar-reports`, `get-safety-signals`, `explain-slices`, `find-protocols`, `draft-rca`, `create-safety-action` |
| `rovo:skill` **safety-rca** | Reusable RCA write-up method that other agents can use |
| `rovo:mcp` | The five read-only tools, for Claude, Cursor and other MCP clients |
| `jira:issuePanel` (UI Kit) | Signal banner, Swiss cheese layers, similar reports, protocol staleness |
| `trigger` | Indexes reports on create and update; comments once per new or growing signal |

See [docs/DESIGN.md](docs/DESIGN.md) for the architecture, data model and scoring.

## Try the engine in 10 seconds (no Atlassian site needed)

```bash
npm install
npm run demo        # signals plus a sample RCA from 34 synthetic reports
npm test            # unit tests for redaction, extraction, similarity, signals and RCA
```

## Install on your Atlassian site

Prerequisites: Node 22, the [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/)
(`npm i -g @forge/cli`, then `forge login`), and a developer site with Jira, Confluence and Rovo.

```bash
npm install
forge register          # writes your own app.id into manifest.yml
forge deploy
forge install --product jira --site your-site.atlassian.net
forge install --product confluence --site your-site.atlassian.net --upgrade
```

1. Create a Jira project with the key **`SAFE`**, the default safety project.
2. Optionally, create a Confluence space for protocols, for example `SAFE`.
3. Load the synthetic demo data:
   ```bash
   JIRA_BASE_URL=https://your-site.atlassian.net JIRA_EMAIL=you@example.com \
   JIRA_API_TOKEN=xxxx SLICE_PROJECT=SAFE SLICE_SPACE=SAFE npm run seed
   ```
4. Open any `SAFE` issue, find the **Slice · safety signals** panel, and click **Index all past reports**.
5. In Rovo chat, pick the **Slice** agent and ask *"What safety signals are emerging this month?"*

## Project layout

```
manifest.yml            Forge modules and permissions
src/engine/             Pure, unit-tested logic (redaction, lexicon, similarity, signals, RCA)
src/analysis.js         Glue between Atlassian data, storage and the engine
src/actions.js          Rovo action handlers
src/triggers.js         Issue event handler (index and signal alert)
src/resolvers.js        Issue panel backend
src/frontend/index.jsx  Issue panel (UI Kit)
prompts/slice-agent.md  Agent instructions
skills/safety-rca/      Rovo skill
src/demo-data.js        Synthetic reports and protocols (fictional devices, no real patients)
scripts/                demo.js (offline) and seed.js (loads a dev site)
```

## Roadmap

- Assignable investigator: assign a report to Slice in Jira (`rovo:agentConnector`)
- A Confluence "Safety signal" page generated per signal
- Teamwork Graph links between reports, protocols, wards and actions
- Trend view: did the fix reduce repeat reports?

## Disclaimer

Slice supports patient-safety learning and quality improvement. It is not a medical device
and does not provide clinical advice. All demo data is synthetic.

## License

MIT
