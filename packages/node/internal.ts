// Curated internal API surface for other first-party Nx plugins (e.g. @nx/nest,
// @nx/express). Prefer this over deep `@nx/node/src/*` imports — those are not
// part of the public API.
export type { Schema } from './src/generators/application/schema';
export { tslibVersion } from './src/utils/versions';
