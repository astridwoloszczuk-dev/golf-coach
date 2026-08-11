#!/usr/bin/env node
/*
 * holestest.js — the extra-holes card, end to end.
 *
 * WHY. Her Dürnberg match on 10 Aug 2026 went to the 20th hole and the manual
 * card was a hardcoded `Array.from({length:18})` in three places: the form, the
 * save, and the scan-fill. smoke.js calls renderers, so it would have passed a
 * card that renders 18 boxes and silently drops holes 19-20 on save — which is
 * the exact fault worth a test, because you only find it a week later when the
 * round reads wrong and the card is long gone.
 *
 * Checks, in the order they can break:
 *   1. the form renders 18 boxes by default, and 20 after two ＋ taps
 *   2. saveCardRound() writes 20 holes_data entries, with hole 20's values
 *   3. `holes` on the row is 20, not 18
 *   4. removeCardHole() cannot go below 18
 *   5. reopening a 20-hole round via editRound() restores 20 boxes, so an edit
 *      does not truncate what the first save got right
 *   6. matchplay is actually written (the column the stats filter on and no
 *      screen ever set)
 *
 *   node holestest.js
 */
const fs = require('fs');
const dir = process.argv[2] || '.';

const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const externals = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)[^"]*"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f))
  .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8'));

// ── DOM stub that actually models the two things this test needs: a container
// whose children can be appended to and removed, and inputs that hold a value.
const els = {};
function mkEl(id){
  return {
    id, _h:'', textContent:'', value:'', checked:false, style:{}, dataset:{},
    _kids: [],
    set innerHTML(v){ this._h = String(v); },
    get innerHTML(){ return this._h; },
    get lastElementChild(){ return this._kids[this._kids.length-1] || null; },
    insertAdjacentHTML(pos, s){ this._h += s; this._kids.push(mkChild(this)); },
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false } },
    setAttribute(){}, getAttribute(){ return null }, appendChild(){}, removeChild(){},
    addEventListener(){}, querySelector(){ return null }, querySelectorAll(){ return [] },
    closest(){ return null }, focus(){}, remove(){}, scrollIntoView(){},
  };
}
function mkChild(parent){
  return { scrollIntoView(){}, remove(){ parent._kids.pop(); } };
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

  // Some of these are const in index.html, some are function declarations, and
  // which is which is not this test's business — same try/catch trick smoke.js
  // uses so the harness survives either.
  let captured = null;
  try { saveRoundRow = async row => { captured = row; }; } catch (e) {}
  try { sel = async () => []; } catch (e) {}
  try { selSoft = async () => []; } catch (e) {}
  try { ins = async () => []; } catch (e) {}
  try { upd = async () => []; } catch (e) {}
  try { renderRounds = () => {}; } catch (e) {}
  try { ME = { id:'smoke', email:'a@b.c', role:'student' }; } catch (e) {}
  try { STUDENT_ID = 'smoke'; } catch (e) {}

  // ── 1 · default card is 18, grows to 20 ────────────────────────────────
  cardHoles = BASE_HOLES;
  const form = cardFormHtml();
  check('form renders 18 hole headers', (form.match(/Hole \\d+<\\/div>/g) || []).length, 18);
  check('form has no hole 19 by default', form.indexOf('Hole 19<') !== -1, false);

  document.getElementById('rf_holes')._h = '';
  addCardHole(); addCardHole();
  check('cardHoles after two taps', cardHoles, 20);
  check('appended markup has hole 19', document.getElementById('rf_holes').innerHTML.indexOf('Hole 19<') !== -1, true);
  check('appended markup has hole 20', document.getElementById('rf_holes').innerHTML.indexOf('Hole 20<') !== -1, true);

  // ── 2/3/6 · the save carries all 20, plus holes + matchplay ────────────
  document.getElementById('rf_d').value = '2026-08-10';
  document.getElementById('rf_c').value = 'Colony West';
  document.getElementById('rf_co').checked = true;
  document.getElementById('rf_mp').checked = true;
  for (let i = 0; i < 20; i++){
    document.getElementById('hp_' + i).value = '4';
    document.getElementById('hs_' + i).value = String(4 + (i % 2));
  }
  document.getElementById('hputts_19').value = '2';
  document.getElementById('hmp_19').value = '+';
  // takeawayRow() needs its two fields or saveCardRound bails before saving
  document.getElementById('rf_tk').value = 'putting';
  document.getElementById('rf_tkn').value = 'held the stroke on 20';
  document.getElementById('rf_tks').value = 'the winning putt';

  await saveCardRound();
  if (!captured) { console.log('  FAIL  saveCardRound produced no row (takeaway gate?)'); fails++; }
  else {
    check('holes_data length', captured.holes_data.length, 20);
    check('holes column', captured.holes, 20);
    check('matchplay written', captured.matchplay, true);
    check('hole 20 score kept', captured.holes_data[19].score, '5');
    check('hole 20 putts kept', captured.holes_data[19].putts, 2);
    check('hole 20 mp mark kept', captured.holes_data[19].mp, '+');
  }

  // ── 4 · cannot shrink below 18 ─────────────────────────────────────────
  removeCardHole(); removeCardHole(); removeCardHole();
  check('floor at 18', cardHoles, 18);

  // ── 5 · reopening a 20-hole round restores 20 boxes ────────────────────
  ROUNDS = [{ id: 7, is_simple:false, matchplay:true,
              holes_data: Array.from({length:20}, () => ({par:4, score:4})) }];
  editRound(7);
  check('editRound restores 20', cardHoles, 20);
  check('reopened form renders 20 headers', (cardFormHtml().match(/Hole \\d+<\\/div>/g) || []).length, 20);

  console.log('');
  console.log(fails ? fails + ' FAILURE(S)' : 'all checks passed');
  process.exit(fails ? 1 : 0);
})();
`;

try { (0, eval)(harness); }
catch (e) { console.error('harness failed to load: ' + e.name + ': ' + e.message); process.exit(2); }
