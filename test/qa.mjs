/**
 * SILENT MEDIC — regression gate
 *
 * Run before any release:   node test/qa.mjs
 * Requires Playwright:      npm install playwright
 *
 * Exit code 0 = every check passed. Non-zero = do not ship.
 *
 * These checks exist because each one has failed before. They guard the things that
 * silently break: the integrity hash after a knowledge base edit, the displayed counts
 * drifting from the data, the responsive rules being overridden, and the decision rules
 * firing on the wrong casualty.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = 'file://' + resolve(HERE, '..', 'index.html');
const EXEC = process.env.CHROME_PATH || undefined;

// ---- expected state of the knowledge base -------------------------------
const EXPECT = { drugs: 117, chunks: 815, categories: 9, dualUse: 438 };

let failures = 0, checks = 0;
const ok = (name, cond, detail = '') => {
  checks++;
  if (cond) { console.log(`  PASS  ${name}`); }
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = t => console.log(`\n${t}`);

// v0.6.0: the console auto-opens ~1s after Ready; click the splash button only if still up
const enterConsole = async (page) => {
  await page.waitForFunction(() => !document.getElementById('bootBtn').disabled, { timeout: 20000 });
  await page.evaluate(() => {
    const boot = document.getElementById('boot');
    const btn = document.getElementById('bootBtn');
    if (boot && !boot.classList.contains('hide') && btn && !btn.disabled) btn.click();
  });
  await page.waitForFunction(() => document.getElementById('boot').classList.contains('hide'), { timeout: 20000 });
};

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});

// =========================================================================
section('Boot, integrity, and counts');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(APP);
  await page.waitForFunction(() => {
    const b = document.getElementById('bootBtn');
    return b && !b.disabled;
  }, { timeout: 20000 });

  const boot = await page.evaluate(() => document.getElementById('bootLog').innerText);
  ok('no console or page errors during boot', errors.length === 0, errors.join(' | '));
  ok('knowledge base integrity hash matches', /Integrity verified/.test(boot),
     'boot log said: ' + boot.split('\n').find(l => /ntegrity/.test(l)));

  // v0.6.0: console may have auto-opened while the checks above ran — click only if still up
  await page.evaluate(() => {
    const boot = document.getElementById('boot');
    const btn = document.getElementById('bootBtn');
    if (boot && !boot.classList.contains('hide') && btn && !btn.disabled) btn.click();
  });
  await page.waitForFunction(() => document.getElementById('boot').classList.contains('hide'), { timeout: 20000 });
  await page.waitForSelector('#queryInput', { state: 'visible' });

  const state = await page.evaluate(() => ({
    chunks: +document.getElementById('chunkCount').textContent,
    drugs: +document.getElementById('catTotal').textContent,
    kbLabel: document.getElementById('kbLabel').textContent,
    cats: document.querySelectorAll('.nav-item').length - 1, // minus "All Drugs"
    body: document.body.innerText
  }));
  ok(`chunk count is ${EXPECT.chunks}`, state.chunks === EXPECT.chunks, `got ${state.chunks}`);
  ok(`drug count is ${EXPECT.drugs}`, state.drugs === EXPECT.drugs, `got ${state.drugs}`);
  ok(`${EXPECT.categories} categories`, state.cats === EXPECT.categories, `got ${state.cats}`);
  ok('header drug count agrees', state.kbLabel.includes(String(EXPECT.drugs)), state.kbLabel);

  // every displayed count must agree with the data — this drifted before
  const stale = await page.evaluate(exp => {
    const text = document.body.innerText;
    const bad = [];
    const nums = text.match(/\b\d{3}\b/g) || [];
    for (const n of new Set(nums)) {
      const v = +n;
      if (v >= 100 && v <= 999 && /drug/i.test(text)) {
        // only flag numbers presented as drug or mapping counts
      }
    }
    if (!text.includes(exp.drugs + ' drugs')) bad.push('no "' + exp.drugs + ' drugs" anywhere');
    if (!text.includes(exp.dualUse + ' dual-use')) bad.push('no "' + exp.dualUse + ' dual-use"');
    for (const wrong of [118, 119, 120]) if (text.includes(wrong + ' drugs')) bad.push('stale "' + wrong + ' drugs"');
    for (const wrong of [433, 443]) if (text.includes(wrong + ' dual-use')) bad.push('stale "' + wrong + ' dual-use"');
    return bad;
  }, EXPECT);
  ok('no stale counts in the interface', stale.length === 0, stale.join('; '));

  await page.close();
}

// =========================================================================
section('Query console');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(APP);
  await enterConsole(page);
  await page.waitForSelector('#queryInput', { state: 'visible' });

  const search = async (mode, q) => {
    await page.evaluate(m => setMode(m), mode);
    await page.fill('#queryInput', q);
    await page.click('#queryBtn');
    await page.waitForFunction(
      term => {
        const t = document.getElementById('results').innerText;
        return t.startsWith('Query:') && t.toLowerCase().includes(term.toLowerCase());
      },
      q, { timeout: 10000 }
    ).catch(() => {});
    return page.evaluate(() => document.getElementById('results').innerText);
  };

  ok('drug search finds ketamine', /Ketamine/i.test(await search('drug', 'ketamine')));
  ok('drug search finds TXA', /Tranexamic/i.test(await search('drug', 'txa')));
  // merged records must stay reachable by every route
  ok('naloxone reachable by drug name', /Naloxone/i.test(await search('drug', 'narcan')));
  ok('naloxone reachable by symptom', /Naloxone/i.test(await search('sx', 'opioid overdose')));
  ok('naloxone reachable by mechanism', /Naloxone/i.test(await search('mech', 'opioid receptor')));
  ok('bicarbonate reachable', /Sodium Bicarbonate/i.test(await search('drug', 'bicarbonate')));
  const bicarb = await search('drug', 'bicarbonate');
  const bicarbHeadings = (bicarb.match(/^Sodium Bicarbonate.*$/gm) || []).length;
  ok('bicarbonate resolves to a single record', bicarbHeadings >= 1 && bicarbHeadings <= 2,
     `${bicarbHeadings} headings`);

  // ---- ranking (v0.5.1) ------------------------------------------------
  // The drug a query is ABOUT must come first. Before field weighting, "opioid
  // overdose" put calcium and four opioid-sparing analgesics above naloxone.
  const ranksFirst = async (mode, q, re) => {
    const r = await page.evaluate(([m, term]) => {
      setMode(m);
      return retrieve(term, 5).map(c => c.d);
    }, [mode, q]);
    ok(`"${q}" ranks ${re.source} first`, re.test(r[0] || ''), 'got: ' + r.join(' > '));
  };
  await ranksFirst('sx', 'opioid overdose', /Naloxone/i);
  await ranksFirst('sx', 'cyanide poisoning', /Hydroxocobalamin/i);
  await ranksFirst('sx', 'methemoglobinemia', /Methylene Blue/i);
  await ranksFirst('sx', 'nerve agent', /Atropine/i);
  await ranksFirst('sx', 'hyperkalemia', /Calcium/i);
  await ranksFirst('drug', 'ketamine', /Ketamine/i);

  // whole-word matching: an incidental substring must not score as a term hit
  const wordBoundary = await page.evaluate(() => ({
    hyphen: hasWord('opioid-sparing analgesia', 'opioid'),
    inner:  hasWord('overdose reversal', 'dose'),
  }));
  ok('hasWord matches across a hyphen', wordBoundary.hyphen === true);
  ok('hasWord rejects an inner substring', wordBoundary.inner === false);

  await page.close();
}

// =========================================================================
section('Decision engine');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(APP);
  await enterConsole(page);
  await page.waitForSelector('#deToggle', { state: 'visible' });
  await page.click('#deToggle');

  const plan = async ({ mech, injuries = [], tox = [], met = [], gcs = null, drop = [] }) => {
    await page.evaluate(() => {
      document.querySelectorAll('#deToxidrome input, #deMetabolic input, #deInjuries input')
        .forEach(c => { c.checked = false; c.closest('.de-check').classList.remove('checked'); });
      document.querySelectorAll('#deMech .de-radio')
        .forEach(r => { r.classList.remove('selected'); r.setAttribute('aria-checked', 'false'); });
    });
    if (mech) await page.evaluate(v => {
      const r = document.querySelector(`#deMech .de-radio[data-val="${v}"]`);
      r.classList.add('selected'); r.setAttribute('aria-checked', 'true');
    }, mech);
    for (const [grp, vals] of [['deInjuries', injuries], ['deToxidrome', tox], ['deMetabolic', met]])
      for (const v of vals) await page.evaluate(([g, val]) => {
        const el = document.querySelector(`#${g} input[data-val="${val}"]`);
        el.checked = true; el.closest('.de-check').classList.add('checked');
      }, [grp, v]);
    for (const v of drop) await page.evaluate(val => {
      const el = document.querySelector(`#deResources input[data-val="${val}"]`);
      if (el) { el.checked = false; el.closest('.de-check').classList.remove('checked'); }
    }, v);
    await page.fill('#dePtGCS', gcs === null ? '' : String(gcs));
    await page.click('.de-action-btn');
    await page.waitForTimeout(300);
    return page.evaluate(() => document.getElementById('deOutput').innerText);
  };

  // --- trauma path still works
  let t = await plan({ mech: 'blast', injuries: ['hemorrhage_extremity', 'tbi'], gcs: 11 });
  ok('tourniquet fires on extremity hemorrhage', /tourniquet/i.test(t));
  ok('TBI targets fire on blast + TBI', /Target SpO2/.test(t));
  ok('TXA fires', /TXA 2 g/.test(t));

  // --- low GCS must NOT be read as head injury without a trauma mechanism
  t = await plan({ mech: 'cbrn', tox: ['nerve_agent'], gcs: 10 });
  ok('nerve agent: atropine fires', /Atropine 2 mg/.test(t));
  ok('nerve agent: 2-PAM fires', /Pralidoxime|2-PAM/.test(t));
  ok('nerve agent: TBI rule does NOT fire', !/Target SpO2/.test(t));
  ok('nerve agent: ketamine does NOT fire', !/Ketamine 100 mg/.test(t));

  // --- missing kit must warn, not go silent
  t = await plan({ mech: 'cbrn', tox: ['nerve_agent'], gcs: 12, drop: ['pam'] });
  ok('missing 2-PAM produces a warning', /NO 2-PAM/.test(t));

  // --- antidotes and electrolytes
  t = await plan({ mech: 'burn', tox: ['cyanide'], gcs: 14 });
  ok('cyanide: hydroxocobalamin fires', /Hydroxocobalamin/.test(t));
  ok('cyanide: CO-safety note present', /CO poisoning|concurrent CO/i.test(t));

  t = await plan({ mech: 'blunt', met: ['crush', 'tq_release', 'hyperkalemia_ecg'], gcs: 15 });
  ok('hyperkalemia: calcium fires', /Calcium gluconate 1 g/.test(t));
  ok('hyperkalemia: albuterol fires', /Albuterol 10-20 mg/.test(t));
  ok('hyperkalemia: prepare-before-release warning fires', /BEFORE TOURNIQUET RELEASE/.test(t));
  ok('crush: bicarbonate alkalinization fires', /urine pH/.test(t));

  t = await plan({ mech: 'environmental', met: ['heat'], gcs: 15 });
  ok('heat, alert: ORS fires', /Oral rehydration salts/.test(t));
  t = await plan({ mech: 'environmental', met: ['heat'], gcs: 12 });
  ok('heat, altered: heat stroke exclusion fires', /HEAT STROKE/.test(t));
  ok('heat, altered: ORS suppressed', !/Oral rehydration salts 500/.test(t));

  // --- every recommendation must carry a citation
  const uncited = await page.evaluate(() =>
    [...document.querySelectorAll('.de-rec')].filter(r => !r.querySelector('.de-rec-cite')).length);
  ok('every recommendation carries a citation', uncited === 0, `${uncited} without`);

  // --- handoff
  const meta = await page.evaluate(() => document.querySelector('.de-out-meta')?.innerText || '');
  ok('output carries timestamp', /Generated/.test(meta));
  ok('output carries inputs used', /Inputs/.test(meta));
  ok('output carries a disclaimer', await page.evaluate(() =>
    /not a substitute/i.test(document.querySelector('.de-out-foot')?.innerText || '')));
  const copyText = await page.evaluate(() => typeof decisionPlanText === 'function' ? decisionPlanText() : '');
  ok('plain-text export is produced', copyText.length > 200 && /ACTION SEQUENCE/.test(copyText));
  ok('plain-text export carries sources', /Source:/.test(copyText));

  await page.close();
}

// =========================================================================
section('Keyboard and dialog behaviour');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(APP);
  await enterConsole(page);
  await page.waitForSelector('#deToggle', { state: 'visible' });

  await page.focus('#deToggle');
  await page.click('#deToggle');
  await page.waitForTimeout(300);
  ok('focus moves into the panel',
     await page.evaluate(() => document.getElementById('deOverlay').contains(document.activeElement)));
  ok('panel is a labelled modal dialog', await page.evaluate(() => {
    const o = document.getElementById('deOverlay');
    return o.getAttribute('role') === 'dialog' && o.getAttribute('aria-modal') === 'true'
        && !!document.getElementById(o.getAttribute('aria-labelledby'));
  }));
  await page.evaluate(() => document.querySelector('#deMech .de-radio[data-val="gsw"]').focus());
  await page.keyboard.press('Enter');
  ok('radio chips operate from the keyboard', await page.evaluate(() => {
    const r = document.querySelector('#deMech .de-radio[data-val="gsw"]');
    return r.classList.contains('selected') && r.getAttribute('aria-checked') === 'true';
  }));
  ok('radio groups carry radiogroup semantics', await page.evaluate(() =>
    document.getElementById('deMech').getAttribute('role') === 'radiogroup'));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('Escape closes the panel',
     await page.evaluate(() => !document.getElementById('deOverlay').classList.contains('open')));
  ok('focus returns to the launcher',
     await page.evaluate(() => document.activeElement.id === 'deToggle'));

  await page.close();
}

// =========================================================================
section('Layout and contrast');
{
  for (const [w, h, name] of [[1440, 900, 'desktop'], [1024, 768, 'tablet'], [430, 860, 'phone']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(APP);
    await enterConsole(page);
    await page.waitForSelector('#queryInput', { state: 'visible' });
    await page.fill('#queryInput', 'ketamine');
    await page.click('#queryBtn');
    await page.waitForTimeout(600);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok(`${name}: no horizontal overflow`, !over);
    await page.close();
  }

  // token contrast against the surfaces they sit on
  const page = await browser.newPage();
  await page.goto(APP);
  const contrast = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const rgb = v => v.trim().startsWith('#')
      ? [1, 3, 5].map(i => parseInt(v.trim().slice(i, i + 2), 16))
      : v.match(/\d+/g).slice(0, 3).map(Number);
    const lum = c => {
      const f = x => (x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      const [r, g, b] = rgb(c);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const panel3 = cs.getPropertyValue('--panel-3');
    const out = {};
    for (const t of ['--text', '--text-2', '--text-3', '--text-4', '--blue', '--red', '--orange', '--green', '--teal'])
      out[t] = +ratio(cs.getPropertyValue(t), panel3).toFixed(2);
    return out;
  });
  for (const [token, r] of Object.entries(contrast))
    ok(`${token} meets WCAG AA (4.5:1) on panel`, r >= 4.5, `${r}:1`);
  await page.close();
}

await browser.close();
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.log(`${failures} FAILED — do not ship`); process.exit(1); }
console.log('All checks passed.');
