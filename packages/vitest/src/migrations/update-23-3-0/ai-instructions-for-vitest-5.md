# Vitest 5 migration

The deterministic pre-pass already handled the mechanical parts: removed deep
entry points were repointed where a plain import or export declaration reached
them, `.vitest` was added to `.gitignore`, and `vite` was declared in
`package.json` if the workspace had been relying on Vitest 4 pulling it in.

Anything it could not decide for itself is in the context it passed you. Work
through that list first, then run the tests.

Most of what is left is runtime behavior. Do not try to find it by reading every
test file. Run the test suites, then work through the failures with the list
below, which covers the changes that produce confusing failures.

## Run the tests first

```bash
nx run-many -t test
```

## What the failures probably mean

**Mocks look empty.** `clearMocks` now defaults to `true`, so `mock.calls`,
`mock.instances`, `mock.contexts` and `mock.results` reset before every test. A
test that asserts on calls recorded by an earlier test now sees nothing. Fix the
test, or set `clearMocks: false` in the config to keep the old behavior.

**"Cannot call vi.mock inside ...".** `vi.mock`, `vi.unmock` and `vi.hoisted`
now throw when called outside the module top level. In v4 this only warned. Move
the call to the top level, or switch to `vi.doMock`.

**A test fails that used to pass silently.** An unawaited `resolves`, `rejects`
or `toMatchFileSnapshot` now fails the test instead of being ignored. Add the
missing `await`.

**`expect.poll` times out.** It now fails when the callback does not settle
within `timeout`, rather than hanging on the last value.

**A `toThrow('')` assertion changed meaning.** An empty string now matches any
message. Use `/^$/` to assert on an empty message.

**Snapshot names moved.** String values interpolated through `$` in
`test.for`/`test.each` titles are no longer wrapped in quotes, and truncation is
now controlled by `taskTitleValueFormatTruncate` (default 40).

**A CI filter matches nothing.** `-t` and `testNamePattern` now join name
segments with `' > '` instead of a space.

**Per-worker resources collide.** `VITEST_POOL_ID` and `VITEST_WORKER_ID` are
now 1-based. Any logic deriving a database name, port or directory from them
shifts by one.

**Vitest cannot find a config.** It no longer searches ancestor directories.
Pass `--config` explicitly, or give the directory its own config.

**Projects behave differently.** Inline projects now default to `extends: true`
and share the root Vite server (`sharedViteServer`). Set either to `false` if a
project needs its own resolution.

## Check these without running anything

- `sequential`, if the pre-pass flagged any. `test.sequential()` and
  `describe.sequential()` are gone. When nothing makes the test concurrent, drop
  the modifier: `test.sequential('a', ...)` becomes `test('a', ...)`. When it was
  opting out of a concurrent suite or a concurrent setting in the config, it
  becomes the `{ concurrent: false }` option. The same applies to a `sequential`
  entry in a test's options object.
- `vitest/environments` imports, if the pre-pass flagged any: `builtinEnvironments`
  and `populateGlobal` moved to `vitest/runtime`, the `VitestEnvironment` type to
  `vitest/node`.
- `@vitest/runner` and `@vitest/ws-client` in `package.json`: neither is published
  for v5. Their exports are in `vitest/runtime`.
- Benchmarks: the module-level `bench()` API is gone, along with
  `benchmark.reporters`, `benchmark.outputFile`, `benchmark.compare` and the
  `--compare` CLI flag. `bench` now comes off the test context.
- `coverage.thresholds` under a glob no longer inherits the top-level `perFile`.
  Set it on each glob that needs it.
- Browser mode, if the workspace configures it by hand: locators are strict by
  default, `toHaveTextContent` no longer accepts a RegExp (`toMatchTextContent`
  does), browser commands receive a locator object rather than a selector string,
  automocked modules return `undefined`, and `browser.api` moved to top-level
  `api`.

The full list is at https://vitest.dev/guide/migration.
