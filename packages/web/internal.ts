// Curated internal API surface for other first-party Nx plugins (e.g. @nx/react,
// @nx/angular, @nx/rspack, @nx/next, @nx/remix, @nx/module-federation). Prefer
// this over deep `@nx/web/src/*` imports — those are not part of the public API.
export { waitForPortOpen } from './src/utils/wait-for-port-open';
export { default as fileServerExecutor } from './src/executors/file-server/file-server.impl';
