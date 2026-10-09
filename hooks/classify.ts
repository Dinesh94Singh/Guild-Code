// Guild Code's classifier: where in the guild hall a tool call happens.
// Pure functions only, so they are tested without the engine.
//
// V1 toolchains: JavaScript/TypeScript, Python, Java, C++, Rust (+ Docker).
import type { GuildLang, GuildLocation } from '../types'

export type Placement = {
  location: GuildLocation
  lang?: GuildLang
  /** Short words for the chronicle: "pytest -x tests/" or "src/app.ts". */
  detail: string
  /** The tool or framework recognised, e.g. "pytest", "cargo test". */
  framework?: string
}

// Higher wins when a compound command touches several rooms.
const RANK: Record<GuildLocation, number> = { dungeon: 5, armory: 4, cauldron: 3, study: 2, tavern: 1 }

type Rule = { re: RegExp; location: GuildLocation; lang?: GuildLang; framework: string }

// Rules are tried in order against one simple command (wrappers stripped).
// Within a toolchain, test rules come before lint rules before build rules.
const RULES: Rule[] = [
  // ── Rust ────────────────────────────────────────────────────────────
  { re: /^cargo (\+\S+ )?(test|nextest|bench|miri test|tarpaulin|llvm-cov|mutants)\b/, location: 'dungeon', lang: 'rust', framework: 'cargo test' },
  { re: /^cargo (\+\S+ )?(fmt|clippy|check|fix|deny|audit|udeps|machete|sort)\b/, location: 'armory', lang: 'rust', framework: 'cargo lint' },
  { re: /^(rustfmt|clippy-driver)\b/, location: 'armory', lang: 'rust', framework: 'rustfmt' },
  { re: /^cargo\b/, location: 'cauldron', lang: 'rust', framework: 'cargo' },
  { re: /^(rustc|rustup|wasm-pack|cross|trunk|cargo-\S+|dx)\b/, location: 'cauldron', lang: 'rust', framework: 'rust build' },

  // ── Java (Maven, Gradle, javac) ─────────────────────────────────────
  { re: /^(mvnw?|\.\/mvnw)\b.*(\b(test|verify|surefire:test|failsafe:\S+|integration-test)\b|-Dtest=)/, location: 'dungeon', lang: 'java', framework: 'maven test' },
  { re: /^(mvnw?|\.\/mvnw)\b.*\b(checkstyle|spotless|pmd|spotbugs|fmt|formatter|sortpom):/, location: 'armory', lang: 'java', framework: 'maven lint' },
  { re: /^(mvnw?|\.\/mvnw)\b/, location: 'cauldron', lang: 'java', framework: 'maven' },
  { re: /^(gradlew?|\.\/gradlew)\b.*\b(\S*:)?(test|check|integrationTest|connectedCheck|jacocoTestReport)\b/i, location: 'dungeon', lang: 'java', framework: 'gradle test' },
  { re: /^(gradlew?|\.\/gradlew)\b.*\b(\S*:)?(spotless\w*|checkstyle\w*|pmd\w*|spotbugs\w*|lint\w*|ktlint\w*|detekt)\b/, location: 'armory', lang: 'java', framework: 'gradle lint' },
  { re: /^(gradlew?|\.\/gradlew)\b/, location: 'cauldron', lang: 'java', framework: 'gradle' },
  { re: /^java\b.*(junit-platform-console|org\.junit|org\.testng)/, location: 'dungeon', lang: 'java', framework: 'junit' },
  { re: /^(google-java-format|checkstyle|pmd)\b/, location: 'armory', lang: 'java', framework: 'java lint' },
  { re: /^(javac|java|jar|ant|jbang|jlink|jpackage)\b/, location: 'cauldron', lang: 'java', framework: 'javac' },

  // ── C++ (CMake, Make, Ninja, Bazel, Meson, compilers) ───────────────
  { re: /^ctest\b/, location: 'dungeon', lang: 'cpp', framework: 'ctest' },
  { re: /^cmake\b.*--target\s+(test|check|run_tests|unit_tests?)\b/, location: 'dungeon', lang: 'cpp', framework: 'ctest' },
  { re: /^meson test\b/, location: 'dungeon', lang: 'cpp', framework: 'meson test' },
  { re: /^(bazel|bazelisk) (test|coverage)\b/, location: 'dungeon', lang: 'cpp', framework: 'bazel test' },
  { re: /^(\.\/|\S+\/)\S*(_tests?|_unittests?|Tests?|_spec)$|^(\.\/|\S+\/)tests?_\S+$/, location: 'dungeon', lang: 'cpp', framework: 'test binary' },
  { re: /^(\.\/|\S+\/)\S*(_tests?|Tests?)\s+--gtest_\S+/, location: 'dungeon', lang: 'cpp', framework: 'googletest' },
  { re: /^(clang-format|clang-tidy|run-clang-tidy\S*|cppcheck|cpplint|include-what-you-use|iwyu\S*|cmake-format|cmake-lint)\b/, location: 'armory', lang: 'cpp', framework: 'clang tools' },
  { re: /^(cmake|ninja|meson|conan|vcpkg|scons|ccache|premake\d*|xmake)\b/, location: 'cauldron', lang: 'cpp', framework: 'cmake' },
  { re: /^(bazel|bazelisk)\b/, location: 'cauldron', lang: 'cpp', framework: 'bazel' },
  { re: /^(g\+\+|gcc|clang\+\+|clang|c\+\+|cc|cl|icpx|nvcc)(-\d+)?(?=\s|$)/, location: 'cauldron', lang: 'cpp', framework: 'compiler' },

  // ── Python ──────────────────────────────────────────────────────────
  { re: /^(pytest|py\.test|nose2|ward|behave|hypothesis)\b/, location: 'dungeon', lang: 'python', framework: 'pytest' },
  { re: /^python[\d.]* -m (pytest|unittest|nose2|doctest)\b/, location: 'dungeon', lang: 'python', framework: 'pytest' },
  { re: /^python[\d.]* (\S+\/)?manage\.py test\b/, location: 'dungeon', lang: 'python', framework: 'django test' },
  { re: /^coverage run\b/, location: 'dungeon', lang: 'python', framework: 'coverage' },
  { re: /^tox\b(?!.*-e\s*(lint|format|flake8|mypy|style|typecheck))/, location: 'dungeon', lang: 'python', framework: 'tox' },
  { re: /^nox\b(?!.*-s\s*(lint|format|mypy|typecheck))/, location: 'dungeon', lang: 'python', framework: 'nox' },
  { re: /^(tox|nox)\b/, location: 'armory', lang: 'python', framework: 'tox lint' },
  { re: /^(ruff|black|isort|flake8|pylint|mypy|pyright|basedpyright|autopep8|yapf|bandit|pyflakes|pycodestyle|pydocstyle|pyupgrade|autoflake|blacken-docs)\b/, location: 'armory', lang: 'python', framework: 'python lint' },
  { re: /^python[\d.]* -m (ruff|black|isort|flake8|pylint|mypy|pyright|autopep8|yapf)\b/, location: 'armory', lang: 'python', framework: 'python lint' },
  { re: /^(pip\d?|pipx|poetry|uv|pdm|hatch|flit|conda|mamba|micromamba|pipenv|maturin|pyinstaller|twine|virtualenv)\b/, location: 'cauldron', lang: 'python', framework: 'python packaging' },
  { re: /^python[\d.]* -m (pip|build|venv|virtualenv|twine|setuptools)\b/, location: 'cauldron', lang: 'python', framework: 'python packaging' },
  { re: /^python[\d.]* (\S+\/)?setup\.py\b/, location: 'cauldron', lang: 'python', framework: 'setuptools' },
  { re: /^python[\d.]* (\S+\/)?manage\.py\b/, location: 'cauldron', lang: 'python', framework: 'django' },
  { re: /^(python[\d.]*|ipython|jupyter|streamlit|uvicorn|gunicorn|flask|fastapi)\b/, location: 'cauldron', lang: 'python', framework: 'python' },

  // ── JavaScript / TypeScript ─────────────────────────────────────────
  { re: /^(jest|vitest|mocha|ava|tap|tape|jasmine|karma|uvu|cypress run|playwright test|wdio|nyc|c8)\b/, location: 'dungeon', lang: 'javascript', framework: 'js test' },
  { re: /^(npm|pnpm|yarn|bun) (run |exec )?(jest|vitest|mocha|ava|tap|jasmine|karma|cypress|playwright|wdio|uvu)\b/, location: 'dungeon', lang: 'javascript', framework: 'js test' },
  { re: /^(node|deno|bun) (--test\b|test\b)/, location: 'dungeon', lang: 'javascript', framework: 'js test' },
  { re: /^(npm|pnpm|yarn|bun) (run )?(test|t|tst|e2e|coverage|spec)([:\s]|$)/, location: 'dungeon', lang: 'javascript', framework: 'npm test' },
  { re: /^(npm|pnpm|yarn|bun) (run )?\S*(test|spec|e2e)\S*/, location: 'dungeon', lang: 'javascript', framework: 'npm test' },
  { re: /^(eslint|prettier|biome|oxlint|stylelint|standard|xo|dprint|tslint|rome|knip)\b/, location: 'armory', lang: 'javascript', framework: 'js lint' },
  { re: /^tsc\b.*--noEmit/, location: 'armory', lang: 'javascript', framework: 'tsc' },
  { re: /^deno (lint|fmt|check)\b/, location: 'armory', lang: 'javascript', framework: 'deno lint' },
  { re: /^(npm|pnpm|yarn|bun) (run )?\S*(lint|format|fmt|prettier|eslint|typecheck|type-check|check-types|tsc)\S*/, location: 'armory', lang: 'javascript', framework: 'npm lint' },
  { re: /^(npm|pnpm|yarn|bun|npx|node|deno|tsc|vite|webpack|rollup|esbuild|parcel|next|nuxt|turbo|nx|swc|babel|tsup|tsx|ts-node|expo|react-native|electron-builder|lerna|corepack|nodemon|astro|svelte-kit|remix|ng)\b/, location: 'cauldron', lang: 'javascript', framework: 'node' },

  // ── Generic task runners (no language of their own) ─────────────────
  { re: /^(make|gmake|just|task|ninja) (test|tests|check|unittest|unit|integration|e2e)\b/, location: 'dungeon', framework: 'make test' },
  { re: /^(make|gmake|just|task) (lint|format|fmt|tidy|style|clang-format|clang-tidy)\b/, location: 'armory', framework: 'make lint' },
  { re: /^(make|gmake|just|task)\b/, location: 'cauldron', lang: 'cpp', framework: 'make' },
  { re: /^pre-commit\b/, location: 'armory', framework: 'pre-commit' },

  // ── Containers ──────────────────────────────────────────────────────
  { re: /^(docker|podman|nerdctl)( |-)(compose|buildx|build|run|exec|pull|push|up|start|image)\b/, location: 'cauldron', framework: 'docker' },
  { re: /^(docker|podman|nerdctl|buildah|kaniko|skaffold|tilt|helm|kubectl|minikube|kind)\b/, location: 'cauldron', framework: 'containers' },

  // ── Git: diffs are the Armory's, history the Study's ───────────────
  { re: /^git (diff|apply|add|commit|stash|restore|checkout|switch|merge|rebase|cherry-pick|reset|am|format-patch)\b/, location: 'armory', framework: 'git' },
  { re: /^(diff|patch|delta|difft)\b/, location: 'armory', framework: 'diff' },
  { re: /^(git|gh|hg|svn)\b/, location: 'study', framework: 'git' },

  // ── Reading the scrolls ─────────────────────────────────────────────
  { re: /^(cat|less|more|head|tail|ls|tree|find|fd|grep|rg|ag|ack|wc|stat|file|which|whereis|pwd|echo|printf|jq|yq|sed -n|awk|cut|sort|uniq|du|df|env|printenv|man|tldr|curl|wget|bat|exa|eza|xxd|od|readlink|realpath|basename|dirname|ps|top|lsof)\b/, location: 'study', framework: 'shell' },
]

// Wrappers that run another command: what follows them is the real one.
const WRAPPERS = [
  /^sudo( -\S+)* /,
  /^env( -\S+)*( \w+=\S*)* /,
  /^(\w+=("[^"]*"|'[^']*'|\S*) )+/,
  /^time( -p)? /,
  /^timeout( -\S+)* \S+ /,
  /^(nice|nohup|exec|command|stdbuf( -\S+)*|caffeinate|xvfb-run( -\S+)*) /,
  /^(npx|pnpx|bunx)( --?\S+)* /,
  /^(npm|pnpm|yarn) (exec|dlx)( --?\S+)* /,
  /^(uv|poetry|pipenv|pdm|hatch|rye) run( --?\S+)* /,
  /^uvx( --?\S+)* /,
  /^conda run( -n \S+| --name \S+| -p \S+)* /,
  /^bundle exec /,
  /^(dotenv|dotenvx)( --?\S+)* -- /,
  /^(cross-env)( \w+=\S*)* /,
]

/** Splits a shell line into simple commands, wrappers stripped. */
export function simpleCommands(command: string): string[] {
  return command
    .replace(/\\\n/g, ' ')
    .split(/&&|\|\||;|\||\n/)
    .map(part => {
      let s = part.trim().replace(/^[({]\s*|\s*[)}]$/g, '').trim()
      for (let i = 0; i < 6; i += 1) {
        const before = s
        for (const w of WRAPPERS) s = s.replace(w, '')
        if (s === before) break
      }
      // `python -m X` with a known runner reads as the runner itself is handled by rules.
      return s.trim()
    })
    .filter(s => s.length > 0 && !/^(cd|pushd|popd|source|\.|export|set|unset|true|false|sleep)\b/.test(s))
}

export function classifyCommand(command: string): Placement {
  let best: Placement | undefined
  let bestRank = 0
  let lang: GuildLang | undefined
  for (const cmd of simpleCommands(command)) {
    const rule = RULES.find(r => r.re.test(cmd))
    if (rule === undefined) continue
    lang ??= rule.lang
    if (RANK[rule.location] > bestRank) {
      bestRank = RANK[rule.location]
      best = { location: rule.location, lang: rule.lang, framework: rule.framework, detail: cmd }
    }
  }
  const detail = shorten(command.split('\n')[0] ?? command)
  if (best === undefined) return { location: 'cauldron', detail, framework: undefined }
  return { ...best, lang: best.lang ?? lang, detail }
}

const EXT: [RegExp, GuildLang][] = [
  [/\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|astro)$|(^|\/)(package(-lock)?\.json|tsconfig[\w.-]*\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|\.eslintrc[\w.]*|\.prettierrc[\w.]*|vite\.config\.\w+|webpack\.config\.\w+|jest\.config\.\w+)$/, 'javascript'],
  [/\.(py|pyi|pyx|ipynb)$|(^|\/)(pyproject\.toml|requirements[\w.-]*\.txt|setup\.(py|cfg)|Pipfile(\.lock)?|poetry\.lock|uv\.lock|tox\.ini|conftest\.py|pytest\.ini|\.flake8|mypy\.ini)$/, 'python'],
  [/\.(java|gradle|gradle\.kts)$|(^|\/)(pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|gradle\.properties|mvnw)$/, 'java'],
  [/\.(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|ipp|inl|tpp|cu|cuh|cmake)$|(^|\/)(CMakeLists\.txt|Makefile|makefile|meson\.build|conanfile\.(txt|py)|vcpkg\.json|BUILD(\.bazel)?|WORKSPACE|\.clang-format|\.clang-tidy)$/, 'cpp'],
  [/\.rs$|(^|\/)(Cargo\.(toml|lock)|rust-toolchain(\.toml)?|rustfmt\.toml|clippy\.toml)$/, 'rust'],
]

export function langOfPath(path: string | undefined): GuildLang | undefined {
  if (path === undefined) return undefined
  return EXT.find(([re]) => re.test(path))?.[1]
}

const STUDY_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'NotebookRead', 'LSP', 'ToolSearch', 'Skill',
  'ListMcpResourcesTool', 'ReadMcpResourceTool', 'ReadMcpResourceDirTool', 'Monitor',
])
const ARMORY_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const TAVERN_TOOLS = new Set([
  'Agent', 'Task', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskStop', 'TodoWrite',
  'AskUserQuestion', 'SendMessage', 'SendUserMessage', 'SendUserFile', 'EnterPlanMode', 'ExitPlanMode',
])

/** Places one tool call. `input` is the call's arguments as the tool takes them. */
export function classifyTool(tool: string, input: Record<string, unknown>): Placement {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = str('command') ?? ''
    return classifyCommand(command)
  }
  const path = str('file_path') ?? str('notebook_path') ?? str('path')
  const lang = langOfPath(path)
  if (ARMORY_TOOLS.has(tool)) {
    return { location: 'armory', lang, detail: shortPath(path) ?? tool, framework: tool }
  }
  if (STUDY_TOOLS.has(tool) || tool.startsWith('mcp__')) {
    const what = shortPath(path) ?? str('pattern') ?? str('query') ?? str('url') ?? str('skill') ?? tool
    return { location: 'study', lang, detail: shorten(what), framework: tool }
  }
  if (tool === 'TaskUpdate') {
    const status = str('status')?.replace('_', ' ')
    return { location: 'tavern', detail: `quest #${str('taskId') ?? '?'} ${status ?? 'updated'}`, framework: tool }
  }
  if (TAVERN_TOOLS.has(tool)) {
    const what = str('description') ?? str('subject') ?? str('question') ?? tool
    return { location: 'tavern', detail: shorten(what), framework: tool }
  }
  return { location: 'tavern', lang, detail: tool, framework: tool }
}

// ── Reading the battle report: test counts from the five toolchains ──

export type Battle = { failed: number; passed: number; framework?: string }

const sum = (text: string, re: RegExp, group: number) =>
  [...text.matchAll(re)].reduce((n, m) => n + Number(m[group] ?? 0), 0)

/** Reads failed/passed counts from a test run's output, or undefined when none are found. */
export function readBattle(text: string): Battle | undefined {
  const t = text.replace(/\x1b\[[0-9;]*m/g, '')
  let m: RegExpMatchArray | null

  // cargo test: one "test result:" per test binary; add them up.
  if (/test result: (ok|FAILED)\./.test(t)) {
    return {
      passed: sum(t, /test result: \w+\. (\d+) passed/g, 1),
      failed: sum(t, /test result: \w+\. \d+ passed; (\d+) failed/g, 1),
      framework: 'cargo test',
    }
  }
  // cargo nextest: "Summary [...] 10 tests run: 8 passed, 2 failed"
  if ((m = t.match(/(\d+) tests? run: (\d+) passed(?:[^,\n]*)?(?:, (\d+) failed)?/))) {
    return { passed: Number(m[2]), failed: Number(m[3] ?? 0), framework: 'nextest' }
  }
  // Maven Surefire: the last "Tests run: N, Failures: F, Errors: E, Skipped: S"
  const surefire = [...t.matchAll(/Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/g)].pop()
  if (surefire) {
    const [run, fail, err, skip] = surefire.slice(1, 5).map(Number) as [number, number, number, number]
    return { failed: fail + err, passed: Math.max(0, run - fail - err - skip), framework: 'maven' }
  }
  // Gradle: "5 tests completed, 2 failed"
  if ((m = t.match(/(\d+) tests? completed, (\d+) failed/))) {
    return { failed: Number(m[2]), passed: Number(m[1]) - Number(m[2]), framework: 'gradle' }
  }
  // CTest: "75% tests passed, 2 tests failed out of 8"
  if ((m = t.match(/\d+% tests passed, (\d+) tests? failed out of (\d+)/))) {
    return { failed: Number(m[1]), passed: Number(m[2]) - Number(m[1]), framework: 'ctest' }
  }
  // GoogleTest: "[  PASSED  ] 5 tests." / "[  FAILED  ] 2 tests, listed below:"
  if (/\[\s+(PASSED|FAILED)\s+\] \d+ tests?/.test(t)) {
    const p = t.match(/\[\s+PASSED\s+\] (\d+) tests?/)
    const f = t.match(/\[\s+FAILED\s+\] (\d+) tests?,/)
    return { passed: Number(p?.[1] ?? 0), failed: Number(f?.[1] ?? 0), framework: 'googletest' }
  }
  // Catch2: "test cases: 10 | 8 passed | 2 failed"
  if ((m = t.match(/test cases:\s+(\d+) \|\s+(\d+) passed(?: \|\s+(\d+) failed)?/))) {
    return { passed: Number(m[2]), failed: Number(m[3] ?? 0), framework: 'catch2' }
  }
  if (/All tests passed \(\d+ assertions? in (\d+) test cases?\)/.test(t)) {
    const c = t.match(/in (\d+) test cases?/)
    return { passed: Number(c?.[1] ?? 0), failed: 0, framework: 'catch2' }
  }
  // Python unittest: "Ran 5 tests" + "FAILED (failures=2, errors=1)" or "OK"
  if ((m = t.match(/Ran (\d+) tests? in/))) {
    const ran = Number(m[1])
    const failures = Number(t.match(/failures=(\d+)/)?.[1] ?? 0) + Number(t.match(/errors=(\d+)/)?.[1] ?? 0)
    return { failed: failures, passed: ran - failures, framework: 'unittest' }
  }
  // Mocha: "4 passing", "2 failing"
  if (/\d+ passing \(/.test(t)) {
    return {
      passed: Number(t.match(/(\d+) passing/)?.[1] ?? 0),
      failed: Number(t.match(/(\d+) failing/)?.[1] ?? 0),
      framework: 'mocha',
    }
  }
  // Jest: "Tests:       1 failed, 4 passed, 5 total"; Vitest: "Tests  1 failed | 4 passed (5)"
  if ((m = t.match(/Tests:?\s+((?:\d+ \w+(?:,|\s\|)?\s*)+)(?:\(\d+\)|\d+ total)/))) {
    const part = m[1] ?? ''
    return {
      failed: Number(part.match(/(\d+) failed/)?.[1] ?? 0),
      passed: Number(part.match(/(\d+) passed/)?.[1] ?? 0),
      framework: /\|/.test(part) ? 'vitest' : 'jest',
    }
  }
  // pytest: "==== 2 failed, 5 passed, 1 error in 0.31s ===="
  if ((m = t.match(/=+ (.*\b(?:passed|failed|errors?)\b.*) in [\d.]+s/))) {
    const line = m[1] ?? ''
    return {
      failed: Number(line.match(/(\d+) failed/)?.[1] ?? 0) + Number(line.match(/(\d+) errors?/)?.[1] ?? 0),
      passed: Number(line.match(/(\d+) passed/)?.[1] ?? 0),
      framework: 'pytest',
    }
  }
  // Node test runner / TAP: "# pass 5" "# fail 1"
  if (/^# (pass|fail) \d+/m.test(t)) {
    return {
      passed: Number(t.match(/^# pass (\d+)/m)?.[1] ?? 0),
      failed: Number(t.match(/^# fail (\d+)/m)?.[1] ?? 0),
      framework: 'node:test',
    }
  }
  return undefined
}

function shorten(s: string, max = 60): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function shortPath(path: string | undefined): string | undefined {
  if (path === undefined) return undefined
  const parts = path.split('/').filter(Boolean)
  return shorten(parts.slice(-2).join('/'))
}
