// finishertest.js — finishers, as the page shows and sends them.
//
// Wes, via Astrid, 5 Oct 2026: on each drill he assigns he names a finisher
// from his list. Astrid, 18 Oct 2026: every drill ends with a finisher — the
// one he named, or else THE DICE (his "Roll It": a numbered list whose lines
// are the faces). She records made / missed with one tap; a miss repeats the
// drill.
//
// The RULES are in migrations 32 + 33 (the roll, the lock, the repeat). This
// pins the page's half:
//
//   · only Wes gets the picker, on the drill sheet and on any row's sheet;
//   · the picker's default is the dice and offers his named finishers — the
//     dice itself is not listed twice, and there is no "wheel" and no "none";
//   · the default sends no finisher columns at all;
//   · a finisher written as a numbered list is read as the dice, wrapped
//     lines joined to the face above;
//   · she gets Roll on any drill row not yet rolled, Made / Missed once the
//     finisher is known, and never the picker; a lesson has no finisher;
//   · her save carries finisher_result and nothing that could change the
//     instruction; an unrolled row's save carries no finisher key;
//   · the roll goes to the database function, not to Math.random, and the
//     tumble shows the faces the database sent back.
//
//   node finishertest.js .
const fs = require('fs');
const dir = process.argv[2] || '.';
const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pages = fs.readFileSync(`${dir}/app-pages.js`, 'utf8');

const nullEl = () => ({
  set innerHTML(v){ this._h = String(v); }, get innerHTML(){ return this._h || ''; },
  textContent:'', value:'', checked:false, className:'', disabled:false, style:{}, dataset:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(){}, getAttribute(){return null}, appendChild(){}, addEventListener(){},
  querySelector(){return null}, querySelectorAll(){return []}, closest(){return null},
  click(){}, focus(){}, getBoundingClientRect(){return{top:0,left:0,width:0,height:0}},
  get previousElementSibling(){ return nullEl(); },
});
const seen = {};
global.document = { getElementById: id => (seen[id] || (seen[id] = nullEl())),
  querySelector:()=>null, querySelectorAll:()=>[], createElement:nullEl,
  addEventListener(){}, body:nullEl(), documentElement:nullEl() };
global.window = { location:{origin:'https://x.github.io',pathname:'/golf-coach/',search:'',hash:''},
  history:{replaceState(){}}, addEventListener(){}, matchMedia:()=>({matches:false}) };
global.location = global.window.location; global.history = global.window.history;
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
global.navigator = { userAgent:'node' };

const mon = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; })();
const WK = mon.toISOString().slice(0,10);

const DICE_TEXT = 'THE DICE \n \n1 - Up and down from 10 yards from flag\n\n2 - Up and down with putter from off the\ngreen 15 yards from flag\n\n5 - 1 Putt from 3ft\n\n12 - Smash it 100 yard wide fairway.';
const ROLLED = {id:3, name:'Roll It · 12 — Smash it 100 yard wide fairway.', dice:true, face:12,
  text:'Smash it 100 yard wide fairway.', already:false,
  faces:[{n:1,text:'Up and down from 10 yards from flag'},{n:2,text:'Up and down with putter from off the green 15 yards from flag'},
         {n:5,text:'1 Putt from 3ft'},{n:12,text:'Smash it 100 yard wide fairway.'}]};

const drill = (id, name) => ({id, name, category:'long_game_driving', description:'',
                              scoring_hint:'out of 15', created_by:'teacher'});
const A = (id, day, by, d, extra) => Object.assign({id, student_id:'x', drill_id:d.id, label:null,
  week_start:WK, day_index:day, assigned_by:by, done:false, note:null, score:null, out_of:null,
  finisher_mode:'none', finisher_id:null, finisher_name:null, finisher_result:null, repeat_of:null,
  drills:d}, extra || {});
global.FIX = {
  finishers: [{id:1, name:'4ft putt', description:'One putt from 4ft.', archived:false},
              {id:2, name:'First-hole drive', description:'Driver, nothing safe.', archived:false},
              {id:3, name:'Roll It', description:DICE_TEXT, archived:false}],
  assignments: [
    A(1, 0, 'teacher', drill(5,'Fairway corridor'), {finisher_mode:'pick', finisher_id:1, finisher_name:'4ft putt'}),
    A(2, 1, 'claude',  drill(6,'Ladder 30-80m'),    {finisher_mode:'wheel'}),         // legacy wheel row = the dice
    A(3, 2, 'student', drill(7,'Range - driver')),                                     // default = the dice
    A(4, 0, 'teacher', drill(5,'Fairway corridor'), {finisher_mode:'pick', finisher_id:1, finisher_name:'4ft putt', repeat_of:1}),
    A(5, 3, 'student', {id:null}, {label:'Lesson with Wes', drills:null}),             // a lesson: no finisher
    A(6, 4, 'teacher', drill(7,'Range - driver'),   {finisher_mode:'pick', finisher_id:3, finisher_name:'Roll It'}), // picked by name = not rolled yet
    A(7, 4, 'teacher', drill(6,'Ladder 30-80m'),    {finisher_mode:'none', finisher_id:3, finisher_name:ROLLED.name, finisher_result:'made'}),
    A(8, 4, 'teacher', drill(6,'Ladder 30-80m'),    {finisher_mode:'pick', finisher_id:null, finisher_name:null, repeat_of:7}), // a pick row stripped by a repeat = the dice
  ],
  drills: [drill(5,'Fairway corridor')],
  planned_rounds: [], tournaments: [], golf_rounds: [], week_submissions: [], week_reflections: [],
  app_settings: [], weekly_notes: [], goals: [], feedback: [], notifications: [],
};
global.sent = [];
global.fetch = async (url, opt) => {
  const path = String(url).split('/rest/v1/')[1] || '';
  const method = (opt && opt.method) || 'GET';
  if (method !== 'GET') global.sent.push([method, path.split('?')[0], opt.body ? JSON.parse(opt.body) : null]);
  if (path.startsWith('rpc/spin_finisher'))
    return { ok:true, status:200, text:async()=>JSON.stringify(ROLLED) };
  const key = Object.keys(global.FIX).find(k => path.startsWith(k));
  const data = key ? global.FIX[key] : [];
  return { ok:true, status:200, json:async()=>data, text:async()=>JSON.stringify(data) };
};
global.confirm = () => true; global.alert = () => {};

const harness = `
${inline.join('\n;\n')}
;
${pages}
;
(async () => {
  try { STUDENT_ID='x'; GOALS_STUDENT_WRITABLE=false; } catch(e){}
  const checks = [];
  const ck = (k,v) => checks.push([k, !!v]);
  const sheet = () => el('sheet-in').innerHTML;
  const last = (m, t) => (global.sent.filter(s => s[0]===m && s[1]===t).pop() || [])[2];
  const hasFinKey = o => !!o && Object.keys(o).some(k => k.startsWith('finisher') || k === 'repeat_of');
  const row = id => ASSIGN.find(a => a.id === id);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ── THE DICE IS READ FROM HIS TEXT ─────────────────────────────── */
  const faces = finisherFaces(${JSON.stringify(DICE_TEXT)});
  ck('numbered lines are the faces, headings are not',   faces.length === 4 && faces[0].n === 1 && faces[3].n === 12);
  ck('a wrapped line joins the face above',              faces[1].text === 'Up and down with putter from off the green 15 yards from flag');
  ck('a finisher with no numbered list is not a dice',   finisherFaces('One putt from 4ft.').length === 0
                                                         && finisherFaces('Setup - two tees.\\nPutt 1 - to one tee.\\nPutt 2 - back.').length === 0);

  /* ── HER SIDE ───────────────────────────────────────────────────── */
  ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' };
  await renderWeek();
  ck('Roll It is the dice',                              diceFinisher() && diceFinisher().id === 3);
  const wk = el('pg-week').innerHTML;
  ck('a known finisher is marked on its pill, an unrolled one is not', (wk.match(/◎/g) || []).length === 4);
  ck('a repeat is marked on its pill',                   (wk.match(/↻/g) || []).length === 2);
  ck('a pick row with no finisher left reads as the dice', finisherValue(row(8)) === 'none');

  openAssignmentSheet(row(1));
  ck('named finisher: she sees what it is',              /4ft putt/.test(sheet()) && /One putt from 4ft/.test(sheet()));
  ck('named finisher: she gets Made and Missed',         /setFinResult\\('made'\\)/.test(sheet()) && /setFinResult\\('missed'\\)/.test(sheet()));
  ck('she is told what a miss costs',                    /drill comes back/.test(sheet()));
  ck('she never gets the picker',                        !/id="a-fin"/.test(sheet()));
  setFinResult('missed');
  global.sent.length = 0;
  await saveAssignment(1);
  const p1 = last('PATCH', 'assignments');
  ck('her save records the miss',                        p1 && p1.finisher_result === 'missed');
  ck('her save cannot change the instruction',           p1 && !('finisher_mode' in p1) && !('finisher_id' in p1) && !('finisher_name' in p1));

  await renderWeek();
  openAssignmentSheet(row(1));
  setFinResult('made'); setFinResult('made');           // tap twice = clear
  global.sent.length = 0;
  await saveAssignment(1);
  ck('tapping the same result again clears it',          last('PATCH', 'assignments').finisher_result === null);

  await renderWeek();
  openAssignmentSheet(row(3));
  ck('a plain drill row is the dice: she gets Roll, not a result', /Roll It/.test(sheet()) && /rollFinisher\\(3\\)/.test(sheet()) && !/setFinResult/.test(sheet()));
  global.sent.length = 0;
  await saveAssignment(3);
  ck('...and its save sends no finisher column',         !hasFinKey(last('PATCH', 'assignments')));

  await renderWeek();
  openAssignmentSheet(row(2));
  ck('a legacy wheel row is the dice too',               /rollFinisher\\(2\\)/.test(sheet()));
  global.sent.length = 0;
  await rollFinisher(2);
  ck('the roll is asked of the database',                global.sent.some(s => s[1] === 'rpc/spin_finisher' && s[2].aid === 2));
  ck('the tumble shows the faces the database sent',     /Up and down from 10 yards/.test(el('fin-box').innerHTML) && /100 yard wide/.test(el('fin-box').innerHTML) && /fin-die/.test(el('fin-box').innerHTML));
  await wait(5200);
  ck('...then the face she rolled, with Made / Missed',  /12 — Smash it/.test(el('fin-box').innerHTML) && /from the dice/.test(el('fin-box').innerHTML) && /setFinResult\\('made'\\)/.test(el('fin-box').innerHTML));
  ck('the list is not repeated under the rolled face',   !/Up and down from 10 yards/.test(el('fin-box').innerHTML));

  openAssignmentSheet(row(6));
  ck('"Roll It" picked by name is still unrolled',       /rollFinisher\\(6\\)/.test(sheet()) && !/setFinResult/.test(sheet()));

  openAssignmentSheet(row(7));
  ck('a rolled face she already made shows its result',  /12 — Smash it/.test(sheet()) && /setFinResult/.test(sheet()));

  openAssignmentSheet(row(5));
  ck('a lesson has no finisher',                         !/Finisher/.test(sheet()) && !/rollFinisher/.test(sheet()));

  openAssignmentSheet(row(4));
  ck('a repeat says why it is there',                    /finisher was missed/.test(sheet()));

  await renderDrills();
  const lib1 = el('pg-drills').innerHTML;
  ck('she can read the finisher list, the dice marked',  /Finishers/.test(lib1) && /First-hole drive/.test(lib1) && /nothing safe/.test(lib1) && /🎲 Roll It/.test(lib1));
  ck('she cannot add to it',                             !/editFinisher/.test(lib1));
  await openDrill(5);
  ck('her drill sheet has no picker',                    !/id="as-fin"/.test(sheet()));
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  ck('her own assignment sends no finisher column',      !hasFinKey(last('POST', 'assignments')));

  /* ── HIS SIDE ───────────────────────────────────────────────────── */
  ME = { id:'t', email:'w@b', role:'teacher', display_name:'Wes' };
  await renderDrills();
  ck('he can add and edit finishers',                    /editFinisher\\(null\\)/.test(el('pg-drills').innerHTML) && /editFinisher\\(1\\)/.test(el('pg-drills').innerHTML));
  await openDrill(5);
  ck('his drill sheet has the picker',                   /id="as-fin"/.test(sheet()));
  ck('the picker: the dice by default, then his named list', /Roll It — the dice \\(default\\)/.test(sheet()) && /value="f:1"/.test(sheet()) && /value="f:2"/.test(sheet()));
  ck('no wheel, no "no finisher", the dice not listed twice', !/Wheel/.test(sheet()) && !/No finisher/.test(sheet()) && !/value="f:3"/.test(sheet()));

  el('as-fin').value = 'none';
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  ck('the default adds no column to the row',            !hasFinKey(last('POST', 'assignments')));
  ck('she is told the dice is on it',                    /Finisher: the dice/.test((last('POST', 'notifications') || {}).message || ''));

  el('as-fin').value = 'f:2';
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  const k = last('POST', 'assignments');
  ck('pick: the row carries the finisher and its name',  k.finisher_mode === 'pick' && k.finisher_id === 2 && k.finisher_name === 'First-hole drive');
  ck('...and she is told which',                         /Finisher: First-hole drive/.test((last('POST', 'notifications') || {}).message || ''));

  await renderWeek();
  openAssignmentSheet(row(3));
  ck("he can set one on a row that is not his",          /id="a-fin"/.test(sheet()));
  el('a-fin').value = 'f:2';
  global.sent.length = 0;
  await saveAssignment(3);
  const t3 = last('PATCH', 'assignments');
  ck('...and the change is sent, result cleared',        t3.finisher_mode === 'pick' && t3.finisher_id === 2 && t3.finisher_result === null);

  await renderWeek();
  openAssignmentSheet(row(2));
  ck('an unrolled dice row shows him "not rolled"',      /Not rolled yet/.test(sheet()) && !/rollFinisher/.test(sheet()));
  el('a-fin').value = finisherValue(row(2));
  global.sent.length = 0;
  await saveAssignment(2);
  ck('saving a legacy wheel row untouched changes nothing', !hasFinKey(last('PATCH', 'assignments')));

  await renderWeek();
  openAssignmentSheet(row(1));
  ck('he sees the result, not the buttons',              /No result recorded|Result:/.test(sheet()) && !/setFinResult/.test(sheet()));
  el('a-fin').value = finisherValue(row(1));
  global.sent.length = 0;
  await saveAssignment(1);
  ck('saving without changing the picker changes nothing', !hasFinKey(last('PATCH', 'assignments')));

  const bad = checks.filter(c => !c[1]);
  for (const [k2, v] of checks) console.log((v ? '  ok   ' : '  FAIL ') + k2);
  console.log(bad.length ? '\\n' + bad.length + ' FAILED' : '\\nall ' + checks.length + ' passed');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
`;
eval(harness);
