# NestJS 11 -> 12 Migration Instructions for LLM

## Overview

The deterministic migration bumped the declared `@nestjs/*` core packages to `^12.0.1` and, when the workspace was on TypeScript 5, upgraded `typescript` to 6 because `@nestjs/schematics` 12 requires it. NestJS 12 ships every core package as ESM only. A CommonJS app loads them through `require(esm)`, which needs Node.js 20.19+ or 22.12+ to run the app. Jest loads them only on Node.js 24.9 or later and fails with `ERR_REQUIRE_ASYNC_MODULE` below that. The migration checked the Node.js version it ran on, `.nvmrc`, `.node-version` and `engines.node`, but it cannot see the Node.js version CI uses. This runbook covers that check and the source changes that need judgment. Do not change Nx target configuration or the webpack build setup.

## Pre-Migration Checklist

1. Confirm `@nestjs/core` in `package.json` resolves to 12. If it does not, the migration kept NestJS 11 on purpose; make no changes and stop.
2. When the step's `nx_migrate_prompt` block has `impl.agentContext`, read it. It lists the packages the migration bumped and the projects that test Nest code with Jest.

## Step 1: Check the Node.js version every Jest run uses

Skip this step when `impl.agentContext` says no project tests Nest code with Jest.

For each Jest-tested project listed in `impl.agentContext`, find every place its tests run and the Node.js version there:

- CI workflow files (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `.circleci/config.yml`, `bitbucket-pipelines.yml`, `Jenkinsfile`): `node-version`, `setup-node`, container `image:` tags such as `node:22`.
- Dockerfiles and dev container configs that run tests.
- Version manager files the migration does not read, such as `.tool-versions` and `mise.toml`.

If any of them runs these tests on a Node.js below 24.9, the bump leaves the workspace broken: the tests fail there with `ERR_REQUIRE_ASYNC_MODULE` or `SyntaxError: Unexpected token 'export'`. In that case, **revert to NestJS 11**:

1. Set every `@nestjs/*` package the migration bumped back to `^11.0.0` in `package.json` (or its catalog entry).
2. Leave a `typescript` upgrade in place; TypeScript 6 works with NestJS 11.
3. Install, and report to the user which CI job or file runs Node.js below 24.9, and that they can move those tests to Vitest (`nx g @nx/vitest:configuration <project>`, then replace `jest.*` calls with `vi.*`) or raise that Node.js version, then re-run the migration.

Stop after reverting; skip the remaining steps.

If every place runs Node.js 24.9 or later, keep NestJS 12 and continue.

## Step 2: Review custom pipes

`ArgumentMetadata` is generic in NestJS 12. Custom pipes that implement `PipeTransform` and type the `metadata` parameter may fail to typecheck. Run typecheck on the Nest projects and fix the pipe signatures it reports.

## Step 3: Review lifecycle hook ordering

Lifecycle hooks (`onModuleInit`, `onApplicationBootstrap`, `onModuleDestroy`, `beforeApplicationShutdown`, `onApplicationShutdown`) now run in module hierarchy order. Search for hooks that depend on another module's hook having run first, such as a provider that reads a connection another module opens in `onModuleInit`. Do not reorder code unless such a dependency exists; report each one you find.

## Step 4: Review `@Optional()` on subclasses

`@Optional()` is no longer inherited by subclasses. Search for classes that extend an injectable whose constructor parameters use `@Optional()` and that do not redeclare the constructor. Add `@Optional()` to the subclass constructor where the parameter can still be missing.

## Step 5: Opt-in packages

Check `package.json` for each package below and follow the NestJS 12 migration guide (https://docs.nestjs.com/migration-guide) for the ones present:

- `nats`: replaced by `@nats-io/transport-node`; the client options and message payloads change.
- `subscriptions-transport-ws`: removed; use `graphql-ws`. Clients must move to the `graphql-ws` protocol too, so report it rather than changing client code.
- `@nestjs/graphql` with `playground` config: GraphiQL is the default IDE; move `playground` options to `graphiql`.
- `@nestjs/config` with `validationSchema`: validation uses Standard Schema; Joi needs v18+, and Joi options move under `validationOptions.libraryOptions`.
- `@nestjs/terminus`: `HealthIndicator` and `HealthCheckError` are removed; use `HealthIndicatorService`.

`ConsoleLogger` now defaults `structuredParams` to `true`, which changes log output. Do not change it; mention it to the user if the workspace parses its logs.

## Post-Migration Validation

1. Run typecheck on the Nest projects (`npx nx run-many -t typecheck -p <projects>`).
2. Run their tests (`npx nx run-many -t test -p <projects>`). A Jest run that fails with `ERR_REQUIRE_ASYNC_MODULE` means it runs on Node.js below 24.9; go back to Step 1.
3. Build and serve one app (`npx nx build <app>`, `npx nx serve <app>`) to confirm it starts on the workspace's Node.js.
4. Fix failures caused by this migration and re-run until green.

## Nx-Specific Notes

- New Nest projects generated on NestJS 12 use Vitest, and the `@nx/nest` generators reject `--unitTestRunner=jest` on NestJS 12. Existing Jest projects keep working on Node.js 24.9+.
- Keep the webpack build and `@nx/js:node` serve targets as they are; a CommonJS bundle loads NestJS 12 through `require(esm)`.
