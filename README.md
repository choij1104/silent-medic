# SILENT MEDIC

**Offline clinical decision support for prolonged field care.**
Version 0.5.1 · Build 2026-08-25

A single-file, browser-resident decision support tool for combat casualty care and
prolonged field care (PFC) environments. It runs entirely in the browser with no
backend, no external requests, and no data transmission — designed for austere
settings where connectivity cannot be assumed.

---

## What it does

- **Query Console** — three retrieval modes: by **Drug**, by **Symptom**, by **Mechanism**
- **TCCC-RX knowledge base** — 117 drugs, 438 dual-use mappings, 9 categories, 815 chunks, aligned to TCCC 2026 (Change 25-1)
- **Decision Support Module** — generates a time-sequenced action list (MARCH-PAWS ordered) from mechanism of injury, suspected injuries, toxidrome, metabolic risk, vitals, echelon of care, and evacuation delay
- **Toxidrome and electrolyte coverage** — nerve agent and organophosphate, cyanide and closed-space smoke, opioid, methemoglobinemia, sodium-channel and calcium-channel blocker overdose, hydrofluoric acid; crush and post-tourniquet hyperkalemia, transfusion hypocalcemia, hypoglycemia, status epilepticus, heat casualty
- **Echelon awareness** — recommendations tagged R1/2 (point of injury → forward surgical), PFC (evacuation delayed), and CCATT (critical care air transport)
- **Local-only operation** — offline rule base, no AI calls, no telemetry; query history stays in browser storage on the device
- **Citation-linked output** — every recommendation carries its source reference (TCCC 2026 section, JTS PFC guidelines)

## Design constraints

1. **Offline first.** The entire application is one HTML file. Save it, open it, use it with the radio off.
2. **No transmission.** No analytics, no fonts from a CDN, no fetch calls. Network status is displayed so the operator can verify.
3. **Deterministic.** The decision engine is a rule base, not a language model. The same inputs always produce the same output, and every output is traceable to a cited guideline.
4. **Auditable.** Knowledge base integrity is surfaced in the header (SHA-256 badge).
5. **Legible under load.** Type and contrast are set for a phone screen in daylight, not a
   desk monitor: 15px base type, every label and citation at WCAG AA contrast or better,
   and 42-46px touch targets on the controls a medic actually presses.

## Use

Open `index.html` in any modern browser. No install, no build step, no dependencies.

To keep a local copy on a phone or tablet, save the file to device storage and open it
from the browser's file handler; it will run without a network connection.

**Install to a home screen.** Served over https (including GitHub Pages), the app registers a
service worker and can be installed like a native app — add it to the home screen and it opens
with the radio off. The service worker caches only this app's own files and contacts nothing.

**Handing off a plan.** The decision engine's output has Copy and Print actions. Both carry a
timestamp, the casualty summary, the inputs the plan came from, every citation, and the
disclaimer, so what leaves the screen is traceable.

## Repository layout

```
index.html             complete application (UI + knowledge base + decision engine)
manifest.webmanifest   home-screen install metadata
sw.js                  service worker — caches this app's own files only
icon-192.png           app icons
icon-512.png
CHANGELOG.md           release history
README.md              this file
DISCLAIMER.md          intended use and limitations — read before clinical use
LICENSE                copyright and terms
```

`index.html` remains self-contained: opened on its own from disk it is the complete
application. The other files only add the installable, served form.

## Changelog

Full history in [CHANGELOG.md](CHANGELOG.md).

**v0.5.1** — 2026-08-25. Search ranking: the drug a query is about now comes first. Retrieval
weights a match in the indication or the drug class far above a match anywhere in the body
text, adds an exact-phrase bonus when the whole query is the indication, and rewards covering
every word of the query. Term matching is whole-word. `opioid overdose` returned calcium and
four opioid-*sparing* analgesics above naloxone; naloxone now ranks first. Ranking only — no
record, dose, indication, warning, citation, or decision rule changed.

**v0.5.0** — 2026-08-23. A depressed GCS no longer counts as head injury by itself: the TBI and
ketamine rules now require a trauma mechanism, so toxidrome and metabolic casualties are no
longer told to treat a head injury. Decision output gained Copy and Print with timestamp,
casualty summary, inputs, citations, and disclaimer. Full keyboard support — focus rings,
Escape to close, focus trap and restore, keyboard-operable radio chips, dialog semantics.
Installable to a phone home screen via manifest and service worker.

**v0.4.5** — 2026-08-20. Knowledge base de-duplicated. Sodium bicarbonate and naloxone each
existed as two separate drug records with overlapping content and different category and level
tags. Each pair was merged into one record carrying the union of both — class, levels,
mechanism, every warning, and every dual-use mapping; overlapping mappings were combined into a
single entry containing both texts rather than dropped. Merged naloxone is filed under
antidotes with its airway keywords retained, and remains reachable by drug, symptom, and
mechanism search. Counts are now 117 drugs, 438 dual-use mappings, 815 chunks, and the embedded
SHA-256 integrity hash was updated to match.

**v0.4.4** — 2026-08-20. Decision engine extended to the antidote and electrolyte categories,
which had knowledge base entries but no rules behind them. Two new input sections (Toxic
Exposure / Toxidrome, Metabolic & Electrolyte Risk), the corresponding agents added to the kit
list, and 21 new rules. Every new rule quotes the curated knowledge base entry it came from —
no new clinical content was authored for this release. Existing rules unchanged.

**v0.4.3** — 2026-08-20. Legibility pass: base type raised from 13px to 15px throughout,
palette reworked so label and citation text meets WCAG AA (previously 2.2–2.9:1, now
5.4–6.4:1), controls enlarged to 42–46px touch targets, and the layout made to hold
together on a phone. Knowledge base counts corrected to the verified figures — 119 drugs
and 443 dual-use mappings, previously shown variously as 118/119/120 and 433. No clinical
content, rule, or dosing changed.

**v0.4.2** — 2026-05-15. TCCC 2026 (Change 25-1) knowledge base; decision support module.

## Status

Working version under active development. The knowledge base reflects TCCC 2026
guidelines including the Change 25-1 antibiotic revisions (cefadroxil/cephalexin PO,
ceftriaxone IV/IO/IM replacing moxifloxacin and ertapenem).

## Author

Jae Hyek Choi, MSc, PhD, DVSc
Adjunct Assistant Professor, Department of Emergency Medicine
UT Health San Antonio

---

See [DISCLAIMER.md](DISCLAIMER.md) — this software is a reference aid, not a substitute
for clinical judgment, and is not an FDA-cleared medical device.
