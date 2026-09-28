/**
 * SILENT MEDIC — daily scenario verification (operational)
 *
 *   DAY=1 N=15 node test/scenarios.mjs            -> JSON report on stdout
 *
 * Generates N reproducible random casualty scenarios for study day DAY (seeded, so a day's
 * scenarios can be re-run exactly), feeds each one to the decision engine in an offline
 * browser, and checks operational invariants. It does not judge clinical correctness beyond
 * the rule invariants already enforced by test/qa.mjs.
 *
 * Invariants per scenario
 *   I1 no page errors
 *   I2 never a blank result: a plan with recommendations, or, when no rule is triggered (possible
 *      only when no injury, toxidrome or metabolic finding is entered), the engine's explicit prompt
 *      asking for more input
 *   I3 every recommendation carries a citation
 *   I4 output carries timestamp, inputs used, and the disclaimer (only when a plan is produced)
 *   I5 deterministic: the same inputs give the same recommendations on a second run
 *   I6 plan generated within 1,000 ms
 *   I7 rule invariants (only when the trigger is present):
 *        extremity hemorrhage -> tourniquet
 *        nerve agent          -> atropine; and no TBI oxygen target unless TBI was entered or the
 *                                engine's own presumed-TBI rule applies (trauma mechanism gsw, blast,
 *                                blunt or burn with GCS < 13)
 *        cyanide              -> hydroxocobalamin
 *        hyperkalemia ECG     -> calcium gluconate
 *        heat + GCS < 15      -> no oral rehydration salts
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = 'file://' + resolve(HERE, '..', 'index.html');
const EXEC = process.env.CHROME_PATH || undefined;
const DAY = parseInt(process.env.DAY || '1', 10);
const N = parseInt(process.env.N || '15', 10);
const VIEWPORTS = [[390, 844], [768, 1024], [1440, 1000]];

// seeded PRNG (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const some = (r, a, max) => { const k = Math.floor(r() * (max + 1)); const s = new Set(); while (s.size < Math.min(k, a.length)) s.add(pick(r, a)); return [...s]; };
const between = (r, lo, hi) => Math.round(lo + r() * (hi - lo));

// resources the invariants depend on are never removed
const PROTECTED = new Set(['tourniquet', 'atropine', 'pam', 'hydroxocobalamin', 'calcium', 'ors', 'oxygen']);

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const report = { app: 'silent-medic', day: DAY, n: N, started: new Date().toISOString(), scenarios: [] };

// read the option lists from the app itself
const probe = await browser.newPage();
await probe.goto(APP);
await probe.waitForFunction(() => !document.getElementById('bootBtn').disabled, { timeout: 20000 });
const OPTS = await probe.evaluate(() => {
  const vals = sel => [...document.querySelectorAll(sel)].map(e => e.dataset.val).filter(Boolean);
  return {
    mech: vals('#deMech .de-radio'),
    injuries: vals('#deInjuries input'),
    tox: vals('#deToxidrome input'),
    met: vals('#deMetabolic input'),
    res: vals('#deResources input'),
  };
});
const version = await probe.evaluate(() => (document.title || '') + ' ' + ((document.querySelector('.brand small') || {}).innerText || ''));
report.appVersion = version.trim();
await probe.close();

for (let i = 0; i < N; i++) {
  const r = rng(DAY * 1000 + i);
  const sc = {
    id: `D${String(DAY).padStart(2, '0')}-S${String(i + 1).padStart(2, '0')}`,
    mech: pick(r, OPTS.mech),
    injuries: some(r, OPTS.injuries, 3),
    tox: r() < 0.35 ? [pick(r, OPTS.tox)] : [],
    met: some(r, OPTS.met, 2),
    drop: some(r, OPTS.res.filter(x => !PROTECTED.has(x)), 2),
    gcs: between(r, 3, 15), sbp: between(r, 60, 160), hr: between(r, 45, 160),
    spo2: between(r, 70, 100), rr: between(r, 6, 40), wt: between(r, 55, 110), age: between(r, 18, 55),
  };
  const [w, h] = VIEWPORTS[i % VIEWPORTS.length];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  await ctx.setOffline(true);                      // run the scenario with no network
  await page.waitForFunction(() => !document.getElementById('bootBtn').disabled, { timeout: 20000 });
  await page.evaluate(() => { const b = document.getElementById('bootBtn'); if (b) b.click(); });
  await page.waitForFunction(() => document.getElementById('boot').classList.contains('hide'), { timeout: 20000 });
  await page.evaluate(() => { const t = document.getElementById('deToggle'); if (t) t.click(); });

  const run = async () => page.evaluate(s => {
    document.querySelectorAll('#deToxidrome input, #deMetabolic input, #deInjuries input')
      .forEach(c => { c.checked = false; c.closest('.de-check').classList.remove('checked'); });
    document.querySelectorAll('#deResources input')
      .forEach(c => { c.checked = true; c.closest('.de-check').classList.add('checked'); });
    document.querySelectorAll('#deMech .de-radio').forEach(x => { x.classList.remove('selected'); x.setAttribute('aria-checked', 'false'); });
    const m = document.querySelector(`#deMech .de-radio[data-val="${s.mech}"]`);
    if (m) { m.classList.add('selected'); m.setAttribute('aria-checked', 'true'); }
    for (const [g, vals] of [['deInjuries', s.injuries], ['deToxidrome', s.tox], ['deMetabolic', s.met]])
      for (const v of vals) { const el = document.querySelector(`#${g} input[data-val="${v}"]`); if (el) { el.checked = true; el.closest('.de-check').classList.add('checked'); } }
    for (const v of s.drop) { const el = document.querySelector(`#deResources input[data-val="${v}"]`); if (el) { el.checked = false; el.closest('.de-check').classList.remove('checked'); } }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    set('dePtGCS', s.gcs); set('dePtSBP', s.sbp); set('dePtHR', s.hr); set('dePtSpO2', s.spo2);
    set('dePtRR', s.rr); set('dePtWt', s.wt); set('dePtAge', s.age);
    const t0 = performance.now();
    document.querySelector('.de-action-btn').click();
    const ms = performance.now() - t0;
    const recs = [...document.querySelectorAll('.de-rec')];
    return {
      ms,
      text: document.getElementById('deOutput').innerText,
      recs: recs.map(x => x.innerText.split('\n')[0]),
      uncited: recs.filter(x => !x.querySelector('.de-rec-cite')).length,
      meta: (document.querySelector('.de-out-meta') || {}).innerText || '',
      foot: (document.querySelector('.de-out-foot') || {}).innerText || '',
    };
  }, sc);

  const a = await run();
  const b = await run();
  const has = (arr, v) => arr.includes(v);
  const noFindings = !sc.injuries.length && !sc.tox.length && !sc.met.length;
  const checks = {
    I1_no_errors: errors.length === 0,
    I2_plan_produced: a.recs.length > 0 ? a.text.length > 50 : (noFindings && /No actions triggered/.test(a.text)),
    I3_all_cited: a.uncited === 0,
    I5_deterministic: JSON.stringify(a.recs) === JSON.stringify(b.recs),
    I6_under_1s: a.ms < 1000,
  };
  if (a.recs.length > 0) checks.I4_meta_disclaimer = /Generated/.test(a.meta) && /Inputs/.test(a.meta) && /not a substitute/i.test(a.foot);
  const rules = {};
  if (has(sc.injuries, 'hemorrhage_extremity')) rules.tourniquet = /tourniquet/i.test(a.text);
  if (has(sc.tox, 'nerve_agent')) {
    rules.atropine = /Atropine/i.test(a.text);
    const presumedTbi = ['gsw', 'blast', 'blunt', 'burn'].includes(sc.mech) && sc.gcs < 13;
    if (!has(sc.injuries, 'tbi') && !presumedTbi) rules.no_tbi_target = !/Target SpO2/.test(a.text);
  }
  if (has(sc.tox, 'cyanide')) rules.hydroxocobalamin = /Hydroxocobalamin/i.test(a.text);
  if (has(sc.met, 'hyperkalemia_ecg')) rules.calcium = /Calcium gluconate/i.test(a.text);
  if (has(sc.met, 'heat') && sc.gcs < 15) rules.no_ors_when_altered = !/Oral rehydration salts 500/.test(a.text);
  for (const [k, v] of Object.entries(rules)) checks['I7_' + k] = v;
  const pass = Object.values(checks).every(Boolean);
  report.scenarios.push({ ...sc, noFindings, prompted: a.recs.length === 0, viewport: `${w}x${h}`, ms: Math.round(a.ms), recCount: a.recs.length, checks, pass,
    errors: errors.slice(0, 3), failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k) });
  await ctx.close();
}
await browser.close();

const s = report.scenarios;
report.summary = {
  scenarios: s.length,
  passed: s.filter(x => x.pass).length,
  failed: s.filter(x => !x.pass).map(x => ({ id: x.id, failed: x.failed })),
  invariantChecks: s.reduce((n, x) => n + Object.keys(x.checks).length, 0),
  ruleChecks: s.reduce((n, x) => n + Object.keys(x.checks).filter(k => k.startsWith('I7_')).length, 0),
  medianMs: s.map(x => x.ms).sort((p, q) => p - q)[Math.floor(s.length / 2)],
};
console.log(JSON.stringify(report, null, 1));
process.exit(report.summary.failed.length ? 1 : 0);
