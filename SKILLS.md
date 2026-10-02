# Skills

Agent Skills shipped with `@waterx/sdk`. A skill is a written procedure an AI coding agent
loads on demand — the same flow a developer would follow, in a form an agent can execute
without being re-taught it each session.

[**`waterx-sdk-integration`**](./.claude/skills/waterx-sdk-integration/SKILL.md) is the one
skill here: it covers integrating the SDK into an app, keeper, or bot. Its frontmatter
`description` states exactly when it triggers.

## Using it in this repo

Nothing to do. Claude Code discovers `.claude/skills/` and Codex discovers the `.agents/skills/`
symlinks automatically; ask for the skill by name, or just describe an integration task and it loads.

## Using it in your own repo

The skill ships inside the published package. Copy it out of `node_modules` for Claude Code, and
expose the same directory to Codex (Codex scans `.agents/skills/` and follows a **directory**
symlink; a symlinked `SKILL.md` file is skipped):

```bash
mkdir -p .claude/skills .agents/skills
cp -r node_modules/@waterx/sdk/.claude/skills/waterx-sdk-integration .claude/skills/
ln -s ../../.claude/skills/waterx-sdk-integration .agents/skills/waterx-sdk-integration
```

Other agents can read the file directly — it is plain Markdown with a YAML header, and nothing
in it is Claude-specific — but only the two locations above are auto-discovered.

Re-copy after upgrading the SDK; the skill tracks the API surface and changes with it.

## For humans

The skill is readable on its own and doubles as an integration checklist. If you are
reading rather than delegating, [`README.md`](./README.md) covers the same ground with
more prose — start with [First integration](./README.md#first-integration).
