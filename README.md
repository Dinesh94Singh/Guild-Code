# 🏰 Guild Code

**A medieval guild hall for Claude Code.** As Claude works, a live map shows your party walking between five rooms: the Tavern Board, the Wizard's Study, the Dungeon, the Armory and the Alchemist's Cauldron. Failing tests become monsters, edits are forged in the Armory, and builds bubble in the Cauldron.

![The Guild Hall map](docs/guild-hall.png)

It is a **mod** for Claude Code: it runs inside Claude's own engine, draws a native pane, and watches the real work through hooks. Nothing about how Claude works changes, and if Guild Code ever errors, the work carries on without it.

## Install

At the prompt of a Claude Code session:

```
/plugin install guild-code --marketplace <your-github-user>/guild-code
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). The Guild Hall pane opens when a session starts; `/guild` opens it again any time.

To run it from a local checkout while you work on it:

```
claude --plugin-dir /path/to/guild-code
```

## The hall

| Room | What happens there |
| --- | --- |
| 📜 **Tavern Board** | Your prompts arrive as quests. Subagents are dispatched and return. The task list is the quest board. |
| 📚 **Wizard's Study** | Reading files, searching, docs and the web: `Read`, `Grep`, `Glob`, `WebFetch`, `git log`, `ls`, … |
| 💀 **Dungeon** | Test runs. Failing tests are monsters; the pane counts what lurks and what you slew. |
| 🛡️ **Armory** | Edits and writes, linters, formatters, type checkers and diffs. |
| ⚗️ **Alchemist's Cauldron** | Builds, installs, bundlers, compilers and containers. |

When a compound command touches several rooms (`cargo build && cargo test`), it goes to the most dangerous one.

### The party

The main loop is your hero, who takes up the class of whichever room it is in. Every subagent joins the party as its own member and leaves when its work returns. Guild Code also ships four class subagents that Claude can dispatch:

| Class | Agent type | Specialty |
| --- | --- | --- |
| 🧙 Wizard | `guild-code:wizard` | Read-only research: maps the toolchain, relevant files and conventions |
| 🗡️ Rogue | `guild-code:rogue` | Hunts failing tests and bugs; isolates, fixes the root cause, re-runs |
| ⚒️ Dwarf | `guild-code:dwarf` | Formatting, linting, type-checking and clean diffs |
| 🧪 Alchemist | `guild-code:alchemist` | Dependencies, builds, bundles and Docker; diagnoses build failures |

Classes earn XP for work done (more for slaying monsters), and XP persists across sessions. `/guild-stats` shows the record.

## Supported toolchains (V1)

| Language | 💀 Dungeon (tests) | 🛡️ Armory (lint, format, diff) | ⚗️ Cauldron (build) |
| --- | --- | --- | --- |
| **JavaScript / TypeScript** | jest, vitest, mocha, ava, tap, jasmine, karma, playwright, cypress, wdio, `node --test`, `bun test`, `npm/pnpm/yarn test` | eslint, prettier, biome, oxlint, stylelint, standard, xo, `tsc --noEmit`, deno lint/fmt, `npm run lint` | npm/pnpm/yarn/bun install & build, vite, webpack, rollup, esbuild, parcel, next, nuxt, turbo, nx, tsup, swc, babel |
| **Python** | pytest, unittest, nose2, tox, nox, coverage, `manage.py test`, behave | ruff, black, isort, flake8, pylint, mypy, pyright, autopep8, yapf, bandit | pip, uv, poetry, pdm, hatch, conda, pipenv, maturin, `python -m build`, setup.py |
| **Java** | `mvn test/verify`, `-Dtest=`, `gradle test/check`, JUnit console | spotless, checkstyle, PMD, SpotBugs, google-java-format | mvn package/install, gradle build/assemble, javac, java -jar, ant |
| **C++** | ctest, GoogleTest & Catch2 binaries, `meson test`, `bazel test`, `make test` | clang-format, clang-tidy, cppcheck, cpplint, include-what-you-use | cmake, make, ninja, meson, bazel, conan, vcpkg, g++/gcc/clang++ |
| **Rust** | `cargo test`, nextest, `cargo bench`, miri | `cargo fmt`, `cargo clippy`, `cargo check`, rustfmt | `cargo build/run/install`, rustc, wasm-pack, cross |
| **All** | | `git diff/commit/…`, pre-commit | docker, podman, docker compose, buildx, kubectl, helm |

Monster counts are read from the summary lines of: cargo test, cargo nextest, Maven Surefire, Gradle, CTest, GoogleTest, Catch2, pytest, unittest, Jest, Vitest, Mocha and the Node/TAP test runner.

Wrappers are seen through: `npx`, `pnpm exec`, `uv run`, `poetry run`, `env FOO=1`, `sudo`, `time`, `cd dir &&` and friends.

## Commands

- `/guild` opens the Guild Hall pane.
- `/guild-stats` shows XP per class and the dungeon record.

## Surfaces

The terminal draws the hall as five bordered rooms in text. The desktop app, VS Code and mobile draw an illustrated, animated map. All surfaces show the quest board and the chronicle of recent deeds.

## Project layout

```
.claude-plugin/
  plugin.json         the mod's manifest
  marketplace.json    makes this repository installable with /plugin install
hooks/
  hooks.json          names the hooks module
  register.tsx        the hooks: tool calls, prompts, subagents, the pane
  classify.ts         where each command goes, and test-report parsing (pure)
  lore.ts             rooms, classes, languages
  map.ts              the SVG map
agents/               the four class subagents
types/index.d.ts      the mod's state contract
tests/                classifier and behaviour tests
```

## Development

```
claude plugin validate .   # what the engine sees, and anything it would refuse
claude plugin test .       # runs tests/*.test.ts against the engine
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a toolchain or a test-report format.

## License

MIT
