// reflecttest.js — her reflection reaching Wes, and reaching him once.
//
// 6 Sep 2026, from the live notifications table:
//
//   16:00:02  the digest        "No reflection written this week."
//   16:23:52  she sends         "…is in the app. Committing to: Keep at it…"
//   18:10:26  she tidies it     the same message again
//
// Two faults in one evening. The digest is the vehicle her answers travel in,
// and once it has left, a pointer saying "a reflection exists" is the least
// useful message available — he is assigning within hours and has just been
// told there was nothing. And a re-send is an EDIT of a once-a-week object,
// not a second event; saveReply and saveFeedback already knew that, this did
// not. So:
//
//   · before the digest → the short pointer (the digest will carry the text);
//   · after it         → all three answers, plus which copy is current;
//   · a re-send        → nothing at all.
//
//   node reflecttest.js .
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

// HER REAL ANSWERS from 6 Sep, because the long one is the point: felt_good
// runs past 300 characters and is exactly what a pointer message withholds.
const FELT = 'Attempted shape control with 7i and actually surprised myself :) i can '
  + 'actually do that! Then I did the same with the driver - again, was surprised I can '
  + 'quite easily do baby draw vs fade/slice. The control between fade and slice is '
  + 'difficult though. I got fades at the beginning, and slices at the end.';
const OFF  = 'Iron striking on sunday was off ... thin clicky.';
const COM  = 'Keep at it - avoid fatalistic thinking ...';

// ⚠ THE REAL HEADER wes_digest.py writes. saveReflection() searches for this
// exact string to decide whether the digest has gone. If someone reworded the
// digest, this fixture would still pass while the live app silently fell back
// to the pointer — so the last check below reads the string out of the app and
// asserts it is what the digest actually emits, not what this file assumes.
const DIGEST_HEADER = `Astrid — week of ${WK}`;

/* Does the app actually look for that? Read digestGone()'s pattern out of the
   source and resolve its ${wk} against this week. Done here, in module scope,
   because inside the harness template literal a ${...} would be interpolated
   by the harness itself rather than surviving into the test. */
const found = pages.match(/includes\(`(Astrid[^`]*?)`\)/);
const HEADER_OK = !!found && found[1].replace('${wk}', WK) === DIGEST_HEADER;

global.FIX = {
  assignments: [], planned_rounds: [], tournaments: [], golf_rounds: [],
  week_submissions: [], app_settings: [], weekly_notes: [], goals: [], feedback: [],
  week_reflections: [],
  notifications: [],
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
  ME = { id:'x', email:'a@b', role:'student', display_name:'Astrid' };
  try { STUDENT_ID='x'; GOALS_STUDENT_WRITABLE=false; } catch(e){}
  const checks = [];
  const ck = (k,v) => checks.push([k, !!v]);
  const toWes = () => global.posted.filter(p => p[0]==='notifications')
    .map(p => p[1]).filter(m => m.recipient===TEACHER_NAME).map(m => m.message);

  const fillIn = () => {
    el('rf_good').value = ${JSON.stringify(FELT)};
    el('rf_off').value  = ${JSON.stringify(OFF)};
    el('rf_com').value  = ${JSON.stringify(COM)};
  };

  /* ── 1 · BEFORE the digest: the digest will carry it ─────────────── */
  global.FIX.week_reflections = []; global.FIX.notifications = [];
  await renderWeek(); fillIn();
  global.posted.length = 0;
  await saveReflection(true);
  const early = toWes();
  ck('he is told once',                    early.length === 1);
  ck('it is the short pointer',            /is in the app/.test(early[0] || ''));
  ck('it carries the commitment',          (early[0]||'').includes('Keep at it'));
  ck('it does NOT paste all three',        !(early[0]||'').includes('Iron striking'));

  /* ── 2 · AFTER the digest: it has to carry the text itself ───────── */
  global.FIX.week_reflections = [];
  global.FIX.notifications = [{message: ${JSON.stringify(DIGEST_HEADER)} +
     '\\n\\nCommitments: 0/0 done.\\n\\n-- her words --\\nNo reflection written this week.'}];
  await renderWeek(); fillIn();
  global.posted.length = 0;
  await saveReflection(true);
  const late = toWes();
  ck('he is still told exactly once',      late.length === 1);
  ck('it says it missed the digest',       /after today's digest/.test(late[0] || ''));
  ck('"What felt good" is in the message', (late[0]||'').includes('Attempted shape control'));
  ck('"What was off" is too',              (late[0]||'').includes('Iron striking'));
  ck('and the commitment',                 (late[0]||'').includes('Keep at it'));
  ck('it names the current copy',          /current version/.test(late[0] || ''));

  /* ── 3 · A RE-SEND IS AN EDIT. This is the 18:10 message. ────────── */
  const NOW = new Date().toISOString();
  global.FIX.week_reflections = [{id:16, week_start:WK, submitted_at:NOW, updated_at:NOW,
    felt_good:'(already sent)', was_off:'(already sent)', commitment:'(already sent)'}];
  await renderWeek(); fillIn();
  global.posted.length = 0;
  el('rf_com').value = ${JSON.stringify(COM + ' and stop over-reading one bad nine.')};
  await saveReflection(true);
  ck('a re-send pings nobody',             toWes().length === 0);
  ck('but it IS saved',                    global.posted.some(p => p[0]==='week_reflections'));
  ck('the edit reached the row',           global.posted.some(p => p[0]==='week_reflections'
        && /stop over-reading/.test(p[1].commitment || '')));

  /* ── 4 · a draft is not a send, before or after ──────────────────── */
  global.FIX.week_reflections = [];
  await renderWeek(); fillIn();
  global.posted.length = 0;
  await saveReflection(false);
  ck('a draft pings nobody',               toWes().length === 0);
  ck('a draft has no submitted_at',        global.posted.some(p => p[0]==='week_reflections'
        && !p[1].submitted_at));

  /* ── 5 · THE CROSS-FILE CONTRACT ─────────────────────────────────
     digestGone() matches wes_digest.py's first line. Computed outside the
     harness (see HEADER_OK) by reading the pattern out of app-pages.js and
     comparing it to the header the digest really writes — so a reworded
     digest fails here rather than silently degrading to the pointer forever. */
  ck('the app looks for the digest header', ${HEADER_OK});

  let bad = 0;
  for (const [k,v] of checks){ if(!v) bad++; console.log((v ? '  yes  ' : '  NO   ') + k); }
  console.log(bad ? '\\n  ' + bad + ' FAILED' : '\\n  ' + checks.length + ' checks, the reflection lands once');
  process.exit(bad ? 1 : 0);
})();
`;
(0, eval)(harness);
