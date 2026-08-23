# SILENT MEDIC

**Offline clinical decision support for prolonged field care.**
Version 0.4.5 · Build 2026-08-20

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

## Repository layout

```
index.html      complete application (UI + knowledge base + decision engine)
README.md       this file
DISCLAIMER.md   intended use and limitations — read before clinical use
LICENSE         copyright and terms
```

## Changelog

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
