# golf-coach

A two-person coaching app: **student** (Astrid) and **teacher** (Wes), with Claude
as independent analytics and a second coaching voice.

"Teacher" is a role, not a person — Claude occupies the seat until Wes onboards,
and again whenever he goes quiet. The app works fully with zero input from Wes.

## Pages
Agreed Goals (student landing) · Weekly Commitments · Drills + Games · Rounds ·
Tournaments · Weekly Summary (teacher landing) · Feedback.

## How it's built
Vanilla HTML/JS, no framework, no build step, no CDN. Auth is Supabase magic-link
spoken directly over GoTrue's REST API so there is nothing to go stale offline.
Data lives in the hosted `astrid-efficiency` Supabase project.

## Security
The anon key in `index.html` is public by design — Row Level Security carries the
protection, not key secrecy. Notably: Claude's feedback panel is invisible to the
teacher because an RLS policy keeps those rows out of the API response, not
because a `<div>` is hidden.

No secrets belong in this repo. The Anthropic key used by the optional scorecard
photo-scan is stored in your own browser's localStorage and never committed.

Spec and deploy notes live outside this repo, in `CODE/building/coaching-v3.0/`.
