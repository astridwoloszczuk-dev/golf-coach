// finishertest.js — finishers, as the page shows and sends them.
//
// Wes, via Astrid, 5 Oct 2026: on each drill he assigns he either names a
// finisher from his list, makes her draw one on a wheel, or sets none. She
// records made / missed with one tap; a miss repeats the drill.
//
// The RULES are in migration 32 (the draw, the lock, the repeat). This pins
// the page's half:
//
//   · only Wes gets the picker, on the drill sheet and on any row's sheet;
//   · "no finisher" sends no finisher columns at all, so a pre-32 database
//     saves an ordinary assignment exactly as before;
//   · she gets Spin on an unspun wheel row and Made / Missed on a named one,
//     and never the picker;
//   · her save carries finisher_result and nothing that could change the
//     instruction; an ordinary row's save carries no finisher key;
//   · the spin goes to the database function, not to Math.random.
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

const drill = (id, name) => ({id, name, category:'long_game_driving', description:'',
                              scoring_hint:'out of 15', created_by:'teacher'});
const A = (id, day, by, d, extra) => Object.assign({id, student_id:'x', drill_id:d.id, label:null,
  week_start:WK, day_index:day, assigned_by:by, done:false, note:null, score:null, out_of:null,
  finisher_mode:'none', finisher_id:null, finisher_name:null, finisher_result:null, repeat_of:null,
  drills:d}, extra || {});
global.FIX = {
  finishers: [{id:1, name:'4ft putt', description:'One putt from 4ft.', archived:false},
              {id:2, name:'First-hole drive', description:'Driver, nothing safe.', archived:false}],
  assignments: [
    A(1, 0, 'teacher', drill(5,'Fairway corridor'), {finisher_mode:'pick', finisher_id:1, finisher_name:'4ft putt'}),
    A(2, 1, 'claude',  drill(6,'Ladder 30-80m'),    {finisher_mode:'wheel'}),
    A(3, 2, 'student', drill(7,'Range - driver')),
    A(4, 0, 'teacher', drill(5,'Fairway corridor'), {finisher_mode:'pick', finisher_id:1, finisher_name:'4ft putt', repeat_of:1}),
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
    return { ok:true, status:200, text:async()=>JSON.stringify({id:2, name:'First-hole drive', description:'', already:false}) };
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

  /* ── HER SIDE ───────────────────────────────────────────────────── */
  ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' };
  await renderWeek();
  const wk = el('pg-week').innerHTML;
  ck('a row with a finisher is marked on its pill',   (wk.match(/◎/g) || []).length === 3);
  ck('a repeat is marked on its pill',                (wk.match(/↻/g) || []).length === 1);

  openAssignmentSheet(row(1));
  ck('named finisher: she sees what it is',           /4ft putt/.test(sheet()) && /One putt from 4ft/.test(sheet()));
  ck('named finisher: she gets Made and Missed',      /setFinResult\\('made'\\)/.test(sheet()) && /setFinResult\\('missed'\\)/.test(sheet()));
  ck('she is told what a miss costs',                 /drill comes back/.test(sheet()));
  ck('she never gets the picker',                     !/id="a-fin"/.test(sheet()));
  setFinResult('missed');
  global.sent.length = 0;
  await saveAssignment(1);
  const p1 = last('PATCH', 'assignments');
  ck('her save records the miss',                     p1 && p1.finisher_result === 'missed');
  ck('her save cannot change the instruction',        p1 && !('finisher_mode' in p1) && !('finisher_id' in p1) && !('finisher_name' in p1));

  await renderWeek();
  openAssignmentSheet(row(1));
  setFinResult('made'); setFinResult('made');           // tap twice = clear
  global.sent.length = 0;
  await saveAssignment(1);
  ck('tapping the same result again clears it',       last('PATCH', 'assignments').finisher_result === null);

  await renderWeek();
  openAssignmentSheet(row(2));
  ck('unspun wheel: she gets Spin, not a result',     /spinFinisher\\(2\\)/.test(sheet()) && !/setFinResult/.test(sheet()));
  global.sent.length = 0;
  await spinFinisher(2);
  ck('the draw is asked of the database',             global.sent.some(s => s[1] === 'rpc/spin_finisher' && s[2].aid === 2));
  ck('the wheel shows every finisher on the list',    /4ft putt/.test(el('fin-box').innerHTML) && /First-hole drive/.test(el('fin-box').innerHTML));

  openAssignmentSheet(row(3));
  ck('a row with no finisher shows none',             !/Finisher/.test(sheet()));
  global.sent.length = 0;
  await saveAssignment(3);
  ck('...and its save sends no finisher column',      !hasFinKey(last('PATCH', 'assignments')));

  openAssignmentSheet(row(4));
  ck('a repeat says why it is there',                 /finisher was missed/.test(sheet()));

  await renderDrills();
  const lib1 = el('pg-drills').innerHTML;
  ck('she can read the finisher list',                /Finishers/.test(lib1) && /First-hole drive/.test(lib1) && /nothing safe/.test(lib1));
  ck('she cannot add to it',                          !/editFinisher/.test(lib1));
  await openDrill(5);
  ck('her drill sheet has no picker',                 !/id="as-fin"/.test(sheet()));
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  ck('her own assignment sends no finisher column',   !hasFinKey(last('POST', 'assignments')));

  /* ── HIS SIDE ───────────────────────────────────────────────────── */
  ME = { id:'t', email:'w@b', role:'teacher', display_name:'Wes' };
  await renderDrills();
  ck('he can add and edit finishers',                 /editFinisher\\(null\\)/.test(el('pg-drills').innerHTML) && /editFinisher\\(1\\)/.test(el('pg-drills').innerHTML));
  await openDrill(5);
  ck('his drill sheet has the picker',                /id="as-fin"/.test(sheet()));
  ck('the picker offers none, the wheel and his list', /No finisher/.test(sheet()) && /Wheel/.test(sheet()) && /value="f:1"/.test(sheet()) && /value="f:2"/.test(sheet()));

  el('as-fin').value = 'none';
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  ck('"no finisher" adds no column to the row',       !hasFinKey(last('POST', 'assignments')));

  el('as-fin').value = 'wheel';
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  const w = last('POST', 'assignments');
  ck('wheel: the row carries the mode, unspun',       w.finisher_mode === 'wheel' && w.finisher_name === null);
  ck('she is told the wheel is on it',                /Finisher: the wheel/.test((last('POST', 'notifications') || {}).message || ''));

  el('as-fin').value = 'f:2';
  global.sent.length = 0;
  await assignDrill(5, '${WK}');
  const k = last('POST', 'assignments');
  ck('pick: the row carries the finisher and its name', k.finisher_mode === 'pick' && k.finisher_id === 2 && k.finisher_name === 'First-hole drive');

  await renderWeek();
  openAssignmentSheet(row(3));
  ck("he can set one on a row that is not his",       /id="a-fin"/.test(sheet()));
  el('a-fin').value = 'wheel';
  global.sent.length = 0;
  await saveAssignment(3);
  const t3 = last('PATCH', 'assignments');
  ck('...and the change is sent, result cleared',     t3.finisher_mode === 'wheel' && t3.finisher_result === null);

  await renderWeek();
  openAssignmentSheet(row(1));
  ck('he sees the result, not the buttons',           /No result recorded|Result:/.test(sheet()) && !/setFinResult/.test(sheet()));
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
