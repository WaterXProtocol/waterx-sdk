# Knowledge hub — lessons for the next session

One lesson per file, named `YYYY-MM-DD-<slug>.md`. Record corrections and confirmed approaches
alike, including why they mattered; a lesson is only useful with its reason. Do not save what
the repository, `CHANGELOG.md` or git history already records: a rule belongs in `AGENTS.md`,
`src/AGENTS.md`, a skill or a code comment, with a note here only when the story behind it is
longer than the rule. Update an existing note rather than creating a duplicate; delete a note
that turns out to be wrong.

Agents: scan the `title` lines here (`grep -h '^title:' docs/knowledge-hub/*.md`) at the start
of work in an unfamiliar area, and add a note at the end of a task when you learned something
the next session would otherwise rediscover.

Note: `.gitignore` ignores `docs/` in this repo. Until the team adds `!docs/knowledge-hub/` to
it, a new lesson must be added with `git add -f docs/knowledge-hub/<file>.md`.

## Shape

The same YAML frontmatter as the other WaterX repos' `docs/knowledge-hub/` (canonical schema:
`Bucket-Protocol/waterx-commons`, `knowledge-hub/SCHEMA.md`), so the hubs read as one set.
`title` is the lesson in one sentence — what breaks, or what to do.

```markdown
---
title: "<the lesson in one sentence>"
date: "YYYY-MM-DD"
domain: "engineering"
knowledge_type: "error"            # error (something broke) | decision (a confirmed approach)
source: "human"                    # human | ai-agent
source_agent: ""                   # e.g. "Claude Code" when source is ai-agent
project: "waterx-sdk"
tags: [oracle, waterx-config]
roles: [SDK]
error_type: runtime                # config | deploy | build | runtime (error entries)
severity: medium                   # low | medium | high | critical
verification_command: ""           # a command that shows the lesson still holds, or ""
affected_files: ["src/oracle/..."]
related_errors: []                 # slugs of other entries
---

## Problem

## Root cause

## Resolution

## Prevention
```
