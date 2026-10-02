---
name: waterx-sdk-release
description: Release procedure for @waterx/sdk — use when publishing a release or prerelease to npm, cutting the CHANGELOG section, tagging, or writing the GitHub Release. Covers the four ordered steps (publish workflow first, then changelog commit, annotated tag, GitHub Release), who may publish, the registry-timestamp dating rule, and why the version is never hand-bumped. Not for writing a CHANGELOG entry during ordinary PR work (the root AGENTS.md covers that) or for consumer upgrades.
---

# Releasing `@waterx/sdk`

Publishing and changelog-cutting are two separate steps, in this order — **npm first, git second**. The
publish workflow bumps `package.json` itself, so never hand-bump the version. Every tag points at its
`chore(release)` commit, not at the workflow's bump commit.

## 1. Publish from GitHub Actions

Run the `Publish package` workflow (`.github/workflows/publish.yml`, `workflow_dispatch`) and pick
`major` / `minor` / `patch` / `prerelease`; `dryRun` rehearses everything without publishing or pushing.

Three jobs: `guard` (actor + ref, checks out nothing), `build` (the same bar `ci.yml` holds every PR to —
`lint`, `docs:check`, `typecheck`, `test:unit`, `build`, `test:post-build`, `check:exports` — then uploads
`dist`), `publish` (bump → `npm publish --provenance` → for a real release only, a
`chore: bump sdk version to X.Y.Z` commit back to `main`). Only `publish` holds `id-token: write`, and it
runs no dependency code. It creates **no git tag** — steps 2–4 are by hand afterwards; for a release the
run's job summary prints them with the registry timestamp and the commit it published from filled in
(`github.sha`, the same commit npm records as `gitHead`: the bump commit lands after the publish).

- **Who may publish**: the repo variables `RELEASE_PUBLISHERS` / `PRERELEASE_PUBLISHERS` (space-separated
  GitHub user ids, Settings → Secrets and variables → Actions). Read the current values there; they change
  without a PR, and equally any repo admin can change them without review. An unset variable denies
  everyone. An official release must be dispatched from `main`; a prerelease may come from any branch.
  This is advisory, not enforcement: `workflow_dispatch` runs the workflow from the selected ref, so a
  branch that deletes the guard bypasses it — only the `npm-publish` environment (still commented out in
  the workflow) would fix that.
- A prerelease is numbered `<next-patch>-<tag>.<run_number>` and is deliberately not committed back — the
  run number is its counter, which is what stops two prereleases in a row from computing the same
  version (the second would 403 at npm).
- Auth is npm **trusted publishing over OIDC**, no token: npm matches the repository and this workflow's
  filename, so renaming `publish.yml` breaks publishing until npmjs.com is updated.

## 2. Cut the changelog

One commit, `chore(release): X.Y.Z`, touching `CHANGELOG.md` only. Rename `## [Unreleased]` to
`## [X.Y.Z] - YYYY-MM-DD` and open a fresh empty `## [Unreleased]` above it. The **date is the npm registry
publish timestamp in UTC** (`npm view @waterx/sdk time --json`), not the day you cut it — every prior
section is dated that way. Lead the section with a one-paragraph italic note that names every breaking
change; the versioning policy at the top of the file requires it, since a PATCH may carry one. Before
cutting, read `git diff vPREV..HEAD -- CHANGELOG.md` for entries that landed under an already-dated header
and move them up.

## 3. Tag the release commit

Annotated, `v`-prefixed: `git tag -a vX.Y.Z -m "…"` then `git push origin vX.Y.Z`. The note is for
maintainers: what shipped, the npm publish timestamp, the commit npm actually published from
(`npm view @waterx/sdk@X.Y.Z gitHead` — the merge commit, one before the bump), and any breaking change.

## 4. Publish the GitHub Release

On that tag: `gh release create vX.Y.Z --title "X.Y.Z" --notes-file …`, titled with the bare version (no
`v`). This body is for consumers, not the git log: the PRs it came from as links, a `> ⚠️` blockquote
naming any breaking change, then `## Highlights` and a migration table. `gh release view v4.3.3` shows the
house style.

## Verify before you say it is done

`npm view @waterx/sdk version` shows the new version; `git tag --points-at HEAD` names the tag on the
`chore(release)` commit; `gh release view vX.Y.Z` exists. Report each from this session's output.
