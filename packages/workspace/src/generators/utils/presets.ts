export enum Preset {
  Apps = 'apps',
  // TODO(v18): Remove Empty and Core presets
  /** @deprecated Use Apps instead
   */
  Empty = 'empty',
  /** @deprecated Use NPM instead
   */
  Core = 'core',
  NPM = 'npm',
  TS = 'ts',
  WebComponents = 'web-components',
  AngularMonorepo = 'angular-monorepo',
  AngularStandalone = 'angular-standalone',
  ReactMonorepo = 'react-monorepo',
  ReactStandalone = 'react-standalone',
  VueMonorepo = 'vue-monorepo',
  VueStandalone = 'vue-standalone',
  NextJsStandalone = 'nextjs-standalone',
  ReactNative = 'react-native',
  Expo = 'expo',
  NextJs = 'next',
  Nest = 'nest',
  Express = 'express',
  NodeStandalone = 'node-standalone',
  NodeMonorepo = 'node-monorepo',
  TsStandalone = 'ts-standalone',
}
