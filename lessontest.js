// lessontest.js — a Lesson is an assignment she sets herself.
//
// The first cut made it a fifth planned_rounds kind and Astrid rejected it in
// one line: "isn't a lesson more like a drill I assign myself?" She was right,
// so this pins the properties that made her version the better one — the ones
// a future refactor could quietly undo:
//
//   · it has no drill, so it must name itself from `label` (a nameless pill is
//     exactly the kind of thing that ships);
//   · a round played on the same day cannot touch it — the bug the old design
//     needed defensive code to avoid is here structurally impossible;
//   · it is HERS, so it stays outside the coach's quota wheel, under "extra";
//   · it reaches Wes in the submit snapshot, which a planned_round never did;
//   · it offers no Score field, because an hour with Wes is not out of ten.
//
// It also covers the second half of that session: a COMP on the week grid is
// read from `tournaments`, not typed again as a placeholder. She asked for a
// "Competition" pill; the comp was already a first-class row with a name, a
// venue and the check-ins hanging off it, so the grid reads what is there.
//
//   node lessontest.js .
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
global.window = { location:{origin:'https://x',pathname:'/',search:'',hash:''},
  history:{replaceState(){}}, addEventListener(){}, matchMedia:()=>({matches:false}) };
global.location = global.window.location; global.history = global.window.history;
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
global.navigator = { userAgent:'node' };

// Stub at the FETCH layer, not at sel/selSoft: those are `const` in index.html,
// so assigning over them fails silently and the real ones run.
const mon = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; })();
const WK = mon.toISOString().slice(0,10);
const D  = new Date(mon.getTime() + 86400000).toISOString().slice(0,10);   // Tuesday = index 1
const SUN = new Date(mon.getTime() + 6*86400000).toISOString().slice(0,10); // Sunday = index 6
const holes = Array.from({length:9},()=>({par:4,score:5,gir:false,drive:'',app:'',short:'',putts:2,trbl:'',cmt:null}));

// TUESDAY, LOADED: a round she played, a round she planned, a drill Wes set and
// two lessons. If a round can eat a plan, Tuesday is where it happens.
const LESSON_OPEN = {id:71, student_id:'x', drill_id:null, label:'Lesson', week_start:WK,
                     day_index:1, assigned_by:'student', done:false, note:'with Wes', drills:null};
const LESSON_DONE = {id:72, student_id:'x', drill_id:null, label:'Lesson', week_start:WK,
                     day_index:1, assigned_by:'student', done:true, note:null, drills:null};
const COACH_DRILL = {id:73, student_id:'x', drill_id:5, label:null, week_start:WK,
                     day_index:1, assigned_by:'teacher', done:false, note:null,
                     drills:{id:5, name:'Gate Putting', category:'putting_chipping',
                             description:'', scoring_hint:'out of 10', created_by:'teacher'}};
const FIX = {
  assignments:    [COACH_DRILL, LESSON_OPEN, LESSON_DONE],
  golf_rounds:    [{id:1, date:D, course:'Colony Ost', comp:false, practice:false,
                    matchplay:false, stats_excluded:false, holes_data:holes}],
  planned_rounds: [{id:11, date:D, kind:'9', note:null}],
  // MONDAY'S COMP IS BEHIND HER (a result), SUNDAY'S IS AHEAD (no result, and
  // the week's last day, so it cannot be in the past whenever this runs).
  tournaments: [{id:91, date:WK,  name:'Club Medal',       type:'stroke', score:'86', venue:'Colony'},
                {id:92, date:SUN, name:'Club Championship', type:'stroke', score:null, venue:'Colony'}],
  week_submissions: [], week_reflections: [], app_settings: [],
  weekly_notes: [], goals: [],
};
global.posted = [];
global.fetch = async (url, opt) => {
  const table = String(url).split('/rest/v1/')[1] || '';
  if (opt && opt.method === "POST") global.posted.push([table.split('?')[0], JSON.parse(opt.body)]);
  const key = Object.keys(FIX).find(k => table.startsWith(k));
  const data = key ? FIX[key] : [];
  return { ok:true, status:200, json:async()=>data, text:async()=>JSON.stringify(data) };
};
global.confirm = () => true; global.alert = () => {};

const harness = `
${inline.join('\n;\n')}
;
${pages}
;
(async () => {
  try { ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' }; } catch(e){}
  try { STUDENT_ID='x'; GOALS_STUDENT_WRITABLE=false; } catch(e){}
  const checks = [];
  const ck = (k,v) => checks.push([k, !!v]);

  /* ── the week grid ────────────────────────────────────────────────── */
  try { await renderWeek(); }
  catch(e){ console.log('  renderWeek THREW: ' + e.message); process.exit(2); }
  const week = document.getElementById('pg-week').innerHTML;
  // Cells by DAY INDEX, not "the first one with a pill in it": Monday now has
  // a comp on it, and picking by content quietly moved every Tuesday assertion
  // onto the wrong day.
  const dayCell = i => (week.split('data-drop="')[i+1] || '').split('data-drop="')[0];
  const cell = dayCell(1);            // Tuesday
  const lessonPills = (cell.match(/>Lesson</g) || []).length;

  ck('Lesson is offered in the Plan sheet', PLAN_KINDS.some(k => k.id === 'lesson'));
  ck('a lesson names itself from label',    lessonPills === 2);
  ck('no pill fell back to "Drill"',        !/>Drill</.test(cell));
  ck('it wears the by-student ring',        /pill by-student/.test(cell));
  ck('the done one is ticked',              /pill by-student done/.test(cell));
  ck('it drags like any assignment',        /data-aid="71"/.test(cell));

  // THE BUG THE OLD DESIGN NEEDED CODE TO AVOID. Tuesday's round consumes the
  // 9-holes placeholder and cannot reach the lessons — they are not in that
  // table at all, so there is no slice for them to fall out of.
  ck('the round she played renders',        /rpill (social|prac|comp)/.test(cell));
  ck('it consumed the 9-holes placeholder', !/rpill tbc/.test(cell));
  ck('BOTH lessons survive that round',     lessonPills === 2);
  ck("Wes's drill is untouched",            /Gate Putting/.test(cell));

  /* ── the comp: read from tournaments, not typed twice ─────────────── */
  const monCell = dayCell(0), sunCell = dayCell(6);
  ck('an entered comp appears on its day',   !!monCell && !!sunCell);
  ck('it shows the real name, not "comp"',   /Club Championship/.test(sunCell));
  ck('a comp ahead of her is dashed',        /rpill comp ahead/.test(sunCell));
  ck('it says tbc until it happens',         />tbc</.test(sunCell));
  ck('a played comp is solid',               /rpill comp "/.test(monCell));
  ck('a played comp shows its result',       />86</.test(monCell));
  // .includes, not a regex: this file is one big template literal, so a single
  // backslash in a pattern is eaten before the regex ever sees it and the test
  // silently checks the wrong thing.
  ck('tapping it goes to Tournaments',       sunCell.includes("go('tournaments')"));
  // It is NOT a placeholder: no new plan kind was added, so there is still
  // exactly one place a comp is entered.
  ck('no Competition kind was added',        !PLAN_KINDS.some(k => /comp|tourn/i.test(k.id)));

  /* ── the sheet: no drill, so nothing to score ─────────────────────── */
  let sheet = '';
  openSheet = h => { sheet = h; };
  openAssignmentSheet(ASSIGN.find(a => a.id === 71));
  ck('the sheet is titled Lesson',     /<b>Lesson<\\/b>/.test(sheet));
  ck('a lesson offers no Score field', !/id="a-score"/.test(sheet));
  ck('a lesson still offers Done',     /id="a-done"/.test(sheet));
  ck('a lesson still offers a Note',   /id="a-note"/.test(sheet));
  openAssignmentSheet(ASSIGN.find(a => a.id === 73));
  ck('a DRILL still offers Score',     /id="a-score"/.test(sheet) && /out of 10/.test(sheet));

  /* ── it reaches Wes ───────────────────────────────────────────────── */
  posted.length = 0;
  await submitWeek();
  const sub = posted.find(p => p[0] === 'week_submissions');
  const snap = (sub && sub[1].snapshot) || [];
  ck('the lesson is in the submit snapshot', snap.filter(x => x.name === 'Lesson').length === 2);
  ck('no snapshot row is nameless',          snap.length > 0 && snap.every(x => x.name));

  /* ── the summary: hers, so extra, never quota ─────────────────────── */
  try { await renderSummary(); }
  catch(e){ console.log('  renderSummary THREW: ' + e.message); process.exit(2); }
  const sum = document.getElementById('pg-summary').innerHTML;
  // Quota = Wes's one drill, undone. The two lessons are hers: 1 of 2 done,
  // shown BESIDE the wheel, never inside it. Ticking a lesson must not move it.
  ck('the wheel is 0% — his drill is undone', /0%/.test(sum));
  ck('both lessons are counted as extra',     /\\+ 1\\/2 extra/.test(sum));
  ck('the extras are named, not "?"',         /extra[\\s\\S]{0,220}Lesson/.test(sum));

  /* ── the migration the app now needs ──────────────────────────────── */
  ck('the app demands migration 26', SCHEMA_REQUIRED === 26);

  let bad = 0;
  for (const [k,v] of checks){ if(!v) bad++; console.log((v ? '  yes  ' : '  NO   ') + k); }
  console.log(bad ? '\\n  ' + bad + ' FAILED' : '\\n  ' + checks.length + ' checks, lesson behaves');
  process.exit(bad ? 1 : 0);
})();
`;
(0, eval)(harness);
