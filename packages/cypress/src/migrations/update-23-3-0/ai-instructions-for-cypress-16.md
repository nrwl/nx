# Cypress 15 -> 16 Migration Instructions for LLM

## Overview

Migrate the workspace's Cypress projects from Cypress 15 to 16. Cypress 16 removed `Cypress.env()`, `cy.exec()` and `.end()`, stopped accepting `env` overrides in test configuration, turned the cookie and storage getters into queries, renamed or removed several config options, dropped CoffeeScript support, and requires Node 22, Vite 8 (Vite component testing), Angular 21 (Angular component testing) and Next.js 15.0.4 (component testing on Cypress's `next` dev server framework, which the Nx preset does not use). Chrome, Chromium and Edge now use the native browser network, which changes a few `cy.intercept()` details. Deterministic migrations already handled the config options in the Cypress config files, the `cypress/angular-zoneless` import and the `Cypress.Commands.overwrite()` renames; verify those, do not redo them. Config options held in another file reach the config through a spread and are handled in Step 9. This runbook covers the remaining source changes. Do not change Nx target configuration, the `nxE2EPreset` / `nxComponentTestingPreset` calls, or `webServerCommands`; those keep working on Cypress 16.

## Pre-Migration Checklist

1. Confirm `cypress` in `package.json` resolves to 16 or later. If it does not, make no changes and stop.
2. Confirm Node is 22, 24, or 26+ (`node -v`). Cypress 16 declares `engines` `^22.0.0 || ^24.0.0 || >=26.0.0` and refuses to install on Node 20 or 25.
3. List the Cypress projects: every project with a `cypress.config.{ts,js,mjs,cjs}` file. Search their spec and support files for the strings in the steps below.
4. Review `<advisory_context>` from the deterministic migrations: each entry (a non-literal `experimentalFastVisibility`, a removed `execTimeout`, a removed `experimentalSourceRewriting: true`, an unresolved spread, a renamed `overwriteQuery` callback) is pending work for the matching step.

## Step 1: Replace `Cypress.env()`

`Cypress.env()` throws in Cypress 16 and its typings are gone. Values now come from two sources:

- `cy.env([...keys])` reads `env` values (from `cypress.env.json`, `CYPRESS_*` variables, `--env`, the `env` config key and the `env` executor option). It is asynchronous, read-only, and yields an object with only the requested keys.
- `Cypress.expose(key)` reads `expose` values synchronously. `expose` is for non-sensitive values set through the `expose` config key, the `--expose` CLI flag, `Cypress.expose(key, value)` at runtime, or the `expose` test configuration.

Classify each value: sensitive values (keys, tokens, passwords, credentials) stay in `env` and are read with `cy.env()`; public values (feature flags, API versions, public URLs) can move to `expose` and be read with `Cypress.expose()`. Reading a value inside a `cy.origin()` callback follows the same rule.

**Before:**

```ts
const apiUrl = Cypress.env('API_URL');
cy.request(`${apiUrl}/health`);
```

**After:**

```ts
cy.env(['API_URL']).then(({ API_URL }) => {
  cy.request(`${API_URL}/health`);
});
```

Do not assert on the object `cy.env()` yields with `.should()`; the assertion prints the value in the command log. Derive a boolean and assert on that instead.

A `Cypress.env()` call outside a test body (a top-level constant in a support file, a `Cypress.env('x', value)` write) needs restructuring: read it inside `before()`/`beforeEach()` with `cy.env()` and store the result on an alias, move the value to `expose` and read it with `Cypress.expose()`, or for runtime writes store the value through a `cy.task()` registered in `setupNodeEvents`.

Plugins that call `Cypress.env()` throw on Cypress 16. Update them to the versions that use the new API: `@cypress/code-coverage` 4, `@cypress/grep` 6, `@badeball/cypress-cucumber-preprocessor` 27 (options move from `--env` to `--expose`), and the community plugins listed in the Cypress guide (https://docs.cypress.io/app/references/migration-guide#Migrate-plugins-that-use-Cypressenv). Move each plugin's options from `env` to `expose` as its changelog says.

## Step 2: Remove `env` overrides in test configuration

`env` can no longer be set in the `it`/`describe` configuration object; Cypress 16 fails the test. Move the values to `expose` and read them with `Cypress.expose()`. Apply the Step 1 classification first: a sensitive value (a key, token, password or credential) must not move to `expose`, which is for non-sensitive values; keep it in `env` (`cypress.env.json`, `CYPRESS_*` or `--env`) and read it with `cy.env()` inside the test.

**Before:**

```ts
it('uses the sandbox account', { env: { ACCOUNT: 'sandbox' } }, () => {
  cy.visit(`/accounts/${Cypress.env('ACCOUNT')}`);
});
```

**After:**

```ts
it('uses the sandbox account', { expose: { ACCOUNT: 'sandbox' } }, () => {
  cy.visit(`/accounts/${Cypress.expose('ACCOUNT')}`);
});
```

## Step 3: Replace `cy.exec()` with `cy.task()`

`cy.exec()` throws in Cypress 16. Run the command from a `task` registered in `setupNodeEvents` and call it with `cy.task()`. A task returns a value or `null` and times out after 60 seconds; set `taskTimeout` when a former `execTimeout` was higher. Spawn external programs with `execFileSync` and an argument array so no shell is involved. Register one task per command; never a generic task that runs a command string the spec passes in. Values the spec used to template into the command (an id, a file name) travel as task arguments and become entries of the `execFileSync` argument array. A Cypress config that uses `nxE2EPreset` must keep calling the preset's `setupNodeEvents` (see the Nx notes below).

**Before:**

```ts
cy.exec('npm run db:seed');
```

**After:**

```ts
// cypress.config.ts
import { execFileSync } from 'node:child_process';

const preset = nxE2EPreset(import.meta.url, { cypressDir: 'src' });

export default defineConfig({
  e2e: {
    ...preset,
    async setupNodeEvents(on, config) {
      on('task', {
        seedDb() {
          execFileSync('npm', ['run', 'db:seed'], { stdio: 'inherit' });
          return null;
        },
      });
      return preset.setupNodeEvents(on, config);
    },
  },
});

// spec
cy.task('seedDb');
```

## Step 4: Remove `.end()`

`.end()` throws in Cypress 16. Delete the call; the next `cy.*` command already starts a new chain.

**Before:**

```ts
cy.get('[data-test=list]').find('li').should('have.length', 3).end();
```

**After:**

```ts
cy.get('[data-test=list]').find('li').should('have.length', 3);
```

## Step 5: Move runtime `Cypress.config()` writes to test configuration

`blockHosts`, `viewportWidth` and `viewportHeight` can no longer be set with `Cypress.config()` while a test runs; Cypress 16 throws. Set them in the `describe`/`it` configuration object, or use `cy.viewport()` for the viewport. Calls at the top level of a spec or support file are unchanged.

**Before:**

```ts
it('renders on mobile', () => {
  Cypress.config('viewportWidth', 375);
  cy.visit('/');
});
```

**After:**

```ts
it('renders on mobile', { viewportWidth: 375 }, () => {
  cy.visit('/');
});
```

## Step 6: Adapt cookie and storage reads to queries

`cy.getCookie()`, `cy.getCookies()`, `cy.getAllCookies()`, `cy.getAllLocalStorage()` and `cy.getAllSessionStorage()` are queries: they retry assertions chained with `.should()` and follow `defaultCommandTimeout` (4000ms) instead of `responseTimeout` (30000ms). A `.then()` callback still runs once and does not retry. Change nothing unless a test fails; then move the assertion from `.then()` onto `.should()` so it retries, or pass `{ timeout }` when a cookie read needs longer than 4 seconds.

The deterministic migration renamed `Cypress.Commands.overwrite()` to `overwriteQuery()` for those five names; `<advisory_context>` lists each renamed call. Do not re-apply the rename. Adapt each renamed callback to the query contract: `overwriteQuery` calls the callback with the command as `this`, the original query function as the first argument, and then the arguments the test passed, and the callback must return a function that takes the subject. Cypress calls that returned function, possibly many times while retrying, to compute the result. It must not return a chainable, call `cy.*` commands or use `.then()`. The original query reads `this` as well, so every callback must be a `function` expression that calls `originalFn.call(this, ...)`. An arrow callback, or a plain `originalFn(...)` call, fails to typecheck (TS2684, `QueryFnWithOriginalFn` declares `this: Command`) and throws at runtime. Convert arrow callbacks even when they only forward their arguments:

**Before:**

```ts
Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

**After:**

```ts
Cypress.Commands.overwriteQuery(
  'getCookie',
  function (originalFn, name, options) {
    return originalFn.call(this, name, { ...options, log: false });
  }
);
```

Rewrite callbacks that post-process the result. Get the inner function from `originalFn`, then return a function that calls it with the subject and transforms the value:

**Before:**

```ts
Cypress.Commands.overwriteQuery('getCookies', (originalFn, options) => {
  return originalFn(options).then((cookies) =>
    cookies.filter((cookie) => cookie.name.startsWith('app.'))
  );
});
```

**After:**

```ts
Cypress.Commands.overwriteQuery('getCookies', function (originalFn, options) {
  const innerFn = originalFn.call(this, options);
  return (subject) =>
    innerFn(subject).filter((cookie) => cookie.name.startsWith('app.'));
});
```

Callbacks that call other `cy.*` commands, use `cy.wrap()`, or run asynchronous work cannot become queries. Move that logic into a separate custom command added with `Cypress.Commands.add()` and update the specs that relied on the overwritten behavior.

## Step 7: Review behavior changes that need no code by default

Flag these, and change code only when a test fails:

- Native browser network in Chrome, Chromium and Edge: `cy.intercept()` no longer reports `req.httpVersion`, request `content-length` or response `content-encoding`; revalidated responses report `200` instead of `304`; `responseTimeout` does not bound response handlers (use a `timeout` on `cy.wait()`); the browser validates the application's own TLS certificate. Rewrite affected assertions to describe the application rather than the transport. Do not set `forceHttp1: true` to make a suite pass; it is deprecated at introduction.
- `visibilityStrategy` defaults to `'modern'`: assertions that relied on legacy-only visibility semantics (ancestor `overflow` clipping, transform-based hiding, coverage of fixed elements) may change. Rewrite them; keep `visibilityStrategy: 'legacy'` only as a temporary aid.
- `keystrokeDelay` defaults to `0` instead of `10`. A test that depended on the implicit delay can restore it with `keystrokeDelay: 10` in the Cypress config, `Cypress.Keyboard.defaults({ keystrokeDelay: 10 })`, or `{ delay: 10 }` on the `.type()` call.
- `manageBrowserMemory` defaults to `true`. The deterministic migration turned `experimentalMemoryManagement: false` into `manageBrowserMemory: false` in the config file, so an opt-out there survives; one held in another file is handled in Step 9.
- `experimentalSourceRewriting` is gone. Only an application that pins resources with Subresource Integrity needs `removeSRIAttributes: true` in its place.
- CoffeeScript is no longer compiled. Convert `.coffee` specs, support files and fixtures to JavaScript or TypeScript.

## Step 8: Component testing

- Angular: `cypress/angular` mounts with zoneless change detection on Cypress 16, for zone-based apps too. A template no longer re-renders after a plain property mutation on the component instance, so state that tests assert on in the DOM must be signal-based. The `autoSpyOutputs` and `autoDetectChanges` mount options no longer exist: remove `autoDetectChanges`, and replace `autoSpyOutputs: true` with explicit spies passed through `componentProperties` (for example `{ saved: createOutputSpy('savedSpy') }`). Cypress officially supports Angular 21 and later; Angular 20 runs with a warning. The harness bootstraps through `@angular/platform-browser/testing`, so `@angular/platform-browser-dynamic` can be uninstalled when nothing else imports it. The deprecated `@cypress/angular-zoneless` npm package was removed and its imports rewritten to `cypress/angular` by the deterministic migration; remove any leftover reference to it.
- Vite: Cypress 16 component testing runs on Vite 8 only, and `@cypress/vite-dev-server` 8 declares it as a peer. The deterministic migration kept the workspace on Cypress 15 only when a Vite component testing config, or a config whose bundler could not be determined statically, resolved an installed Vite below 8. It cannot see a `vite` that is declared but not installed. It also does not check a Cypress config with a custom name that no `@nx/cypress:cypress` target references, such as one run through `nx:run-commands`. Bump any `vite` below 8 in the root or a project `package.json`, and any `@vitejs/*` plugin that still pins an older major. A Vite component testing config the migration did not check must resolve Vite 8 from its directory.
- Next.js: Cypress's `next` dev server framework requires Next.js 15.0.4 or later. The `@nx/next/plugins/component-testing` preset runs the `react` framework over a webpack config Nx builds, so a Cypress config on that preset does not use the dropped adapter. Only a hand-written config with `devServer: { framework: 'next' }` needs the Next.js bump.
- Electron: the bundled Electron browser is deprecated. Cypress prints a warning; set `defaultBrowser: 'chrome'` (or another installed browser) in the Cypress config, or pass `--browser`, when the warning matters in CI.

## Step 9: Migrate config options held outside the config file

The deterministic migration rewrote `experimentalMemoryManagement`, `experimentalFastVisibility`, `experimentalSourceRewriting`, `allowCypressEnv` and `execTimeout` in each `cypress.config.{ts,js,mjs,cjs}` file, including objects of the same file spread into the config. It cannot follow a spread of an import or a function call. For each spread of that kind in a Cypress config, other than `nxE2EPreset(...)` and `nxComponentTestingPreset(...)`, open the source of the spread object and apply the same changes there: rename `experimentalMemoryManagement` to `manageBrowserMemory` with the same value, replace `experimentalFastVisibility: true` with `visibilityStrategy: 'modern'` and `false` with `visibilityStrategy: 'legacy'`, and delete the three removed options. Search the workspace for the five option names to catch objects the config reaches through more than one file.

## Post-Migration Validation

1. Run typecheck on the Cypress projects (`npx nx run-many -t typecheck -p <projects>` or `npx tsc -p <project>/tsconfig.json --noEmit`). Removed APIs surface as type errors first.
2. Run `npx cypress verify` to confirm the Cypress 16 binary is installed.
3. Run the Cypress projects: `npx nx run-many -t e2e,component-test -p <projects>`. The run must start without removed-option warnings.
4. Fix failures caused by this migration and re-run until green.

## Nx-Specific Notes

- Keep `nxE2EPreset` and `nxComponentTestingPreset` in place. The preset reads `webServerCommands` through Cypress `env` in `setupNodeEvents`, which Nx still passes with `--env`; do not move those values to `expose`.
- When adding `setupNodeEvents` to a config that spreads `nxE2EPreset(...)`, call the preset's `setupNodeEvents` from yours and return its result (see https://nx.dev/docs/kb/cypress-setup-node-events).
- The `env` option of the `@nx/cypress:cypress` executor and `--env` in inferred targets keep working; only how specs read the values changed.
