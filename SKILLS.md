# Skills

Agent Skills shipped with `@waterx/sdk`. A skill is a written procedure an AI coding agent
loads on demand — the same flow a developer would follow, in a form an agent can execute
without being re-taught it each session.

| Skill                                                                                     | Use when                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`waterx-sdk-integration`](./.claude/skills/waterx-sdk-integration/SKILL.md)               | Integrating the SDK into an app, keeper, or bot — client wiring, accounts, funding, tx building, debugging aborts |

## Using it in this repo

Nothing to do. Claude Code discovers `.claude/skills/` automatically; ask for the skill by
name, or just describe an integration task and it loads.

## Using it in your own repo

The skill ships inside the published package, so copy it out of `node_modules`:

```bash
mkdir -p .claude/skills
cp -r node_modules/@waterx/sdk/.claude/skills/waterx-sdk-integration .claude/skills/
```

Agents other than Claude Code can read the file directly — it is plain Markdown with a
YAML header, and nothing in it is Claude-specific.

Re-copy after upgrading the SDK; the skill tracks the API surface and changes with it.

## For humans

The skill is readable on its own and doubles as an integration checklist. If you are
reading rather than delegating, [`README.md`](./README.md) covers the same ground with
more prose — start with [First integration](./README.md#first-integration).
