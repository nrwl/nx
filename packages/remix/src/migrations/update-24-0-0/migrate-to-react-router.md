# Migrate Remix v2 to React Router v8

Migrate this workspace's Remix v2 applications to React Router v8 framework mode with `@nx/react`. Finish the application and Nx configuration changes, then validate the result. Do not replace an existing application with a generated starter.

Nx 24 removes `@nx/remix` executors and all generators except `convert-to-inferred`. A separate automatic migration converts legacy executors to `@nx/remix/plugin` inference without upgrading Remix. That inference plugin and the remaining helpers are deprecated for removal in Nx 25. This prompt performs the framework upgrade; users can defer it and keep Remix v2 on Nx 24.

## Read the upstream migration guides

Use the official guides as the source of framework migration details:

- [Remix v2 to React Router v7](https://reactrouter.com/7.18.4/upgrading/remix), including its linked codemod and Remix future flags.
- [React Router v7 to v8](https://reactrouter.com/upgrading/v7), including its runtime requirements and future flags.
- [React Router framework documentation](https://reactrouter.com/start/framework/installation) for routing, type generation, rendering, and deployment.
- [Nx React Router integration](https://nx.dev/docs/kb/react-router).
- For classic Remix compiler applications, first follow the [Remix Vite migration guide](https://v2.remix.run/docs/guides/vite/).

Read the resources rather than guessing changed APIs. Follow relevant links for the application's deployment adapter, custom server, or other features. Use the staged Remix v2 -> React Router v7 -> React Router v8 path where required. Keep React Router packages on compatible versions and check the installed `@nx/react` integration against the selected version. Do not claim completion if compatibility blocks the upgrade.

## Inspect the workspace

1. Determine the package manager, Nx version, and installed framework versions from the workspace manifests and lockfile. Keep Nx packages on the same version.
2. Find every Remix app and shared library importing `@remix-run/*`. Inspect `remix.config.*`, `vite.config.*`, application entry points, route conventions, and TypeScript configuration. Distinguish classic compiler, Vite, SPA, and server-rendered applications.
3. Inspect each project's resolved Nx targets with `nx show project <name> --json`, plus `nx.json`, project manifests, and CI commands. Record existing target names, dependencies, output paths, and plugin include/exclude rules.
4. Inspect loaders/actions, resource routes, sessions, error boundaries, and custom server or deployment adapter code. Preserve the application's routing and rendering behavior while following the upstream migration steps.

## Upgrade the applications

- Adopt required future flags and fix affected code using the upstream guides. Check Node and React prerequisites before updating dependencies.
- Use upstream codemods where appropriate, then inspect their changes. Update dependencies, imports, package scripts, and the lockfile using the workspace's package manager. Check shared libraries and tests as well as app source files.
- Replace the Remix Vite plugin with the React Router plugin. Create `react-router.config.*` and the route configuration, retaining the existing route URLs and conventions. Keep Nx aliases and workspace-library support in the Vite configuration.
- Update client/server entry points, runtime APIs, and types as directed by the guides. Configure React Router type generation and TypeScript includes. Adapt tests using Remix testing utilities.
- Update custom servers, adapters, and deployment commands when present. Follow their upstream resources. Check SPA/SSR settings, static assets, environment variables, and build output locations against the actual app.

## Finish the Nx integration

1. Install the matching version of `@nx/react` if needed. Register `@nx/react/router-plugin` in `nx.json` and ensure each migrated app has a recognized `react-router.config.*` beside its project manifest.
2. Map existing build/dev/start/typecheck target names to the React Router plugin options. Preserve CI references and task dependencies, or update their callers together. Do not blindly rename a `serve` target used by CI or e2e tests.
3. Inspect resolved targets again. Remove obsolete `@nx/remix:*` executor references and commands invoking the Remix CLI. Review explicit overrides and `targetDefaults`, including entries filtered by `@nx/remix/plugin`, so they do not override the new inferred commands or point at old outputs.
4. Check caching inputs and outputs against the React Router build directory. Update e2e server targets, Dockerfiles, deployment scripts, and start commands that refer to Remix artifacts.
5. Search for remaining `@nx/remix` usage, including `createWatchPaths`, Cypress component-testing presets, generator defaults, and plugin registrations. Replace obsolete helper usage with the relevant upstream or Nx configuration. Keep registrations scoped to apps that still use Remix if the workspace is migrated in stages.
6. Remove `@nx/remix` and unused `@remix-run/*` dependencies only after no project or shared configuration still needs them. Do not remove packages used by an unmigrated app.

## Validate and fix last-mile failures

Use the workspace package manager to run Nx commands. Discover available target names rather than assuming every app has the same targets.

- Run the production build for every migrated app.
- Run other relevant existing targets, such as typecheck, lint, unit tests, and e2e tests. Include affected shared libraries where applicable.
- Smoke-test the existing dev/start targets and key routes where the environment permits, including a loader/action or resource route if the app has one.
- Fix migration-related failures and rerun the failing checks. Check generated types, import resolution, stale target overrides, and deployment output paths when diagnosing failures. Do not disable tests or type checking to make validation pass.
- Report the migrated projects, versions, commands run, and results. List blockers or checks that could not run. Edits and dependency installation alone do not prove the migration works.
