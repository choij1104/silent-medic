# Regression gate

```
npm install playwright
node test/qa.mjs
```

Exit code 0 means every check passed. Anything else means do not ship.

Set `CHROME_PATH` if Playwright's bundled Chromium is not where it expects:

```
CHROME_PATH=/path/to/chrome node test/qa.mjs
```

## What it guards, and why

Each check is here because that thing broke once.

| Area | Guards against |
|---|---|
| **Boot and integrity** | A knowledge base edit that forgets to recompute `KB_EXPECTED_SHA256`. The app would boot with a loud integrity failure. |
| **Counts** | Displayed drug and mapping counts drifting from the data. They once read 118, 119, and 120 in different places. Stale values are failed explicitly. |
| **Query console** | The merged sodium bicarbonate and naloxone records staying reachable by drug name, symptom, and mechanism — merging a record can silently orphan a search route. |
| **Ranking** | The drug a query is about falling below incidental keyword hits. `opioid overdose` once ranked calcium and four opioid-*sparing* analgesics above naloxone. Six queries with an unambiguous answer assert their first result; two assert whole-word matching (`opioid` matches `opioid-sparing`; `dose` does not match `overdose`). Ranking is presentation — these checks say nothing about what a record contains. |
| **Decision engine — trauma** | The core rules still firing: tourniquet, TBI targets, TXA. |
| **Decision engine — GCS gating** | A depressed GCS being read as head injury on a toxidrome casualty. A nerve-agent casualty at GCS 10 must get atropine and 2-PAM and must NOT get TBI targets or ketamine. |
| **Decision engine — missing kit** | Warnings appearing when a required agent is absent, rather than the rule going silent. |
| **Antidotes and electrolytes** | Cyanide, hyperkalemia, crush, and heat rules, including the heat-stroke exclusion that suppresses oral rehydration when mental status is altered. |
| **Citations** | Every recommendation carrying a source. An uncited recommendation is a defect. |
| **Handoff** | Copy and Print output carrying timestamp, inputs, sources, and the disclaimer. |
| **Keyboard** | Focus entering the dialog, Escape closing it, focus returning to the launcher, radio chips operating from the keyboard, dialog and radiogroup semantics. |
| **Layout** | Horizontal overflow at desktop, tablet, and phone widths. The responsive rules were once declared before the component rules and never applied. |
| **Contrast** | Every colour token meeting WCAG AA against the panel it sits on. Label and citation text was once at 2.2:1. |

## When the knowledge base changes

Update `EXPECT` at the top of `qa.mjs` to the new counts, and make sure
`KB_EXPECTED_SHA256` in `index.html` was recomputed over the new decompressed JSON.
