#!/usr/bin/env node
/*
 * tablecheck.js — every scorecard table must have as many cells as headings.
 *
 * WHY. Found by Astrid on 11 Aug 2026, reading Wes's Weekly Summary: the Cmt
 * dots were rendering under MP, and MP rendered nowhere. The cumulative
 * scorecard had TWELVE <th> over ELEVEN <td> — the MP column was in the heading
 * row and never in the body. Every column right of the gap silently shifts left,
 * which is the nastiest kind of display bug: the table still looks like a table,
 * so you read the wrong number under the right label and never think to check.
 *
 * It survived because the two scorecards are near-duplicate layouts — the
 * single-round card and the cumulative one — and only the first was kept current
 * when the MP column was added. divcheck.js renders the summary against EMPTY
 * data, so the table it needed to inspect was never on the page.
 *
 * So: render both tables with a realistic round and count. A heading with no
 * cell under it is a failure, and so is the reverse.
 *
 *   node tablecheck.js
 */
const fs = require('fs');
const dir = process.argv[2] || '.';
const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pages = fs.readFileSync(`${dir}/app-pages.js`, 'utf8');

const nullEl = () => ({
  set innerHTML(v){ this._h = String(v); }, get innerHTML(){ return this._h || ''; },
  textContent:'', value:'', checked:false, style:{}, dataset:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(){}, getAttribute(){return null}, appendChild(){}, addEventListener(){},
  querySelector(){return null}, querySelectorAll(){return []}, closest(){return null},
  focus(){}, remove(){}, scrollIntoView(){},
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

// Her real Dürnberg R4 card: 20 holes, three of them never holed out, MP marks
// throughout and a couple of not-committed dots. Anything that renders this
// correctly renders an ordinary stroke round correctly too.
const MARKS = ['-','+','=','+','-','-','+','+','-','-','=','+','+','-','=','=','-','+','=','+'];
const ROUND = {
  id: 1, date: '2026-08-10', course: 'Colony West', comp: true, matchplay: true,
  holes: 20, is_simple: false,
  holes_data: MARKS.map((m, i) => ({
    par: [4,3,5,4,4,4,3,5,4,5,3,4,4,5,3,4,4,5,4,3][i],
    score: (i===1 || i===7 || i===13) ? '' : String(4 + (i % 2)),
    mp: m, putts: 2, gir: i % 3 === 0,
    drive: i === 4 ? 's' : '', app: i === 9 ? 'm' : '', short: i === 16 ? 'c' : '',
    trbl: i === 8 ? 'W' : '', cmt: i === 17 ? 1 : null,
  })),
};

const harness = `
${inline.join('\n;\n')}
;
${pages}
;
(() => {
  try { ME = { id:'x', email:'a@b', role:'teacher', display_name:'Wes' }; } catch(e){}
  let fails = 0;

  // Count headings against the cells in every body row of every table.
  const audit = (label, markup) => {
    const tables = [...String(markup).matchAll(/<table[\\s\\S]*?<\\/table>/g)].map(m => m[0]);
    if (!tables.length){ console.log('  FAIL  ' + label + ' rendered no table at all'); fails++; return; }
    tables.forEach((tbl, ti) => {
      const head = (tbl.match(/<thead[\\s\\S]*?<\\/thead>/) || [''])[0];
      const nTh = (head.match(/<th\\b/g) || []).length;
      const body = (tbl.match(/<tbody[\\s\\S]*?<\\/tbody>/) || [''])[0];
      const rows = [...body.matchAll(/<tr[\\s\\S]*?<\\/tr>/g)].map(m => m[0]);
      if (!nTh){ console.log('  FAIL  ' + label + ' table ' + (ti+1) + ' has no headings'); fails++; return; }
      if (!rows.length){ console.log('  FAIL  ' + label + ' table ' + (ti+1) + ' has no rows'); fails++; return; }
      const bad = rows.map((r, i) => ({ i: i+1, n: (r.match(/<td\\b/g) || []).length }))
                      .filter(r => r.n !== nTh);
      if (bad.length){
        console.log('  FAIL  ' + label + ': ' + nTh + ' headings but ' +
                    bad[0].n + ' cells (row ' + bad[0].i + ' of ' + rows.length + ', ' +
                    bad.length + ' row(s) affected)');
        console.log('        every column right of the gap shifts left — wrong number, right label');
        fails++;
      } else {
        console.log('  ok    ' + label + ' — ' + nTh + ' headings, ' + nTh + ' cells x ' + rows.length + ' rows');
      }
    });
  };

  const R = ${JSON.stringify(ROUND)};
  audit('single round card (roundDetailHtml)', roundDetailHtml(R));
  audit('cumulative scorecard (cumScorecardHtml)', cumScorecardHtml([R]));

  // The MP column must actually carry the marks, not just exist.
  const one = roundDetailHtml(R), cum = cumScorecardHtml([R]);
  const hasHalf = s => s.indexOf('\\u00bd') !== -1;
  [['single round card', one], ['cumulative scorecard', cum]].forEach(([l, s]) => {
    const ok = hasHalf(s);
    console.log((ok ? '  ok    ' : '  FAIL  ') + l + ' renders halved holes as ' + String.fromCharCode(189));
    if (!ok) fails++;
  });

  console.log('');
  console.log(fails ? fails + ' FAILURE(S)' : 'all table checks passed');
  process.exit(fails ? 1 : 0);
})();
`;
(0, eval)(harness);
