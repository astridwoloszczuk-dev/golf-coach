#!/usr/bin/env node
/*
 * ratingtest.js — what a round was "played to", and the colour it gets.
 *
 * WHY. This number replaces a colour she could argue with (raw over-par against
 * flat cutoffs) with one she cannot see being wrong: the arithmetic happens
 * once, off two figures on a scorecard, and the only visible output is a hue.
 * A formula that is silently one shot out, or a band whose edge sits on the
 * wrong side of 8.9, would look completely normal on screen for months.
 *
 * So the fixed cards below are the whole point. They pin:
 *   1. the formula, against her own worked example — 89 at Colony West/Rot
 *      (76.9/141) is 9.7, the "one better than my handicap that day" she
 *      reported on 12 Sep
 *   2. every band edge, inclusive downward: 6.9 is LIGHT green, not bright;
 *      8.9 is light, 9.0 is amber; 10.9 is amber, 11.0 is red
 *   3. the refusals — 8 scored holes, no course row, a course row with no
 *      rating typed in — all null, never a number
 *   4. 9 holes scaled to 18 and MARKED, so a half card cannot pass as a whole one
 *   5. the chip states (figure / rating? / tee? / silence) that decide whether
 *      she is being asked for a tap or told an answer
 *   6. the picker writing course_id + course + tee together, and "somewhere
 *      else" writing free text with no id — the one that would corrupt data
 *
 *   node ratingtest.js
 */
const fs = require('fs');
const dir = process.argv[2] || '.';

const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const externals = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)[^"]*"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f))
  .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8'));

const pagesSrc = fs.readFileSync(`${dir}/app-pages.js`, 'utf8');

// ── DOM stub: ids that hold a value, and containers that hold markup.
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

// A card of `n` scored holes, par 4 each, that sums to `gross`.
function card(n, gross){
  const base = Math.floor(gross / n), extra = gross - base * n;
  return Array.from({length: n}, (_, i) => ({par: 4, score: String(base + (i < extra ? 1 : 0))}));
}

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
  const near = (label, got, want) => check(label, got == null ? got : Math.round(got * 10) / 10, want);

  try { sel = async () => []; } catch (e) {}
  try { selSoft = async () => []; } catch (e) {}
  try { ins = async () => []; } catch (e) {}
  try { upd = async () => []; } catch (e) {}
  try { renderRounds = () => {}; } catch (e) {}
  try { ME = { id:'rt', email:'a@b.c', role:'student' }; } catch (e) {}

  const mkCard = ${card.toString()};

  // ── the course rows this test prices against ───────────────────────────
  // WEST/ROT is hers, from the June 2026 re-rating sheet. NEUTRAL is a
  // synthetic row with slope 113, which makes "played to" equal gross18 minus
  // cr — so a band edge can be landed on exactly, without a scorecard that
  // happens to add up to a tenth of a shot.
  const WEST_ROT = { id: 1, name: 'Colony West', tee: 'Rot',     par: 73, cr: 76.9, slope: 141 };
  const WEST_BLK = { id: 2, name: 'Colony West', tee: 'Schwarz', par: 73, cr: 78.9, slope: 144 };
  const BRUNN    = { id: 3, name: 'GC Brunn',    tee: 'Rot',     par: 70, cr: null, slope: null };
  const NEUTRAL  = cr => ({ id: 9, name: 'Test', tee: 'Rot', par: 72, cr, slope: 113 });

  COURSES = [WEST_ROT, WEST_BLK, BRUNN];
  COURSE_BY_ID = {};
  for (const c of COURSES) COURSE_BY_ID[c.id] = c;

  // ── 1 · HER WORKED EXAMPLE ─────────────────────────────────────────────
  // 10 Sep 2026, Colony West off the red tees, 89 gross over 18. She was on
  // 10.5 that day and reported the round as one better; the formula says 9.7.
  const sep10 = { id: 7168, date:'2026-09-10', course:'Colony West', tee:'Rot',
                  course_id: 1, comp: true, holes_data: mkCard(18, 89) };
  const pt = playedTo(sep10);
  near('89 at West/Rot (76.9/141) plays to', pt && pt.val, 9.7);
  check('...off a full card, not scaled', pt && pt.scaled, false);
  check('...and it prints without a tilde', playedToTxt(pt), '9.7');
  check('...amber, because it is worse than 8.9', playedToBand(pt.val), 'var(--ye)');

  // The same 89 off the BLACK tees is a different round. This is the whole
  // argument for one row per tee: 1.7 shots, invisible to the old colour.
  near('the same 89 off Schwarz (78.9/144)', playedTo(sep10, WEST_BLK).val, 7.9);

  // ── 2 · BAND EDGES, inclusive downward ─────────────────────────────────
  // Priced off a flat 80 so the only thing moving is the course rating.
  const eighty = { id: 2, date:'2026-01-01', course_id: 9, holes_data: mkCard(18, 80) };
  const at = cr => playedTo(eighty, NEUTRAL(cr));
  const bandAt = cr => playedToBand(at(cr).val);
  near('6.8 →', at(73.2).val, 6.8);  check('   bright green (better than goal − 2)', bandAt(73.2), 'var(--gn)');
  near('6.9 →', at(73.1).val, 6.9);  check('   LIGHT green — the edge is inclusive', bandAt(73.1), 'var(--gn2)');
  near('8.9 →', at(71.1).val, 8.9);  check('   light green — the goal itself', bandAt(71.1), 'var(--gn2)');
  near('9.0 →', at(71.0).val, 9.0);  check('   amber, one tenth past the goal', bandAt(71.0), 'var(--ye)');
  near('10.9 →', at(69.1).val, 10.9); check('   amber — the far edge is inclusive too', bandAt(69.1), 'var(--ye)');
  near('11.0 →', at(69.0).val, 11.0); check('   red', bandAt(69.0), 'var(--rd)');

  // Banded on the number she can SEE, one decimal. 6.94 and 6.89 both print
  // "6.9", so both must be the same colour as a printed 6.9 — light green.
  check('6.94 bands as the 6.9 it prints', playedToBand(6.94), 'var(--gn2)');
  check('6.89 bands as the 6.9 it prints', playedToBand(6.89), 'var(--gn2)');

  // ── 3 · WHEN IT REFUSES ────────────────────────────────────────────────
  check('8 scored holes → no figure', playedTo({course_id:1, holes_data: mkCard(8, 40)}), null);
  check('no course row on the round', playedTo({course_id:null, course:'Somewhere', holes_data: mkCard(18, 89)}), null);
  check('course row with no rating yet', playedTo({course_id:3, holes_data: mkCard(18, 81)}), null);
  check('a quick-add round with no card', playedTo({course_id:1, is_simple:true, holes_data:null}), null);
  check('a course_id pointing at nothing', playedTo({course_id:404, holes_data: mkCard(18, 89)}), null);

  // ── 4 · NINE HOLES: scaled, and SAID to be scaled ──────────────────────
  // 9 holes at 44 is a gross of 88 over 18 — one shot better than the 89 above.
  const nine = { id: 3, date:'2026-06-17', course_id: 1, holes_data: mkCard(9, 44) };
  const p9 = playedTo(nine);
  check('9 scored holes produce a figure', !!p9, true);
  check('...marked as scaled', p9.scaled, true);
  check('...and says how many holes it came from', p9.holes, 9);
  near('...scaled to 18 before pricing', p9.val, 8.9);
  check('...printed with a tilde', playedToTxt(p9), '~8.9');

  // These four cards are replayed byte-for-byte by James's played_to_test.py.
  // Two implementations of one number is the arrangement the spec asks for; the
  // pair of tests is what stops them drifting a tenth apart and telling her 9.7
  // in the app while the Sunday digest tells Wes 9.8 about the same round.
  near('cross-check · 18 holes, 89', playedTo({course_id:1, holes_data: mkCard(18, 89)}).val, 9.7);
  near('cross-check · 18 holes, 89 off black', playedTo({course_id:2, holes_data: mkCard(18, 89)}).val, 7.9);
  near('cross-check · 9 holes, 44', playedTo({course_id:1, holes_data: mkCard(9, 44)}).val, 8.9);
  near('cross-check · 17 holes, 83', playedTo({course_id:1, holes_data: mkCard(17, 83)}).val, 8.8);

  // ── 5 · THE CHIP: a figure, or the ONE tap that is missing ─────────────
  ROUNDS = [];
  const chip = r => playedToChipHtml(r);
  check('a rated round shows its figure', chip(sep10).indexOf('played to 9.7') !== -1, true);
  check('...coloured', chip(sep10).indexOf('var(--ye)') !== -1, true);
  // Brunn 8 Sep: the row exists, the scorecard figures do not.
  const sep8 = { id: 7167, date:'2026-09-08', course:'GC Brunn', tee:'Rot', course_id: 3,
                 comp: true, holes_data: mkCard(18, 81) };
  check('Brunn, unrated, asks for the rating', chip(sep8).indexOf('rating?') !== -1, true);
  check('...and opens THAT course sheet', chip(sep8).indexOf('editCourse(3)') !== -1, true);
  // A Colony round whose historic tee the migration refused to guess.
  const unknownTee = { id: 7121, date:'2026-07-13', course:'Colony West', course_id: null,
                       holes_data: mkCard(18, 83) };
  check('unknown tee asks which tee', chip(unknownTee).indexOf('tee?') !== -1, true);
  check('...and opens that round', chip(unknownTee).indexOf('editRound(7121)') !== -1, true);
  // A genuine one-off course has no missing tap, so it says nothing at all.
  check('a free-text course is silent', chip({id:5, course:'Some links', course_id:null, holes_data: mkCard(18, 90)}), '');
  check('no "n/a" anywhere', chip(sep8).indexOf('n/a'), -1);

  // ── 6 · THE PICKER writes all three columns, or none ───────────────────
  ROUNDS = [sep10, sep8];
  document.getElementById('rf_cs').innerHTML = '';
  const opts = coursePickerOptionsHtml('');
  check('the picker offers every course+tee', (opts.match(/<option value="\\d/g) || []).length, 3);
  check('...labelled course · tee', opts.indexOf('Colony West · Rot') !== -1, true);
  check('...with the free-text hatch', opts.indexOf('somewhere else') !== -1, true);
  check('...and the add hatch', opts.indexOf('__add') !== -1, true);
  // Ordered by last played: Brunn (8 Sep) is the only other course with a
  // round, so West (10 Sep) must come first.
  check('ordered by last played', opts.indexOf('Colony West · Rot') < opts.indexOf('GC Brunn · Rot'), true);

  document.getElementById('rf_cs').value = '2';
  check('picking a row writes all three columns', coursePickValue('rf'),
        {course_id: 2, course: 'Colony West', tee: 'Schwarz'});
  document.getElementById('rf_cs').value = '__other';
  document.getElementById('rf_c').value = 'Emirates Golf Club';
  check('"somewhere else" keeps free text and NO id', coursePickValue('rf'),
        {course_id: null, course: 'Emirates Golf Club', tee: null});
  document.getElementById('rf_cs').value = '';
  document.getElementById('rf_c').value = '';
  check('nothing picked saves nothing', coursePickValue('rf'), {course_id:null, course:null, tee:null});

  // Re-opening a round pre-selects what it was played on.
  setCoursePick('rf', sep10);
  check('editing an old round pre-selects its course', document.getElementById('rf_cs').value, '1');
  setCoursePick('rf', unknownTee);
  check('a tee? round lands on free text, name kept', document.getElementById('rf_cs').value, '__other');
  check('...and does not lose the course name', document.getElementById('rf_c').value, 'Colony West');

  // A scan can only resolve a name it matches exactly AND unambiguously.
  check('a scan cannot guess between two tees', scanCourseGuess('Colony West').course_id, null);
  check('...but a single-tee course resolves', scanCourseGuess('GC Brunn').course_id, 3);

  // ── 7 · THE GOALS BOARD survives rounds with no figure ─────────────────
  const mixed = [
    sep10, sep8, unknownTee,
    {id:11, date:'2026-07-16', course:'Colony Ost', course_id:1, comp:true, holes_data: mkCard(18, 94)},
    {id:12, date:'2026-09-06', course:'Colony West', course_id:1, comp:false, holes_data: mkCard(18, 89)},
    {id:13, date:'2026-09-03', course:'Colony West', course_id:1, comp:false, holes_data: mkCard(17, 84)},
    {id:14, date:'2026-05-19', course:'Colony West', course_id:1, comp:true, holes_data: mkCard(18, 84)},
  ];
  let m;
  try { m = GOAL_METRICS.counting_avg(mixed); } catch(e){ m = {threw: String(e.message)}; }
  check('counting_avg does not throw on unrated rounds', !m.threw, true);
  check('...and reads in played-to against the goal', String(m.txt).indexOf('goal 8.9') !== -1, true);
  try { m = GOAL_METRICS.comp_social_gap(mixed); } catch(e){ m = {threw: String(e.message)}; }
  check('comp_social_gap does not throw', !m.threw, true);
  check('...and is in handicap units now', String(m.txt).indexOf('shots worse under a card') !== -1, true);

  // ── 8 · ONE READER ─────────────────────────────────────────────────────
  // The five-shot Colony fudge was a stand-in for exactly this data. If it is
  // still in the file, two different answers to "how good was that round" are
  // live at once.
  check('the HOME_ADJ fudge is gone', __PAGES_SRC.indexOf('HOME_ADJ'), -1);
  check('...and so is "needs +5"', __PAGES_SRC.indexOf('needs +5'), -1);
  // The differential is computed in exactly one place. Other 113s in the file
  // are rgba() colours and prose, so count the ones doing arithmetic.
  const formulas = (__PAGES_SRC.match(/\\* 113 \\//g) || []).length;
  check('the formula appears once, in playedTo', formulas, 1);

  console.log('');
  console.log(fails ? fails + ' FAILURE(S)' : 'all rating checks passed');
  process.exit(fails ? 1 : 0);
})();
`;

try { (0, eval)(harness); }
catch (e) { console.error('harness failed to load: ' + e.name + ': ' + e.message); process.exit(2); }
