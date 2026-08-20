# GitHub Workflow for DLMS

## Why use GitHub alongside coding

Industry standard is: **code → commit → push** in small chunks, not one giant dump at the end.

Benefits:
- Backup if your PC dies
- Clear history of what changed and why
- Easy rollback
- Shows process for FYP/viva

## Branch model (what we agreed)

| Branch | Purpose |
|--------|---------|
| `main` | Stable, demo-ready |
| `dev` | Integration of finished phases |
| `feat/...` | One feature at a time |
| `chore/...` | Docs, tooling, cleanup |

## Suggested flow from now

1. Work on `dev` (integration branch) day to day
2. For larger features: `feat/...` from `dev` → PR/merge back into `dev`
3. When a milestone is solid: merge `dev` → `main`

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
