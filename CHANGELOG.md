# Changelog

All notable changes to SILENT MEDIC. Dates are the build date carried in the app footer.

The knowledge base is embedded in `index.html` as gzip+base64 and checked at boot against
`KB_EXPECTED_SHA256`. Any release that touches the knowledge base must recompute that hash.

---

## v0.5.1 — 2026-08-25

### Search ranking

The drug a query is about now comes first. Ranking only — no record, dose, indication,
warning, citation, or decision rule changed, and the knowledge base hash is unchanged.

- Retrieval now weights **where** a term matched. A hit in the indication (the `Primary use:`
  line of a drug record, or the label of a dual-use mapping) or in the drug class outscores a
  hit anywhere in the body text, and an exact-phrase match of the whole query against the
  indication carries a further bonus.
- A **coverage** signal rewards records that match every word of the query over records that
  matched one word several times.
- Term matching is **whole-word**: `opioid` still matches `opioid-sparing`, but `dose` no
  longer matches `overdose`.

**What this fixes.** `opioid overdose` returned calcium, lidocaine, ondansetron,
dexmedetomidine, and promethazine above naloxone — five of them scoring on the phrase
"opioid-sparing", which is the opposite of the query. Naloxone now ranks first. The same
correction applies to `cyanide poisoning` → hydroxocobalamin, `methemoglobinemia` →
methylene blue, `nerve agent` → atropine, and `hyperkalemia` → calcium.

### Regression gate

- 55 → **63 checks**. Six assert the first result for a query whose answer is unambiguous;
  two assert the word-boundary behaviour.

---

## v0.5.0 — 2026-08-23

### Decision engine

- A depressed GCS no longer counts as evidence of head injury on its own. The TBI targets and
  ketamine analgesia rules now require a trauma mechanism (GSW, blast, blunt, burn) or an
  explicit TBI selection. A nerve-agent, opioid, hypoglycaemic, or heat-stroke casualty with a
  low GCS is no longer told to treat a head injury.
- Antibiotic route selection still reads GCS as a proxy for "unable to take PO", which is
  correct regardless of the cause of the depressed consciousness. Left unchanged.

### Handoff

- **Copy** puts a plain-text action sequence on the clipboard, with a textarea fallback for
  browsers that block the clipboard API on `file://`.
- **Print** produces a clean sheet containing only the plan — input controls, buttons, and
  chrome are suppressed.
- Both carry a UTC timestamp, the casualty summary, the inputs the plan was generated from,
  every citation, and the disclaimer.

### Accessibility

- Visible focus rings throughout, including inverted rings on the dark header and footer.
- Escape closes the decision panel; Tab is trapped inside it while open; focus returns to the
  launcher on close.
- The custom radio chips are focusable and operable with Enter and Space, and carry
  `radiogroup` / `radio` / `aria-checked` semantics.
- The decision panel is a labelled `dialog` with `aria-modal`.

### Install

- `manifest.webmanifest`, icons, and a service worker that caches only this app's own files,
  so it can be added to a phone home screen and opened with the radio off.
- Registration is skipped on `file://`, where a single `index.html` is already fully offline.

---

## v0.4.5 — 2026-08-20

Knowledge base de-duplicated. Sodium bicarbonate and naloxone each existed as two separate
records with overlapping content and different category and level tags. Each pair was merged
into one record carrying the union of both — class, levels, mechanism, every warning, and every
dual-use mapping; overlapping mappings were combined into a single entry containing both texts
rather than dropped. Merged naloxone is filed under antidotes with its airway keywords
retained, and remains reachable by drug, symptom, and mechanism search.

Counts: 119 → **117 drugs**, 443 → **438 dual-use mappings**, 827 → **815 chunks**.
`KB_EXPECTED_SHA256` updated to match.

---

## v0.4.4 — 2026-08-20

Decision engine extended to the antidote and electrolyte categories, which had knowledge base
entries but no rules behind them.

- New input sections: **Toxic Exposure / Toxidrome** (nerve agent / organophosphate, cyanide /
  closed-space smoke, opioid, methemoglobinemia, TCA / Na-channel blocker, CCB / beta-blocker,
  hydrofluoric acid) and **Metabolic & Electrolyte Risk** (crush, tourniquet release,
  hyperkalemia ECG changes, transfusion, hypoglycemia, seizure, heat, malnourishment).
- Kit list extended with the corresponding agents.
- 21 new rules, each quoting the curated knowledge base entry it derives from. No new clinical
  content was authored for this release. Existing rules unchanged.

---

## v0.4.3 — 2026-08-20

Legibility pass and count correction.

- Base type 13px → 15px throughout.
- Palette reworked so label, hint, and citation text meets WCAG AA — previously 2.2–2.9:1,
  now 5.4–6.4:1.
- Query field, buttons, and decision-panel checkboxes enlarged to 42–46px touch targets.
- Responsive rules moved to the end of the stylesheet; they had been declared before the
  component rules and were being overridden, so they never applied. Phone layout now works.
- Body converted to a flex column so the footer holds at any header height.
- Duplicate empty logo tile removed.
- Displayed counts corrected to the verified figures. They had read 118, 119, and 120 drugs in
  different places, and 433 dual-use mappings; the knowledge base held 119 and 443.

No clinical content, rule, or dosing change.

---

## v0.4.2 — 2026-05-15

TCCC 2026 (Change 25-1) knowledge base; decision support module.
