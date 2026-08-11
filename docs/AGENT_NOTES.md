# Agent Notes

> Local, repo-tracked replacement for Claude Code's global auto-memory system. Read this at session start alongside `CONTEXT.md`. Update it the same way you'd update a memory: durable feedback (what to avoid/repeat) and project facts that aren't otherwise derivable from code or git history. Don't duplicate what `CONTEXT.md`/`CLAUDE.md`/`docs/PRD.md` already track.

---

## Feedback

### No Claude co-author trailer

Do not add a `Co-Authored-By: Claude...` trailer to commits in the Dastiyab repo (or its `jsoftsol/Dastiyab` remote).

**Why:** User explicitly asked (2026-08-11) to strip it from all commits, past and future. The entire git history (112 commits on `master`, 110 on `deploy`) was rewritten with `git-filter-repo` to remove existing trailers and force-pushed to `origin`.

**How to apply:** When committing in this repo, omit the trailer entirely — treat it as a standing repo convention, not a one-time instruction.

### CONTEXT.md + AGENT_NOTES.md auto-load via SessionStart hook

`.claude/settings.json` runs `.claude/hooks/session-start-context.mjs` on `SessionStart`, which injects the full text of `CONTEXT.md` and this file into context automatically — no need to read them manually at session start anymore (`docs/PRD.md` is still read on demand only, per the existing "skim if task touches product scope" rule).

**Why:** User asked (2026-08-11) for local project files to load automatically every session rather than relying on the agent remembering the "Session Start" instructions in `CLAUDE.md`. `jq` isn't available in this environment's Git Bash, so the hook is a small Node script instead.

**How to apply:** If `CONTEXT.md` or `docs/AGENT_NOTES.md` get renamed/restructured, update `.claude/hooks/session-start-context.mjs` to match. If session context ever seems to be missing this injected block, check `/hooks` — a newly created `.claude/settings.json` may need one manual reload before the file watcher picks it up.

### Keep all durable notes local to this repo

Don't write to the global Claude Code auto-memory folder (`~/.claude/projects/.../memory/`) for this project. Keep everything — feedback, project decisions, reference pointers — in this file instead.

**Why:** User explicitly asked (2026-08-11) for all files, including memory, to be saved locally in the project directory rather than in global user-level state.

**How to apply:** At the end of a session where you'd normally save an auto-memory entry, add/update a section here instead and commit it like any other doc change.

---

## Project Notes

### Deploy status

Dastiyab is deployed and confirmed live at `https://dastiyab.jsoftsol.com/` (verified 2026-08-11 via `gh run list --repo jsoftsol/Dastiyab` and a direct `curl`, both healthy). The GitHub Actions `Deploy` workflow triggers on push to the `deploy` branch.

**Why this matters:** as of the 2026-08-11 session, there had been a ~2 month gap with no commits since the deploy infra was built (2026-06-12), and `CONTEXT.md` incorrectly carried an "unverified" caveat for that whole period. That caveat is now resolved in `CONTEXT.md`/`docs/PRD.md`.

**How to apply:** trust `CONTEXT.md`'s "Where We Left Off" section as current, but if there's another long gap with no commits before this note is consulted, re-verify with `gh run list` and `curl` rather than assuming — deploy status is exactly the kind of thing that goes stale silently.
