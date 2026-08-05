#!/usr/bin/env node
/*
 * smoke.js — does the app actually RUN?
 *
 * WHY THIS EXISTS. On 5 Aug 2026 three bugs reached Astrid that no check
 * caught, all the same shape: code that parses perfectly and then throws the
 * moment it runs.
 *
 *   1. `wkQuad is not defined` — a line-range edit deleted a computation along
 *      with the cards above it.
 *   2. my "verification" grepped for the string `allCounted`, which appeared
 *      in the block I had just added. A substring check cannot tell a USE from
 *      a DEFINITION.
 *   3. the habit grid passed `row.group === undefined`, so every colour rule
 *      missed and filled cells rendered near-black on dark grey.
 *
 * `node --check` proves a file PARSES. It says nothing about whether its
 * identifiers resolve. This loads the real page, stubs the DOM and the network,
 * and calls every renderer for both roles. A ReferenceError fails the run.
 *
 *   node smoke.js .            # from live/golf-coach
 *   node smoke.js ../habit     # works on the habit app too
 *
 * Not a substitute for opening the page. It catches the class of bug that
 * shipped three times in one day, which is the class worth automating.
 */
const fs = require('fs');
const dir = process.argv[2] || '.';

const html  = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const externals = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)[^"]*"/g)]
  .map(m => m[1]).filter(f => !/^https?:/.test(f))
  .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8'));

// ── the thinnest DOM that lets a renderer finish ──────────────────────────
const nullEl = () => ({
  set innerHTML(v){ this._h = v; try { global.__html.push(String(v)); } catch (e) {} },
  get innerHTML(){ return this._h || '' }, textContent:'', value:'', checked:false, className:'', disabled:false,
  style:{}, dataset:{}, children:[], firstChild:null,
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false } },
  setAttribute(){}, getAttribute(){ return null }, removeAttribute(){},
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  querySelector(){ return null }, querySelectorAll(){ return [] },
  closest(){ return null }, click(){}, focus(){}, blur(){}, remove(){},
  getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0} },
  get previousElementSibling(){ return nullEl() },
});
const seen = {};
// Every innerHTML written during a render, so the output can be inspected for
// the silent-garbage class of bug (see the JUNK check below).
global.__html = [];
global.document = {
  getElementById: id => (seen[id] || (seen[id] = nullEl())),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: nullEl, createTextNode: () => ({}),
  addEventListener(){}, removeEventListener(){},
  body: nullEl(), documentElement: nullEl(),
};
global.window = {
  location:{ origin:'https://x.test', pathname:'/', search:'', hash:'', href:'https://x.test/' },
  history:{ replaceState(){}, pushState(){} },
  addEventListener(){}, removeEventListener(){}, matchMedia:()=>({matches:false, addListener(){}}),
  scrollTo(){}, setTimeout, clearTimeout,
};
global.localStorage = { _:{}, getItem(k){ return this._[k] ?? null }, setItem(k,v){ this._[k]=String(v) },
                        removeItem(k){ delete this._[k] } };
global.navigator = { userAgent:'node', serviceWorker:{ register(){ return Promise.resolve() } } };
global.alert = () => {}; global.confirm = () => true; global.prompt = () => null;
// The page uses bare `location` / `history` / `setTimeout`, which in a browser
// resolve off window. Mirror the ones it actually touches onto the global.
global.location = global.window.location;
global.history  = global.window.history;
global.matchMedia = global.window.matchMedia;
global.scrollTo = () => {};
global.requestAnimationFrame = (f) => setTimeout(f, 0);
global.CustomEvent = class {}; global.Event = class {};
global.fetch = async () => ({ ok:true, status:200, headers:{ get:()=>null },
                              json: async () => [], text: async () => '[]' });

// One eval: `const`/`let` from index.html must be visible to app-pages.js.
// golf-coach names them renderX; the habit app just has render(). Both listed
// so one harness covers both PWAs.
const RENDERERS = ['renderGoals','renderWeek','renderDrills','renderRounds',
                   'renderTournaments','renderSummary','renderFeedback','renderOpen','render'];

const harness = `
${inline.join('\n;\n')}
;
${externals.join('\n;\n')}
;
(async () => {
  // Replace the data layer only AFTER everything is defined, so renderers run
  // against empty-but-valid results instead of the network.
  try { sel      = async () => []; } catch (e) {}
  try { selSoft  = async () => []; } catch (e) {}
  try { api      = async () => []; } catch (e) {}
  try { ins      = async () => []; } catch (e) {}
  try { upd      = async () => []; } catch (e) {}
  try { STUDENT_ID = 'smoke'; } catch (e) {}
  try { GOALS_STUDENT_WRITABLE = false; } catch (e) {}

  const names = ${JSON.stringify(RENDERERS)};
  let failures = 0, ran = 0;

  for (const role of ['student','teacher']) {
    try { ME = { id:'smoke', email:'smoke@test', role, display_name:role }; } catch (e) {}
    for (const n of names) {
      let fn; try { fn = eval(n); } catch (e) { continue; }
      if (typeof fn !== 'function') continue;
      ran++;
      try {
        __html = [];
        await fn();
        // A CRASH is only half the story. The habit bug on 5 Aug threw nothing:
        // row.group was undefined, so the class read "g-undefined", every colour
        // rule missed and filled cells went unreadable. That kind of fault does
        // not raise - it LANDS IN THE OUTPUT. So sniff what was written.
        // Substring checks, not a regex: the regex went through two layers of
        // escaping and matched "> <", failing on healthy output. Plain
        // indexOf cannot be got wrong.
        const out = __html.join(' ');
        const junk = ['g-undefined','="undefined"','>undefined<','[object Object]','NaN%','>NaN<']
          .filter(t => out.indexOf(t) !== -1);
        if (junk.length) {
          console.log('  JUNK  ' + role + ' / ' + n + '  ->  ' + junk.join('  |  '));
          failures++;
        } else {
          console.log('  ok    ' + role + ' / ' + n);
        }
      } catch (e) {
        const msg = String(e && e.message).split(String.fromCharCode(10))[0];
        if (e instanceof ReferenceError || e instanceof TypeError && /is not a function|of undefined|of null/.test(msg)) {
          console.log('  FAIL  ' + role + ' / ' + n + '  ->  ' + e.name + ': ' + msg);
          failures++;
        } else {
          console.log('  ~     ' + role + ' / ' + n + '  (' + msg + ') - stub artefact, ignored');
        }
      }
    }
  }
  console.log('');
  console.log(ran + ' renderer runs, ' + failures + ' hard failure(s)');
  process.exit(failures ? 1 : 0);
})();
`;

try {
  (0, eval)(harness);
} catch (e) {
  console.error('harness failed to load: ' + e.name + ': ' + e.message);
  process.exit(2);
}
