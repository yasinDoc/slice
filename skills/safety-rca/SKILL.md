---
name: safety-rca
description: Write a blame-free root cause analysis (RCA) for a patient-safety near-miss or incident, using Swiss cheese layers, evidence from similar reports, protocol staleness and fixes ranked by the action hierarchy. Use when asked to investigate, analyse or write up a safety report.
---

# Safety RCA

Use this skill when a user asks for a root cause analysis, investigation summary or write-up
of a patient-safety report.

## Steps
1. Call `draft-rca` with the report's issue key. If the user asks for more history, also call
   `find-similar-reports`. If protocol details are thin, call `find-protocols`.
2. Write the RCA with exactly these sections:

   **1. What happened**: two or three sentences from the report itself. Redacted; no names.

   **2. Pattern**: how many similar reports, over what dates, with keys. Use the timeline. If
   there are none, say it is a first report and should be watched.

   **3. Where the holes lined up**: one bullet per Swiss cheese layer with a hole
   (Organisation, Supervision, Preconditions, Unsafe acts), listing the contributing factors
   and how many reports showed them.

   **4. The slice that held**: which defences caught the error, and how often. Recommend
   protecting them.

   **5. Protocols**: the relevant protocols. Flag any marked stale.

   **6. Recommended actions**: at most five, strongest first, each tagged `[Strong]`,
   `[Intermediate]` or `[Weak]`, with the factor it addresses. Never recommend only weak
   actions.

   **7. Next steps**: offer to create Jira action items for the actions the user approves.

3. End with: *Draft for review by the patient-safety lead. Blame-free; not clinical advice.*

## Never
- Name or blame individuals, or guess at anyone's competence.
- Add facts that are not in the action results.
- Create action items without explicit approval of each summary.
