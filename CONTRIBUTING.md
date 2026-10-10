# Contributing to Guild Code

## Run it while you work

```
claude --plugin-dir /path/to/guild-code
```

An interactive session watches the folder: saving a file reloads the mod. Run `claude --debug` to see why a hook was skipped or a pane refused.

The first time the engine loads the mod it lays its API types in `.claude-plugin/types/` (ignored by git). After that, `tsc -p .` type-checks the mod with the repository's `tsconfig.json`.

## Checks

```
claude plugin validate .
claude plugin test .
```

Both must pass before a pull request.

## Work on the Guild Hall page

The page is `demo/src.html`: the dry run as it stands, and live when `/guild` serves it with `window.GUILD_LIVE` set. Edit it, then rebuild the page the mod serves:

```
node demo/build.mjs
```

That inlines the real classifier (`hooks/classify.ts`) and the island (`hooks/world.js`) into `demo/guild-hall.html`, which is committed. Open it straight from disk for the dry run; run `/guild` in a session with the mod loaded for the live page.

## Add a tool or framework

Everything about where a command goes lives in `hooks/classify.ts`.

1. Add a rule to `RULES`, inside its language's block. Rules are tried in order and the first match wins, so put test rules before lint rules before build rules within a toolchain.
2. If the tool is usually run through a wrapper (like `npx` or `uv run`), check that `WRAPPERS` strips it.
3. Add the command and its expected room to `CASES` in `tests/classify.test.ts`.

## Add a test-report format

If a test runner prints a summary line Guild Code doesn't read yet, add a branch to `readBattle` in `hooks/classify.ts` and a case to the `readBattle` tests with a real line of that runner's output.

## Add a language

1. Add it to `GuildLang` in `types/index.d.ts` and to `LANGS` in `hooks/lore.ts` (with a short crest).
2. Add its file extensions and manifest files to `EXT` in `hooks/classify.ts`.
3. Add its test, lint and build rules, and tests for them.
4. Add its commands to the four agents in `agents/`.

## Design rules

- **Never block real work.** Every hook that sits in front of a tool call, prompt or subagent is fail-open (`.catch(($, e, next) => next(e))`), and the hook's own bookkeeping is wrapped in `try`.
- **State the drawing reads lives in `$.state`** (declared in `types/index.d.ts`), never in module variables, so it survives a hot reload.
- **Keep `classify.ts` pure**, so it is tested without the engine.
