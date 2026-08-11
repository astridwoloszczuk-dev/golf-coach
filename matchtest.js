#!/usr/bin/env node
/*
 * matchtest.js — the matchplay summary: result notation and the holes line.
 *
 * Pure functions, no DOM: it lifts ordinalHole/matchResult/holesSummary out of
 * app-pages.js and runs them directly, so it stays fast and has nothing to stub.
 *
 * The case that matters most is the first one — her real Dürnberg R4 card from
 * 10 Aug 2026, all square after 18, halved the 19th, won the 20th.
 *
 *   node matchtest.js
 */
const fs = require('fs');
const src = fs.readFileSync((process.argv[2] || '.') + '/app-pages.js', 'utf8');

// pull just the two functions + helper out of the file, no DOM needed
const grab = name => {
  const i = src.indexOf('function ' + name);
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{'){ d++; started = true; }
    else if (src[j] === '}'){ d--; if (started && d === 0) return src.slice(i, j+1); }
  }
};
eval(grab('ordinalHole') + '\n' + grab('matchResult') + '\n' + grab('holesSummary'));

let fails = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  ok    ':'  FAIL  ') + label + (ok?'':`   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  if (!ok) fails++;
};
const mk = marks => marks.map(m => ({mp:m}));

// ── her actual Dürnberg card, 10 Aug ────────────────────────────────────────
const durnberg = ['-','+','=','+','-','-','+','+','-','-','=','+','+','-','=','=','-','+','=','+'];
t('Dürnberg R4 — won on the 20th', matchResult(mk(durnberg)).txt, 'Won on the 20th');
t('Dürnberg R4 — recorded as a win', matchResult(mk(durnberg)).won, true);

// ── standard notations ──────────────────────────────────────────────────────
// 3 up with 2 to play => decided on the 16th as 3&2. (First draft of this test
// had FOUR wins in it and expected 3&2 — the code was right and the test was
// wrong, which is the correct way round but worth not repeating.)
t('3&2', matchResult(mk(['+','+','+'].concat(Array(13).fill('=')))).txt, 'Won 3&2');
// 4 up with 3 to play, decided on the 15th
t('4&3', matchResult(mk(['+','+','+','+'].concat(Array(11).fill('=')))).txt, 'Won 4&3');
// all square through 18
t('halved', matchResult(mk(Array(18).fill('='))).txt, 'Halved');
// 1 up after 18
t('won 1 up', matchResult(mk(['+'].concat(Array(17).fill('=')))).txt, 'Won 1 up');
t('lost 1 up', matchResult(mk(['-'].concat(Array(17).fill('=')))).txt, 'Lost 1 up');
// heavy loss: 5 down with 4 to play, decided on 14
t('lost 5&4', matchResult(mk(Array(5).fill('-').concat(Array(13).fill('=')))).txt, 'Lost 5&4');
// extra holes, lost on 19
t('lost on the 19th', matchResult(mk(Array(18).fill('=').concat(['-']))).txt, 'Lost on the 19th');
// not a match / too few marks
t('no marks => null', matchResult(mk(Array(18).fill(''))), null);
t('stroke card => null', matchResult([]), null);
t('unicode minus handled', matchResult(mk(['\u2212'].concat(Array(17).fill('=')))).txt, 'Lost 1 up');

// ── holes summary: her card, 20 played / 17 scored ──────────────────────────
const hd = durnberg.map((m,i)=>({mp:m, score: (i===1||i===7||i===13) ? '' : '4'}));
const hs = holesSummary({holes:20, holes_data:hd}, {n:17});
t('label names 20 played and 17 scored', hs.label, '20 holes · 17 scored · 3 not holed out');
t('tooltip splits direction correctly',  hs.title,
  '2 won without holing out (holes 2, 8) · 1 conceded by you (hole 14)');

// ── holes summary: ordinary complete card stays terse ───────────────────────
t('complete 18 stays plain',
  holesSummary({holes:18, holes_data:Array(18).fill({score:'4'})}, {n:18}).label, '18 holes');
t('legacy round with null holes',
  holesSummary({holes:null, holes_data:Array(18).fill({score:'4'})}, {n:18}).label, '18 holes');
t('partly-filled stroke card is honest',
  holesSummary({holes:18, holes_data:Array(18).fill({score:''})}, {n:7}).label, '18 holes · 7 scored');

console.log('');
console.log(fails ? fails + ' FAILURE(S)' : 'all match-logic checks passed');
process.exit(fails ? 1 : 0);
