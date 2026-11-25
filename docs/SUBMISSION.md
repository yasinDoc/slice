# Slice: Codegeist 2026 submission kit

Everything needed for the Devpost form, the demo video and the judges' test run.

---

## 1. Devpost form

**Project name:** Slice

**Tagline (≤ 60 chars):** Hospital near-misses, connected before the holes line up

**Category:** Apps for Specialized Industries (healthcare)

**Bonus prizes:**
- **Best Agents:** `rovo:agent` "Slice", seven reusable `action` modules, and a reusable `rovo:skill` (safety-rca)
- **Best app with Atlassian MCP:** `rovo:mcp` exposes the five read-only safety tools to external MCP clients
- *(Optional)* **Marketplace:** add the listing or review-ticket link here if you submit it

### Inspiration
Most harm to patients in hospital shows up first as a near-miss: a wrong pump rate caught by a second
nurse, a mislabelled blood tube rejected by the lab. Hospitals ask staff to report these. But each
report is reviewed on its own, so when the same failure finally reaches a patient, the investigation
finds the earlier warnings, filed weeks apart in different words. The organisation had the
knowledge. Nothing connected it.

### What it does
Slice turns Jira (or Jira Service Management) into a patient-safety learning system:

1. **Redacts first.** Patient names, record numbers, dates of birth, phone numbers, emails and bed
   numbers are removed before anything is stored.
2. **Understands each report:** category, ward, device model, drug, shift, outcome, contributing
   factors, and which defence caught the error.
3. **Slices it** onto James Reason's Swiss cheese model: organisation, supervision, preconditions,
   unsafe acts.
4. **Connects the dots.** An explainable similarity score finds related reports and raises
   **signals**, for example *"6 infusion / IV pump reports involving VitaFlow 300 in Ward 6 in 83
   days"*. When a new report joins a signal, Slice comments on it in Jira.
5. **Checks protocols** in Confluence and flags any that are overdue for review.
6. **Recommends fixes**, ranked by the safety "action hierarchy": strong fixes like smart-pump hard
   limits come before weak ones like more training. One click turns a fix into a linked Jira action item.
7. **Closes the loop.** Every signal tracks the action items created from it, their live Jira
   status, and whether the pattern recurred less after the first action ("did it work?").
8. **Briefs the safety committee.** One click publishes a Confluence "safety signal brief" with the
   evidence, the Swiss cheese layers, the defences that held, ranked fixes, overdue protocols, a timeline
   linked back to Jira, and a decision checklist.
9. **Shows the big picture** on a project dashboard: active signals, where the holes are, top
   causes, the safeguards that held, and the weekly trend.
10. **Investigates with Rovo.** The Slice agent answers "what's emerging?" and drafts a blame-free
   root cause analysis. The same tools are available to any MCP client.

### How we built it
- **Forge** app, written in JavaScript with UI Kit. Modules: `jira:issuePanel`, `jira:projectPage`,
  `jira:adminPage`, `trigger` (issue created, updated, deleted), `rovo:agent`, `action` ×7,
  `rovo:skill`, `rovo:mcp`.
- **A deterministic, explainable engine** (`src/engine/`): a safety-domain lexicon, a redaction
  layer, weighted similarity (category, device, location, drug, factors, shift, text), signal
  detection, a Swiss cheese layer profile, and fixes ranked by the action hierarchy. Every match
  shows its reasons, so a safety lead can trust it or argue with it.
- **Rovo does the language work.** The agent prompt and skill enforce blame-free, cite-every-claim
  answers that don't give clinical advice.
- **Runs on Atlassian.** There are no external calls. Data stays in Forge storage, and Atlassian
  reports the deployed app as eligible for Runs on Atlassian.
- **Permission-aware.** Users only see reports they can already open in Jira. Settings and demo
  data are restricted to admins.
- **Tests.** There are 37 tests: engine unit tests, Forge integration tests against mocked Jira,
  Confluence and storage, and tests for the demo loader.

### Challenges
- **Getting a safety system right is about trust.** Slice never ranks or names individuals, always
  shows evidence, and asks before changing anything.
- **Stored data must never contain identifiers**, so redaction runs before storage and is tested.
- **The live site found bugs that mocks didn't**: storage-key rules, a search that broke when a
  report was deleted, and alerts after retried events. Each one now has a regression test.

### Accomplishments
- The whole chain works end to end on a live site. A nurse files a report, Slice links it to five
  earlier ones, shows where the holes line up, flags a protocol that is 56 months overdue, and
  turns the strongest fix into a Jira task.
- A judge can set up the demo with one click. **Load demo data** creates the reports and a Confluence
  protocol space, with no API token or terminal.

### What we learned
Near-miss data is the cheapest safety data a hospital has. Its value comes almost entirely from
connecting reports, which is exactly what Atlassian's system of work is good at.

### What's next
- Assign a report to Slice in Jira and have it run the whole investigation (`rovo:agentConnector`)
- Teamwork Graph links between reports, protocols, wards and actions
- Richer outcome tracking: harm-weighted trends and statistical significance for the before/after check

### Built with
Atlassian Forge · UI Kit · Jira · Jira Service Management · Confluence · Rovo agents · Rovo actions ·
Rovo skills · Rovo MCP · Forge KVS · JavaScript

---

## 2. How Slice meets the main technology requirement
Slice is a Forge app that integrates with **Jira / Jira Service Management** (issue panel, project
page, admin page, issue triggers, creating linked action items), **Confluence** (protocol search
and staleness, demo protocol space), and **Rovo** (`rovo:agent`, seven `action` modules, `rovo:skill`,
`rovo:mcp`).

---

## 3. Judges' test guide (≈ 5 minutes)

1. Install Slice from the installation link on a site with Jira (or JSM) and Confluence.
2. Create a Jira project with key **SAFE**.
3. In the project sidebar, open **Slice safety signals** → click **Load demo data** (admin).
   (Settings live at Administration → Connected apps → Slice → ⋯ → **Configure**.)
   You should see *"Demo data ready: 34 reports created … 4 protocol pages in Confluence space CLINPROT."*
4. The dashboard now shows 4 signals: pumps on Ward 6, potassium in ICU, specimen labelling in the
   emergency department, and falls on Ward 3.
5. Open **SAFE-5** (on a fresh install, click the cheese-slices icon above the description once to add the panel) → the **Slice · safety signals** panel shows the pump signal, the four layers,
   recommended fixes (try **Create action**), similar reports with reasons, and
   *"Infusion pump programming… stale · 56 months"*.
6. On the dashboard, click **Publish brief to Confluence** on the pump signal and open the link:
   a committee-ready page with layers, defences, ranked fixes, the stale protocol and a linked timeline.
7. Create a report in SAFE with summary *"VitaFlow 300 rate entered wrong again"* and description
   *"Ward 6, night shift 03:00. Heparin rate entered 10x too high on the VitaFlow 300 keypad, was
   interrupted. Second nurse double-checked and caught it."*. Within 1–3 minutes Slice comments
   🧀 on it and adds the `slice-signal` label.
8. In **Rovo chat**, choose the **Slice** agent:
   - *"What safety signals are emerging this month?"*
   - *"Draft an RCA for SAFE-5"*
9. **MCP (optional):** an admin enables external MCP access for Slice. Then connect an MCP client
   to `https://mcp.atlassian.com/forge/97b983e8-9b84-42a3-8273-1a9dadb4ae9f` and call
   `get-safety-signals`.

All data is synthetic. The devices (VitaFlow 300, LabelJet 2) are fictional.

---

## 4. Demo video script (4:30)

| Time | Show | Say |
|---|---|---|
| 0:00 | A hospital ward photo or title card | "Most harm to patients in hospital shows up first as a near-miss, one nobody connected to the others." |
| 0:20 | Swiss cheese diagram (Slice logo) | "Every safety system has layers. Each has holes. Harm happens when the holes line up. Slice shows you where they're lining up." |
| 0:40 | SAFE project → Load demo data | "34 synthetic near-miss reports and a Confluence protocol space, in one click." |
| 1:00 | Dashboard: tiles, 4 signal cards | "Four patterns Slice found on its own. Six pump errors on Ward 6, all on the same device." |
| 1:30 | Swiss cheese tab and charts | "Preconditions failed in every one: a confusing keypad, interruptions, fatigue. And here's what held: the pump's dose limit." |
| 2:00 | SAFE-5 panel | "On the report itself: the signal, the layers, similar reports with the reason for each match…" |
| 2:20 | Protocol "stale · 56 months" | "…and the infusion protocol that hasn't been reviewed in 56 months." |
| 2:35 | Recommended fixes → Create action; dashboard → Publish brief → Confluence page | "Fixes ranked by strength. Hard limits beat more training. One click creates a linked task, and another publishes a brief for the safety committee in Confluence." |
| 3:00 | Create a new report → 🧀 comment appears | "A nurse files a new near-miss. Slice recognises the pattern and says so, without blaming anyone." |
| 3:30 | Rovo chat with the Slice agent: RCA draft | "Rovo's Slice agent drafts the root cause analysis, citing every report." |
| 4:00 | Architecture slide | "Forge, UI Kit, Rovo agent, actions, skill and MCP. Runs on Atlassian, no patient identifiers stored, 37 tests." |
| 4:15 | Title card | "Slice. Connect the near-misses before the holes line up." |

---

## 5. Before you submit
- [ ] `forge deploy -e production` and `forge install` the production version on the demo site
- [ ] Developer console → Slice → **Distribution** → enable sharing, then copy the **installation link**
- [ ] Make the GitHub repo public (or give the judges access)
- [ ] Record the video and upload it to YouTube as **Public**
- [ ] Fill in the Devpost form from section 1 and paste the install link and video URL
