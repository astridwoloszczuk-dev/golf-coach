// plantest.js — what Wes actually receives, and what he can say back.
//
// Astrid, 5 Sep: "the weekly commitments should be fully visible to Wes, incl
// how many rounds I am planning on playing and all the things I am choosing to
// place in the week incl any additional drills. He doesn't (yet?) assign much,
// so I fill it with things I think are useful — if he wants to course correct
// he can."
//
// Before this, submitWeek() sent only the PLACED DRILLS, on the FIRST submit
// only. Rounds she intended, comps she had entered and every change after
// Monday were invisible to him. This pins the fix:
//
//   · the message carries drills, planned rounds AND entered comps;
//   · his own are marked, Claude's are marked, hers are not — she wanted him to
//     see what she chose, and marking the minority is what stays readable;
//   · a re-commit tells him too, but at most once a day;
//   · the message and the sheet he comments in are built from ONE description
//     of the week, so he cannot be reacting to a plan he was not sent.
//
//   node plantest.js .
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
global.WK = mon.toISOString().slice(0,10);
const WK = global.WK;
const ymdOf = i => new Date(mon.getTime() + i*86400000).toISOString().slice(0,10);

// A REALISTIC WEEK OF HERS: he set one, Claude filled one, she added three,
// she intends two rounds and there is a comp on Saturday.
const drill = (id, name) => ({id, name, category:'putting_chipping', description:'',
                              scoring_hint:'out of 10', created_by:'teacher'});
const A = (id, day, by, d, label) => ({id, student_id:'x', drill_id: d ? d.id : null,
  label: label || null, week_start:WK, day_index:day, assigned_by:by, done:false,
  note:null, drills:d || null});
global.FIX = {
  assignments: [
    A(1, 0, 'teacher', drill(5,'Gate Putting')),
    A(2, 1, 'claude',  drill(6,'Ladder 30-80m')),
    A(3, 1, 'student', drill(7,'Range - driver')),
    A(4, 3, 'student', drill(8,'Range - driver')),
    A(5, 3, 'student', null, 'Lesson'),
    A(9, null, 'student', drill(9,'Bunker basics')),   // in the tray, not placed
  ],
  planned_rounds: [{id:11, date:ymdOf(2), kind:'9',  note:'Wienerberg?'},
                   {id:12, date:ymdOf(6), kind:'18', note:null}],
  tournaments:    [{id:91, date:ymdOf(5), name:'Ladies Trophy', type:'stroke',
                    score:null, venue:'Colony'}],
  golf_rounds: [], week_submissions: [], week_reflections: [], app_settings: [],
  weekly_notes: [], goals: [], feedback: [], notifications: [],
};
global.posted = [];
global.fetch = async (url, opt) => {
  const table = String(url).split('/rest/v1/')[1] || '';
  if (opt && opt.method === 'POST') global.posted.push([table.split('?')[0], JSON.parse(opt.body)]);
  const key = Object.keys(global.FIX).find(k => table.startsWith(k));
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
  const msgTo = who => (global.posted.filter(p => p[0]==='notifications')
                        .map(p => p[1]).filter(m => m.recipient===who).pop() || {}).message || '';

  /* ── FIRST SUBMIT ───────────────────────────────────────────────── */
  ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' };
  await renderWeek();
  global.posted.length = 0;
  await submitWeek();
  const m1 = msgTo(TEACHER_NAME);

  ck('he is told at all',                    !!m1);
  ck('it says she committed',                /has committed her plan/.test(m1));
  ck("HIS drill is there",                   /Gate Putting/.test(m1));
  ck('HER extra drills are there',           /Range - driver/.test(m1));
  ck('her LESSON is there',                  /Lesson/.test(m1));
  ck('the 9 holes she plans is there',       /9 holes/.test(m1));
  ck('the 18 holes she plans is there',      /18 holes/.test(m1));
  ck('the comp is there, by name',           /Ladies Trophy/.test(m1));
  // HER SCRATCH STAYS HERS. "Wienerberg?" carries a question mark because the
  // course is undecided; a coach reading a maybe-venue as a fact is worse than
  // him not seeing it. It stays on the pill tooltip in the app.
  ck('her round note is NOT sent',           !/Wienerberg/.test(m1));
  ck('the tray item is NOT there',           !/Bunker basics/.test(m1));
  // Counted SEPARATELY: a comp is an entry with a fixed date and a result, not
  // "a round she is planning", and one number for both reads wrong.
  ck('sessions are counted',                 /5 sessions/.test(m1));
  ck('planned rounds are counted',           /2 rounds planned/.test(m1));
  ck('the comp is counted apart from them',  /1 comp/.test(m1));

  /* ONE MARK, MEANING "you set this". Her call, 5 Sep: Claude's rows carried a
     [Claude] tag in the first cut and she cut it — "it's not suggested by him
     is the key here". So the teacher is marked and nothing else is, Claude's
     included. The unmarked half stays literally true of Claude's rows, because
     Claude assigns into the TRAY — everything on a day was placed by her. */
  ck('his own is marked [you]',              /Gate Putting \\[you\\]/.test(m1));
  ck('the word Claude is gone entirely',     !/Claude/.test(m1));
  ck("Claude's drill carries no mark",       /Ladder 30-80m(?! \\[)/.test(m1));
  ck('hers carries no mark',                 /Range - driver(?! \\[)/.test(m1));
  ck('the key explains the one mark',        /\\[you\\] = set by you/.test(m1));

  ck('it invites him to react',              /Does the plan look off\\?/.test(m1));
  ck('it links straight to the week',        m1.includes('?p=week'));

  /* ── WHY CLAUDE'S ROWS NEED NO LABEL ────────────────────────────────
     Astrid, 5 Sep: "if Wes comes back with 'exchange a for b' and Claude
     assigned that drill — can I actually do that? If I cannot delete them,
     it is worth putting a Claude label next to them. If I can, leave as is."

     She can (migration 19, deliberately: "when Claude assigns it is filling a
     gap Wes left, not issuing an instruction — she may bin it"), so there is
     no label. That makes this asymmetry load-bearing for the message format:
     if a later change ever locked Claude's rows down, the unlabelled message
     would start hiding something she cannot act on. Pinned here so that
     change cannot pass quietly. */
  let sh = ''; openSheet = h => { sh = h; };
  openAssignmentSheet(ASSIGN.find(a => a.assigned_by === 'claude'));
  ck("she can Remove Claude's drill",        /removeAssignment\\(2\\)/.test(sh));
  openAssignmentSheet(ASSIGN.find(a => a.assigned_by === 'teacher'));
  ck("she cannot Remove Wes's drill",        !/removeAssignment\\(1\\)/.test(sh));
  ck('and is told why',                      /his to remove/.test(sh));

  /* ── RE-COMMIT: he hears about it, once a day ───────────────────── */
  FIX.week_submissions = [{id:1, submitted_at:new Date().toISOString()}];
  await renderWeek();
  global.posted.length = 0;
  await submitWeek();
  const m2 = msgTo(TEACHER_NAME);
  ck('a re-commit tells him too',            /has changed her plan/.test(m2));
  ck('the changed plan is a full plan',      /Ladies Trophy/.test(m2) && /18 holes/.test(m2));

  // Second re-commit inside the window: the notification is now on record, so
  // it must be held rather than sent again.
  FIX.notifications = [{message:'Astrid has changed her plan for ' + fmtRange(WEEK) + '.',
                        created_at:new Date().toISOString()}];
  global.posted.length = 0;
  await submitWeek();
  ck('a second re-commit today is held',     !msgTo(TEACHER_NAME));
  ck('the plan is still re-stamped',         global.posted.some(p => p[0]==='week_submissions'));
  FIX.notifications = [];

  /* ── WES: what he sees, and what he can write ───────────────────── */
  ME = { id:'w', email:'w@b', role:'teacher', display_name:'Wes' };
  await renderWeek();
  const wkHtml = document.getElementById('pg-week').innerHTML;
  ck('Wes is offered the comment box',       /replyToQ\\('plan'\\)/.test(wkHtml));

  let sheet = ''; openSheet = h => { sheet = h; };
  replyToQ('plan');
  ck('his sheet shows the plan',             /Ladies Trophy/.test(sheet) && /Lesson/.test(sheet));
  ck('his sheet shows what she chose',       /Range - driver/.test(sheet));
  ck('it is the SAME plan he was sent',      planLines().every(l => sheet.includes(l.split('  ')[1].split(' \\u00b7 ')[0])));

  // Saving it must ping HER, and say it is about the plan - not be swallowed
  // by the reflection-reply window.
  global.posted.length = 0;
  el('qr-body').value = 'Swap the second range session for chipping.';
  await saveReply('plan');
  const toHer = msgTo(STUDENT_NAME);
  ck('she is pinged about it',               !!toHer);
  ck('the ping says PLAN, not reflection',   /commented on your plan/.test(toHer));
  ck('it is stored as question=plan',        global.posted.some(p =>
        p[0]==='feedback' && p[1].question==='plan' && p[1].author==='teacher'));

  /* ── HER side: his note shows, silence does not ─────────────────── */
  ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' };
  FIX.feedback = [{id:77, week_start:WK, author:'teacher', question:'plan',
                   body:'Swap the second range session for chipping.'}];
  await renderWeek();
  const herHtml = document.getElementById('pg-week').innerHTML;
  ck('she sees his note on the week page',   /Swap the second range session/.test(herHtml));
  ck('she is not offered his write button',  !/replyToQ\\('plan'\\)/.test(herHtml));

  FIX.feedback = [];
  await renderWeek();
  const quiet = document.getElementById('pg-week').innerHTML;
  ck('no empty "nothing from Wes" panel',    !/on this week's plan/i.test(quiet));

  let bad = 0;
  for (const [k,v] of checks){ if(!v) bad++; console.log((v ? '  yes  ' : '  NO   ') + k); }
  console.log(bad ? '\\n  ' + bad + ' FAILED' : '\\n  ' + checks.length + ' checks, Wes sees the whole week');
  process.exit(bad ? 1 : 0);
})();
`;
(0, eval)(harness);
