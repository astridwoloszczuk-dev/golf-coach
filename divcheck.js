// Render the summary against stubbed data and check the DIVs actually balance.
// Counting `<div class="card"` against `h += </div>` in the source cannot work:
// most cards close inline inside their own template literal. The only honest
// check is the markup that comes out.
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
global.fetch = async () => ({ ok:true, status:200, json:async()=>[], text:async()=>'[]' });
global.confirm = () => true; global.alert = () => {};

const harness = `
${inline.join('\n;\n')}
;
${pages}
;
(async () => {
  // some of these are const in index.html; assign what we can
  try { sel = async () => []; } catch(e){}
  try { selSoft = async () => []; } catch(e){}
  try { api = async () => []; } catch(e){}
  try { ME = { id:'x', email:'a@b', role:'teacher', display_name:'Wes' }; } catch(e){}
  try { STUDENT_ID = 'x'; } catch(e){}
  try { GOALS_STUDENT_WRITABLE = false; } catch(e){}
  await renderSummary();
  const out = document.getElementById('pg-summary').innerHTML;
  const open  = (out.match(/<div\\b/g) || []).length;
  const close = (out.match(/<\\/div>/g) || []).length;
  console.log('  <div> opened : ' + open);
  console.log('  </div> closed: ' + close);
  console.log(open === close ? '  BALANCED' : '  UNBALANCED by ' + (open - close));
  // how many TOP-LEVEL cards does the page actually end up with?
  let depth = 0, top = 0;
  for (const m of out.matchAll(/<div\\b[^>]*>|<\\/div>/g)) {
    if (m[0] === '</div>') depth--;
    else { if (depth === 0 && /class="card/.test(m[0])) top++; depth++; }
  }
  console.log('  top-level cards: ' + top);
  process.exit(open === close ? 0 : 1);
})();
`;
(0, eval)(harness);
