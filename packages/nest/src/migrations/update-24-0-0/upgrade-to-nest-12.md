#### Upgrade NestJS 11 to 12

Bumps the declared `@nestjs/*` core packages (`common`, `core`, `microservices`, `platform-*`, `schematics`, `testing`, `websockets`) to 12; a package manager catalog entry is bumped in the catalog. `@nestjs/schematics` 12 requires TypeScript 6, so a workspace on TypeScript 5 also gets `typescript` upgraded to the version Nx installs by default.

NestJS 12 ships its core packages as ESM only. A CommonJS app loads them through `require(esm)`, which needs Node.js 20.19+ or 22.12+, and Jest can load them only on Node.js 24.9 or later. When a project tests Nest code with Jest and the migration runs on a Node.js below 24.9, or `.nvmrc`, `.node-version` or `engines.node` allows one, the workspace stays on NestJS 11 and the migration reports the projects and the command to run once their tests move to Vitest or run on Node.js 24.9+. The paired AI instructions check the Node.js version in CI, revert to NestJS 11 if a Jest run there would break, and walk through the changes that need judgment: generic `ArgumentMetadata` in custom pipes, lifecycle hook ordering, `@Optional()` on subclasses, and the opt-in NATS, GraphQL, `@nestjs/config` and Terminus changes. Read more in the [NestJS 12 migration guide](https://docs.nestjs.com/migration-guide).

#### Sample Code Changes

##### Before

```json title="package.json"
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0"
  },
  "devDependencies": {
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "typescript": "~5.9.2"
  }
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@nestjs/common": "^12.0.1",
    "@nestjs/core": "^12.0.1",
    "@nestjs/platform-express": "^12.0.1"
  },
  "devDependencies": {
    "@nestjs/schematics": "^12.0.1",
    "@nestjs/testing": "^12.0.1",
    "typescript": "~6.0.3"
  }
}
```
