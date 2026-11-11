#!/usr/bin/env node
/*
 * aeratedtest.js — the aerated / winter-greens box, 4 Nov 2026.
 *
 * 11 Nov 2026: REVERSED. The box is a flag only now; checks 1-4 assert the round
 * counts in full. Original design (4 Nov) for the record:
 * WHY. The box splits a round in two: the outcomes the surface decided (score,
 * played-to, putts, three-putts, saves, doubles) stop counting, the faults she
 * decided (drive, approach, c, penalties, position, GIR) keep counting. That
 * split lives in one helper and in every pool that calls it, and a pool that
 * still calls getRoundStats directly would quietly average sand-roll putts
 * into her winter — which is the exact thing the box exists to prevent, and
 * it would look completely normal on screen.
 *
 * Checks:
 *   1. countedStats nulls exactly the outcome keys and nothing else
 *   2. outcomeCounts: aerated and not-counted both say no; a plain round yes
 *   3. the goal tiles (counting_avg, scramble, best round) skip an aerated
 *      round but still read the plain ones
 *   4. the social-vs-comp table shows "—" for putts/score on an all-aerated
 *      side and still shows a scoring-position figure for it
 *   5. the card form carries the box and saveCardRound() writes it; the quick
 *      form writes it too
 *   6. editing an aerated round restores the tick
 *
 *   node aeratedtest.js
 */
const fs = require('fs');
const dir = process.argv[2] || '.';

const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const externals = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)[^"]*"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f))
  .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8'));
const pagesSrc = fs.readFileSync(`${dir}/app-pages.js`, 'utf8');

const els = {};
function mkEl(id){
  return {
    id, _h:'', textContent:'', value:'', checked:false, style:{}, dataset:{},
    set innerHTML(v){ this._h = String(v); },
    get innerHTML(){ return this._h; },
    insertAdjacentHTML(pos, s){ this._h += s; },
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false } },
    setAttribute(){}, getAttribute(){ return null }, appendChild(){}, removeChild(){},
    addEventListener(){}, querySelector(){ return null }, querySelectorAll(){ return [] },
    closest(){ return null }, focus(){}, remove(){}, scrollIntoView(){},
  };
}
global.document = {
  getElementById: id => (els[id] || (els[id] = mkEl(id))),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => mkEl('new'), createTextNode: () => ({}),
  addEventListener(){}, body: mkEl('body'), documentElement: mkEl('root'),
};
global.window = { location:{origin:'https://x.test',pathname:'/',search:'',hash:'',href:'https://x.test/'},
  history:{replaceState(){},pushState(){}}, addEventListener(){},
  matchMedia:()=>({matches:false,addListener(){}}), scrollTo(){}, setTimeout, clearTimeout };
global.localStorage = { _:{}, getItem(k){ return this._[k] ?? null }, setItem(k,v){ this._[k]=String(v) }, removeItem(k){ delete this._[k] } };
global.navigator = { userAgent:'node', serviceWorker:{ register(){ return Promise.resolve() } } };
global.alert = () => {}; global.confirm = () => true; global.prompt = () => null;
global.location = global.window.location; global.history = global.window.history;
global.matchMedia = global.window.matchMedia; global.scrollTo = () => {};
global.requestAnimationFrame = f => setTimeout(f, 0);
global.CustomEvent = class {}; global.Event = class {};
global.fetch = async () => ({ ok:true, status:200, headers:{get:()=>null}, json:async()=>[], text:async()=>'[]' });
global.__PAGES_SRC = pagesSrc;
global.__SHEET_SRC = fs.readFileSync(`${dir}/scorecard_print.html`, 'utf8');

const harness = `
${inline.join('\n;\n')}
;
${externals.join('\n;\n')}
;
(async () => {
  let fails = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? '  ok    ' : '  FAIL  ') + label + (ok ? '' : '   got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)));
    if (!ok) fails++;
  };

  let captured = null;
  try { saveRoundRow = async row => { captured = row; }; } catch (e) {}
  try { sel = async () => []; } catch (e) {}
  try { selSoft = async () => []; } catch (e) {}
  try { ins = async () => []; } catch (e) {}
  try { upd = async () => []; } catch (e) {}
  try { renderRounds = () => {}; } catch (e) {}
  try { ME = { id:'at', email:'a@b.c', role:'student' }; } catch (e) {}
  try { STUDENT_ID = 'at'; } catch (e) {}

  const WEST_ROT = { id: 1, name: 'Colony West', tee: 'Rot', par: 73, cr: 76.9, slope: 141 };
  COURSES = [WEST_ROT]; COURSE_BY_ID = { 1: WEST_ROT };

  // One card, 18 holes: a lost drive, a missed quadrant, a choked chip, a
  // penalty, two three-putts, one double, a GIR on every par 3.
  const holes = Array.from({length: 18}, (_, i) => ({
    par: i % 6 === 2 ? 3 : 4, score: i % 6 === 2 ? 3 : (i === 5 ? 6 : 5),
    drive: i === 0 ? 'x' : '', gir: i % 6 === 2, app: i === 1 ? 'm' : '',
    short: i === 3 ? 'c' : '', putts: (i === 4 || i === 7) ? 3 : 2, trbl: i === 5 ? 'W' : '',
  }));
  const mk = (id, date, extra) => ({ id, date, course:'Colony West', tee:'Rot', course_id:1,
                                     comp:true, holes_data: holes.map(h => ({...h})), ...extra });
  const plain = [mk(1,'2026-09-01',{}), mk(2,'2026-09-08',{}), mk(3,'2026-09-15',{})];
  const aer   = mk(4,'2026-11-04',{greens_aerated:true});
  const excl  = mk(5,'2026-11-05',{stats_excluded:true});

  // ── 1–4 · since 11 Nov 2026 an aerated round counts in full (flag only) ──
  const full = getRoundStats(aer), cut = countedStats(aer);
  check('countedStats == getRoundStats for an aerated round', JSON.stringify(cut), JSON.stringify(full));
  check('aerated counts for outcomes', outcomeCounts(aer), true);
  check('not-counted still does not', outcomeCounts(excl), false);
  check('a plain round does', outcomeCounts(plain[0]), true);
  const avg3 = GOAL_METRICS.counting_avg(plain).val, avg4 = GOAL_METRICS.counting_avg(plain.concat([aer])).val;
  check('counting_avg reads the aerated round like a plain one', avg4, avg3);
  const soc = mk(7,'2026-11-07',{comp:false, greens_aerated:true});
  const tbl = gapTableHtml([soc, plain[0]]);
  const cellsOf = label => { const m = tbl.match(new RegExp(label + '</td>\\\\s*<td[^>]*>([^<]*)</td>\\\\s*<td[^>]*>([^<]*)</td>')); return m ? [m[1].trim(), m[2].trim()] : null; };
  check('putts: the aerated social side has a figure', cellsOf('Putts /18'), ['38.0', '38.0']);
  check('the old caveat is gone', tbl.indexOf('count for position and GIR only') === -1, true);

  // ── 5 · the forms write it ─────────────────────────────────────────────
  cardHoles = BASE_HOLES; editId = null;
  const form = cardFormHtml();
  check('card form has the box', form.indexOf('id="rf_ag"') !== -1, true);
  check('quick form has the box', simpleFormHtml().indexOf('id="sr_ag"') !== -1, true);
  document.getElementById('rf_d').value = '2026-11-04';
  document.getElementById('rf_ag').checked = true;
  document.getElementById('rf_tk').value = 'drive'; document.getElementById('rf_tkn').value = 'x'; document.getElementById('rf_tks').value = 'y';
  for (let i = 0; i < 18; i++){ document.getElementById('hp_'+i).value = '4'; document.getElementById('hs_'+i).value = '5'; }
  captured = null; await saveCardRound();
  check('saveCardRound writes greens_aerated', captured && captured.greens_aerated, true);
  document.getElementById('rf_ag').checked = false;
  captured = null; await saveCardRound();
  check('...and false when unticked', captured && captured.greens_aerated, false);
  document.getElementById('sr_d').value = '2026-11-04';
  document.getElementById('sr_ag').checked = true;
  document.getElementById('sr_tk').value = 'drive'; document.getElementById('sr_tkn').value = 'x'; document.getElementById('sr_tks').value = 'y';
  captured = null; await saveSimpleRound();
  check('saveSimpleRound writes greens_aerated', captured && captured.greens_aerated, true);

  // ── 6 · edit restores the tick ─────────────────────────────────────────
  ROUNDS = [aer]; editId = 4; document.getElementById('rf_ag').checked = false;
  fillFormFromRound();
  check('editing an aerated round ticks the box', document.getElementById('rf_ag').checked, true);
  ROUNDS = [plain[0]]; editId = 1; fillFormFromRound();
  check('...and a plain round clears it', document.getElementById('rf_ag').checked, false);

  // ── 7 · the badge ──────────────────────────────────────────────────────
  check('the rounds list shows the badge', __PAGES_SRC.indexOf('>aerated</span>') !== -1, true);

  // ── 8 · the paper card and the scan agree with the form ────────────────
  // The print sheet carries the box, the scan prompt asks for it, and a scan
  // that read it ticks rf_ag — otherwise a photographed winter card lands in
  // the stats as a summer one, which is the quiet failure the box exists for.
  check('the print sheet has the Aerated box', /comp-lbl">Aerated</.test(__SHEET_SRC), true);
  check('the scan prompt asks for it', __PAGES_SRC.indexOf('"aerated":false') !== -1, true);
  cardHoles = BASE_HOLES; editId = null; cardFormHtml();
  document.getElementById('rf_ag').checked = false;
  fillFromScan({ date:'2026-11-05', comp:false, practice:false, aerated:true, notes:null, holes:[] });
  check('a scanned tick lands on the form', document.getElementById('rf_ag').checked, true);
  fillFromScan({ date:'2026-11-05', comp:false, practice:false, notes:null, holes:[] });
  check('...and a card without the key clears it', document.getElementById('rf_ag').checked, false);

  console.log('');
  console.log(fails ? fails + ' FAILURE(S)' : 'all aerated-greens checks passed');
  process.exit(fails ? 1 : 0);
})();
`;

try { (0, eval)(harness); }
catch (e) { console.error('harness failed to load: ' + e.name + ': ' + e.message); process.exit(2); }
