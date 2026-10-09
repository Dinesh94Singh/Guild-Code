import { describe, expect, test } from 'claude-code/testing'

import { classifyCommand, classifyTool, langOfPath, readBattle } from '../hooks/classify'

type Case = [command: string, location: string, lang?: string]

const CASES: Record<string, Case[]> = {
  javascript: [
    ['npm test', 'dungeon', 'javascript'],
    ['npm run test:unit -- --watch=false', 'dungeon', 'javascript'],
    ['pnpm vitest run src/', 'dungeon', 'javascript'],
    ['npx jest --runInBand', 'dungeon', 'javascript'],
    ['npx playwright test', 'dungeon', 'javascript'],
    ['node --test', 'dungeon', 'javascript'],
    ['bun test', 'dungeon', 'javascript'],
    ['yarn mocha', 'dungeon', 'javascript'],
    ['npx eslint . --fix', 'armory', 'javascript'],
    ['npx prettier --write src', 'armory', 'javascript'],
    ['npm run lint', 'armory', 'javascript'],
    ['npx tsc --noEmit', 'armory', 'javascript'],
    ['npx biome check .', 'armory', 'javascript'],
    ['npm run build', 'cauldron', 'javascript'],
    ['npm ci', 'cauldron', 'javascript'],
    ['npx vite build', 'cauldron', 'javascript'],
    ['pnpm install', 'cauldron', 'javascript'],
    ['npx webpack --mode production', 'cauldron', 'javascript'],
  ],
  python: [
    ['pytest -x tests/', 'dungeon', 'python'],
    ['python -m pytest -q', 'dungeon', 'python'],
    ['uv run pytest', 'dungeon', 'python'],
    ['poetry run pytest tests/unit', 'dungeon', 'python'],
    ['python3 -m unittest discover', 'dungeon', 'python'],
    ['python manage.py test', 'dungeon', 'python'],
    ['tox', 'dungeon', 'python'],
    ['tox -e lint', 'armory', 'python'],
    ['ruff check --fix .', 'armory', 'python'],
    ['black src', 'armory', 'python'],
    ['mypy src', 'armory', 'python'],
    ['python -m flake8', 'armory', 'python'],
    ['pip install -r requirements.txt', 'cauldron', 'python'],
    ['uv sync', 'cauldron', 'python'],
    ['poetry build', 'cauldron', 'python'],
    ['python -m build', 'cauldron', 'python'],
    ['python app.py', 'cauldron', 'python'],
  ],
  java: [
    ['mvn test', 'dungeon', 'java'],
    ['./mvnw -q verify', 'dungeon', 'java'],
    ['mvn -Dtest=UserServiceTest test', 'dungeon', 'java'],
    ['./gradlew test', 'dungeon', 'java'],
    ['./gradlew :core:test --tests "*Foo*"', 'dungeon', 'java'],
    ['gradle check', 'dungeon', 'java'],
    ['mvn spotless:apply', 'armory', 'java'],
    ['mvn checkstyle:check', 'armory', 'java'],
    ['./gradlew spotlessApply', 'armory', 'java'],
    ['mvn clean package -DskipTests', 'cauldron', 'java'],
    ['./gradlew build', 'cauldron', 'java'],
    ['javac -d out src/Main.java', 'cauldron', 'java'],
    ['java -jar target/app.jar', 'cauldron', 'java'],
  ],
  cpp: [
    ['ctest --output-on-failure', 'dungeon', 'cpp'],
    ['cd build && ctest -j8', 'dungeon', 'cpp'],
    ['cmake --build build --target test', 'dungeon', 'cpp'],
    ['./build/unit_tests', 'dungeon', 'cpp'],
    ['./build/parser_test --gtest_filter=Parser.*', 'dungeon', 'cpp'],
    ['bazel test //...', 'dungeon', 'cpp'],
    ['meson test -C builddir', 'dungeon', 'cpp'],
    ['make test', 'dungeon'],
    ['clang-format -i src/*.cpp', 'armory', 'cpp'],
    ['clang-tidy src/main.cpp -- -std=c++20', 'armory', 'cpp'],
    ['cppcheck --enable=all src', 'armory', 'cpp'],
    ['cmake -S . -B build -G Ninja', 'cauldron', 'cpp'],
    ['cmake --build build -j', 'cauldron', 'cpp'],
    ['make -j8', 'cauldron', 'cpp'],
    ['g++ -O2 -std=c++20 main.cpp -o app', 'cauldron', 'cpp'],
    ['clang++ -c foo.cc', 'cauldron', 'cpp'],
  ],
  rust: [
    ['cargo test', 'dungeon', 'rust'],
    ['cargo test --workspace -- --nocapture', 'dungeon', 'rust'],
    ['cargo nextest run', 'dungeon', 'rust'],
    ['cargo +nightly miri test', 'dungeon', 'rust'],
    ['cargo fmt --all', 'armory', 'rust'],
    ['cargo clippy -- -D warnings', 'armory', 'rust'],
    ['cargo check', 'armory', 'rust'],
    ['cargo build --release', 'cauldron', 'rust'],
    ['cargo run -- --help', 'cauldron', 'rust'],
    ['wasm-pack build', 'cauldron', 'rust'],
  ],
  other: [
    ['docker build -t app .', 'cauldron'],
    ['docker compose up -d', 'cauldron'],
    ['git diff HEAD~1', 'armory'],
    ['git log --oneline -5', 'study'],
    ['ls -la src', 'study'],
    ['rg "TODO" src', 'study'],
  ],
}

describe('classifyCommand places every V1 toolchain', () => {
  for (const [group, cases] of Object.entries(CASES)) {
    test(group, () => {
      for (const [command, location, lang] of cases) {
        const got = classifyCommand(command)
        expect({ command, location: got.location }).toEqual({ command, location })
        if (lang !== undefined) expect({ command, lang: got.lang }).toEqual({ command, lang })
      }
    })
  }

  test('a compound command goes to its most dangerous room', () => {
    expect(classifyCommand('cargo build && cargo test').location).toBe('dungeon')
    expect(classifyCommand('npm ci && npm run lint').location).toBe('armory')
    expect(classifyCommand('pytest 2>&1 | tail -20').location).toBe('dungeon')
    expect(classifyCommand('CI=1 FOO=bar npm test').location).toBe('dungeon')
  })
})

test('tools without a shell map to their rooms with a language', () => {
  expect(classifyTool('Read', { file_path: '/repo/src/lib.rs' })).toMatchObject({ location: 'study', lang: 'rust' })
  expect(classifyTool('Grep', { pattern: 'fn main' }).location).toBe('study')
  expect(classifyTool('Edit', { file_path: '/repo/app/Main.java' })).toMatchObject({ location: 'armory', lang: 'java' })
  expect(classifyTool('Write', { file_path: '/repo/x.py' })).toMatchObject({ location: 'armory', lang: 'python' })
  expect(classifyTool('Agent', { description: 'Find flaky tests' })).toMatchObject({ location: 'tavern', detail: 'Find flaky tests' })
  expect(classifyTool('TaskCreate', { subject: 'Fix login' }).location).toBe('tavern')
  expect(classifyTool('TaskUpdate', { taskId: '2', status: 'completed' })).toMatchObject({ location: 'tavern', detail: 'quest #2 completed' })
})

test('languages from paths', () => {
  expect(langOfPath('src/App.tsx')).toBe('javascript')
  expect(langOfPath('pyproject.toml')).toBe('python')
  expect(langOfPath('build.gradle.kts')).toBe('java')
  expect(langOfPath('include/foo.hpp')).toBe('cpp')
  expect(langOfPath('CMakeLists.txt')).toBe('cpp')
  expect(langOfPath('Cargo.toml')).toBe('rust')
  expect(langOfPath('README.md')).toBe(undefined)
})

describe('readBattle reads test reports', () => {
  test('cargo, summed over binaries', () => {
    const out = 'test result: ok. 3 passed; 0 failed; 0 ignored\n\ntest result: FAILED. 4 passed; 2 failed; 0 ignored'
    expect(readBattle(out)).toMatchObject({ passed: 7, failed: 2 })
  })
  test('nextest', () => {
    expect(readBattle('     Summary [   0.2s] 10 tests run: 8 passed, 2 failed, 0 skipped')).toMatchObject({ passed: 8, failed: 2 })
  })
  test('maven surefire', () => {
    expect(readBattle('[ERROR] Tests run: 10, Failures: 1, Errors: 1, Skipped: 2')).toMatchObject({ passed: 6, failed: 2 })
  })
  test('gradle', () => {
    expect(readBattle('5 tests completed, 2 failed')).toMatchObject({ passed: 3, failed: 2 })
  })
  test('ctest', () => {
    expect(readBattle('75% tests passed, 2 tests failed out of 8')).toMatchObject({ passed: 6, failed: 2 })
  })
  test('googletest', () => {
    expect(readBattle('[  PASSED  ] 5 tests.\n[  FAILED  ] 2 tests, listed below:')).toMatchObject({ passed: 5, failed: 2 })
  })
  test('pytest', () => {
    expect(readBattle('===== 2 failed, 5 passed, 1 error in 0.31s =====')).toMatchObject({ passed: 5, failed: 3 })
    expect(readBattle('============ 12 passed in 1.02s ============')).toMatchObject({ passed: 12, failed: 0 })
  })
  test('unittest', () => {
    expect(readBattle('Ran 5 tests in 0.002s\n\nFAILED (failures=2)')).toMatchObject({ passed: 3, failed: 2 })
  })
  test('jest and vitest', () => {
    expect(readBattle('Tests:       1 failed, 4 passed, 5 total')).toMatchObject({ passed: 4, failed: 1 })
    expect(readBattle(' Tests  1 failed | 4 passed (5)')).toMatchObject({ passed: 4, failed: 1 })
  })
  test('mocha', () => {
    expect(readBattle('  4 passing (12ms)\n  2 failing')).toMatchObject({ passed: 4, failed: 2 })
  })
  test('no report', () => {
    expect(readBattle('compiling...')).toBe(undefined)
  })
})
