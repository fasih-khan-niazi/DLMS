# GitHub Workflow for DLMS

## Why use GitHub alongside coding

Industry standard is: **code → commit → push** in small chunks, not one giant dump at the end.

Benefits:
- Backup if your PC dies
- Clear history of what changed and why
- Easy rollback
- Shows process for FYP/viva

## Branch model (what we agreed)

| Branch / tag | Purpose |
|--------------|---------|
| `main` | Frozen Week 1 client delivery |
| `v1.0.0-week1` | Exact commit for Week 1 (do not move) |
| `dev` | Week 2+ integration |
| `feat/...` | One feature at a time |

## Week 1 lock flow (already done once)

1. Finish work on `dev` and commit
2. `git checkout main` → `git merge dev`
3. Tag `v1.0.0-week1` on that merge commit
4. Push `main` + tag
5. `git checkout dev` and continue Week 2 here

Clients use the **hosted** API (Render), not a git checkout on their machine. You only check out the tag when you need to rebuild or redeploy that exact code.

## Commit style

Short, clear, present tense:

- `feat: add reservation queue and 72h hold`
- `fix: assign next reservation without composite index`
- `docs: add digital library local storage notes`
- `chore: lower PDF upload limit to 25MB`

## What never goes to GitHub

- `.env`
- `secrets/`
- `api/uploads/`
- Firebase service account JSON
- `google-services.json`

(Already covered by `.gitignore`.)

## What *does* go to GitHub

- All source (`api/`, `mobile/`, `admin/`, `shared/`)
- Engineering docs under `docs/` (architecture, setup, roadmap, …)
- Root `README.md`

`docs/` is **not** gitignored. FYP thesis drafts can live in `docs/fyp/` (see `docs/README.md`).

## First product commit

Use **one** commit for the initial dump (phases 1-6), then small commits after that.
See the agent’s step-by-step teach-through in chat when you first push.
