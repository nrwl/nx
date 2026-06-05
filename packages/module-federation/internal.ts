// Curated internal API surface for other first-party Nx plugins (e.g. @nx/react,
// @nx/angular, @nx/rspack). Prefer this over deep `@nx/module-federation/src/*`
// imports — those are not part of the public API.
export {
  buildStaticRemotes,
  startRemoteIterators,
  DevRemoteDefinition,
} from './src/executors/utils';
export {
  getModuleFederationConfig,
  getRemotes,
  parseStaticRemotesConfig,
  StaticRemotesConfig,
} from './src/utils';
