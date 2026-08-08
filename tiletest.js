// Render the summary with the Tournaments tile OPEN, against a real-shaped
// tournament + check-ins + round, and confirm the expansion actually contains a
// mood dot and a result. "It parses" was never the question.
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
// so assigning over them fails silently and the real ones run — which is exactly
// what made the first version of this test report a fully broken page.
const mon = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; })();
const TDATE = new Date(mon.getTime() + 86400000).toISOString().slice(0,10);
const holes = Array.from({length:18},()=>({par:4,score:5,gir:false,drive:'',app:'',short:'',putts:2,trbl:'',cmt:null}));
const FIX = {
  tournaments: [{id:99, date:TDATE, name:'Ladies Stableford', type:'stableford',
                 venue:'Colony', score:null, notes:'windy'}],
  golf_rounds: [{id:1, date:TDATE, course:'Colony Ost', comp:true, matchplay:false,
                 stats_excluded:false, holes_data:holes}],
  check_ins:   [{tournament_id:99, phase:'pre', mood:4, note:'calm'},
                {tournament_id:99, phase:'post', mood:6, note:''}],
};
global.fetch = async (url) => {
  const table = String(url).split('/rest/v1/')[1] || '';
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
  try { ME = { id:'x', email:'a@b', role:'teacher', display_name:'Wes' }; } catch(e){}
  try { STUDENT_ID='x'; GOALS_STUDENT_WRITABLE=false; } catch(e){}

  sumOpen = 't';                       // Tournaments tile expanded
  try { await renderSummary(); }
  catch(e){ console.log('  renderSummary THREW: ' + e.message); process.exit(2); }
  const out = document.getElementById('pg-summary').innerHTML;
  console.log('  rendered ' + out.length + ' chars; contains name: ' + /Ladies Stableford/.test(out));
  const seg = out.slice(out.indexOf('Ladies Stableford') - 900, out.indexOf('Ladies Stableford') + 900);

  const checks = [
    ['tournament name',   /Ladies Stableford/.test(seg)],
    ['a COLOURED mood dot', /class="mdot" style="background:#[0-9a-f]{6}/i.test(seg)],
    ['NOT an empty dot only', !/mdot empty/.test(seg) || /class="mdot" style="background:#/i.test(seg)],
    ['a result rendered',  /class="tscore"/.test(seg)],
    ['the note',           /windy/.test(seg)],
  ];
  let bad = 0;
  for (const [k,v] of checks){ if(!v) bad++; console.log((v?'  yes  ':'  NO   ')+k); }
  console.log(bad ? '\\n  ' + bad + ' missing' : '\\n  tile renders fully');
  process.exit(bad ? 1 : 0);
})();
`;
(0, eval)(harness);
