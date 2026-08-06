'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   golf-coach — page renderers.

   Loaded after the shell in index.html (which owns config, auth, api(),
   notify() and the router). Everything here reads/writes through those.

   One week definition, everywhere: Monday–Sunday, Europe/Vienna. WEEK is the
   Monday and is shared across Weekly Commitments / Weekly Summary / Feedback,
   so paging back on one page pages back on all three.
   ═══════════════════════════════════════════════════════════════════════════ */

let WEEK = monday(new Date());

function weekNavHtml(sub){
  const cur = ymd(WEEK) === ymd(monday(new Date()));
  return `<div class="wknav">
    <button onclick="stepWeek(-1)" aria-label="Previous week">‹</button>
    <div class="lbl"><b>${cur ? 'This week' : fmtRange(WEEK)}</b><span>${cur ? fmtRange(WEEK) : (sub||'')}</span></div>
    <button onclick="stepWeek(1)" aria-label="Next week">›</button>
  </div>`;
}
function stepWeek(n){ WEEK = addDays(WEEK, n*7); go(CUR); }

// A stable list of the 7 days of WEEK.
function weekDays(){
  return Array.from({length:7}, (_,i) => {
    const d = addDays(WEEK, i);
    return {i, d, ymd: ymd(d), label: DAY_SHORT[i], long: DAY_LONG[i],
            isToday: ymd(d) === todayYmd()};
  });
}

/* ═══════════════════════════════════════════════════════════════
   1 · AGREED GOALS — the student's landing page.

   Three horizons, each goal with a status light. The light is the
   TEACHER's to set. Claude may argue for a change in its feedback
   text; it never reaches in and sets one.
   ═══════════════════════════════════════════════════════════════ */
let GOALS = [];

/* ── Goal metrics ────────────────────────────────────────────────
   Her redesign, 6 Aug: she opens this page daily, so it has to say
   something. The status dot is gone; the title itself carries the
   colour, the live number sits beside it, the description goes small
   underneath.

   EVERY THRESHOLD BELOW IS ANCHORED ON HER OWN BASELINE, measured
   6 Aug over 15 competition rounds (228 holes) and 16 social (187).
   Inventing round numbers would have produced a page that is either
   permanently green or permanently red, and either way ignorable.

   Amber is "behind", red is "far behind". Nothing here is scored
   against a field or a tour average — only against what she already
   does and what the goal requires.
   ──────────────────────────────────────────────────────────────── */
const HOME_COURSE = /colony|himberg|roehampton/i;   // "away" means none of these
// Local date parse so every metric below is self-contained and can be run
// against real rounds by a test harness without dragging in the whole page.
const gmDate = d => { const [y,m,dd] = String(d).split('-').map(Number); return new Date(y, m-1, dd); };

// A metric returns {val, txt, state} — state is 'good' | 'warn' | 'bad' | null.
// null means not enough evidence yet, and the title stays neutral: colouring a
// goal off two data points teaches her to distrust the colour.
const GOAL_METRICS = {

  /* Open MID-WEEK events entered individually, away from a home course.

     Rewritten 6 Aug, and the first version was measuring the wrong thing
     entirely. It counted ROUNDS, so a three-day Mannschaftsmeisterschaft
     counted as three, and the goal read 7-of-5 and green. Astrid knew that was
     flattering; the corrected number is 0.

     Two corrections, both derived, neither needing a new field:
       1. CONSECUTIVE DAYS AT ONE COURSE ARE ONE EVENT. Entering a three-day
          team event is one decision, not three.
       2. MID-WEEK ONLY. Every away competitive round she has played this
          season was a Saturday or a Sunday - the team events. Weekends are
          Niko's, which is the real constraint behind this goal, so Mon-Fri is
          what actually distinguishes the thing being aimed at. It also
          excludes the team events without needing to label them.

     Aim 1.5 a month across May-October, judged on PACE so far rather than the
     season total, or it reads red until October and then flips in a week. */
  away_comps(R){
    /* Away, STROKE FORMAT, any day, counted as ROUNDS.

       Three shapes before this one, and each correction removed something of
       mine rather than adding anything. Mid-week was my invention: weekend
       events count perfectly well, when she plays is irrelevant. And the
       consecutive-day collapsing was a WORKAROUND for team events inflating
       the count three-to-one — which the matchplay flag now solves at the
       source, properly, so the workaround goes.

       Her two Fontana days are a two-day medal ranking tournament and count as
       two. St Pölten and Herzog were matchplay and count as none. That gives 2,
       which is what she said it was before any of this was computed. */
    const yr = new Date().getFullYear();
    const inSeason = d => { const m = Number(d.slice(5,7)); return m >= 5 && m <= 10; };
    const rounds = R.filter(r => r.comp && !r.stats_excluded && !r.matchplay
                              && r.date.slice(0,4) === String(yr) && inSeason(r.date)
                              && !HOME_COURSE.test(r.course || '')).length;
    const now = new Date();
    const monthsIn = Math.min(6, Math.max(0, (Math.min(10, now.getMonth()+1) - 5) + now.getDate()/30));
    if (monthsIn < 0.5) return {txt:'season not started', state:null};
    const due = 1.5 * monthsIn;
    const ratio = due ? rounds/due : 1;
    return {val: rounds, txt: `${rounds} away round${rounds===1?'':'s'} · ${due.toFixed(0)} due`,
            state: ratio >= 0.9 ? 'good' : ratio >= 0.6 ? 'warn' : 'bad'};
  },

  /* Holes after a birdie held to bogey or better. Her signature, measured.
     THRESHOLDS ARE DELIBERATELY NOT 95%: she makes about one birdie a round,
     so a season is ~20 events and a single slip costs 5 points. 95% would mean
     one lapse all year and would sit red on noise. 90/70 keeps it honest and
     still demanding — she is on 75% in competition against 100% socially. */
  post_birdie(R){
    let tot = 0, ok = 0;
    for (const r of R){
      if (r.stats_excluded) continue;
      const p = (r.holes_data||[]).filter(h => String(h.par??'')!=='' && String(h.score??'')!=='');
      for (let i = 0; i < p.length-1; i++){
        if (Number(p[i].score) < Number(p[i].par)){
          tot++;
          if (Number(p[i+1].score) - Number(p[i+1].par) <= 1) ok++;
        }
      }
    }
    if (tot < 5) return {txt:`${ok}/${tot} — too few birdies yet`, state:null};
    const pct = Math.round(ok*100/tot);
    return {val: pct, txt: `${pct}% held · ${ok}/${tot}`,
            state: pct >= 90 ? 'good' : pct >= 70 ? 'warn' : 'bad'};
  },

  /* Scramble: up-and-downs as a share of greens missed. Exactly the number she
     asked for — it combines the `c` marks with the saves actually made, since
     scrambling well and collecting c's are the same axis. Competition 15%,
     social 25%. Good amateurs run 30-40%, so 30 is the target and 20 the floor;
     this is her single biggest scoring leak. */
  scramble(R){
    let missed = 0, ud = 0;
    for (const r of R){
      if (r.stats_excluded || !r.comp) continue;
      for (const h of (r.holes_data||[])){
        if (String(h.par??'')==='' || String(h.score??'')==='') continue;
        if (h.gir) continue;
        missed++;
        const sh = String(h.short||'').toLowerCase();
        if (['ud','u','✓'].includes(sh) || Number(h.score) <= Number(h.par)) ud++;
      }
    }
    if (missed < 20) return {txt:'not enough competition holes', state:null};
    const pct = Math.round(ud*100/missed);
    return {val: pct, txt: `${pct}% scrambled · ${ud}/${missed}`,
            state: pct >= 30 ? 'good' : pct >= 20 ? 'warn' : 'bad'};
  },

  /* COUNTING-ROUND SCORING — replaces a reconstructed handicap.

     Her instruction, 6 Aug: do not calculate the handicap. The app cannot —
     her real index draws on scores this database does not hold and on 9-hole
     rounds combined in pairs, and every attempt to rebuild it moved by four
     shots depending on which subset was included. Her handicap is a published
     number; guessing at it is worse than useless because it looks authoritative.

     What the app CAN answer is the question the goal actually turns on: is she
     playing at the level that would take her there. So this measures COUNTING
     rounds only — competition, stroke format, not matchplay, not social — and
     asks whether their scoring sits where it needs to.

     COURSE-ADJUSTED, her numbers. Colony and Himberg rate well above par, so
     +10 there is the same golf as +5 somewhere easier; the boundaries move by
     five strokes between the two. Rather than judge each round against its own
     course, every round is normalised onto the "other courses" scale by taking
     five off the Colony/Himberg ones, so a mixed set averages honestly:

       Colony / Himberg      green ~+10   amber ~+15
       everywhere else       green ~+5    amber ~+10

     Her own reasoning for those levels: trending around +15 at Colony gets her
     to a sub-9 index eventually — twenty rounds of it, realistically two years,
     hence amber. Around +9 or +10 there translates to an index near 4 or 5 and
     gets her there far faster, hence green.

     COMPLETE CARDS ONLY, FOR THE FORMAT PLAYED — 9 holes or 17+, nothing in
     between. Her three Wednesday-afternoon 9-hole stableford comps at Colony
     were played DELIBERATELY to get counting cards in (there are very few
     handicap-relevant events to enter), so throwing them away would discard
     exactly the effort the goal is asking for. They scale honestly too: +12 per
     18, which is "played well, not great" and matches the ~20 points she
     returned. What gets excluded is the genuinely partial — an 8-hole card, or
     an 18-hole competition with 15 holes entered — where the missing holes are
     not a shorter format but a gap. Last 8, so it tracks current form. */
  counting_avg(R){
    const HOME_ADJ = /colony|himberg/i;
    const vals = [];
    for (const r of R){
      if (r.stats_excluded || !r.comp || r.matchplay) continue;
      const p = (r.holes_data||[]).filter(h => String(h.par??'')!=='' && String(h.score??'')!=='');
      if (!(p.length === 9 || p.length >= 17)) continue;   // complete for its format
      const per18 = p.reduce((a,h)=>a+(Number(h.score)-Number(h.par)),0) * 18 / p.length;
      // normalise onto the "other courses" scale
      vals.push({d: r.date, v: per18 - (HOME_ADJ.test(r.course||'') ? 5 : 0)});
    }
    if (vals.length < 3)
      return {txt:`only ${vals.length} counting round${vals.length===1?'':'s'}`, state:null};
    const last = vals.sort((a,z)=>a.d.localeCompare(z.d)).slice(-8);
    const avg = last.reduce((a,x)=>a+x.v, 0) / last.length;
    return {val: avg,
            txt: `counting rounds ${avg>0?'+':''}${avg.toFixed(1)} adj · needs +5`,
            state: avg <= 5 ? 'good' : avg <= 10 ? 'warn' : 'bad'};
  },

  /* BREAKING 80 is a GROSS SCORE, so read the gross score. Nothing here is
     relative to par, and that matters: her best completed competition round is
     27 April at Colony Himberg West Red, +7 — which looked like 79 until you
     notice the card totals PAR 73. She shot exactly 80. Comparing "+7" against
     an assumed par 72 would have marked this goal green for a round that
     missed it by one.

     Completed 18s only, stroke play only. A 17-hole round scaled up is not a
     round of 79, and a match won 3&2 is not a score at all. */
  best_comp_round(R){
    let best = null, when = null;
    for (const r of R){
      if (r.stats_excluded || !r.comp || r.matchplay) continue;
      const p = (r.holes_data||[]).filter(h => String(h.par??'')!=='' && String(h.score??'')!=='');
      if (p.length !== 18) continue;
      const gross = p.reduce((a,h)=>a+Number(h.score), 0);
      if (best == null || gross < best){ best = gross; when = r.date; }
    }
    if (best == null) return {txt:'no completed 18-hole comp yet', state:null};
    return {val: -best,          // lower gross is better; negate so trend reads up = good
            txt: `best 18-hole comp ${best} · needs 79`,
            state: best <= 79 ? 'good' : best <= 83 ? 'warn' : 'bad'};
  },

  /* Competition scoring minus social scoring. The choke signature as one
     number, and closing it is the two-year goal. Currently 3.8 shots. */
  comp_social_gap(R){
    const agg = f => { let n=0,d=0;
      for (const r of R){ if (r.stats_excluded || !f(r)) continue;
        for (const h of (r.holes_data||[])){
          if (String(h.par??'')==='' || String(h.score??'')==='') continue;
          n++; d += Number(h.score) - Number(h.par); } }
      return n >= 36 ? d*18/n : null; };
    const c = agg(r=>r.comp), so = agg(r=>!r.comp);
    if (c == null || so == null) return {txt:'need more of both', state:null};
    const gap = c - so;
    return {val: gap, txt: `${gap>0?'+':''}${gap.toFixed(1)} shots worse under a card`,
            state: gap <= 2 ? 'good' : gap <= 4 ? 'warn' : 'bad'};
  },
};

/* Metrics where "better" means a LOWER number. */
const LOWER_IS_BETTER = new Set(['counting_avg', 'comp_social_gap', 'best_comp_round']);
/* Season-to-date counts have no meaningful half-and-half trend. */
const NO_TREND = new Set(['away_comps']);

/* HORIZON-AWARE JUDGEMENT, added 6 Aug.

   The board came out entirely red and Astrid asked me to move the cutoffs. I
   would not — the thresholds are anchored on her own baseline and on what each
   goal literally requires, and shifting them the minute they deliver bad news
   is editing the thermometer. She has a standing instruction to me about
   exactly that.

   But she was right that the board was broken, for a different reason: a board
   where everything is one colour carries no information, and I was judging a
   FIVE-YEAR goal against today's average and colouring it red for not having
   arrived yet. That is a category error, not a hard truth.

   So: `now` goals are judged on ARRIVAL, because now is when they are due.
   2-year and 5-year goals are judged on MOVEMENT — are the last few rounds
   better than the ones before them. A long goal going the right way is green
   even when it is miles off, and a long goal drifting is red even if it once
   looked close. Nothing here changes a single number she is measured against;
   it changes which question the colour answers. */
function goalMetric(g, rounds){
  if (!g.metric || !GOAL_METRICS[g.metric]) return null;
  const fn = GOAL_METRICS[g.metric];
  let m;
  try { m = fn(rounds || [], g); }
  catch(e){ console.warn('metric failed', g.metric, e); return null; }
  if (!m) return null;

  // trend: same metric over the older half of her rounds vs the newer half
  if (!NO_TREND.has(g.metric) && m.val != null){
    try {
      const R = (rounds || []).slice().sort((a,z)=>a.date.localeCompare(z.date));
      const cut = Math.floor(R.length / 2);
      if (cut >= 4){
        const before = fn(R.slice(0, cut), g), after = fn(R.slice(cut), g);
        if (before && after && before.val != null && after.val != null){
          const raw = after.val - before.val;
          const better = LOWER_IS_BETTER.has(g.metric) ? -raw : raw;
          m.delta = raw;
          m.dir = Math.abs(raw) < 0.05 ? 'flat' : better > 0 ? 'up' : 'down';
        }
      }
    } catch(e){ /* trend is a bonus, never a reason to lose the metric */ }
  }

  // long-horizon goals are scored on movement, not arrival
  if ((g.horizon === '2y' || g.horizon === '5y') && m.dir)
    m.state = m.dir === 'up' ? 'good' : m.dir === 'flat' ? 'warn' : 'bad';

  return m;
}

async function renderGoals(){
  // rounds come along now: every metric on this page is computed from them
  let gRounds;
  [GOALS, gRounds] = await Promise.all([
    sel('goals', 'select=*&order=horizon.asc,sort.asc,id.asc'),
    selSoft('golf_rounds', 'select=date,course,comp,matchplay,stats_excluded,holes_data&order=date.asc'),
  ]);
  GOALS = GOALS || []; gRounds = gRounds || [];
  const canEdit = ME.role === 'teacher' || GOALS_STUDENT_WRITABLE;
  // The spec puts the status light in the teacher's hands — it is a judgement
  // about the coaching relationship, not a computed metric. But until Wes
  // onboards there IS no teacher, and a light nobody can move is just decoration.
  // So while goals are hers (goals_student_writable), the light is hers too. It
  // transfers to Wes the moment that flag flips, with no code change.
  const canLight = ME.role === 'teacher' || (ME.role === 'student' && GOALS_STUDENT_WRITABLE);

  let h = '';
  if (ME.role === 'student' && !GOALS_STUDENT_WRITABLE)
    h += `<div class="hintbar">Goals are Wes's to edit now. Talk to him if one needs changing.</div>`;

  for (const hz of HORIZONS){
    const list = GOALS.filter(g => g.horizon === hz.id);
    h += `<div class="card tinted" style="background:rgba(${hz.hue},${hz.a})">
      <div class="sect"><span>${hz.label}<span class="bar" style="background:rgba(${hz.hue},.85)"></span></span>${canEdit ? `<button class="btn btns" onclick="editGoal(null,'${hz.id}')">＋ Add</button>` : ''}</div>`;
    if (!list.length) h += `<div class="empty">Nothing set for this horizon yet.</div>`;
    /* HER ORDER, 6 Aug: process goals first, handicap goals after, achieved
       ones greyed at the foot of the process block. Something she is DOING
       outranks a number she is waiting on, and a goal already met should stay
       visible without taking the top of the page. */
    const rank = g => (g.status === 'achieved' ? 1 : 0) + (g.kind === 'outcome' ? 2 : 0);
    const ordered = list.slice().sort((a, z) =>
      rank(a) - rank(z) || (a.sort ?? 0) - (z.sort ?? 0) || a.id - z.id);

    for (const g of ordered){
      if (g.proposed){ h += proposedGoalHtml(g); continue; }
      const m = goalMetric(g, gRounds);
      const done = g.status === 'achieved';
      /* The TITLE carries the colour now — the dot is gone. Colour comes from
         the live metric where there is one, and only falls back to the status
         light where there isn't, so the page cannot claim a goal is on track
         while its own number says otherwise. No metric and no evidence = plain
         text, never a guess. */
      const col = done ? 'var(--gn)'
        : m && m.state === 'good' ? 'var(--gn)'
        : m && m.state === 'warn' ? 'var(--ye)'
        : m && m.state === 'bad'  ? 'var(--rd)'
        : m ? 'var(--tx)'
        : g.status === 'at_risk' ? 'var(--ye)'
        : g.status === 'stalled' ? 'var(--rd)'
        : 'var(--tx)';
      h += `<div class="goal" style="${done ? 'opacity:.55' : ''}">
        <div class="gt">
          <div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:8px">
            <b style="font-size:15px;font-weight:750;color:${col};${done ? 'text-decoration:line-through' : ''}">${esc(g.title)}</b>
            ${done ? '<span class="bp">achieved</span>'
                   : m ? `<span style="font-size:12px;font-weight:600;color:${col === 'var(--tx)' ? 'var(--mu)' : col}">${esc(m.txt)}${
                         m.dir ? `<span title="against her earlier rounds" style="margin-left:6px;font-weight:700">${
                           m.dir === 'up' ? '\u25b2' : m.dir === 'down' ? '\u25bc' : '\u2192'}</span>` : ''}</span>`
                       : ''}
          </div>
          ${g.detail ? `<p style="font-size:11.5px;color:var(--mu);margin-top:3px;line-height:1.45">${esc(g.detail)}</p>` : ''}
          ${canLight && !done ? statusPickHtml(g) : ''}
          ${suggestionHtml(g)}
        </div>
        ${canEdit ? `<button class="btn btns" onclick="editGoal(${g.id},'${g.horizon}')">✎</button>` : ''}
      </div>`;
    }
    h += `</div>`;
  }
  el('pg-goals').innerHTML = h;
}

const statusLabel = s => (STATUSES.find(x=>x.id===s)||{}).label || s;

// Claude's proposed status. It writes `suggested_status`, never `status` — the
// light stays a human call, so the suggestion is an argument you accept or bin,
// not a value that changed itself under you. Dismissing costs nothing; next
// Sunday simply proposes again if the case still holds.
function suggestionHtml(g){
  if (!g.suggested_status || g.suggested_status === g.status) return '';
  const when = g.suggested_at ? new Date(g.suggested_at).toLocaleDateString(undefined,{day:'numeric',month:'short'}) : '';
  return `<div style="margin-top:9px;padding:9px 11px;border:1px solid rgba(192,132,252,.4);
      background:rgba(192,132,252,.07);border-radius:9px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--pu);margin-bottom:4px">
      Claude suggests: ${esc(statusLabel(g.suggested_status))}${when?' · '+when:''}</div>
    ${g.suggested_reason?`<div style="font-size:12.5px;line-height:1.5;color:var(--tx)">${esc(g.suggested_reason)}</div>`:''}
    <div class="rbtns" style="margin-top:9px">
      <button class="btn btns btnp" onclick="acceptSuggestion(${g.id})">Accept</button>
      <button class="btn btns" onclick="dismissSuggestion(${g.id})">Dismiss</button>
    </div></div>`;
}

/* CONSENT, NOT EDITING. The goals table is teacher-write-only — she asked for
   that ("I just don't want to edit them myself. That strikes me as dangerous"),
   because a goal you can quietly rewrite on a bad day is not a goal. So her two
   powers are yes and no, and they run through SECURITY DEFINER functions that
   re-check is_student() rather than through any grant on the table. */
const consent = (fn, id) => api('rpc/'+fn, {method:'POST', body:{goal_id:id}, prefer:'return=minimal'});

async function acceptSuggestion(id){
  const g = GOALS.find(x=>x.id===id);
  if (!g) return;
  await consent('accept_goal', id);
  toast(g.proposed ? 'Added to your goals' : 'Moved to '+statusLabel(g.suggested_status));
  renderGoals();
}
async function dismissSuggestion(id){
  const g = GOALS.find(x=>x.id===id);
  if (g && g.proposed && !confirm('Bin this proposed goal?')) return;
  await consent('dismiss_goal', id);
  renderGoals();
}

// A proposal is not a goal yet, so it must not look like one — no status light,
// nothing that reads as agreed. It is an argument awaiting a yes.
function proposedGoalHtml(g){
  return `<div style="margin:9px 0;padding:11px 13px;border:1px solid rgba(192,132,252,.45);
      background:rgba(192,132,252,.08);border-radius:10px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--pu);margin-bottom:5px">
      ${esc(g.proposed_by||'Claude')} suggests a goal</div>
    <b style="font-size:14.5px;font-weight:650;line-height:1.35;display:block">${esc(g.title)}</b>
    ${g.detail?`<p style="font-size:12.5px;color:var(--mu);margin-top:4px;line-height:1.45;white-space:pre-wrap">${esc(g.detail)}</p>`:''}
    ${g.proposed_reason?`<div style="font-size:12.5px;line-height:1.5;margin-top:8px;padding-top:8px;border-top:1px solid rgba(192,132,252,.25)">${esc(g.proposed_reason)}</div>`:''}
    <div class="rbtns" style="margin-top:10px">
      <button class="btn btns btnp" onclick="acceptSuggestion(${g.id})">Accept</button>
      <button class="btn btns" onclick="dismissSuggestion(${g.id})">Not this one</button>
    </div></div>`;
}

function statusPickHtml(g){
  return `<div class="statuspick">` + STATUSES.map(s =>
    `<button class="spill ${g.status===s.id?'sel':''}" data-s="${s.id}" onclick="setGoalStatus(${g.id},'${s.id}')">${s.label}</button>`
  ).join('') + `</div>`;
}

async function setGoalStatus(id, status){
  await upd('goals', 'id=eq.'+id, {status, updated_at: new Date().toISOString()});
  toast('Status updated');
  renderGoals();
}

function editGoal(id, horizon){
  const g = id ? GOALS.find(x=>x.id===id) : {horizon, title:'', detail:'', status:'on_track', sort:GOALS.length};
  openSheet(`
    <div class="sheet-h"><b>${id?'Edit goal':'New goal'}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="fr"><label>Horizon</label><select id="g-hz">
      ${HORIZONS.map(x=>`<option value="${x.id}" ${x.id===g.horizon?'selected':''}>${x.label}</option>`).join('')}
    </select></div>
    <div class="fr"><label>Goal</label><input type="text" id="g-title" value="${esc(g.title)}" placeholder="e.g. Handicap 8.9"></div>
    <div class="fr"><label>Detail (optional)</label><textarea id="g-detail" rows="3" placeholder="What does hitting this actually look like?">${esc(g.detail||'')}</textarea></div>
    <div class="rbtns">
      <button class="btn btnp" onclick="saveGoal(${id||'null'})">Save</button>
      ${id ? `<button class="btn btnd" onclick="deleteGoal(${id})">Delete</button>` : ''}
      <button class="btn" onclick="closeSheet()">Cancel</button>
    </div>`);
}

async function saveGoal(id){
  const title = gv('g-title');
  if (!title){ toast('Give it a title'); return; }
  const row = {horizon: gv('g-hz'), title, detail: gv('g-detail') || null, updated_at: new Date().toISOString()};
  if (id) await upd('goals', 'id=eq.'+id, row);
  else await ins('goals', {...row, student_id: STUDENT_ID, status:'on_track', sort: GOALS.length});
  closeSheet(); toast('Saved'); renderGoals();
}
async function deleteGoal(id){
  if (!confirm('Delete this goal?')) return;
  await del('goals', 'id=eq.'+id);
  closeSheet(); renderGoals();
}

/* ═══════════════════════════════════════════════════════════════
   2 · WEEKLY COMMITMENTS

   One canonical Mon–Sun week. Assigned drills land in the "Open
   assignments" tray; drag (or tap-then-tap) them onto a day.

   Submit = commit + notify. NOT a lock: the grid stays editable
   afterwards and the digest shows planned-vs-actual instead. There
   is deliberately no lock ceremony.

   Ticking and scoring accumulate SILENTLY. No per-tick pings, ever
   — a muted channel is a dead channel.
   ═══════════════════════════════════════════════════════════════ */
let ASSIGN = [];       // assignments for WEEK, with the embedded drill
let SUBS = [];         // week_submissions for WEEK
let REFL = [];         // week_reflections for WEEK and the one before
let selectedAid = null;

/* ── The weekly reflection ───────────────────────────────────────
   Wes, 5 Aug. Three questions, answered BEFORE he assigns, so that what
   he sets answers what she said instead of arriving blind. Due Sunday
   before 16:00 — the digest he already receives goes at 16:00, so this
   needs no new delivery and gives that digest her voice.

   It lives here and not on the Weekly Summary on purpose. Her rule, and
   still right: the summary is evidence, not testimony. This is testimony.
   Wes reads it beside the evidence rather than inside it, and where the
   two disagree is the coaching.

   Question 3 carries the weight. Last week's answer to it is printed
   directly above this week's questions — that placement, and nothing
   else, is what makes this a contract rather than a diary. Nothing
   enforces it; being read is the mechanism.
   ──────────────────────────────────────────────────────────────── */
const reflFor = wk => REFL.find(r => r.week_start === wk) || null;

function reflectionHtml(){
  const wk = ymd(WEEK), r = reflFor(wk), prev = reflFor(ymd(addDays(WEEK,-7)));
  const mine = ME.role === 'student';
  const v = (x) => esc((r && r[x]) || '');

  if (!mine){
    if (!r || !r.submitted_at) return `<div class="card"><div class="ct">Her week, in her words</div>
      <div class="empty">Not written yet.</div></div>`;
    const row = (lbl, val) => val ? `<div style="margin-bottom:11px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:var(--mu);margin-bottom:3px">${lbl}</div>
      <div style="font-size:13.5px;line-height:1.5;white-space:pre-wrap">${esc(val)}</div></div>` : '';
    return `<div class="card"><div class="ct">Her week, in her words</div>
      ${row('What felt good', r.felt_good)}${row('What was off', r.was_off)}
      ${row('Committing to next week', r.commitment)}</div>`;
  }

  return `<div class="card"><div class="ct"><span>Reflect &amp; commit</span>${
      r && r.submitted_at ? '<span class="bp">sent</span>' : ''}</div>
    ${prev && prev.commitment ? `<div style="padding:10px 12px;border-radius:9px;margin-bottom:13px;
        border:1px solid rgba(200,169,110,.35);background:rgba(200,169,110,.08)">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:var(--ac);margin-bottom:4px">
        Last week you committed to</div>
      <div style="font-size:13.5px;line-height:1.5;white-space:pre-wrap">${esc(prev.commitment)}</div>
    </div>` : ''}
    <div class="fr"><label>What felt good this week?</label>
      <textarea id="rf_good" rows="2">${v('felt_good')}</textarea></div>
    <div class="fr"><label>What was off?</label>
      <textarea id="rf_off" rows="2">${v('was_off')}</textarea></div>
    <div class="fr"><label>What are you committing to for next week?</label>
      <textarea id="rf_com" rows="2" placeholder="One thing you'll own — not a target, a behaviour.">${v('commitment')}</textarea></div>
    <div class="rbtns" style="margin-top:0">
      <button class="btn btnp btns" onclick="saveReflection(true)">${r && r.submitted_at ? 'Update' : 'Send to '+esc(TEACHER_NAME)}</button>
      <button class="btn btns" onclick="saveReflection(false)">Save draft</button></div>
    <p class="empty" style="font-size:11.5px">Goes out with Sunday's 16:00 digest, before he assigns — so what he sets answers what you said.</p>
  </div>`;
}

async function saveReflection(send){
  const row = {
    student_id: STUDENT_ID, week_start: ymd(WEEK),
    felt_good: gv('rf_good') || null,
    was_off:   gv('rf_off')  || null,
    commitment:gv('rf_com')  || null,
    updated_at: new Date().toISOString(),
  };
  if (send){
    if (!row.commitment){ toast('Question 3 is the one that matters'); return; }
    row.submitted_at = new Date().toISOString();
  }
  await api('week_reflections?on_conflict=week_start', {method:'POST', body:row,
    prefer:'resolution=merge-duplicates,return=minimal'});
  if (send) await notify(TEACHER_NAME,
    `Astrid's reflection for ${fmtRange(WEEK)} is in the app.

Committing to: ${row.commitment}`);
  toast(send ? 'Sent' : 'Saved');
  renderWeek();
}

async function renderWeek(){
  const wk = ymd(WEEK);
  // Last week's row too: question 3 is a commitment, and a commitment nobody
  // reads back is a wish. It is shown above this week's answers.
  const prevWk = ymd(addDays(WEEK,-7));
  [ASSIGN, SUBS, REFL] = await Promise.all([
    sel('assignments', `select=*,drills(id,name,category,description,scoring_hint,created_by)&week_start=eq.${wk}&order=sort.asc,id.asc`),
    sel('week_submissions', `select=id,submitted_at&week_start=eq.${wk}&order=submitted_at.asc`),
    selSoft('week_reflections', `select=*&week_start=in.(${wk},${prevWk})`),
  ]);
  ASSIGN = ASSIGN || []; SUBS = SUBS || []; REFL = REFL || [];
  selectedAid = null;

  const tray = ASSIGN.filter(a => a.day_index == null);
  const placed = ASSIGN.filter(a => a.day_index != null);
  const doneN = placed.filter(a => a.done).length;

  let h = weekNavHtml(`${placed.length} placed · ${doneN} done`);

  if (SUBS.length){
    const t = new Date(SUBS[SUBS.length-1].submitted_at);
    h += `<div class="hintbar">Committed ${t.toLocaleDateString(undefined,{day:'numeric',month:'short'})} ${t.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}. Still editable — the digest compares plan against what actually happened.</div>`;
  }
  if (tray.length && !SUBS.length)
    h += `<div class="hintbar">Drag an open assignment onto a day — or tap it, then tap the day.</div>`;

  h += `<div class="wkgrid">`;
  for (const d of weekDays()){
    const items = placed.filter(a => a.day_index === d.i);
    h += `<div class="day ${d.isToday?'today':''}" data-drop="${d.i}" onclick="dayTapped(${d.i})">
      <div class="day-h"><b>${d.long}</b><span>${fmtDay(d.d)}${d.isToday?' · today':''}</span></div>
      <div class="pills">${items.map(pillHtml).join('') || '<span class="empty" style="padding:0;font-size:12px">—</span>'}</div>
    </div>`;
  }
  h += `</div>`;

  h += `<div class="tray" data-drop="tray" onclick="trayTapped()">
    <div class="ct"><span>Open assignments${tray.length?' · '+tray.length:''}</span>
      <button class="btn btns" onclick="event.stopPropagation();go('drills')">＋ From library</button></div>
    <div class="pills">${tray.map(pillHtml).join('') || '<span class="empty" style="padding:0;font-size:12px">Nothing waiting. Add from the library.</span>'}</div>
  </div>`;

  if (ME.role === 'student'){
    h += `<div class="rbtns">
      <button class="btn btnp" onclick="submitWeek()" ${placed.length?'':'disabled'}>
        ${SUBS.length ? 'Re-commit plan' : 'Submit plan'}</button>
    </div>
    <p class="empty" style="font-size:11.5px">Submitting notifies ${esc(TEACHER_NAME)} once per week and stamps a snapshot. Ticking things off after that is silent.</p>`;
  }

  h += reflectionHtml();
  h += weekNoteHtml();
  el('pg-week').innerHTML = h;
  wireDrag(el('pg-week'));
  loadWeekNote();
}

function pillHtml(a){
  const d = a.drills || {};
  return `<span class="pill by-${a.assigned_by} ${a.done?'done':''}" data-aid="${a.id}">
    <span class="nm">${esc(d.name || 'Drill')}</span>
    ${a.done ? '<span class="sc">✓' + (nn(a.score) ? ' '+a.score : '') + '</span>' : ''}
  </span>`;
}

/* ── drag + tap placement ─────────────────────────────────────────
   HTML5 drag-and-drop doesn't exist on touch, so this is pointer
   events: works with a finger and a mouse, same code. A tap (no
   movement) falls through to select-then-tap-a-day.
────────────────────────────────────────────────────────────────── */
function wireDrag(root){
  root.querySelectorAll('.pill[data-aid]').forEach(p => {
    p.addEventListener('pointerdown', pillPointerDown);
    p.addEventListener('click', e => e.stopPropagation());   // don't trigger the day's onclick
  });
}

function dropTargetAt(x,y){
  const e = document.elementFromPoint(x,y);
  const t = e && e.closest('[data-drop]');
  return t ? t.dataset.drop : null;
}
function paintDrop(key){
  document.querySelectorAll('[data-drop]').forEach(n => n.classList.toggle('drop', n.dataset.drop === key));
}

function pillPointerDown(e){
  if (e.button != null && e.button > 0) return;
  const pill = e.currentTarget;
  const aid = Number(pill.dataset.aid);
  const sx = e.clientX, sy = e.clientY;
  let moved = false, ghost = null, ox = 0, oy = 0;
  try { pill.setPointerCapture(e.pointerId); } catch {}

  const onMove = ev => {
    if (!moved && Math.hypot(ev.clientX-sx, ev.clientY-sy) < 8) return;
    if (!moved){
      moved = true;
      const r = pill.getBoundingClientRect();
      ox = sx - r.left; oy = sy - r.top;
      ghost = pill.cloneNode(true);
      ghost.classList.add('drag');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      pill.style.opacity = '.3';
      try { navigator.vibrate(15); } catch {}
    }
    ghost.style.left = (ev.clientX - ox) + 'px';
    ghost.style.top  = (ev.clientY - oy) + 'px';
    paintDrop(dropTargetAt(ev.clientX, ev.clientY));
  };
  const onUp = ev => {
    pill.removeEventListener('pointermove', onMove);
    pill.removeEventListener('pointerup', onUp);
    pill.removeEventListener('pointercancel', onUp);
    pill.style.opacity = '';
    if (ghost) ghost.remove();
    paintDrop(null);
    if (!moved){ pillTapped(aid); return; }
    const target = dropTargetAt(ev.clientX, ev.clientY);
    if (target != null) placeAssignment(aid, target === 'tray' ? null : Number(target));
  };
  pill.addEventListener('pointermove', onMove);
  pill.addEventListener('pointerup', onUp);
  pill.addEventListener('pointercancel', onUp);
}

function pillTapped(aid){
  const a = ASSIGN.find(x => x.id === aid);
  if (!a) return;
  if (a.day_index == null){
    // In the tray: select it, then tap a day.
    selectedAid = (selectedAid === aid) ? null : aid;
    document.querySelectorAll('.pill[data-aid]').forEach(p =>
      p.classList.toggle('sel', Number(p.dataset.aid) === selectedAid));
    if (selectedAid) toast('Now tap a day');
  } else {
    openAssignmentSheet(a);
  }
}
function dayTapped(i){
  if (selectedAid == null) return;
  const aid = selectedAid; selectedAid = null;
  placeAssignment(aid, i);
}
function trayTapped(){
  if (selectedAid == null) return;
  const aid = selectedAid; selectedAid = null;
  placeAssignment(aid, null);
}

async function placeAssignment(aid, dayIndex){
  await upd('assignments', 'id=eq.'+aid, {day_index: dayIndex});
  renderWeek();
}

/* ── tick / score / note — silent by design ─────────────────────── */
function openAssignmentSheet(a){
  const d = a.drills || {};
  openSheet(`
    <div class="sheet-h"><b>${esc(d.name||'Drill')}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="empty" style="padding:0 0 12px">${esc(catLabel(d.category))} · assigned by ${esc(a.assigned_by)}${d.description ? '<br>'+esc(d.description) : ''}</div>
    <label style="display:flex;align-items:center;gap:10px;font-size:15px;margin-bottom:12px;cursor:pointer">
      <input type="checkbox" id="a-done" ${a.done?'checked':''} style="width:20px;height:20px;accent-color:var(--gn)"> Done
    </label>
    <div class="fr"><label>Score${d.scoring_hint ? ' — '+esc(d.scoring_hint) : ''}</label>
      <input type="number" id="a-score" step="any" value="${nn(a.score)?a.score:''}" placeholder="—"></div>
    <div class="fr"><label>Note</label><textarea id="a-note" rows="2" placeholder="How did it actually go?">${esc(a.note||'')}</textarea></div>
    <div class="rbtns">
      <button class="btn btnp" onclick="saveAssignment(${a.id})">Save</button>
      <button class="btn" onclick="moveToTray(${a.id})">Back to tray</button>
      <button class="btn btnd" onclick="removeAssignment(${a.id})">Remove</button>
    </div>`);
}
async function saveAssignment(id){
  const done = el('a-done').checked;
  const sc = gv('a-score');
  await upd('assignments','id=eq.'+id, {
    done,
    score: sc === '' ? null : Number(sc),
    note: gv('a-note') || null,
    done_at: done ? new Date().toISOString() : null,
  });
  closeSheet(); renderWeek();          // silent — no notify() here, deliberately
}
async function moveToTray(id){ closeSheet(); await placeAssignment(id, null); }
async function removeAssignment(id){
  if (!confirm('Remove this from the week?')) return;
  await del('assignments','id=eq.'+id);
  closeSheet(); renderWeek();
}

/* ── submit ──────────────────────────────────────────────────────
   Notifies Wes on the FIRST commit of a week only. Re-committing
   re-stamps the snapshot silently — the alternative trains him to
   mute the channel, which is how the garmin flap went wrong.
────────────────────────────────────────────────────────────────── */
async function submitWeek(){
  const placed = ASSIGN.filter(a => a.day_index != null);
  const snapshot = placed.map(a => ({
    assignment_id: a.id, drill_id: a.drill_id,
    name: (a.drills||{}).name || null, category: (a.drills||{}).category || null,
    day_index: a.day_index, assigned_by: a.assigned_by,
  }));
  const first = SUBS.length === 0;
  await ins('week_submissions', {student_id: STUDENT_ID, week_start: ymd(WEEK), snapshot});

  if (first){
    const byDay = weekDays().map(d => {
      const items = placed.filter(a => a.day_index === d.i);
      return items.length ? `${d.label}: ${items.map(a=>(a.drills||{}).name).join(', ')}` : null;
    }).filter(Boolean);
    const sent = await notify(TEACHER_NAME,
      `Astrid has committed her plan for ${fmtRange(WEEK)} — ${placed.length} session${placed.length===1?'':'s'}.\n\n${byDay.join('\n')}`);
    toast(sent ? 'Committed — ' + TEACHER_NAME + ' notified' : 'Committed (' + TEACHER_NAME + ' not on Signal yet — queued)');
  } else {
    toast('Plan re-stamped');
  }
  renderWeek();
}

/* ── the student's week note (existing weekly_notes table) ──────── */
function weekNoteHtml(){
  return `<div class="card" style="margin-top:14px">
    <div class="ct">📝 Note for the week — context the data can't see</div>
    <textarea id="wk-note" rows="3" placeholder="Drill details, why something was cut short, what was different…"></textarea>
    <div class="rbtns"><button class="btn btns btnp" onclick="saveWeekNote()">Save</button>
      <span id="wk-note-st" class="empty" style="padding:0;align-self:center"></span></div>
  </div>`;
}
async function loadWeekNote(){
  try {
    const r = await sel('weekly_notes', `select=note&week_start=eq.${ymd(WEEK)}`);
    if (el('wk-note')) el('wk-note').value = (r && r[0] && r[0].note) || '';
  } catch {}
}
async function saveWeekNote(){
  const note = el('wk-note').value.trim();
  await api('weekly_notes', {method:'POST', prefer:'resolution=merge-duplicates,return=minimal',
    body:{week_start: ymd(WEEK), note, updated_at: new Date().toISOString()}});
  const st = el('wk-note-st');
  if (st){ st.textContent = '✓ saved'; setTimeout(()=>st.textContent='', 2500); }
}

/* ═══════════════════════════════════════════════════════════════
   3 · DRILLS + GAMES

   Shared library. All three parties add — Claude's additions are
   tagged and sparing; assignment quality beats library size.
   ═══════════════════════════════════════════════════════════════ */
let DRILLS = [], DRILL_SCORES = null;

async function renderDrills(){
  DRILLS = await sel('drills', 'select=*&archived=eq.false&order=category.asc,name.asc') || [];
  let h = `<div class="rbtns" style="margin:0 0 12px"><button class="btn btnp" onclick="editDrill(null)">＋ New drill or game</button></div>`;
  for (const c of CATS){
    const list = DRILLS.filter(d => d.category === c.id);
    if (!list.length) continue;
    h += `<div class="card tinted" style="background:rgba(${c.hue},.07)">
      <div class="sect"><span>${c.label}<span class="bar" style="background:rgba(${c.hue},.9)"></span></span>
        <span style="font-size:12px;color:var(--mu);font-weight:600">${list.length}</span></div>`;
    for (const d of list){
      h += `<div class="drow" onclick="openDrill(${d.id})">
        <div class="dn"><b>${esc(d.name)}</b><span>${esc(d.description||'')}</span></div>
        ${d.created_by === 'claude' ? '<span class="bg bg-claude">Claude</span>' : ''}
        ${d.created_by === 'teacher' ? '<span class="bg bg-teacher">'+esc(TEACHER_NAME)+'</span>' : ''}
        <span class="chev">›</span>
      </div>`;
    }
    h += `</div>`;
  }
  if (!DRILLS.length) h += `<div class="card"><div class="empty">Library is empty. Add the first drill.</div></div>`;
  el('pg-drills').innerHTML = h;
}

async function openDrill(id){
  const d = DRILLS.find(x => x.id === id);
  if (!d) return;
  // Score history across every week this drill was ever assigned.
  const hist = await sel('assignments',
    `select=week_start,score,done,done_at&drill_id=eq.${id}&score=not.is.null&order=week_start.asc`) || [];
  const mon = monday(new Date());
  const targets = [
    {label:'This week',  d: mon},
    {label:'Next week',  d: addDays(mon, 7)},
    {label:'Week after', d: addDays(mon, 14)},
  ];
  openSheet(`
    <div class="sheet-h"><b>${esc(d.name)}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="empty" style="padding:0 0 10px">${esc(catLabel(d.category))}${d.scoring_hint?' · scored '+esc(d.scoring_hint):''}</div>
    ${d.description ? `<p style="font-size:14px;line-height:1.6;margin-bottom:14px;white-space:pre-wrap">${esc(d.description)}</p>` : ''}
    ${sparkHtml(hist)}
    <div class="dl">Assign to</div>
    <div class="rbtns" style="margin-top:0">
      ${targets.map(t => `<button class="btn btnb btns" onclick="assignDrill(${d.id},'${ymd(t.d)}')">${t.label}</button>`).join('')}
    </div>
    <div class="rbtns"><button class="btn btns" onclick="editDrill(${d.id})">✎ Edit</button>
      <button class="btn btns btnd" onclick="archiveDrill(${d.id})">Archive</button></div>`);
}

// Tiny inline SVG trend — no chart library, nothing to load.
function sparkHtml(hist){
  if (!hist.length) return `<div class="empty" style="padding:0 0 10px">No scores logged yet.</div>`;
  if (hist.length === 1)
    return `<div class="empty" style="padding:0 0 10px">One score so far: <b style="color:var(--tx)">${hist[0].score}</b> (${esc(hist[0].week_start)})</div>`;
  const vals = hist.map(x => Number(x.score));
  const min = Math.min(...vals), max = Math.max(...vals), span = (max-min) || 1;
  const W = 300, H = 74, P = 8;
  const pts = vals.map((v,i) => {
    const x = P + (i/(vals.length-1)) * (W - 2*P);
    const y = H - P - ((v-min)/span) * (H - 2*P);
    return [x,y];
  });
  const path = pts.map((p,i) => (i?'L':'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const first = vals[0], last = vals[vals.length-1];
  const delta = last - first;
  return `<div class="dl" style="margin-top:0">Score history — ${vals.length} logged</div>
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" fill="none" stroke="var(--ac)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="var(--ac)"/>`).join('')}
    </svg>
    <div class="empty" style="padding:0 0 10px">
      First ${first} → latest <b style="color:var(--tx)">${last}</b>
      ${delta ? ` · <span class="${delta>0?'good':'bad'}">${delta>0?'+':''}${Math.round(delta*10)/10}</span>` : ' · flat'}
      · best ${max}, worst ${min}
    </div>`;
}

async function assignDrill(drillId, weekStart){
  const byTeacher = ME.role === 'teacher';
  await ins('assignments', {
    student_id: STUDENT_ID, drill_id: drillId, week_start: weekStart,
    day_index: null, assigned_by: byTeacher ? 'teacher' : 'student',
  });
  const d = DRILLS.find(x => x.id === drillId) || {};
  if (byTeacher){
    // Events → Astrid: drill assigned. (The other one is "feedback ready".)
    await notify(STUDENT_NAME,
      `${TEACHER_NAME} has assigned you a drill for the week of ${fmtRange(parseYmd(weekStart))}: ${d.name}. It's waiting in your open assignments.`);
  }
  closeSheet();
  toast(byTeacher ? 'Assigned — Astrid notified' : 'Added to your open assignments');
}

function editDrill(id){
  const d = id ? DRILLS.find(x=>x.id===id) : {category:'putting_chipping', name:'', description:'', scoring_hint:''};
  openSheet(`
    <div class="sheet-h"><b>${id?'Edit drill':'New drill or game'}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="fr"><label>Category</label><select id="d-cat">
      ${CATS.map(c=>`<option value="${c.id}" ${c.id===d.category?'selected':''}>${c.label}</option>`).join('')}</select></div>
    <div class="fr"><label>Name</label><input type="text" id="d-name" value="${esc(d.name)}" placeholder="e.g. Gate drill – 3ft"></div>
    <div class="fr"><label>Description</label><textarea id="d-desc" rows="4" placeholder="How is it set up, and what counts?">${esc(d.description||'')}</textarea></div>
    <div class="fr"><label>How it's scored</label><input type="text" id="d-score" value="${esc(d.scoring_hint||'')}" placeholder="out of 20 / points / metres"></div>
    <div class="rbtns"><button class="btn btnp" onclick="saveDrill(${id||'null'})">Save</button>
      <button class="btn" onclick="closeSheet()">Cancel</button></div>`);
}
async function saveDrill(id){
  const name = gv('d-name');
  if (!name){ toast('Give it a name'); return; }
  const row = {category: gv('d-cat'), name, description: gv('d-desc')||null, scoring_hint: gv('d-score')||null};
  if (id) await upd('drills','id=eq.'+id, row);
  else await ins('drills', {...row, created_by: ME.role === 'teacher' ? 'teacher' : 'student'});
  closeSheet(); toast('Saved'); renderDrills();
}
async function archiveDrill(id){
  if (!confirm('Archive this drill? Past scores stay.')) return;
  await upd('drills','id=eq.'+id, {archived:true});
  closeSheet(); renderDrills();
}

/* ═══════════════════════════════════════════════════════════════
   4 · ROUNDS

   Ported from the goal-tracker's "Runden" tab: same key-stats block,
   same fault-only card, same add-round flow, same history — pointed
   at the same golf_rounds table, so all 34 historical rounds are
   there from the first load.

   One change on purpose: the old sync DELETEd every row and re-POSTed
   the whole array on every save. That's a data-loss trap on a phone
   with flaky wifi, so this writes row by row.
   ═══════════════════════════════════════════════════════════════ */
let ROUNDS = [], roundMode = 'select', editId = null;
let scanFiles = [null,null], scanPreviews = [null,null];

/* ── Comp round → Wes ────────────────────────────────────────────
   Added 4 Aug 2026. The SPEC said "submit + Sunday digest only, never
   per-tick"; that rule was written about habit ticks, and a competition
   result is the one thing a remote coach wants pushed rather than pulled.
   It replaces texting him the score, so it removes a job rather than
   adding one. Social rounds stay silent — the digest already lists them.

   WHY A BUTTON AND NOT AUTOMATIC ON SAVE. A round is saved many times
   while the holes go in — watched live on 4 Aug, saved at 7 holes of 18 —
   so firing on save would send a score she had not finished writing down.
   There is no reliable "card complete" signal to fire on instead. Blank
   holes are a legitimate finished card, for at least two unrelated
   reasons — 4 Aug had both: two holes CLOSED for maintenance (conceded at
   net 2 points, never played), and a front nine she simply chose not to
   enter. A finished card, 7 scores in 18 rows. Any "has she filled it in"
   rule calls that unfinished for ever. She knows when she is done; the
   app does not, and should stop pretending it can infer it.

   SENT-ONCE LEDGER: the `notifications` table itself, matched on the
   round id carried in the message. No new column, and it survives a
   reinstall — which a localStorage flag would not.
   ──────────────────────────────────────────────────────────────── */
const roundTag = id => `#R${id}`;
let COMP_SENT = new Set();

/* ── Read-only hole-by-hole ──────────────────────────────────────
   Found 4 Aug: Wes could not open a round. Not a permission problem —
   there was no read-only detail view at all. The student reached the
   card only through editRound(), which is student-gated and correctly
   so, which left the teacher with a summary line and no way in. The
   hole-by-hole IS the coaching read, so the coach was the one person
   who could not see it.

   Expands in place rather than becoming a page: no router change, and
   the summary stays on screen next to the detail.

   The legend is not decoration. The fault-only shorthand is Astrid's,
   built for her card in June; Wes has never seen it and would
   otherwise be reading someone else's private notation.
   ──────────────────────────────────────────────────────────────── */
let openRound = null;

function toggleRoundDetail(id){
  openRound = (openRound === id) ? null : id;
  renderRounds();
}

function roundDetailHtml(r){
  const hd = (r.holes_data||[]).map((h,i)=>({...h, no:i+1}))
                               .filter(h => String(h.score??'')!=='' || String(h.par??'')!=='');
  if (!hd.length)
    return `<div class="empty" style="padding:10px 0 2px">${r.is_simple
      ? 'Logged without a scorecard — no hole detail.'
      : 'No holes filled in on this card.'}</div>`;

  const mark = v => { const s=String(v??'').trim(); return s===''?'<span style="color:var(--b1)">·</span>':esc(s.toUpperCase()); };
  const cell = 'padding:3px 6px;text-align:center;white-space:nowrap';

  return `<div style="overflow-x:auto;margin-top:8px;-webkit-overflow-scrolling:touch">
    <table style="border-collapse:collapse;font-size:11px;min-width:100%">
      <thead><tr style="color:var(--mu);text-transform:uppercase;letter-spacing:.6px;font-size:9px">
        <th style="${cell};text-align:left">Hole</th><th style="${cell}">Par</th><th style="${cell}">Score</th>
        <th style="${cell}">GIR</th><th style="${cell}">Drive</th><th style="${cell}">App</th>
        <th style="${cell}">Short</th><th style="${cell}">Putts</th><th style="${cell}">Trbl</th><th style="${cell}">MP</th><th style="${cell}">Cmt</th>
      </tr></thead><tbody>
      ${hd.map(h=>{
        const p=Number(h.par), s=Number(h.score);
        const d=(String(h.score??'')!==''&&String(h.par??'')!=='')?s-p:null;
        const col=d===null?'':d<=-1?'var(--gn)':d===0?'var(--tx)':d===1?'var(--wn,var(--tx))':'var(--bd,var(--tx))';
        return `<tr style="border-top:1px solid var(--b1)">
          <td style="${cell};text-align:left;font-weight:600">${h.no}</td>
          <td style="${cell};color:var(--mu)">${esc(String(h.par??'')||'·')}</td>
          <td style="${cell};font-weight:700;color:${col}">${esc(String(h.score??'')||'·')}${d!==null&&d!==0?`<span style="font-weight:400;font-size:9px;color:var(--mu)"> ${d>0?'+':''}${d}</span>`:''}</td>
          <td style="${cell}">${h.gir?'●':'<span style="color:var(--b1)">·</span>'}</td>
          <td style="${cell}">${mark(h.drive)}</td>
          <td style="${cell}">${mark(h.app)}</td>
          <td style="${cell}">${mark(h.short)}</td>
          <td style="${cell};color:var(--mu)">${h.putts??'<span style="color:var(--b1)">·</span>'}</td>
          <td style="${cell}">${mark(h.trbl)}</td>
          <td style="${cell};font-weight:700;color:${h.mp==='+'?'var(--gn)':h.mp==='-'?'var(--rd)':'var(--mu)'}">${
            h.mp==='=' ? '\u00bd' : (h.mp || '<span style="color:var(--b1)">\u00b7</span>')}</td>
          <td style="${cell};color:${h.cmt?'var(--rd)':'var(--b1)'}">${h.cmt?'●'.repeat(Math.min(5,Number(h.cmt))):'·'}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    <div style="font-size:10px;color:var(--mu);margin-top:8px;line-height:1.6">
      <b>Fault-only card</b> — a blank cell means that part of the hole was fine, so only the misses are written down.<br>
      <b>Drive</b> S advantage lost · X green gone &nbsp;·&nbsp; <b>App</b> M missed the quadrant, 7i or shorter · X dead, any club
      <span style="opacity:.7">(W on older cards = wedge wrong side, retired 5 Aug 2026; counted as M)</span><br>
      <b>Short</b> C choked a makeable save (successful saves are derived, not ticked) &nbsp;·&nbsp;
      <b>Trbl</b> W water · O OB · U unplayable · FB/GB bunker &nbsp;·&nbsp;
      <b>Cmt</b> one dot per shot she was not fully committed to
    </div>`;
}

async function loadCompSent(){
  const rows = await selSoft('notifications', 'select=message&recipient=eq.'+encodeURIComponent(TEACHER_NAME));
  COMP_SENT = new Set();
  for (const r of rows){
    const m = String(r.message||'').match(/#R(\d+)/);
    if (m) COMP_SENT.add(Number(m[1]));
  }
}

async function sendRoundToWes(id){
  const r = ROUNDS.find(x=>x.id===id);
  if (!r) return;
  const s = getRoundStats(r);
  const when = r.date ? fmtDay(parseYmd(r.date)) : 'today';
  const bits = [];
  if (s.delta !== null) bits.push(`${s.delta>0?'+':''}${s.delta} to par off ${s.n} holes`);
  if (s.gir   !== null) bits.push(`GIR ${s.gir}`);
  if (s.fw    !== null) bits.push(`fairways ${s.fw}`);
  if (s.putts !== null) bits.push(`${s.putts} putts`);
  if (s.p3)             bits.push(`${s.p3} three-putt${s.p3>1?'s':''}`);
  if (s.db)             bits.push(`${s.db} double${s.db>1?'s':''}+`);
  if (s.pen)            bits.push(`${s.pen} penalt${s.pen>1?'ies':'y'}`);

  const msg = `Astrid played a competition — ${r.course||'course not given'}, ${when}.\n\n`
    + (bits.length ? bits.join(' · ') + '\n\n' : '')
    + (r.notes ? `Her note: "${r.notes}"\n\n` : '')
    + `Full card in the app under Rounds. ${roundTag(id)}`;

  if (!await notify(TEACHER_NAME, msg)) { toast("Couldn't queue that — try again"); return; }
  COMP_SENT.add(id);
  toast(`Sent to ${TEACHER_NAME}`);
  renderRounds();
}

/* Wes asked for the legend to live on the Rounds page rather than only inside
   an opened card, 5 Aug. Collapsed by default: he needs it until he has the
   shorthand, she never needs it, and neither should pay for it with a screen
   of small print above their rounds. */
let legendOpen = false;
function toggleLegend(){ legendOpen = !legendOpen; renderRounds(); }
function roundsLegendHtml(){
  return `<div class="card" style="padding:11px 14px">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleLegend()">
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--mu);font-weight:600">
        How to read the card</span>
      <span style="color:var(--mu);font-size:13px">${legendOpen?'▾':'▸'}</span>
    </div>
    ${legendOpen?`<div style="font-size:11.5px;color:var(--mu);margin-top:9px;line-height:1.65">
      <b>Fault-only</b> — a blank cell means that part of the hole was fine, so only the misses are written down.<br>
      <b>Drive</b> S advantage lost · X green gone &nbsp;·&nbsp; <b>App</b> M missed the quadrant, 7i or shorter · X dead, any club<br>
      <b>Short</b> C choked a makeable save (successful saves are derived, not ticked)<br>
      <b>Trbl</b> W water · O OB · U unplayable — <i>these carry a penalty stroke</i> · FB/GB bunker, no stroke<br>
      <b>GIR</b> green in regulation · <b>Putts</b> count
    </div>`:''}</div>`;
}

async function renderRounds(){
  if (roundMode === 'select' && editId === null){
    ROUNDS = await sel('golf_rounds','select=*&order=date.desc,id.desc') || [];
    if (ME.role === 'student') await loadCompSent();
  }

  let h = roundStatsHtml();
  h += roundsLegendHtml();

  if (editId !== null){
    const r = ROUNDS.find(x=>x.id===editId);
    h += r && r.is_simple ? simpleFormHtml() : cardFormHtml();
  } else if (roundMode === 'select' && ME.role !== 'student'){
    // Rounds are hers to write (migration 08). Nothing to offer him here.
  } else if (roundMode === 'select'){
    h += `<div class="card"><div class="ct">New round</div>
      <p class="empty" style="padding:0 0 10px">Scan the scorecard, enter it hole by hole, or just log that you played.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btnp" style="flex:1;min-width:84px" onclick="startScan()">📷 Photo</button>
        <button class="btn" style="flex:1;min-width:84px" onclick="setRoundMode('manual')">✏️ Card</button>
        <button class="btn" style="flex:1;min-width:84px" onclick="setRoundMode('simple')">🏌️ Quick add</button>
      </div></div>`;
  } else if (roundMode === 'scan'){
    h += scanHtml();
  } else if (roundMode === 'simple'){
    h += simpleFormHtml();
  } else {
    h += cardFormHtml();
  }

  if (editId === null && roundMode === 'select') h += historyHtml();
  el('pg-rounds').innerHTML = h;
  if (editId !== null) setTimeout(fillFormFromRound, 40);
}

// Called by the router on page entry (not by the internal re-renders).
function resetRounds(){ roundMode='select'; editId=null; scanFiles=[null,null]; scanPreviews=[null,null]; }
function setRoundMode(m){ roundMode = m; editId = null; renderRounds(); }
function cancelRound(){ roundMode='select'; editId=null; scanFiles=[null,null]; scanPreviews=[null,null]; renderRounds(); }

/* ── stats (verbatim logic from the tracker) ─────────────────── */
function deriveRoundStats(hd){
  const Z={n:0,delta:null,gir:null,fw:null,ud:null,p3:null,db:null,b5:null,pen:null,bs:null,
           drvS:null,drvX:null,appM:null,appW:null,appX:null,shC:null,putts:null,penStk:null,bunk:null,hero:null,
           quadHit:null,quadPct:null,posHit:null,posPct:null,cmtPct:null,cmtDots:null};
  if(!hd||!hd.length)return Z;
  const played=hd.filter(h=>h.par!=null&&h.par!==''&&h.score!=null&&h.score!=='');
  const n=played.length;
  if(!n)return Z;
  const isNew=played.some(h=>h.drive!==undefined||h.app!==undefined||h.short!==undefined||h.trbl!==undefined||h.putts!==undefined);
  const delta=played.reduce((s,h)=>s+(Number(h.score)-Number(h.par)),0);
  const gir=played.filter(h=>h.gir).length;
  const db=played.filter(h=>Number(h.score)>=Number(h.par)+2).length;
  const b5=played.filter(h=>Number(h.par)===5&&Number(h.score)>=6).length;
  const o={...Z,n,delta,gir,db,b5};
  if(isNew){
    const dv=h=>String(h.drive||'').toLowerCase(), ap=h=>String(h.app||'').toLowerCase(),
          sh=h=>String(h.short||'').toLowerCase(), tr=h=>String(h.trbl||'').trim().toUpperCase();
    o.drvS=played.filter(h=>dv(h)==='s').length;
    o.drvX=played.filter(h=>dv(h)==='x').length;
    // Fault-only card: a blank Drive cell means "fine", so a fault-free drive
    // on a non-par-3 is the fairway-hit equivalent.
    o.fw=played.filter(h=>Number(h.par)!==3&&dv(h)==='').length;
    // Wes collapsed the App column on 5 Aug 2026: the club stopped mattering,
    // the QUADRANT started — he defines it as inside 30ft, the distance at which
    // a three-putt stops being likely. So "missed with a wedge" and "missed with
    // a 7-iron" became one fault, because they cost the same.
    //
    // Old cards keep their w. It is folded into m for every derived figure —
    // that is interpretation, not rewriting: a wedge on the wrong side always WAS
    // a missed quadrant, it just had its own letter. appW stays populated so an
    // old card still renders the letter it was written with.
    //
    // Honest caveat: pre-5-Aug "m" meant "scoring-club miss" by feel, not by 30ft.
    // A trend that straddles the changeover is comparing a judgement with a
    // measurement, and should be read as such.
    o.appW=played.filter(h=>ap(h)==='w').length;
    o.appM=played.filter(h=>ap(h)==='m').length + o.appW;
    o.appX=played.filter(h=>ap(h)==='x').length;
    o.shC=played.filter(h=>sh(h)==='c').length;
    // A successful save is DERIVED: missed the green, still par or better.
    o.ud=played.filter(h=>!h.gir&&(['ud','u','✓'].includes(sh(h))||Number(h.score)<=Number(h.par))).length;
    // hero-shot tell: green-attack died AND a penalty stroke on the same hole
    o.hero=played.filter(h=>ap(h)==='x'&&['W','O','U'].includes(tr(h))).length;
    o.putts=played.reduce((s,h)=>s+(Number(h.putts)||0),0)||null;
    o.p3=played.filter(h=>Number(h.putts)>=3).length;
    o.penStk=played.filter(h=>['W','O','U'].includes(tr(h))).length;
    o.bunk=played.filter(h=>['FB','GB'].includes(tr(h))).length;
    o.pen=o.penStk;

    /* SCORING POSITION % — Wes's headline metric. Astrid's design, 5 Aug
       evening, and it is a genuine improvement on what I had.

       It began as "Quadrant %" over m and x. That name claimed 30ft, which the
       data cannot support: `m` is only ever marked on a SCORING-CLUB approach,
       7i or shorter. A 6-iron or longer leaves the cell blank whatever happens.

       Which left a hole in the measurement, not just in the name: on a long
       approach NO fault was possible, so long courses quietly flattered the
       figure. I was going to document that and move on. Her fix is better —
       add `c`.

       Her reasoning: when she misses a green it is usually with a long club,
       and then the chip is the shot that decides whether par was ever
       available. `c` is not "chunked" — it is any chip that does not finish
       inside about 10ft, unless the lie was bad enough that anywhere on the
       green was a good result. So `c` is the long-hole equivalent of missing
       the quadrant: the same failure, one shot later.

       With it, EVERY hole has a route to a fault and the metric stops
       depending on how long the course is:
         7i or shorter, quadrant hit ........ blank   in position
         7i or shorter, quadrant missed ..... m       not
         6i or longer, green hit ............ blank   in position
         6i or longer, missed, chip close ... blank   in position
         6i or longer, missed, chip not ..... c       not
         dead ............................... x       not

       COMPUTED PER HOLE, NOT BY COUNTING MARKS. A hole can carry both an `m`
       and a `c` — miss the quadrant with a wedge, then chip badly — and
       subtracting mark counts would punish that hole twice and can drive the
       figure below zero on a bad enough round. */
    o.posHit = played.filter(h => ['m','x','w'].indexOf(ap(h)) < 0 && sh(h) !== 'c').length;
    o.posPct = n ? Math.round(o.posHit * 100 / n) : null;
    // kept as the approach-only view, for when the question is specifically
    // about the approach rather than about reaching a scoring position
    o.quadHit = n - o.appM - o.appX;
    o.quadPct = n ? Math.round(o.quadHit * 100 / n) : null;

    /* COMMITMENT % — dots marked AFTER each shot, per Wes and her call that it
       must be a record rather than a live judgement (a running self-assessment
       mid-swing is the attention spiral that produced the range shanks).
       Denominator is shots actually PLAYED: score minus the penalty strokes,
       which are the W/O/U marks. A penalty is not a shot you failed to commit
       to. Bunkers carry none. Known limit: one Trbl code per hole, so two
       penalties on one hole quietly inflate that hole's denominator. */
    const withCmt = played.filter(h => h.cmt != null && h.cmt !== '');
    if (withCmt.length){
      const dots = withCmt.reduce((a,h)=>a+Number(h.cmt||0),0);
      const shots = withCmt.reduce((a,h)=>a + Number(h.score)
        - (['W','O','U'].includes(tr(h)) ? 1 : 0), 0);
      o.cmtDots = dots;
      o.cmtPct = shots > 0 ? Math.round((1 - dots/shots) * 100) : null;
    }
  }else{
    o.fw=played.filter(h=>h.fw&&Number(h.par)!==3).length;
    o.ud=played.filter(h=>h.ud&&!h.gir).length;
    o.p3=played.filter(h=>h.p3).length;
    o.pen=played.filter(h=>h.p&&String(h.p).trim()).length;
    o.bs=played.filter(h=>h.b7).length;
  }
  return o;
}
function getRoundStats(r){
  if (r.holes_data && r.holes_data.length){
    const s = deriveRoundStats(r.holes_data);
    return {...s, holes: s.n};
  }
  return {n: Number(r.holes||18), holes: Number(r.holes||18), delta:null, gir:null, fw:null, ud:null,
          p3:null, db:null, b5:null, pen:null, bs:null, drvS:null, drvX:null, appM:null, appW:null,
          appX:null, shC:null, putts:null, penStk:null, bunk:null, hero:null};
}

function roundStatsHtml(){
  if (!ROUNDS.length) return '';
  const sc=(v,n)=>(v!=null&&n>0)?v*18/n:null;
  // stats_excluded rounds stay in history and stay hers — they just don't get
  // to speak for the others. A half-entered card is not a small sample, it is a
  // biased one, and averaging it in is worse than not having it.
  const rs=ROUNDS.filter(r=>!r.stats_excluded).map(r=>{const s=getRoundStats(r);return {...s,comp:!!r.comp};});
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const f1=v=>v==null?'—':(Math.round(v*10)/10).toFixed(1);
  const sg=v=>v==null?'':((v>0?'+':'')+(Math.round(v*10)/10).toFixed(1));
  const fS=v=>v==null?'—':((v>0?'+':'')+(Math.round(v*10)/10).toFixed(1));
  const sD=g=>mean(rs.filter(g).filter(x=>x.delta!=null&&x.n>=9).map(x=>sc(x.delta,x.n)));
  const dAll=sD(()=>true), dComp=sD(x=>x.comp), dNorm=sD(x=>!x.comp);
  const M=[
    {l:'Doubles+',      g:x=>x.db, bad:1},
    {l:'3-putts',       g:x=>x.p3, bad:1},
    {l:'Penalties',     g:x=>x.penStk!=null?x.penStk:x.pen, bad:1},
    {l:'Drives lost',   g:x=>x.drvX, bad:1},
    // appM already includes appW (folded above) — adding appW again would count
    // every legacy wedge miss twice.
    {l:'App faults',    g:x=>(x.appM!=null||x.appX!=null)?((x.appM||0)+(x.appX||0)):null, bad:1},
    {l:'Short chokes',  g:x=>x.shC, bad:1},
    {l:'GIR',           g:x=>x.gir, bad:0},
    {l:'Up & downs',    g:x=>x.ud, bad:0},
  ];
  const rows=M.map(m=>{
    const pool=ff=>{const xs=rs.filter(x=>ff(x)&&m.g(x)!=null&&x.n>0);const H=xs.reduce((s,x)=>s+x.n,0);
      return H?xs.reduce((s,x)=>s+m.g(x),0)*18/H:null;};
    const cv=pool(x=>x.comp), nv=pool(x=>!x.comp), av=pool(()=>true);
    return {l:m.l, bad:m.bad, cv, nv, av, delta:(cv!=null&&nv!=null)?cv-nv:null};
  }).filter(r=>r.av!=null);
  const bad=rows.filter(r=>r.bad), good=rows.filter(r=>!r.bad);
  const workOn=bad.filter(r=>r.delta!=null).sort((a,b)=>b.delta-a.delta)[0]||bad.slice().sort((a,b)=>b.av-a.av)[0];
  const resilient=bad.filter(r=>r.delta!=null&&r.delta<=0.3).sort((a,b)=>a.delta-b.delta)[0];
  const strong=good.slice().sort((a,b)=>b.av-a.av)[0];
  const carrot=resilient||strong;

  let h=`<div class="mgrid">
    <div class="mc"><div class="mv">${fS(dAll)}</div><div class="ml">Ø /18</div></div>
    <div class="mc"><div class="mv">${fS(dComp)}</div><div class="ml">Ø comp /18</div></div>
    <div class="mc"><div class="mv">${fS(dNorm)}</div><div class="ml">Ø social /18</div></div>
  </div>`;
  if(workOn){
    const sub=workOn.delta!=null?`${f1(workOn.nv)} social → ${f1(workOn.cv)} comp · ${sg(workOn.delta)} under pressure`:`${f1(workOn.av)} per 18`;
    h+=`<div style="margin-top:14px;padding:11px 13px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.08);border-radius:10px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--rd);margin-bottom:3px">🎯 Work on</div>
      <div style="font-size:15px;font-weight:700">${workOn.l}</div>
      <div style="font-size:12px;color:var(--mu);margin-top:2px">${sub}</div></div>`;
  }
  if(carrot){
    const sub=carrot.bad?`stays steady under a card · ${sg(carrot.delta)} comp`:`${f1(carrot.av)} per 18`;
    h+=`<div style="margin-top:8px;padding:11px 13px;border:1px solid rgba(74,222,128,.4);background:rgba(74,222,128,.08);border-radius:10px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--gn);margin-bottom:3px">💪 Doing well</div>
      <div style="font-size:15px;font-weight:700">${carrot.l}</div>
      <div style="font-size:12px;color:var(--mu);margin-top:2px">${sub}</div></div>`;
  }
  h+=`<div style="margin-top:14px;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--mu);margin-bottom:6px">Per 18 — social · comp · Δ</div>
    <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:5px 12px;font-size:13px;align-items:center">`;
  rows.forEach(r=>{
    let dc='var(--mu)';
    if(r.delta!=null){const worse=r.bad?(r.delta>0.2):(r.delta<-0.2);const better=r.bad?(r.delta<-0.2):(r.delta>0.2);
      dc=worse?'var(--rd)':(better?'var(--gn)':'var(--mu)');}
    h+=`<div>${r.l}</div>
        <div style="text-align:right;font-variant-numeric:tabular-nums">${f1(r.nv)}</div>
        <div style="text-align:right;font-variant-numeric:tabular-nums">${f1(r.cv)}</div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;color:${dc}">${r.delta==null?'—':sg(r.delta)}</div>`;
  });
  return h+`</div>`;
}

function historyHtml(){
  if (!ROUNDS.length) return `<div class="card"><div class="empty">No rounds logged yet.</div></div>`;
  let h=`<div class="card"><div class="ct">Round history · ${ROUNDS.length}</div>`;
  for (const r of ROUNDS){
    const s=getRoundStats(r);
    const sc18=(v,n)=>v!==null&&n>0?v*18/n:null;
    const dScaled=sc18(s.delta,s.n);
    const isOpen = openRound === r.id;
    h+=`<div class="rrow">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
        <span style="font-weight:700;font-size:14px;cursor:pointer;flex:1" onclick="toggleRoundDetail(${r.id})"
          >${isOpen?'▾':'▸'} ${esc(r.date||'—')}${r.course?' · '+esc(r.course):''}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${r.comp?'<span class="bi">Comp</span>':''}${r.practice?'<span class="bp">Practice</span>':''}
          ${ME.role==='student'&&r.comp?(COMP_SENT.has(r.id)
            ? `<span class="bp" title="Already sent — a comp round only goes once">→ ${esc(TEACHER_NAME)} ✓</span>`
            : `<button class="btn btns" onclick="sendRoundToWes(${r.id})" title="Send this comp round to ${esc(TEACHER_NAME)} on Signal">→ ${esc(TEACHER_NAME)}</button>`):''}
          ${r.stats_excluded?'<span class="bp" title="Kept in history, left out of every statistic">not counted</span>':''}
          ${ME.role==='student'?`<button class="btn btns" onclick="toggleExcluded(${r.id})" title="${r.stats_excluded?'Count this round in the statistics':'Keep this round but leave it out of the statistics'}">${r.stats_excluded?'∅':'⌀'}</button>
          <button class="btn btns" onclick="editRound(${r.id})">✎</button>
          <button class="btn btns btnd" onclick="deleteRound(${r.id})">✕</button>`:''}
        </div>
      </div>
      <div style="font-size:12px;color:var(--mu);display:flex;flex-wrap:wrap;gap:8px">
        <span>${s.n||r.holes||'?'} holes</span>
        ${r.tee?`<span>Tee: ${esc(r.tee)}</span>`:''}
        ${s.delta!==null?`<span style="font-weight:700;color:var(--tx)">${Number(s.delta)>0?'+':''}${s.delta} par${s.n<18?' ('+((dScaled>0?'+':'')+Number(dScaled).toFixed(1))+'/18)':''}</span>`:''}
        ${s.gir!==null?`<span>GIR:${s.gir}</span>`:''}
        ${s.fw!==null?`<span>FW:${s.fw}</span>`:''}
        ${s.ud!==null?`<span>U&amp;D:${s.ud}</span>`:''}
        ${s.p3!==null?`<span class="${s.p3>2?'bad':s.p3>0?'warn':'good'}">3P:${s.p3}</span>`:''}
        ${s.db!==null?`<span class="${s.db>2?'bad':s.db>0?'warn':'good'}">Dbl:${s.db}</span>`:''}
        ${s.pen?`<span class="${s.pen>2?'bad':s.pen>0?'warn':'good'}">Pen:${s.pen}</span>`:''}
      </div>
      ${r.practice&&((r.practice_focus&&r.practice_focus.length)||r.practice_drill)?
        `<div style="font-size:12px;color:var(--gn);margin-top:4px">🎯 ${fociLabels(r.practice_focus).map(esc).join(' · ')}${r.practice_drill?` — <span style="color:var(--mu);font-style:italic">${esc(r.practice_drill)}</span>`:''}</div>`:''}
      ${r.takeaway?`<div style="font-size:12px;color:var(--gn2);margin-top:4px">✓ ${esc(takeawayLabel(r.takeaway))}${r.takeaway_note?` — <span style="color:var(--mu);font-style:italic">${esc(r.takeaway_note)}</span>`:''}</div>`:''}
      ${r.notes?`<div style="font-size:12px;color:var(--mu);margin-top:4px;font-style:italic;white-space:pre-wrap">${esc(r.notes)}</div>`:''}
      ${isOpen?roundDetailHtml(r):''}
    </div>`;
  }
  return h+`</div>`;
}

/* ── forms ───────────────────────────────────────────────────── */
function focusBlockHtml(p){
  return `<div id="${p}_focus" style="display:none;margin:-4px 0 14px">
    <div style="font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Focus — what did you work on?</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
      ${PRACTICE_FOCI.map(f=>`<button type="button" class="fpill" data-f="${f.id}" title="${esc(f.hint)}" onclick="this.classList.toggle('sel')">${f.label}</button>`).join('')}
    </div>
    <input type="text" id="${p}_drill" maxlength="120" placeholder="Specific drill (optional)"></div>`;
}
function toggleFocus(p){ const b=el(p+'_focus'); if(b) b.style.display=(el(p+'_pr')&&el(p+'_pr').checked)?'block':'none'; }
function getFoci(p){ return Array.from(document.querySelectorAll('#'+p+'_focus .fpill.sel')).map(b=>b.dataset.f); }
function setFoci(p,arr){ (arr||[]).forEach(f=>{const b=document.querySelector('#'+p+'_focus .fpill[data-f="'+f+'"]'); if(b) b.classList.add('sel');}); }

function simpleFormHtml(){
  return `<div class="card"><div class="ct">${editId!==null?'Edit round':'Quick add'}</div>
    <div class="g2"><div class="fr"><label>Date</label><input type="date" id="sr_d"></div>
      <div class="fr"><label>Course</label><input type="text" id="sr_c" placeholder="Fontana"></div></div>
    <div class="g2"><div class="fr"><label>Tee</label><input type="text" id="sr_t" placeholder="e.g. Yellow"></div>
      <div class="fr"><label>Holes</label><select id="sr_h"><option value="9">9 holes</option><option value="18" selected>18 holes</option></select></div></div>
    <div class="fr" style="display:flex;align-items:center;gap:18px;margin:6px 0 14px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="sr_co" style="width:18px;height:18px;accent-color:var(--ac)">Competitive</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="sr_pr" onchange="toggleFocus('sr')" style="width:18px;height:18px;accent-color:var(--gn)">On-course practice</label>
    </div>
    ${focusBlockHtml('sr')}
    <div class="fr"><label>Notes</label><textarea id="sr_n" rows="2"></textarea></div>
    ${takeawayHtml('sr','','','')}
    ${ticksHtml(null)}
    <div class="rbtns"><button class="btn btnp" onclick="saveSimpleRound()">Save</button>
      <button class="btn" onclick="cancelRound()">Cancel</button></div></div>`;
}

function holeBoxHtml(i){
  return `<div class="hole-box"><div class="hole-hdr">Hole ${i+1}</div>
    <div class="hole-r1">
      <div class="hole-nf"><span class="hole-lbl">Par</span><input type="number" id="hp_${i}" min="3" max="5" placeholder="4" class="hole-num"></div>
      <div class="hole-nf"><span class="hole-lbl">Score</span><input type="number" id="hs_${i}" min="1" max="15" placeholder="—" class="hole-num"></div>
    </div>
    <div class="hole-r2">
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">Drive s/x</span><input type="text" id="hdrive_${i}" maxlength="1" placeholder="—" class="hole-num" style="text-align:center" title="blank = fine · s advantage lost · x green gone"></div>
      <label class="hole-toggle"><input type="checkbox" id="hgir_${i}"> GIR</label>
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">App m/x</span><input type="text" id="happ_${i}" maxlength="1" placeholder="—" class="hole-num" style="text-align:center" title="blank = fine · m missed the quadrant, 7i or shorter only · x dead, any club"></div>
    </div>
    <div class="hole-r3">
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">Short c</span><input type="text" id="hshort_${i}" maxlength="1" placeholder="—" class="hole-num" style="text-align:center" title="blank = fine (saves are derived) · c choked a makeable save"></div>
      <div class="hole-nf"><span class="hole-lbl">Putts</span><input type="number" id="hputts_${i}" min="0" max="9" placeholder="—" class="hole-num"></div>
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">Trbl</span><input type="text" id="htrbl_${i}" maxlength="2" placeholder="—" class="hole-num" style="text-transform:uppercase;text-align:center" title="W water · O OB · U unplayable · FB/GB bunker"></div>
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">MP</span><input type="text" id="hmp_${i}" maxlength="1" placeholder="—" class="hole-num" style="text-align:center" title="Matchplay only: + won the hole · - lost it · . halved. Leave the SCORE blank on a conceded hole rather than guessing."></div>
      <div class="hole-nf" style="flex:1"><span class="hole-lbl">Not cmtd</span><input type="number" min="0" max="9" id="hcmt_${i}" placeholder="—" class="hole-num" style="text-align:center" title="How many shots on this hole you were NOT fully committed to — the dots off the paper card. Blank = all committed."></div>
    </div></div>`;
}

function cardFormHtml(){
  return `<div class="card"><div class="ct">${editId!==null?'Edit round':'New round — check &amp; save'}</div>
    <div class="g2"><div class="fr"><label>Date</label><input type="date" id="rf_d"></div>
      <div class="fr"><label>Course</label><input type="text" id="rf_c" placeholder="Fontana"></div></div>
    <div class="fr" style="display:flex;align-items:center;gap:18px;margin:6px 0 14px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="rf_co" style="width:18px;height:18px;accent-color:var(--ac)">Competitive</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="rf_pr" onchange="toggleFocus('rf')" style="width:18px;height:18px;accent-color:var(--gn)">On-course practice</label>
    </div>
    ${focusBlockHtml('rf')}
    <div class="dl">Holes</div>
    <div>${Array.from({length:18},(_,i)=>holeBoxHtml(i)).join('')}</div>
    <div class="dl">Notes</div>
    <div class="fr"><textarea id="rf_n" placeholder="What didn't work?"></textarea></div>
    ${takeawayHtml('rf','','','')}
    ${ticksHtml(null)}
    <div class="rbtns"><button class="btn btnp" onclick="saveCardRound()">Save</button>
      <button class="btn" onclick="cancelRound()">Cancel</button></div></div>`;
}

function editRound(id){ editId=id; const r=ROUNDS.find(x=>x.id===id); roundMode = (r&&r.is_simple)?'simple':'manual'; renderRounds(); }

function fillFormFromRound(){
  const r = ROUNDS.find(x=>x.id===editId);
  if (!r) return;
  if (r.is_simple){
    if(el('sr_d')) el('sr_d').value=r.date||'';
    if(el('sr_c')) el('sr_c').value=r.course||'';
    if(el('sr_t')) el('sr_t').value=r.tee||'';
    if(el('sr_h')) el('sr_h').value=String(r.holes||18);
    if(el('sr_co'))el('sr_co').checked=!!r.comp;
    if(el('sr_pr'))el('sr_pr').checked=!!r.practice;
    toggleFocus('sr'); setFoci('sr', r.practice_focus);
    if(el('sr_drill'))el('sr_drill').value=r.practice_drill||'';
    if(el('sr_n')) el('sr_n').value=r.notes||'';
    if(el('sr_tks')) el('sr_tks').value=r.takeaway_shot||'';
    ['shape','pattern','club'].forEach((id,ix)=>{ const v=[r.shape_control,r.miss_pattern,r.club_selection][ix];
      if(v!=null) pickTick(id, v?1:0); });
    if(el('sr_tk')){ el('sr_tk').value=r.takeaway||''; el('sr_tkn').value=r.takeaway_note||'';
      document.querySelectorAll('#pg-rounds .fpill[data-tk]').forEach(b=>b.classList.toggle('sel', b.dataset.tk===r.takeaway)); }
  } else {
    if(el('rf_d')) el('rf_d').value=r.date||'';
    if(el('rf_c')) el('rf_c').value=r.course||'';
    if(el('rf_n')) el('rf_n').value=r.notes||'';
    if(el('rf_tks')) el('rf_tks').value=r.takeaway_shot||'';
    ['shape','pattern','club'].forEach((id,ix)=>{ const v=[r.shape_control,r.miss_pattern,r.club_selection][ix];
      if(v!=null) pickTick(id, v?1:0); });
    if(el('rf_tk')){ el('rf_tk').value=r.takeaway||''; el('rf_tkn').value=r.takeaway_note||'';
      document.querySelectorAll('#pg-rounds .fpill[data-tk]').forEach(b=>b.classList.toggle('sel', b.dataset.tk===r.takeaway)); }
    if(el('rf_co'))el('rf_co').checked=!!r.comp;
    if(el('rf_pr'))el('rf_pr').checked=!!r.practice;
    toggleFocus('rf'); setFoci('rf', r.practice_focus);
    if(el('rf_drill'))el('rf_drill').value=r.practice_drill||'';
    (r.holes_data||[]).forEach((hd,i)=>{
      if(el('hp_'+i))    el('hp_'+i).value    = hd.par!=null?hd.par:'';
      if(el('hs_'+i))    el('hs_'+i).value    = hd.score!=null?hd.score:'';
      if(el('hdrive_'+i))el('hdrive_'+i).value= hd.drive||'';
      if(el('hgir_'+i))  el('hgir_'+i).checked= !!hd.gir;
      if(el('happ_'+i))  el('happ_'+i).value  = hd.app||'';
      if(el('hshort_'+i))el('hshort_'+i).value= hd.short||'';
      if(el('hputts_'+i))el('hputts_'+i).value= hd.putts!=null?hd.putts:'';
      if(el('htrbl_'+i)) el('htrbl_'+i).value = hd.trbl||'';
    });
  }
}

/* ── The one thing that worked ───────────────────────────────────
   Agreed with Astrid 4 Aug. The fault-only card is excellent
   diagnostics and a punishing RITUAL: eighteen holes of writing down
   only your own misses, performed in the one domain where her memory
   notes her worth is conditional. Nothing anywhere in the app has ever
   asked what went well.

   Her design, and better than the one I proposed: a PATTERN ("great
   putting"), not a single shot. A pattern attributes to skill; one shot
   attributes to luck, and competence beliefs are built from the former.

   Same six areas as the fault card, so it is one axis signed both ways
   — Wes can now see where she says it went well against where the card
   says it didn't, and the disagreement is itself coaching material.

   MANDATORY, INCLUDING BAD ROUNDS. Especially those. Optional here
   means skipped on exactly the days it matters, and the record quietly
   becomes a highlights reel of good rounds, which tells nobody
   anything. On a genuinely awful day "short game stopped it being
   worse" is both true and useful.
   ──────────────────────────────────────────────────────────────── */
const TAKEAWAYS = [
  {id:'drive',  label:'Driving'},
  {id:'app',    label:'Approach play'},
  {id:'short',  label:'Short game'},
  {id:'putt',   label:'Putting'},
  {id:'course', label:'Course management'},
  {id:'mental', label:'Head / attitude'},
];
const takeawayLabel = id => (TAKEAWAYS.find(t=>t.id===id)||{}).label || id;

function takeawayHtml(p, sel, note, shot, ticks){
  return `<div class="dl">The one thing that worked</div>
    <p class="empty" style="padding:0 0 8px;font-size:12px">Required — most of all after a bad one. What held up, not the best single shot.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px">
      ${TAKEAWAYS.map(t=>`<button type="button" class="fpill ${sel===t.id?'sel':''}" data-tk="${t.id}"
        onclick="pickTakeaway('${p}','${t.id}')">${t.label}</button>`).join('')}
    </div>
    <input type="hidden" id="${p}_tk" value="${esc(sel||'')}">
    <div class="fr"><textarea id="${p}_tkn" rows="2" placeholder="In your own words (optional)">${esc(note||'')}</textarea></div>
    <div class="fr"><label>And the one shot</label>
      <input type="text" id="${p}_tks" maxlength="160" placeholder="The shot you'd play again" value="${esc(shot||'')}"></div>`;
}
function pickTakeaway(p, id){
  el(p+'_tk').value = id;
  document.querySelectorAll('#pg-rounds .fpill[data-tk]').forEach(b=>b.classList.toggle('sel', b.dataset.tk===id));
}
// Returns null when nothing is picked, so the caller can refuse to save.
function takeawayRow(p){
  const v = gv(p+'_tk'), shot = (gv(p+'_tks')||'').trim();
  // BOTH are required, her call 5 Aug. The pattern is where the coaching value
  // is; the shot is the one she will actually remember. Neither substitutes.
  if (!v || !shot) return null;
  const tick = id => { const el0 = document.querySelector('#pg-rounds .ynpill.sel[data-t="'+id+'"]');
                       return el0 ? el0.dataset.v === '1' : null; };
  return {takeaway: v, takeaway_note: gv(p+'_tkn') || null, takeaway_shot: shot,
          shape_control: tick('shape'), miss_pattern: tick('pattern'), club_selection: tick('club')};
}

/* Wes's three, 5 Aug — and the only three that survived Astrid's filter: they
   cannot be DEDUCED from the card, because she can score well with all three
   off. Anything the scorecard or the notes already imply did not get a field.

   YES AND NO, not one checkbox. Unanswered and "it was off" are different
   facts, and a single tick collapses them — the paper card has ✓/✗ boxes for
   the same reason.

   The middle one is valenced the other way round: spotting a pattern in your
   misses is good awareness of a bad thing. Hence "spotted", never anything
   evaluative, and the three are never summed. */
const TICKS = [
  {id:'shape',   label:'Shot shape under control?'},
  {id:'pattern', label:'Pattern in the misses spotted?'},
  {id:'club',    label:'Right clubs selected?'},
];
function ticksHtml(vals){
  const yn = (id,v,on) => `<button type="button" class="ynpill ${on?'sel':''}" data-t="${id}" data-v="${v}"
      onclick="pickTick('${id}',${v})" style="${on?(v?'background:var(--gn);border-color:var(--gn);color:#0d1117':'background:var(--rd);border-color:var(--rd);color:#0d1117'):''}">${v?'✓':'✗'}</button>`;
  return `<div class="dl">Three for ${esc(TEACHER_NAME)}</div>
    ${TICKS.map(t=>{ const cur = vals ? vals[t.id] : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--b1)">
        <span style="font-size:13px">${t.label}</span>
        <span style="display:flex;gap:6px;flex-shrink:0">${yn(t.id,1,cur===true)}${yn(t.id,0,cur===false)}</span>
      </div>`;}).join('')}`;
}
function pickTick(id, v){
  document.querySelectorAll('#pg-rounds .ynpill[data-t="'+id+'"]').forEach(b=>{
    const on = Number(b.dataset.v) === v;
    b.classList.toggle('sel', on);
    b.setAttribute('style', on ? (v ? 'background:var(--gn);border-color:var(--gn);color:#0d1117'
                                    : 'background:var(--rd);border-color:var(--rd);color:#0d1117') : '');
  });
}

async function saveRoundRow(row){
  if (editId !== null) await upd('golf_rounds','id=eq.'+editId, row);
  else                 await ins('golf_rounds', row);
  editId=null; roundMode='select';
  toast('Round saved');
  renderRounds();
}
async function saveSimpleRound(){
  const d=gv('sr_d');
  if(!d){ toast('Pick a date'); return; }
  const tk=takeawayRow('sr');
  if(!tk){ toast('Both the theme and the one shot are needed'); return; }
  await saveRoundRow({ ...tk,
    date:d, course:gv('sr_c')||null, tee:gv('sr_t')||null, holes:Number(gv('sr_h'))||18,
    comp:el('sr_co').checked, practice:el('sr_pr').checked,
    practice_focus:getFoci('sr'), practice_drill:(el('sr_drill')?el('sr_drill').value.trim():'')||null,
    notes:gv('sr_n')||null, holes_data:null, is_simple:true,
  });
}
async function saveCardRound(){
  const d=gv('rf_d');
  if(!d){ toast('Pick a date'); return; }
  const holes_data=Array.from({length:18},(_,i)=>({
    par:   el('hp_'+i)?el('hp_'+i).value:'',
    score: el('hs_'+i)?el('hs_'+i).value:'',
    drive: el('hdrive_'+i)?el('hdrive_'+i).value.trim().toLowerCase():'',
    gir:   el('hgir_'+i)?el('hgir_'+i).checked:false,
    app:   el('happ_'+i)?el('happ_'+i).value.trim().toLowerCase():'',
    short: el('hshort_'+i)?el('hshort_'+i).value.trim().toLowerCase():'',
    putts: el('hputts_'+i)&&el('hputts_'+i).value!=='' ? Number(el('hputts_'+i).value) : null,
    trbl:  el('htrbl_'+i)?el('htrbl_'+i).value.trim().toUpperCase():'',
    cmt:   el('hcmt_'+i)&&el('hcmt_'+i).value!=='' ? Number(el('hcmt_'+i).value) : null,
    // she writes a DOT for a halved hole - less to write than ½ and impossible
    // to confuse with anything else on a card. Accept the variants, store one.
    mp:    el('hmp_'+i)? el('hmp_'+i).value.trim().replace(/^[.½0]$/,'=') : '',
  }));
  const tk=takeawayRow('rf');
  if(!tk){ toast('Both the theme and the one shot are needed'); return; }
  const bad = holes_data.filter(h => h.score!=='' && (h.par===''||h.par==null));
  if (bad.length && !confirm(bad.length+' hole(s) have a score but no par — those won\'t be counted. Save anyway?')) return;
  await saveRoundRow({ ...tk,
    date:d, course:gv('rf_c')||null, comp:el('rf_co').checked, practice:el('rf_pr').checked,
    practice_focus:getFoci('rf'), practice_drill:(el('rf_drill')?el('rf_drill').value.trim():'')||null,
    notes:gv('rf_n')||null, holes_data, is_simple:false, holes:18,
  });
}
async function toggleExcluded(id){
  const r = ROUNDS.find(x=>x.id===id); if(!r) return;
  const now = !r.stats_excluded;
  if (now && !confirm('Keep this round in the history but leave it out of every statistic?')) return;
  await upd('golf_rounds','id=eq.'+id,{stats_excluded:now});
  r.stats_excluded = now;
  toast(now?'Left out of the stats':'Counting again');
  renderRounds();
}

async function deleteRound(id){
  if(!confirm('Delete this round?')) return;
  await del('golf_rounds','id=eq.'+id);
  toast('Deleted'); renderRounds();
}

/* ── scorecard photo scan (unchanged flow; key lives in this
      browser's localStorage only, never in the repo) ─────────── */
function startScan(){ roundMode='scan'; scanFiles=[null,null]; scanPreviews=[null,null]; renderRounds(); }

function scanHtml(){
  const key = localStorage.getItem('anthropic_key')||'';
  const slot=(i,label)=>{
    const has=!!scanFiles[i];
    return `<div><div style="font-size:11px;font-weight:600;text-align:center;margin-bottom:4px">${label}</div>
      ${has?`<img src="${scanPreviews[i]}" style="width:100%;height:100px;border-radius:6px;border:1px solid var(--b1);object-fit:cover;display:block">
             <div style="font-size:10px;color:var(--mu);text-align:center;margin-bottom:4px">${scanFiles[i].kb}KB</div>`
           :`<div style="height:100px;border:1.5px dashed var(--b1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:4px" onclick="el('sf${i}').click()">📷</div>`}
      <input type="file" id="sf${i}" accept="image/*" style="display:none" onchange="onScanFile(this,${i})">
      <button class="btn btns" style="width:100%" onclick="el('sf${i}').click()">${has?'Change':'Choose photo'}</button></div>`;
  };
  return `<div class="card"><div class="ct">Scorecard photos</div>
    <p class="empty" style="padding:0 0 10px">Front and/or back — one side is enough.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">${slot(0,'Holes 1–9')}${slot(1,'Holes 10–18')}</div>
    ${key?'':`<div class="fr"><label>Anthropic API key (stored on this device only)</label>
      <input type="text" id="ank" placeholder="sk-ant-…"><button class="btn btns" style="margin-top:6px" onclick="saveAnthKey()">Save key</button></div>`}
    <div id="scan-status" style="font-size:12px;min-height:18px;margin-bottom:8px"></div>
    <div class="rbtns">
      ${(scanFiles[0]||scanFiles[1])&&key?`<button class="btn btnp" onclick="runScan()">🔍 Analyse</button>`:''}
      <button class="btn" onclick="cancelRound()">Cancel</button></div></div>`;
}
function saveAnthKey(){ const k=gv('ank'); if(k){ localStorage.setItem('anthropic_key',k); renderRounds(); } }

function resizeForApi(dataUrl,cb){
  const img=new Image();
  img.onload=()=>{
    const MAX=1400; let w=img.width,h=img.height;
    const s=Math.min(1,MAX/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    let q=0.82,out=c.toDataURL('image/jpeg',q);
    while(out.length>4700000&&q>0.3){ q-=0.15; out=c.toDataURL('image/jpeg',q); }
    cb(out, Math.round(out.length*0.75/1024));
  };
  img.src=dataUrl;
}
function onScanFile(input,i){
  const f=input.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=e=>resizeForApi(e.target.result,(resized,kb)=>{
    scanFiles[i]={base64:resized.split(',')[1],mimeType:'image/jpeg',kb};
    scanPreviews[i]=resized; renderRounds();
  });
  rd.readAsDataURL(f);
}
async function runScan(){
  const key=localStorage.getItem('anthropic_key')||'';
  const st=el('scan-status');
  if(st) st.innerHTML='<span class="mu"><span class="spin"></span> Claude is reading the card…</span>';
  try{
    const data=await analyzeScorecard(scanFiles.filter(Boolean),key);
    scanFiles=[null,null]; scanPreviews=[null,null];
    roundMode='manual'; renderRounds();
    setTimeout(()=>fillFromScan(data),80);
  }catch(err){ if(st) st.innerHTML=`<span class="bad">✗ ${esc(err.message)}</span>`; }
}
async function analyzeScorecard(images,apiKey){
  const content=[];
  images.forEach((img,i)=>{
    if(images.length>1) content.push({type:'text',text:i===0?'Front 9 (holes 1–9):':'Back 9 (holes 10–18):'});
    content.push({type:'image',source:{type:'base64',media_type:img.mimeType,data:img.base64}});
  });
  content.push({type:'text',text:`This is a handwritten golf scorecard. Extract all data carefully.

This card is FAULT-ONLY: blank fault cells mean "fine, no fault" (that is normal and expected on most holes) — a blank is NOT missing data as long as the hole has a score.

For each hole return:
- hole: number 1-18
- par: 3, 4 or 5 (null if unreadable)
- score: strokes played (integer, null if blank)
- drive: Drive cell — "s", "x", or "" if blank (blank = good drive; par 3s always blank). A stray tick also means "".
- gir: true if the GIR cell is ticked, else false
- app: App cell — "m", "x", or "" if blank. A stray tick also means "". Cards written before
  5 Aug 2026 may also carry "w"; if you see one, return "w" exactly as written — do not
  translate it, the app folds it in itself.
- short: Short cell — "c", or "" if blank (saves are derived from score). A stray tick or dash also means "".
- putts: number of putts written (integer, null if blank)
- trbl: Trbl cell letters exactly (W, O, U, FB or GB), or "" if blank

Also extract: date ("YYYY-MM-DD" or null), course (or null), comp (true/false), practice (true/false), notes (or null).

Return ONLY valid JSON, no markdown:
{"date":null,"course":null,"comp":false,"practice":false,"notes":null,"holes":[{"hole":1,"par":4,"score":5,"drive":"","gir":false,"app":"m","short":"","putts":2,"trbl":""}]}`});

  const resp=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json',
             'anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:2048,messages:[{role:'user',content}]}),
  });
  if(!resp.ok){ const e=await resp.json().catch(()=>({})); throw new Error((e.error&&e.error.message)||('HTTP '+resp.status)); }
  const data=await resp.json();
  let raw=data.content[0].text.trim();
  if(raw.startsWith('```')) raw=raw.split('\n').slice(1,-1).join('\n');
  return JSON.parse(raw);
}
function fillFromScan(d){
  if(d.date&&el('rf_d'))   el('rf_d').value=d.date;
  if(d.course&&el('rf_c')) el('rf_c').value=d.course;
  if(d.notes&&el('rf_n'))  el('rf_n').value=d.notes;
  if(el('rf_co')) el('rf_co').checked=!!d.comp;
  if(el('rf_pr')) el('rf_pr').checked=!!d.practice;
  toggleFocus('rf');
  (d.holes||[]).forEach(h=>{
    const i=h.hole!=null?Number(h.hole)-1:null;
    if(i==null||i<0||i>17) return;
    if(el('hp_'+i))    el('hp_'+i).value    = h.par!=null?h.par:'';
    if(el('hs_'+i))    el('hs_'+i).value    = h.score!=null?h.score:'';
    if(el('hdrive_'+i))el('hdrive_'+i).value= h.drive||'';
    if(el('hgir_'+i))  el('hgir_'+i).checked= !!h.gir;
    if(el('happ_'+i))  el('happ_'+i).value  = h.app||'';
    if(el('hshort_'+i))el('hshort_'+i).value= h.short||'';
    if(el('hputts_'+i))el('hputts_'+i).value= h.putts!=null?h.putts:'';
    if(el('htrbl_'+i)) el('htrbl_'+i).value = h.trbl||'';
  });
}

/* ═══════════════════════════════════════════════════════════════
   5 · TOURNAMENTS — manual v1, month-grouped, past and future.
   Type drives the score format ("89" vs "3&2"); future events show
   a countdown instead of a score.
   ═══════════════════════════════════════════════════════════════ */
let TOURN = [];

let CHECKINS = [];
const checkIn = (tid, phase) => CHECKINS.find(c => c.tournament_id === tid && c.phase === phase);

/* ── Tournaments she could enter ─────────────────────────────────
   Pulled daily from golf.at by tournament_finder.py on James, filtered
   to within 75km of 1130, handicap-relevant and open to guests. Her
   ask: "here are the possible tournaments, pick one" — searching
   golf.at herself is the annoying part, not entering.

   WEEKDAY IS THE DEFAULT TAB, not weekend, because weekday events are
   the ones she actually wants. Weekend ones are kept rather than
   filtered away, on their own tab, so the decision stays hers.

   18-hole reads bold and full-strength, 9-hole deliberately quieter —
   her words, "18 is obviously much better". The list should say that
   before it is read.
   ──────────────────────────────────────────────────────────────── */
let FINDS = [], findsTab = 'week';
let TROUNDS = [];   // rounds, for deriving tournament results
function setFindsTab(t){ findsTab = t; renderTournaments(); }

async function dismissFind(id){
  await upd('tournament_finds', 'id=eq.'+id, {dismissed:true});
  FINDS = FINDS.filter(f => f.id !== id);
  renderTournaments();
}

function findsHtml(){
  if (!FINDS.length) return '';
  const wk  = FINDS.filter(f => !f.is_weekend);
  const we  = FINDS.filter(f =>  f.is_weekend);
  const list = findsTab === 'week' ? wk : we;
  const tab = (id, label, n) => `<button class="btn btns ${findsTab===id?'btnp':''}"
      onclick="setFindsTab('${id}')">${label}${n?' · '+n:''}</button>`;

  return `<div class="card">
    <div class="ct"><span>Could enter</span>
      <span style="font-size:10px;color:var(--mu)">within 75km · hcp-relevant · open to guests</span></div>
    <div class="rbtns" style="margin:0 0 10px">${tab('week','Weekdays',wk.length)}${tab('wend','Weekends',we.length)}</div>
    ${!list.length ? `<div class="empty">Nothing on this tab.</div>` : list.map(f => {
      const big = f.holes === 18;
      return `<div style="display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--b1)">
        <span style="font-size:11px;color:var(--mu);min-width:52px;white-space:nowrap">${fmtDay(parseYmd(f.date))}</span>
        <div style="flex:1;min-width:0">
          <a href="${esc(f.url||'#')}" target="_blank" rel="noopener"
             style="font-size:${big?'14':'12.5'}px;font-weight:${big?'700':'500'};
                    color:${big?'var(--tx)':'var(--mu)'};text-decoration:none">${esc(f.name)}</a>
          <div style="font-size:11px;color:var(--mu);margin-top:2px">
            <span style="color:${big?'var(--ac)':'var(--mu)'};font-weight:${big?'700':'400'}">${f.holes} holes</span>
            ${f.club?' · '+esc(f.club):''}${f.distance_km!=null?' · '+f.distance_km+'km':' · distance unknown'}
          </div>
        </div>
        ${ME.role==='student'?`<button class="btn btns" title="Not interested"
           onclick="dismissFind(${f.id})">✕</button>`:''}
      </div>`;
    }).join('')}
    <div class="empty" style="font-size:11px;padding:9px 0 0">Tapping one opens its golf.at entry page. Dismissing only hides it here.</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   8 · OPEN TOURNAMENTS — what she could enter

   Pulled daily from golf.at by tournament_finder.py on James: within
   75km of 1130, handicap-relevant, open to guests, cancelled ones
   already dropped. Her ask was never entry — it was that SEARCHING
   golf.at is annoying.

   FOUR INDEPENDENT TOGGLES rather than tabs, because the useful
   questions cross each other: "18-hole weekdays" is the one she
   actually wants, and a tab layout cannot express it. All four on =
   everything. Choices persist, so the filter she lives in survives a
   reload.

   CAPPED AT 8 WEEKS, her call. The table holds the whole season; a
   phone does not want 181 rows, and anything further out is not a
   decision she is making today.
   ═══════════════════════════════════════════════════════════════ */
const OPEN_WEEKS = 8;
let OPENS = [];
let openF = (() => {
  try { return JSON.parse(localStorage.getItem('gc_openf')) || null; } catch(e){ return null; }
})() || {week:true, wend:true, h9:true, h18:true, dist:75};

function toggleOpenF(k){
  openF[k] = !openF[k];
  localStorage.setItem('gc_openf', JSON.stringify(openF));
  renderOpen();
}

// Distance is a single CHOICE, not three toggles: 20km is inside 50km is inside
// 75km, so independent switches would let her pick combinations that cannot mean
// anything. One wins, the others clear.
function setOpenDist(km){
  openF.dist = km;
  localStorage.setItem('gc_openf', JSON.stringify(openF));
  renderOpen();
}

async function renderOpen(){
  const until = ymd(addDays(parseYmd(todayYmd()), OPEN_WEEKS*7));
  OPENS = await selSoft('tournament_finds',
    `select=*&dismissed=is.false&date=gte.${todayYmd()}&date=lte.${until}&order=date.asc`) || [];

  // "rank" is a NARROWING switch, not another category: when it is on, nothing
  // but ranking events shows. They are what the 2-year goal points at, so being
  // able to see only those is worth one dedicated toggle.
  // Ranking events ignore distance entirely, here as in the finder — worth
  // travelling for. An unknown distance is kept too, same reasoning as the
  // pull: a missing tournament is worse than an over-inclusive list.
  const inRange = f => f.is_ranking || f.distance_km == null
                       || Number(f.distance_km) <= (openF.dist || 75);
  const shown = OPENS.filter(f =>
    (!openF.rank || f.is_ranking) &&
    inRange(f) &&
    ((f.is_weekend ? openF.wend : openF.week)) &&
    ((Number(f.holes) === 9 ? openF.h9 : openF.h18)));

  const tgl = (k, label, n) =>
    `<button class="tgl ${openF[k]?'on':''}" onclick="toggleOpenF('${k}')">${label}<span
       style="opacity:.65;font-weight:400"> ${n}</span></button>`;

  let h = `<div class="card">
    <div style="display:flex;flex-wrap:wrap;gap:7px">
      ${tgl('week','Weekdays', OPENS.filter(f=>!f.is_weekend).length)}
      ${tgl('wend','Weekends', OPENS.filter(f=> f.is_weekend).length)}
      ${tgl('h18','18 holes',  OPENS.filter(f=>Number(f.holes)===18).length)}
      ${tgl('h9','9 holes',    OPENS.filter(f=>Number(f.holes)===9).length)}
      ${OPENS.some(f=>f.is_ranking)?tgl('rank','ÖGV ranking only', OPENS.filter(f=>f.is_ranking).length):''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px">
      ${[20,50,75].map(km=>`<button class="tgl ${(openF.dist||75)===km?'on':''}"
          onclick="setOpenDist(${km})">${km}km<span style="opacity:.65;font-weight:400"> ${
          OPENS.filter(f=>!f.is_ranking && f.distance_km!=null && Number(f.distance_km)<=km).length
        }</span></button>`).join('')}
    </div>
    <div class="empty" style="font-size:11px;padding:9px 0 0">
      ${shown.length} of ${OPENS.length} · next ${OPEN_WEEKS} weeks · within ${openF.dist||75}km · handicap-relevant · open to guests · no seniors, juniors or men-only
    </div></div>`;

  if (!OPENS.length){
    h += `<div class="card"><div class="empty">Nothing pulled yet. The list refreshes daily.</div></div>`;
    el('pg-open').innerHTML = h; return;
  }
  if (!shown.length){
    h += `<div class="card"><div class="empty">Nothing matches those toggles.</div></div>`;
    el('pg-open').innerHTML = h; return;
  }

  // Grouped by day so a week reads as a week, not as 90 identical lines.
  let cur = null, open = false;
  for (const f of shown){
    if (f.date !== cur){
      if (open) h += `</div>`;
      const d = parseYmd(f.date);
      const away = Math.round((d - parseYmd(todayYmd()))/86400000);
      h += `<div class="card"><div class="ct"><span>${DAY_LONG?DAY_LONG[(d.getDay()+6)%7]+' · ':''}${fmtDay(d)}</span>
        <span style="font-size:10px;color:var(--mu)">${away===0?'today':away===1?'tomorrow':'in '+away+' days'}</span></div>`;
      cur = f.date; open = true;
    }
    // 18 bold and full strength, 9 deliberately quieter - "18 is obviously
    // much better", so the list should say so before it is read.
    const big = Number(f.holes) === 18;
    h += `<div style="display:flex;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--b1)">
      <span style="font-size:11px;font-weight:700;min-width:26px;color:${big?'var(--ac)':'var(--mu)'}">${f.holes}h</span>
      <div style="flex:1;min-width:0">
        <a href="${esc(f.url||'#')}" target="_blank" rel="noopener"
           style="font-size:${big?'14':'12.5'}px;font-weight:${big?'700':'500'};
                  color:${big?'var(--tx)':'var(--mu)'};text-decoration:none">${esc(f.name)}</a>
        ${f.is_ranking?'<span class="bi" style="margin-left:6px">ÖGV ranking</span>':''}
        <div style="font-size:11px;color:var(--mu);margin-top:2px">
          ${f.club?esc(f.club):''}${f.distance_km!=null?' · '+f.distance_km+'km':' · distance unknown'}</div>
      </div>
      ${ME.role==='student'?`<button class="btn btns" title="Not interested" onclick="dismissOpen(${f.id})">✕</button>`:''}
    </div>`;
  }
  if (open) h += `</div>`;
  el('pg-open').innerHTML = h;
}

async function dismissOpen(id){
  await upd('tournament_finds', 'id=eq.'+id, {dismissed:true});
  renderOpen();
}

async function renderTournaments(){
  [TOURN, CHECKINS, FINDS, TROUNDS] = await Promise.all([
    sel('tournaments','select=*&order=date.desc'),
    selSoft('check_ins','select=*'),      // absent until migration 03 is run
    // absent until migration 12 + the daily pull; fails soft to an empty list
    selSoft('tournament_finds',
      `select=*&dismissed=is.false&date=gte.${todayYmd()}&order=date.asc`),
    // her rounds, so a tournament can show what she actually shot rather than
    // asking her to type the score a second time
    selSoft('golf_rounds','select=date,course,comp,matchplay,holes_data,stats_excluded&order=date.asc'),
  ]);
  TOURN = TOURN || []; CHECKINS = CHECKINS || []; FINDS = FINDS || []; TROUNDS = TROUNDS || [];
  const today = todayYmd();
  let h = ME.role==='student'
    ? `<div class="rbtns" style="margin:0 0 12px"><button class="btn btnp" onclick="editTournament(null)">＋ Add tournament</button></div>` : '';

  const future = TOURN.filter(t => t.date >= today).sort((a,b)=>a.date.localeCompare(b.date));
  const past   = TOURN.filter(t => t.date <  today);

  if (future.length){
    h += `<div class="card"><div class="ct">Coming up</div>`;
    for (const t of future) h += tournamentRow(t, true);
    h += `</div>`;
  }
  let curMonth = null, open = false;
  for (const t of past){
    const d = parseYmd(t.date);
    const mk = d.getFullYear()+'-'+d.getMonth();
    if (mk !== curMonth){
      if (open) h += `</div>`;
      h += `<div class="card"><div class="ct">${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`;
      curMonth = mk; open = true;
    }
    h += tournamentRow(t, false);
  }
  if (open) h += `</div>`;
  if (!TOURN.length) h += `<div class="card"><div class="empty">No tournaments yet.</div></div>`;
  el('pg-tournaments').innerHTML = h;
}

/* ── What she actually shot ──────────────────────────────────────
   The row showed a `score` she had to type by hand and never did, so
   results were invisible on the page whose whole job is results. She has
   already entered the round; asking for the number twice is how the
   second copy ends up empty and wrong. So it is DERIVED from the card.

   THREE CASES, and they are not the same kind of thing — her point:

     MATCH      a clean result. 3&2 is exact and means nothing scaled;
                there is no per-18 version of winning on the 16th. Shown
                as typed, with won/lost, and never derived from a card.
     FULL 18    the number she shot. Shown as-is.
     UNDER 18   stroke play only, pro-rated to 18 — nine holes simply
                doubled. Marked as scaled, because a figure stretched
                from a partial card should say so rather than sit next
                to a real one pretending to be the same thing.
   ──────────────────────────────────────────────────────────────── */
/* ── The match, derived ──────────────────────────────────────────
   She already writes + - ½ on a separate scorecard during a match, so
   moving it onto the card costs nothing and retires the second sheet.

   Three things fall out of it, and only the third was the one she was
   drawn to:

     1. THE RESULT COMES FREE. Walk the holes, carry the lead; the match
        ends the moment the lead exceeds the holes remaining, which is
        exactly what "3&2" means — three up with two to play. No typing
        a result any more.

     2. NO MORE GUESSED SCORES, which is the real prize. Her convention
        was to invent a score for a hole conceded to her, and to write a
        triple for one she conceded. Both put fiction into the one
        dataset that is currently clean — and the triple lands precisely
        on her worst holes. With the match in its own column the score
        can simply be left blank: the margin carries the match, the card
        carries the golf, and neither has to lie for the other.

     3. Whether she wins holes with birdies or bogeys. Interesting, and
        unreadable for years — five matches a season is not a sample.
        A bonus, never the justification.
   ──────────────────────────────────────────────────────────────── */
function matchResult(holes){
  // a halved hole may arrive as . ½ 0 or = depending on when it was written
  const marks = (holes||[]).map(h => String(h.mp||'').trim().replace(/^[.½0]$/,'='));
  if (!marks.some(m => m === '+' || m === '-' || m === '=')) return null;
  let lead = 0;
  for (let i = 0; i < marks.length; i++){
    const m = marks[i];
    if (m === '+') lead++; else if (m === '-') lead--;
    const left = marks.length - 1 - i;
    // dormie is |lead| === left and the match continues; it ends when it exceeds.
    // A match decided ON the 18th is "1up", never "1&0" - nobody says 1&0.
    if (Math.abs(lead) > left)
      return {won: lead > 0, holes: i + 1,
              text: left === 0 ? `${Math.abs(lead)}up` : `${Math.abs(lead)}&${left}`};
  }
  if (lead === 0) return {won: null, text: 'halved', holes: marks.length};
  return {won: lead > 0, text: `${Math.abs(lead)}up`, holes: marks.length};
}

function tournamentResult(t){
  const r = (TROUNDS||[]).find(x => x.date === t.date && !x.stats_excluded);
  // a match derived from the + - = column beats one typed by hand
  if (t.type === 'match' || (r && r.matchplay)){
    const m = r ? matchResult(r.holes_data) : null;
    if (m) return {kind:'match', text: m.text, won: m.won, derived: true};
    return {kind:'match', text: t.score, won: t.won};
  }
  if (!r) return nn(t.score) ? {kind:'typed', text: t.score} : null;

  const p = (r.holes_data||[]).filter(h => String(h.par??'')!=='' && String(h.score??'')!=='');
  if (!p.length) return nn(t.score) ? {kind:'typed', text: t.score} : null;

  const k = 18 / p.length;                       // 9 holes -> x2
  const full = p.length === 18;
  return {
    kind: full ? 'full' : 'prorated',
    holes: p.length,
    gross: Math.round(p.reduce((a,h)=>a+Number(h.score),0) * k),
    delta: p.reduce((a,h)=>a+(Number(h.score)-Number(h.par)),0) * k,
  };
}

function tournamentResultHtml(t){
  const R = tournamentResult(t);
  if (!R) return '';
  if (R.kind === 'match'){
    if (!nn(R.text) && R.won == null) return '';
    const col = R.won === true ? 'var(--gn)' : R.won === false ? 'var(--rd)' : 'var(--bl)';
    return `<div class="tscore" style="color:${col}" title="Match play — an exact result, never scaled">
      ${esc(R.text || (R.won ? 'won' : 'lost'))}
      <div style="font-size:9px;font-weight:400;color:var(--bl)">${R.derived?'match ·  from card':'match'}</div></div>`;
  }
  if (R.kind === 'typed')
    return `<div class="tscore">${esc(R.text)}</div>`;

  const col = R.delta <= 6 ? 'var(--gn)' : R.delta <= 12 ? 'var(--tx)' : 'var(--rd)';
  const d = `${R.delta>0?'+':''}${R.kind==='prorated' ? R.delta.toFixed(1) : R.delta}`;
  return `<div class="tscore" style="color:${col}${R.kind==='prorated'?';opacity:.82':''}"
      title="${R.kind==='prorated' ? R.holes+' holes played, scaled to 18' : 'full 18 holes'}">
    ${R.kind==='prorated'?'~':''}${R.gross}
    <div style="font-size:9px;font-weight:400;color:${R.kind==='prorated'?'var(--ye)':'var(--mu)'}">
      ${d}${R.kind==='prorated' ? ` · from ${R.holes}h` : ''}</div></div>`;
}

function tournamentRow(t, isFuture){
  const days = isFuture ? daysBetween(todayYmd(), t.date) : null;
  const col = days==null ? '' : (days<=7 ? 'var(--rd)' : days<=14 ? 'var(--ye)' : 'var(--ac)');
  return `<div class="trow" ${ME.role==='student'?`onclick="editTournament(${t.id})"`:''}>
    ${isFuture
      ? `<div class="tcd"><b style="color:${col}">${days===0?'today':days}</b><span>${days===0?'':'days'}</span></div>`
      : `<div class="tcd"><b style="font-size:15px;color:var(--mu)">${parseYmd(t.date).getDate()}</b><span>${MONTHS[parseYmd(t.date).getMonth()].slice(0,3)}</span></div>`}
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:650">${esc(t.name)}</div>
      <div style="font-size:11.5px;color:var(--mu);margin-top:2px">
        ${t.type==='match'?'Match play':t.type==='stableford'?'Stableford':'Stroke play'}${t.venue?' · '+esc(t.venue):''}${isFuture?' · '+esc(t.date):''}</div>
      ${t.notes?`<div style="font-size:12px;color:var(--mu);margin-top:3px;font-style:italic">${esc(t.notes)}</div>`:''}
    </div>
    <div class="mpair" onclick="event.stopPropagation();openCheckIn(${t.id})" title="Before / after">
      ${moodDot(checkIn(t.id,'pre'))}${moodDot(checkIn(t.id,'post'))}
    </div>
    ${isFuture ? '' : tournamentResultHtml(t)}
  </div>`;
}

function editTournament(id){
  const t = id ? TOURN.find(x=>x.id===id) : {date:todayYmd(), name:'', type:'stroke', score:'', venue:'', notes:''};
  openSheet(`
    <div class="sheet-h"><b>${id?'Edit tournament':'New tournament'}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="g2"><div class="fr"><label>Date</label><input type="date" id="t-date" value="${esc(t.date)}"></div>
      <div class="fr"><label>Type</label><select id="t-type" onchange="tournScoreHint()">
        <option value="stroke"     ${t.type==='stroke'    ?'selected':''}>Stroke play</option>
        <option value="stableford" ${t.type==='stableford'?'selected':''}>Stableford</option>
        <option value="match"      ${t.type==='match'     ?'selected':''}>Match play</option></select></div></div>
    <div class="fr"><label>Name</label><input type="text" id="t-name" value="${esc(t.name)}" placeholder="CCG Ladies Cup"></div>
    <div class="fr"><label>Venue</label><input type="text" id="t-venue" value="${esc(t.venue||'')}" placeholder="Colony Ost"></div>
    <div class="fr"><label id="t-score-lbl">Score</label><input type="text" id="t-score" value="${esc(t.score||'')}" placeholder="${t.type==='match'?'3&2':'89'}"></div>
    <!-- won/lost only means anything for a match; "3&2" carries the margin but
         not the outcome, and nothing can read which of you it belongs to -->
    <div class="fr" id="t-won-wrap" style="${t.type==='match'?'':'display:none'}">
      <label>Result</label>
      <div style="display:flex;gap:7px">
        <button type="button" class="tgl ${t.won===true?'on':''}"  id="t-won-y" onclick="pickWon(1)">Won</button>
        <button type="button" class="tgl ${t.won===false?'on':''}" id="t-won-n" onclick="pickWon(0)">Lost</button>
      </div><input type="hidden" id="t-won" value="${t.won===true?'1':t.won===false?'0':''}"></div>
    <div class="fr"><label>Notes</label><textarea id="t-notes" rows="2">${esc(t.notes||'')}</textarea></div>
    <div class="rbtns"><button class="btn btnp" onclick="saveTournament(${id||'null'})">Save</button>
      ${id?`<button class="btn btnd" onclick="deleteTournament(${id})">Delete</button>`:''}
      <button class="btn" onclick="closeSheet()">Cancel</button></div>`);
  tournScoreHint();
}
function tournScoreHint(){
  const ty = gv('t-type'), isMatch = ty==='match';
  const l=el('t-score-lbl'), s=el('t-score'), w=el('t-won-wrap');
  if(l) l.textContent = isMatch ? 'Result (e.g. 3&2, 1up)'
                      : ty==='stableford' ? 'Points (e.g. 34)' : 'Score (e.g. 89)';
  if(s) s.placeholder = isMatch ? '3&2' : ty==='stableford' ? '34' : '89';
  if(w) w.style.display = isMatch ? '' : 'none';
}
function pickWon(v){
  el('t-won').value = String(v);
  el('t-won-y').classList.toggle('on', v===1);
  el('t-won-n').classList.toggle('on', v===0);
}
async function saveTournament(id){
  const name=gv('t-name'), date=gv('t-date');
  if(!name||!date){ toast('Name and date, please'); return; }
  // won is nullable and stays null for stroke/stableford: "lost" and "not a
  // match" are different facts, so no defaulting to false
  const isMatch = gv('t-type')==='match', w = gv('t-won');
  const row={date, name, type:gv('t-type'), score:gv('t-score')||null,
             won: isMatch ? (w===''?null:w==='1') : null,
             venue:gv('t-venue')||null, notes:gv('t-notes')||null};
  if(id) await upd('tournaments','id=eq.'+id,row);
  else   await ins('tournaments',{...row, student_id:STUDENT_ID});
  closeSheet(); toast('Saved'); renderTournaments();
}
async function deleteTournament(id){
  if(!confirm('Delete this tournament?')) return;
  await del('tournaments','id=eq.'+id);
  closeSheet(); renderTournaments();
}

/* ── Wes's check-in: how it felt before, and what was actually true after ──
   His words: "colours for emotions before events … all of the above are not
   reality." So this is not mood logging. The `post` answer is the whole point —
   the gap between what you feared and what happened is the evidence, and it
   only reads as evidence if the `pre` was captured before you knew the score.
────────────────────────────────────────────────────────────────────────────── */
function moodDot(c){
  if (!c) return '<span class="mdot empty"></span>';
  const m = mood(c.mood);
  // A ring, not a second dot: nervous rides ON the mood, it does not sit
  // beside it. Scrolling the list still reads as one colour per row.
  const ring = c.also_nervous ? `box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px ${NERVOUS_COL};` : '';
  return `<span class="mdot" style="background:${m ? m.col : 'var(--mu)'};${ring}"
    title="${esc(m?m.label:'')}${c.also_nervous?' + nervous':''}"></span>`;
}

function moodPickHtml(id, sel, nerv){
  const has = !(sel===''||sel==null);
  return `<div class="moods">` + MOODS.map(m =>
    `<button type="button" class="mpill ${Number(sel)===m.v?'sel':''}" data-v="${m.v}"
       ${m.hint?`title="${esc(m.hint)}"`:''}
       style="${Number(sel)===m.v?`background:${m.col};border-color:${m.col};`:`color:${m.col}`}"
       onclick="pickMood('${id}',${m.v})"><span class="dot"></span>${m.label}</button>`).join('') + `</div>
    <input type="hidden" id="${id}" value="${has?sel:''}">
    <input type="hidden" id="${id}-nerv" value="${nerv?'1':''}">
    <div id="${id}-nervwrap" style="margin-top:8px;${(has&&Number(sel)!==NERVOUS_V)?'':'display:none'}">
      <button type="button" class="fpill ${nerv?'sel':''}" id="${id}-nervbtn"
        title="Nervous rides along with anything — Wes reckons it's a good sign, not a warning"
        onclick="toggleNervous('${id}')">＋ and nervous with it</button>
    </div>`;
    // NOT `sel||''` — Bored is mood 0, and that falsy 0 silently emptied the
    // hidden field while the pill still showed as selected, so reopening a
    // "Bored" check-in and saving it answered "Pick one first".
}

// Hidden when "Nervous" itself is the pick: "nervous and nervous with it" is
// not a state, it is a bug that survived review.
function toggleNervous(id){
  const inp = el(id+'-nerv'), btn = el(id+'-nervbtn');
  inp.value = inp.value ? '' : '1';
  btn.classList.toggle('sel', !!inp.value);
}
function syncNervous(id, v){
  const wrap = el(id+'-nervwrap');
  if (!wrap) return;
  wrap.style.display = (Number(v) === NERVOUS_V) ? 'none' : '';
  if (Number(v) === NERVOUS_V){ el(id+'-nerv').value=''; el(id+'-nervbtn').classList.remove('sel'); }
}
function pickMood(id, v){
  const inp = el(id); if (!inp) return;
  inp.value = v;
  const wrap = inp.previousElementSibling;
  wrap.querySelectorAll('.mpill').forEach(b => {
    const m = mood(b.dataset.v), on = Number(b.dataset.v) === v;
    b.classList.toggle('sel', on);
    b.setAttribute('style', on ? `background:${m.col};border-color:${m.col};` : `color:${m.col}`);
  });
  syncNervous(id, v);
}

/* The teacher READS these and never sets one.
   Found 4 Aug with Wes signed in: the sheet had no role gate, so he got the
   full picker, her note boxes and both Save buttons. The database was never
   at risk — RLS is `is_student()` and his write touches 0 rows — but that is
   precisely what made it bad. The upsert merges on conflict, so on a
   tournament that already had a check-in his tap returned 200 with an empty
   result and the app cheerfully said "Saved". A UI that lies is worse than
   one that refuses.

   He still sees everything: the answers, her notes, the gap line. Only the
   controls go. Nobody answers for someone else's head. */
function checkInReadOnly(t, pre, post){
  const row = (c, when) => {
    if (!c) return `<div style="display:flex;gap:10px;align-items:center;padding:9px 0;color:var(--mu);font-size:13px">
      <span class="mdot" style="background:transparent;border:1px dashed var(--b1)"></span>${when} — not answered</div>`;
    const m = mood(c.mood) || {label:'—', col:'var(--b1)'};
    return `<div style="padding:9px 0;border-bottom:1px solid var(--b1)">
      <div style="display:flex;gap:10px;align-items:center">
        <span class="mdot" style="background:${m.col}"></span>
        <b style="font-size:14px">${esc(m.label)}${c.also_nervous?` <span style="color:${NERVOUS_COL};font-weight:600">+ nervous</span>`:''}</b>
        <span style="color:var(--mu);font-size:12px">${when}${c.focus?` · head in the <b>${esc(c.focus)}</b>`:''}</span>
      </div>
      ${c.note?`<div style="font-size:12.5px;color:var(--mu);font-style:italic;margin:5px 0 0 24px;white-space:pre-wrap">"${esc(c.note)}"</div>`:''}
    </div>`;
  };
  return `
    <div class="sheet-h"><b>${esc(t.name)}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="empty" style="padding:0 0 14px">${esc(t.date)}${t.venue?' · '+esc(t.venue):''}</div>
    ${row(pre,'before')}
    ${row(post,'after')}
    ${pre && post ? gapLine(pre, post) : ''}
    <div class="empty" style="font-size:11.5px;padding:14px 0 0">Astrid's own answers — yours to read, not to set.</div>`;
}

function openCheckIn(tid){
  const t = TOURN.find(x => x.id === tid);
  if (!t) return;
  const pre = checkIn(tid,'pre'), post = checkIn(tid,'post');
  const played = t.date < todayYmd();
  if (ME.role !== 'student') { openSheet(checkInReadOnly(t, pre, post)); return; }
  openSheet(`
    <div class="sheet-h"><b>${esc(t.name)}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="empty" style="padding:0 0 14px">${esc(t.date)}${t.venue?' · '+esc(t.venue):''}</div>

    <div style="padding:10px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.04);font-size:12.5px;line-height:1.55;margin-bottom:14px;color:var(--mu)">
      These describe <b style="color:var(--tx)">the next hour</b>, not you. That is
      Wes's whole point — none of them are reality, they are weather. Naming which
      one is blowing is the exercise.
    </div>

    <div class="dl" style="margin-top:0">Before — how does it feel?</div>
    ${moodPickHtml('ci-pre-mood', pre ? pre.mood : '', pre && pre.also_nervous)}
    <div style="margin-top:12px;font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.8px">Where's your head?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      ${FOCUS.map(f=>`<button type="button" class="fpill ${pre&&pre.focus===f.id?'sel':''}" data-f="${f.id}"
        title="${esc(f.hint)}" onclick="pickFocus('${f.id}')">${f.label}</button>`).join('')}
    </div>
    <input type="hidden" id="ci-pre-focus" value="${pre?(pre.focus||''):''}">
    <div class="fr" style="margin-top:10px"><textarea id="ci-pre-note" rows="2"
      placeholder="Anything you notice (optional)">${pre?esc(pre.note||''):''}</textarea></div>
    <div class="rbtns" style="margin-top:0">
      <button class="btn btnp btns" onclick="saveCheckIn(${tid},'pre')">Save before</button></div>

    ${played ? `
      <div class="dl">After — what was actually true?</div>
      ${moodPickHtml('ci-post-mood', post ? post.mood : '', post && post.also_nervous)}
      <div class="fr" style="margin-top:10px"><textarea id="ci-post-note" rows="2"
        placeholder="How it really went">${post?esc(post.note||''):''}</textarea></div>
      <div class="rbtns" style="margin-top:0">
        <button class="btn btnb btns" onclick="saveCheckIn(${tid},'post')">Save after</button></div>
      ${pre && post ? gapLine(pre, post) : ''}
    ` : `<p class="empty" style="font-size:12px">The "after" opens once the day has passed.</p>`}`);
}

function pickFocus(f){
  el('ci-pre-focus').value = f;
  document.querySelectorAll('.fpill[data-f]').forEach(b => b.classList.toggle('sel', b.dataset.f === f));
}

// The one line that makes this an intervention rather than a mood diary.
function gapLine(pre, post){
  const a = mood(pre.mood), b = mood(post.mood);
  if (!a || !b) return '';
  const lo = s => esc(s.toLowerCase());
  // Bored sits off the axis, so subtracting it would invent a direction that
  // does not exist. Say what happened and make no claim about up or down.
  if (!onAxis(pre) || !onAxis(post)) {
    const txt = (!onAxis(pre) && !onAxis(post))
      ? `Flat before, flat after — <b>${lo(a.label)}</b> both ends. Worth asking what was missing.`
      : !onAxis(pre)
        ? `You went in <b>${lo(a.label)}</b> and came out <b>${lo(b.label)}</b>. The round switched you on; the flatness beforehand wasn't the event either.`
        : `You went in <b>${lo(a.label)}</b> and came out <b>${lo(b.label)}</b>. Whatever was there at the start had gone by the end.`;
    return `<div style="margin-top:14px;padding:10px 12px;border-radius:9px;
      border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:13px;line-height:1.5">${txt}</div>`;
  }
  const moved = post.mood - pre.mood;
  const txt = moved > 0
    ? `You went in <b>${esc(a.label.toLowerCase())}</b> and came out <b>${esc(b.label.toLowerCase())}</b>. The feeling beforehand wasn't the event.`
    : moved < 0
      ? `You went in <b>${esc(a.label.toLowerCase())}</b> and came out <b>${esc(b.label.toLowerCase())}</b>. Worth telling Wes about this one.`
      : `Same before and after — <b>${esc(a.label.toLowerCase())}</b>.`;
  return `<div style="margin-top:14px;padding:10px 12px;border-radius:9px;
    border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:13px;line-height:1.5">${txt}</div>`;
}

async function saveCheckIn(tid, phase){
  const m = gv(phase === 'pre' ? 'ci-pre-mood' : 'ci-post-mood');
  if (!m){ toast('Pick one first'); return; }
  const row = {
    student_id: STUDENT_ID, tournament_id: tid, phase, mood: Number(m),
    also_nervous: !!gv(phase === 'pre' ? 'ci-pre-mood-nerv' : 'ci-post-mood-nerv'),
    focus: phase === 'pre' ? (gv('ci-pre-focus') || null) : null,
    note: gv(phase === 'pre' ? 'ci-pre-note' : 'ci-post-note') || null,
    updated_at: new Date().toISOString(),
  };
  // on_conflict names the unique index so re-answering overwrites instead of
  // erroring — the Signal prompt can then be re-sent safely.
  await api('check_ins?on_conflict=tournament_id,phase', {method:'POST', body: row,
    prefer:'resolution=merge-duplicates,return=minimal'});
  toast('Saved');
  closeSheet();
  renderTournaments();
}

/* ═══════════════════════════════════════════════════════════════
   6 · WEEKLY SUMMARY — the teacher's landing page.

   Wes hasn't specified what he wants ("Wes to design"), so this is a
   sensible default for him to react to. Collect his reactions after
   2–3 real cycles, then a short spec session — don't guess further.
   ═══════════════════════════════════════════════════════════════ */
/* ── Wes's summary header ────────────────────────────────────────
   His spec, 5 Aug: a progress wheel with the percentage in the middle,
   and beside it the week's assignments grouped into Drills & Games /
   On Course Practise / Tournaments, each opening to its own detail.

   THE WHEEL IS PRO-RATED BY DAY, and that was Astrid's fix rather than
   his. A wheel that is red at 0% turns red every Monday morning and
   calls Monday a failure. So the ring fills against where you should be
   by TODAY, not against Sunday night: neutral while you are on pace,
   red only when genuinely behind it, green when ahead or finished.
   ──────────────────────────────────────────────────────────────── */
let sumOpen = null;
function toggleSumSection(k){ sumOpen = (sumOpen===k) ? null : k; renderSummary(); }

function wheelHtml(pct, pace){
  const R = 46, C = 2 * Math.PI * R;
  const shown = Math.max(0, Math.min(100, pct));
  // ahead or done = green · behind pace by more than 15 points = red · else neutral
  const col = (shown >= 100 || shown >= pace) ? 'var(--gn)'
            : (pace - shown > 15) ? 'var(--rd)' : 'var(--ac)';
  return `<svg viewBox="0 0 110 110" style="width:112px;height:112px;flex-shrink:0" aria-label="${shown}% complete">
    <circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--b1)" stroke-width="9"/>
    <circle cx="55" cy="55" r="${R}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - shown/100)}"
      transform="rotate(-90 55 55)" style="transition:stroke-dashoffset .5s ease"/>
    ${pace<100&&pace>0?`<circle cx="${55 + R*Math.cos((pace/100)*2*Math.PI - Math.PI/2)}"
      cy="${55 + R*Math.sin((pace/100)*2*Math.PI - Math.PI/2)}" r="3" fill="var(--mu)"><title>where you should be today</title></circle>`:''}
    <text x="55" y="55" text-anchor="middle" dominant-baseline="central"
      style="font:700 24px -apple-system,sans-serif;fill:var(--tx)">${shown}%</text>
  </svg>`;
}

function sumTile(k, label, done, total){
  const pct = total ? Math.round(done*100/total) : null;
  const on = sumOpen===k;
  return `<div onclick="toggleSumSection('${k}')" style="cursor:pointer;padding:9px 11px;border-radius:9px;
      border:1px solid ${on?'var(--b2)':'var(--b1)'};background:${on?'rgba(255,255,255,.05)':'transparent'};
      display:flex;justify-content:space-between;align-items:center;gap:10px">
    <span style="font-size:13px;font-weight:600">${esc(label)}</span>
    <span style="font-size:13px;font-weight:700;color:${total&&done===total?'var(--gn)':'var(--tx)'};white-space:nowrap">
      ${total?`${done}/${total}`:'—'} <span style="color:var(--mu);font-weight:400">${on?'\u25be':'\u25b8'}</span></span>
  </div>`;
}

// What is still open matters as much as what is done — he asked for both.
function sumDetail(items){
  if (!items.length) return `<div class="empty" style="padding:8px 0">Nothing in here this week.</div>`;
  return `<div style="margin-top:9px">${items.map(i=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--b1);font-size:13px;line-height:1.5">
      ${i.done?'<span class="good">\u2713</span>':'<span class="bad">\u2717</span>'} ${esc(i.name)}
      ${nn(i.score)?` <b style="color:var(--ac)">${esc(String(i.score))}</b>`:''}
      ${i.when?`<span style="color:var(--mu);font-size:11.5px"> \u00b7 ${esc(i.when)}</span>`:''}
      ${i.note?`<div style="font-size:11.5px;color:var(--mu);font-style:italic;margin:2px 0 0 15px">${esc(i.note)}</div>`:''}
    </div>`).join('')}</div>`;
}



/* ── The cumulative card, and the gap table ──────────────────────
   Two buttons under Rounds this week, 5 Aug. Both answer a question a
   list of rounds cannot: WHERE on the course it goes wrong, and how much
   of it only goes wrong under a card.
   ──────────────────────────────────────────────────────────────── */
let roundsView = null;
function setRoundsView(v){ roundsView = (roundsView===v) ? null : v; renderSummary(); }

/* One row per hole across several rounds, shaped like the paper card, with the
   column totals as PERCENTAGES on the top line. The rows show WHERE, the
   percentages show HOW OFTEN — a coach reads the top line and only drops into
   the rows when one of them looks wrong. */
function cumScorecardHtml(rounds){
  /* ONE ROW PER HOLE PLAYED, not per hole number.

     The first version averaged by hole number - "you played the 5th twice,
     here are its stats". Astrid killed it: she is not always on the same
     course, so the 5th at Fontana and the 5th at Roehampton have nothing to
     do with each other and averaging them says nothing at all.

     So this is just every played hole, in order, in the same shape as the
     card you get by opening a single round - with the round it came from in
     the left column, and the totals on top. 36 holes played, 36 rows. */
  const holes = [];
  for (const r of rounds){
    (r.holes_data || []).forEach((h, i) => {
      if (String(h.par == null ? '' : h.par) === '' || String(h.score == null ? '' : h.score) === '') return;
      holes.push({...h, no: i + 1, date: r.date, course: r.course});
    });
  }
  if (!holes.length) return `<div class="empty">No hole-by-hole data in these rounds.</div>`;

  const lc = k => h => String(h[k] || '').toLowerCase();
  const pc = f => Math.round(holes.filter(f).length * 100 / holes.length);
  const tot = k => holes.reduce((a, h) => a + Number(h[k] || 0), 0);
  const delta = holes.reduce((a, h) => a + (Number(h.score) - Number(h.par)), 0);

  const tiles = [
    ['Holes',  holes.length, null],
    ['vs par', (delta > 0 ? '+' : '') + delta, delta <= 0],
    ['GIR',    pc(h => h.gir) + '%', pc(h => h.gir) >= 50],
    ['In position', pc(h => ['m','x','w'].indexOf(lc('app')(h)) < 0 && lc('short')(h) !== 'c') + '%',
                    pc(h => ['m','x','w'].indexOf(lc('app')(h)) < 0 && lc('short')(h) !== 'c') >= 60],
    ['Putts',  tot('putts') || '\u00b7', null],
  ];
  const cell = 'padding:3px 5px;text-align:center;white-space:nowrap';
  const mark = v => { const t = String(v || '').trim();
                      return t === '' ? '<span style="color:var(--b1)">\u00b7</span>' : esc(t.toUpperCase()); };

  return `<div style="display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 10px">
      ${tiles.map(([l, v, good]) => `<div style="flex:1;min-width:58px;padding:7px 4px;border-radius:8px;
        border:1px solid var(--b1);text-align:center">
        <div style="font-size:17px;font-weight:700;color:${good == null ? 'var(--tx)' : good ? 'var(--gn)' : 'var(--rd)'}">${v}</div>
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--mu);margin-top:1px">${l}</div>
      </div>`).join('')}
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table style="border-collapse:collapse;font-size:11px;min-width:100%"><thead>
      <tr style="color:var(--mu);text-transform:uppercase;letter-spacing:.6px;font-size:9px">
        <th style="${cell};text-align:left">Round</th><th style="${cell}">Hole</th>
        <th style="${cell}">Par</th><th style="${cell}">Score</th><th style="${cell}">GIR</th>
        <th style="${cell}">Drive</th><th style="${cell}">App</th><th style="${cell}">Short</th>
        <th style="${cell}">Putts</th><th style="${cell}">Trbl</th><th style="${cell}">MP</th><th style="${cell}">Cmt</th></tr>
      </thead><tbody>
      ${holes.map((h, i) => {
        const d = Number(h.score) - Number(h.par);
        const col = d <= -1 ? 'var(--gn)' : d === 0 ? 'var(--tx)' : d === 1 ? 'var(--tx)' : 'var(--rd)';
        const newRound = i === 0 || holes[i-1].date !== h.date || holes[i-1].course !== h.course;
        return `<tr style="border-top:1px solid ${newRound ? 'var(--b2)' : 'var(--b1)'}">
          <td style="${cell};text-align:left;color:var(--mu);font-size:10px">${
            newRound ? esc(fmtDay(parseYmd(h.date))) + (h.course ? '<br>' + esc(String(h.course).slice(0,14)) : '') : ''}</td>
          <td style="${cell};font-weight:600">${h.no}</td>
          <td style="${cell};color:var(--mu)">${esc(String(h.par))}</td>
          <td style="${cell};font-weight:700;color:${col}">${esc(String(h.score))}${
            d !== 0 ? `<span style="font-weight:400;font-size:9px;color:var(--mu)"> ${d > 0 ? '+' : ''}${d}</span>` : ''}</td>
          <td style="${cell}">${h.gir ? '\u25cf' : '<span style="color:var(--b1)">\u00b7</span>'}</td>
          <td style="${cell}">${mark(h.drive)}</td>
          <td style="${cell}">${mark(h.app)}</td>
          <td style="${cell}">${mark(h.short)}</td>
          <td style="${cell};color:var(--mu)">${h.putts == null ? '<span style="color:var(--b1)">\u00b7</span>' : h.putts}</td>
          <td style="${cell}">${mark(h.trbl)}</td>
          <td style="${cell};color:${h.cmt ? 'var(--rd)' : 'var(--b1)'}">${
            h.cmt ? '\u25cf'.repeat(Math.min(5, Number(h.cmt))) : '\u00b7'}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
}

/* Social versus competition, side by side. This is the point of the whole page:
   the gap IS her signature and closing it is the 2-year goal. It needs a longer
   window than one week or the comparison is noise, so it runs on every round
   not marked excluded. */
function gapTableHtml(all){
  const soc = all.filter(r=>!r.comp), cmp = all.filter(r=>r.comp);
  if (!soc.length || !cmp.length)
    return `<div class="empty">Needs at least one of each \u2014 ${soc.length} social, ${cmp.length} competition.</div>`;
  const agg = function(list){
    const st = list.map(getRoundStats).filter(x=>x.n);
    const n  = st.reduce((a,x)=>a+x.n,0);
    const per18 = k => n ? (st.reduce((a,x)=>a+(x[k]||0),0)*18/n) : null;
    return {rounds:st.length, delta:per18('delta'),
            quad: n ? st.reduce((a,x)=>a+(x.posHit||0),0)*100/n : null,
            gir:per18('gir'), putts:per18('putts'), pen:per18('pen'), db:per18('db')};
  };
  const S = agg(soc), C = agg(cmp);
  const rows = [
    ['Rounds',           S.rounds, C.rounds, null,   0],
    ['Score vs par /18', S.delta,  C.delta,  'low',  1],
    ['Scoring position %', S.quad,  C.quad,   'high', 0],
    ['GIR /18',          S.gir,    C.gir,    'high', 1],
    ['Putts /18',        S.putts,  C.putts,  'low',  1],
    ['Penalties /18',    S.pen,    C.pen,    'low',  1],
    ['Doubles+ /18',     S.db,     C.db,     'low',  1],
  ];
  const cell = 'padding:6px 6px;text-align:right;white-space:nowrap';
  const f = (v,d) => v==null ? '\u2014' : Number(v).toFixed(d);
  return `<div style="overflow-x:auto;margin-top:10px">
    <table style="border-collapse:collapse;font-size:12.5px;width:100%"><thead>
      <tr style="color:var(--mu);text-transform:uppercase;letter-spacing:.6px;font-size:9px">
        <th style="${cell};text-align:left">&nbsp;</th><th style="${cell}">Social</th>
        <th style="${cell}">Comp</th><th style="${cell}">Gap</th></tr></thead><tbody>
      ${rows.map(function(r){
        const l=r[0], a=r[1], c=r[2], dir=r[3], d=r[4];
        const gap = (a==null||c==null||dir==null) ? null : c-a;
        const bad = gap!=null && ((dir==='low' && gap>0) || (dir==='high' && gap<0));
        return `<tr style="border-top:1px solid var(--b1)">
          <td style="${cell};text-align:left;color:var(--mu)">${l}</td>
          <td style="${cell}">${f(a,d)}</td><td style="${cell}">${f(c,d)}</td>
          <td style="${cell};font-weight:700;color:${gap==null?'var(--mu)':bad?'var(--rd)':'var(--gn)'}">
            ${gap==null?'\u2014':(gap>0?'+':'')+Number(gap).toFixed(d)}</td></tr>`; }).join('')}
      </tbody></table></div>
    <div style="font-size:10.5px;color:var(--mu);margin-top:8px">Everything per 18 holes so part-rounds compare honestly. Excluded rounds left out. Red means competition is the worse of the two.</div>`;
}

/* ── Breathwork, and nothing else ────────────────────────────────
   Wes asked for meditation / breathwork, 6 Aug. She already tracks it —
   it is the `breath` row in the habit app — and she does not want to
   hand him the habit app, which also holds alcohol, protein, water,
   supplements and her wind-down mood.

   So this reads a SECURITY DEFINER function that returns one field for
   one week and cannot be asked for anything else. Not a read grant on
   daily_habits with a promise that the UI will only render one column:
   the UI is not the security boundary, and a teacher token pointed at
   the REST API would return the lot.

   Rendered as seven day pills — a mirror of the row she actually fills
   in — plus the count, which is the number he will actually read.
   ──────────────────────────────────────────────────────────────── */
async function mindWeekHtml(wk){
  let rows;
  try {
    rows = await api('rpc/mind_week_guarded', {method:'POST', body:{wk}});
  } catch(e){ return ''; }              // migration not run yet: show nothing
  if (!Array.isArray(rows) || !rows.length) return '';
  const done = rows.filter(r => r.done).length;
  const today = todayYmd();
  return `<div class="card"><div class="ct"><span>Breathwork</span>
      <span class="bg ${done>=5?'bg-good':done>=3?'bg-warn':'bg-bad'}">${done}/7</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${rows.map(r => {
        const d = parseYmd(r.d), future = r.d > today;
        return `<div style="flex:1;min-width:34px;text-align:center;padding:7px 2px;border-radius:8px;
            border:1px solid ${r.done?'var(--pu)':'var(--b1)'};
            background:${r.done?'rgba(192,132,252,.22)':'transparent'};opacity:${future?.4:1}">
          <div style="font-size:13px;font-weight:700;color:${r.done?'var(--pu)':'var(--b1)'}">${r.done?'●':'·'}</div>
          <div style="font-size:9px;color:var(--mu);margin-top:2px">${DAY_SHORT[(d.getDay()+6)%7]}</div>
        </div>`;
      }).join('')}
    </div></div>`;
}

async function renderSummary(){
  const wk = ymd(WEEK), wkEnd = ymd(addDays(WEEK,6));
  const back4 = ymd(addDays(WEEK,-21));   // this week + 3 back, for the streak check

  const fortnight = ymd(addDays(parseYmd(todayYmd()),14));
  const [asg, subs, rounds, goals, tourn, note, refl] = await Promise.all([
    sel('assignments', `select=*,drills(id,name,category)&week_start=gte.${back4}&week_start=lte.${wk}&order=week_start.asc`),
    sel('week_submissions', `select=submitted_at,snapshot&week_start=eq.${wk}&order=submitted_at.asc`),
    // A YEAR of rounds, not a week: the gap table compares social with
    // competition, and one week of two rounds is not a comparison.
    sel('golf_rounds', `select=*&date=gte.${ymd(addDays(WEEK,-365))}&date=lte.${wkEnd}&order=date.asc`),
    sel('goals', 'select=*&order=horizon.asc,sort.asc'),
    // his spec: the next one, plus everything else inside a fortnight
    sel('tournaments', `select=*&date=gte.${todayYmd()}&date=lte.${fortnight}&order=date.asc`),
    sel('weekly_notes', `select=note&week_start=eq.${wk}`),
    selSoft('week_reflections', `select=*&week_start=eq.${wk}`),
  ]);

  const thisWeek = (asg||[]).filter(a => a.week_start === wk);
  const planned  = thisWeek.filter(a => a.day_index != null);
  const done     = planned.filter(a => a.done);
  const missed   = planned.filter(a => !a.done);
  const parked   = thisWeek.filter(a => a.day_index == null);

  /* ── header: the wheel and the three buckets ── */
  const cat = a => ((a.drills||{}).category) || '';
  const dg  = planned.filter(a => cat(a) !== 'game_like');
  const ocp = planned.filter(a => cat(a) === 'game_like');
  const wkT = (tourn||[]).filter(t => t.date >= wk && t.date <= wkEnd);
  const tDone = wkT.filter(t => (t.score||'').trim() || t.date < todayYmd());

  const totalN = dg.length + ocp.length + wkT.length;
  const doneN  = dg.filter(a=>a.done).length + ocp.filter(a=>a.done).length + tDone.length;
  const pct    = totalN ? Math.round(doneN*100/totalN) : 0;
  // Where she SHOULD be by today. Monday morning expects nothing.
  const elapsed = Math.min(7, Math.max(0, Math.round((parseYmd(todayYmd()) - WEEK)/86400000) + 1));
  const pace = Math.round(elapsed*100/7);

  const mapA = l => l.map(a => ({done:!!a.done, name:(a.drills||{}).name||'—', score:a.score,
                                when:(weekDays()[a.day_index]||{}).label, note:a.note}));

  let h = weekNavHtml(fmtRange(WEEK));

  h += `<div class="card">
    <div style="display:flex;gap:16px;align-items:center">
      ${wheelHtml(pct, pace)}
      <div style="flex:1;display:flex;flex-direction:column;gap:7px;min-width:0">
        ${sumTile('dg','Drills & Games', dg.filter(a=>a.done).length, dg.length)}
        ${sumTile('ocp','On Course Practise', ocp.filter(a=>a.done).length, ocp.length)}
        ${sumTile('t','Tournaments', tDone.length, wkT.length)}
      </div></div>
    ${sumOpen==='dg' ? sumDetail(mapA(dg)) : ''}
    ${sumOpen==='ocp'? sumDetail(mapA(ocp)) : ''}
    ${sumOpen==='t'  ? sumDetail(wkT.map(t=>({done:!!(t.score||'').trim(), name:t.name,
        score:t.score, when:t.date, note:t.notes}))) : ''}
  </div>`;

  /* CLAUDE'S BRIEFING REMOVED, 6 Aug. Her read, and it is right: every line of
     it duplicated something already on this page. It explained the drill Wes
     himself set, then reported she had not done it — which the wheel says
     above; it narrated the rounds, which the rounds table does better; and it
     quoted the scoring-position figure, which appears twice below.

     The cause is accretion, not the model. The prose was written when this page
     had nothing else on it. The wheel, the tiles, the cumulative card and the
     gap table all arrived underneath it afterwards, and nobody asked whether
     the paragraph still earned its place. It did not.

     It comes back only if it can say something no table here can — where her
     account and the evidence disagree, or where a trend crosses. Not a summary
     of what is already visible. */

  // Her own words, clearly attributed and kept OUT of the computed summary:
  // evidence and testimony sit beside each other, never blended.
  const r0 = (refl||[])[0];
  if (r0 && r0.submitted_at){
    const row=(l,v)=>v?`<div style="margin-bottom:9px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:var(--mu);margin-bottom:2px">${l}</div><div style="font-size:13.5px;line-height:1.5;white-space:pre-wrap">${esc(v)}</div></div>`:'';
    h += `<div class="card"><div class="ct">Her week, in her words</div>
      ${row('What felt good', r0.felt_good)}${row('What was off', r0.was_off)}${row('Committing to next week', r0.commitment)}</div>`;
  }

  /* KEPT, though she asked for the commitments card to go: a drill skipped
     three weeks running is not visible anywhere else. The tile detail shows
     THIS week; a streak only exists across weeks, and it is exactly what a
     coach needs to see. Reduced to one line rather than a card. */
  const streaks = skipStreaks(asg||[], wk);
  if (streaks.length){
    h += `<div style="margin:-4px 0 12px;padding:9px 12px;border-radius:9px;
        border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.07);font-size:12.5px;line-height:1.6">
      ${streaks.map(x=>`<b>${esc(catLabel(x.cat))}</b> skipped ${x.n} week${x.n===1?'':'s'} running`).join('<br>')}
    </div>`;
  }

  /* Clean approach % — Wes's headline number, on the page he reads. Renamed
     from "Quadrant %" on 5 Aug: blank in the App column means fine FOR THE CLUB
     IN HAND, so the figure never measured 30ft. See deriveRoundStats.
     A single round moves 5.6% per hole, so the week's figure sits beside a
     rolling last-5 and split comp vs social. That split is not decoration: the
     gap between the two IS her choke signature, and closing it is the 2-year
     goal. One computation, two jobs.

     `allCounted` is a YEAR of rounds (the gap table needs a real window);
     `counted` narrows to this week for everything on this card. */
  const allCounted = (rounds||[]).filter(r=>!r.stats_excluded);
  const counted    = allCounted.filter(r=>r.date >= wk && r.date <= wkEnd);
  const quadOf = list => {
    const st = list.map(getRoundStats).filter(x=>x.posPct!=null);
    if (!st.length) return null;
    const hit = st.reduce((a,x)=>a+x.posHit,0), n = st.reduce((a,x)=>a+x.n,0);
    return n ? Math.round(hit*100/n) : null;
  };
  const wkQuad = quadOf(counted);
  const wkComp = quadOf(counted.filter(r=>r.comp));
  const wkSoc  = quadOf(counted.filter(r=>!r.comp));

  /* The two analyses sit ABOVE the individual rounds and are built to be
     obviously tappable — they were plain small buttons and nothing said they
     opened anything. These are the two questions a list of rounds cannot
     answer: where it actually goes wrong, and how much of it only goes wrong
     under a card. They deserve to be the thing you reach for first. */
  const panel = (id, title, sub) => `<div onclick="setRoundsView('${id}')" style="cursor:pointer;
      flex:1;min-width:150px;padding:12px 13px;border-radius:11px;
      border:1px solid ${roundsView===id?'var(--ac)':'var(--b2)'};
      background:${roundsView===id?'rgba(200,169,110,.12)':'var(--sf)'}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <b style="font-size:13.5px">${title}</b>
      <span style="color:${roundsView===id?'var(--ac)':'var(--mu)'};font-size:15px">${roundsView===id?'\u25be':'\u203a'}</span></div>
    <div style="font-size:11px;color:var(--mu);margin-top:3px;line-height:1.4">${sub}</div></div>`;

  h += `<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px">
      ${panel('card','Every hole played','One row per hole, this week \u00b7 tap to open')}
      ${panel('gap','Social vs competition','Where the gap actually is \u00b7 all rounds')}
    </div>`;
  if (roundsView==='card' || roundsView==='gap'){
    h += `<div class="card">
      <div class="ct">${roundsView==='card' ? 'Every hole played, this week' : 'Social vs competition \u00b7 all rounds'}</div>
      ${roundsView==='card' ? cumScorecardHtml(counted) : gapTableHtml(allCounted)}</div>`;
  }

  h += `<div class="card"><div class="ct"><span>Rounds this week</span>${
      wkQuad!=null?`<span class="bg ${wkQuad>=60?'bg-good':wkQuad>=45?'bg-warn':'bg-bad'}">In position ${wkQuad}%</span>`:''}</div>`;
  if (wkQuad!=null && (wkComp!=null||wkSoc!=null))
    h += `<div class="empty" style="padding:0 0 9px;font-size:12px">Holes reaching a realistic scoring position · ${
      [wkSoc!=null?`social ${wkSoc}%`:null, wkComp!=null?`comp ${wkComp}%`:null].filter(Boolean).join(' · ')
    }${(wkComp!=null&&wkSoc!=null)?` · <b style="color:${wkSoc-wkComp>10?'var(--rd)':'var(--tx)'}">gap ${wkSoc-wkComp>0?'-':'+'}${Math.abs(wkSoc-wkComp)}</b> under a card`:''}</div>`;
  if (!(rounds||[]).filter(r=>r.date >= wk && r.date <= wkEnd).length)
    h += `<div class="empty">No rounds played.</div>`;
  for (const r of (rounds||[]).filter(r=>r.date >= wk && r.date <= wkEnd)){
    const s = getRoundStats(r);
    h += `<div class="rrow"><div style="display:flex;justify-content:space-between;gap:8px">
        <b style="font-size:13.5px;cursor:pointer;text-decoration:underline;text-decoration-color:var(--b2);text-underline-offset:3px"
          onclick="openRound=${r.id};go('rounds')">${esc(r.date)}${r.course?' · '+esc(r.course):''}</b>
        ${r.comp?'<span class="bi">Comp</span>':''}</div>
      <div style="font-size:12px;color:var(--mu);display:flex;flex-wrap:wrap;gap:8px;margin-top:3px">
        ${s.delta!=null?`<span style="font-weight:700;color:var(--tx)">${s.delta>0?'+':''}${s.delta} par</span>`:''}
        ${s.posPct!=null?`<span style="font-weight:700;color:var(--tx)">Pos:${s.posPct}%</span>`:''}
        ${s.gir!=null?`<span>GIR:${s.gir}</span>`:''}${s.p3!=null?`<span>3P:${s.p3}</span>`:''}
        ${s.db!=null?`<span>Dbl:${s.db}</span>`:''}${s.pen?`<span>Pen:${s.pen}</span>`:''}
        ${s.cmtPct!=null?`<span style="font-weight:700;color:var(--tx)">Cmt:${s.cmtPct}%</span>`:''}
        ${r.stats_excluded?'<span class="bp">not counted</span>':''}</div>
      ${r.takeaway?`<div style="font-size:12px;color:var(--gn2);margin-top:4px">✓ ${esc(takeawayLabel(r.takeaway))}${r.takeaway_note?` — <span style="color:var(--mu);font-style:italic">${esc(r.takeaway_note)}</span>`:''}</div>`:''}
      ${r.notes?`<div style="font-size:12px;color:var(--mu);margin-top:4px;font-style:italic;white-space:pre-wrap">${esc(r.notes)}</div>`:''}</div>`;
  }
  h += await mindWeekHtml(wk);

  /* — goals + next tournament — */
  // Only what needs attention: NOW goals that are at-risk or stalled. A wall of
  // green lights is noise, and the 2- and 5-year horizons don't move week to
  // week — if nothing is wrong, this card doesn't appear at all.
  const attention = (goals||[]).filter(g => g.horizon === 'now' && (g.status === 'at_risk' || g.status === 'stalled'));
  if (attention.length){
    h += `<div class="card"><div class="ct">Goals needing attention</div>`;
    for (const g of attention) h += `<div class="goal"><div class="light ${g.status}"></div>
      <div class="gt"><b style="font-size:13.5px">${esc(g.title)}</b>
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:.7px">${esc(statusLabel(g.status))}</p></div></div>`;
    h += `</div>`;
  }

  if ((tourn||[]).length){
    /* ONE tournament block, not two. "Coming up" and "Next tournament" listed
       the same events — the first as a countdown, the second with her check-in
       attached — which read as repetition rather than as two views.

       So: the next one in full, with the pre-round check-in, and beneath it
       anything else inside SEVEN days. A fortnight was too long a horizon for a
       page about this week; a second event next Tuesday is context, one in
       eleven days is not. */
    const t = tourn[0], days = daysBetween(todayYmd(), t.date);
    const soon = (tourn||[]).slice(1).filter(x => daysBetween(todayYmd(), x.date) <= 7);
    const ci = await selSoft('check_ins', `select=*&tournament_id=eq.${t.id}`);
    const pre = ci.find(c => c.phase === 'pre');
    const preLine = pre
      ? `<div style="margin-top:9px;display:flex;align-items:center;gap:8px;font-size:13px">
           <span class="mdot" style="background:${(mood(pre.mood)||{}).col}"></span>
           <span>Going in <b>${esc((mood(pre.mood)||{}).label||'').toLowerCase()}</b>${
             pre.focus ? ' · head ' + esc((FOCUS.find(f=>f.id===pre.focus)||{}).label||'').toLowerCase() : ''}</span></div>
         ${pre.note?`<div style="font-size:12px;color:var(--mu);font-style:italic;margin-top:3px">${esc(pre.note)}</div>`:''}`
      : `<div class="empty" style="padding:6px 0 0;font-size:12px">No check-in yet.</div>`;
    h += `<div class="card"><div class="ct">Next tournament</div>
      <div class="trow" style="border:none;padding:0">
        <div class="tcd"><b style="color:${days<=7?'var(--rd)':days<=14?'var(--ye)':'var(--ac)'}">${days===0?'today':days}</b><span>${days===0?'':'days'}</span></div>
        <div style="flex:1"><div style="font-size:14px;font-weight:650">${esc(t.name)}</div>
          <div style="font-size:11.5px;color:var(--mu)">${esc(t.date)} · ${t.type==='match'?'Match play':'Stroke play'}${t.venue?' · '+esc(t.venue):''}</div></div>
      </div>${preLine}${soon.length ? `
      <div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--b1)">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:var(--mu);margin-bottom:5px">
          Also this week</div>
        ${soon.map(x => {
          const dd = daysBetween(todayYmd(), x.date);
          return `<div style="display:flex;justify-content:space-between;gap:9px;padding:4px 0;font-size:12.5px">
            <span>${esc(x.name)}${x.venue?`<span style="color:var(--mu)"> · ${esc(x.venue)}</span>`:''}</span>
            <b style="white-space:nowrap;color:${dd<=2?'var(--ac)':'var(--tx)'}">${dd===0?'today':dd===1?'tomorrow':'in '+dd+' days'}</b>
          </div>`;
        }).join('')}
      </div>` : ''}</div>`;
  }

  /* — her note — */
  h += `<div class="card"><div class="ct">Astrid's note for the week</div>
    <div class="empty" style="white-space:pre-wrap;padding:0">${(note&&note[0]&&note[0].note) ? esc(note[0].note) : 'Nothing written.'}</div></div>`;

  /* — inline actions — */
  if (ME.role === 'teacher'){
    h += `<div class="rbtns">
      <button class="btn btnp" onclick="go('drills')">Assign a drill</button>
      <button class="btn btnb" onclick="go('feedback')">Write this week's comment</button>
      <button class="btn" onclick="go('week')">Open the grid</button></div>`;
  }
  el('pg-summary').innerHTML = h;
}

// "putting skipped 2nd week running" — count back from `wk` while a category
// had something planned and nothing done.
function skipStreaks(all, wk){
  const weeks = [];
  for (let i=0;i<4;i++) weeks.push(ymd(addDays(parseYmd(wk), -7*i)));   // newest first
  const out = [];
  for (const c of CATS){
    let n = 0;
    for (const w of weeks){
      const inWeek = all.filter(a => a.week_start===w && a.day_index!=null && (a.drills||{}).category===c.id);
      if (!inWeek.length) break;                 // nothing planned → streak ends
      if (inWeek.some(a => a.done)) break;       // something done → streak ends
      n++;
    }
    if (n >= 2) out.push({cat:c.id, n});
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   7 · FEEDBACK

   Two panels: Wes's comments (everyone sees) and Claude's comments
   (the Sunday coach run — golf AND the non-golf coaching).

   The Claude panel is not rendered for a teacher, but that is the
   belt: the braces is the RLS policy in schema.sql, which keeps
   author='claude' rows out of the teacher's API response entirely.
   ═══════════════════════════════════════════════════════════════ */
async function renderFeedback(){
  const wk = ymd(WEEK);
  const rows = await sel('feedback', `select=*&week_start=eq.${wk}&order=created_at.asc`) || [];
  const teacher = rows.filter(r => r.author === 'teacher');
  const claude  = rows.filter(r => r.author === 'claude');

  let h = weekNavHtml(fmtRange(WEEK));

  h += `<div class="card"><div class="ct"><span>${esc(TEACHER_NAME)}'s comments</span>
    ${ME.role==='teacher' ? `<button class="btn btns" onclick="editFeedback(${teacher.length?teacher[0].id:'null'})">${teacher.length?'✎ Edit':'＋ Write'}</button>` : ''}</div>`;
  if (!teacher.length) h += `<div class="empty">Nothing from ${esc(TEACHER_NAME)} for this week yet.</div>`;
  for (const r of teacher) h += `<div class="fb fb-teacher">${esc(r.body)}</div>`;
  h += `</div>`;

  if (ME.role !== 'teacher'){
    h += `<div class="card"><div class="ct">Claude's comments</div>`;
    if (!claude.length) h += `<div class="empty">Nothing yet — Claude writes on Sunday evening.</div>`;
    for (const r of claude) h += `<div class="fb fb-claude">${esc(r.body)}</div>`;
    h += `</div>`;
  }
  el('pg-feedback').innerHTML = h;
}

function editFeedback(id){
  const wk = ymd(WEEK);
  openSheet(`
    <div class="sheet-h"><b>Comment · ${esc(fmtRange(WEEK))}</b><button class="sheet-x" onclick="closeSheet()">×</button></div>
    <div class="fr"><textarea id="fb-body" rows="9" placeholder="What she should take from this week."></textarea></div>
    <div class="rbtns"><button class="btn btnp" onclick="saveFeedback(${id||'null'},'${wk}')">Save</button>
      <button class="btn" onclick="closeSheet()">Cancel</button></div>`);
  if (id){
    sel('feedback', `select=body&id=eq.${id}`).then(r => {
      if (r && r[0] && el('fb-body')) el('fb-body').value = r[0].body;
    });
  }
}
async function saveFeedback(id, wk){
  const body = el('fb-body').value.trim();
  if (!body){ toast('Nothing to save'); return; }
  if (id){
    await upd('feedback','id=eq.'+id, {body, updated_at:new Date().toISOString()});
    toast('Updated');                       // edits are silent — no second ping
  } else {
    await ins('feedback', {student_id:STUDENT_ID, week_start:wk, author:'teacher', body});
    // Events → Astrid: feedback ready. First write of the week only.
    const sent = await notify(STUDENT_NAME, `${TEACHER_NAME} has left you a comment for ${fmtRange(parseYmd(wk))}. It's in the app under Feedback.`);
    toast(sent ? 'Saved — Astrid notified' : 'Saved');
  }
  closeSheet(); renderFeedback();
}
