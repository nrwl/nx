export enum Preset {
  Apps = 'apps',
  // TODO(v19): Remove Empty and Core presets
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
  NextJsStandalone = 'nextjs-standalone',
  ReactNative = 'react-native',
  VueMonorepo = 'vue-monorepo',
  VueStandalone = 'vue-standalone',
  Nuxt = 'nuxt',
  NuxtStandalone = 'nuxt-standalone',
  Expo = 'expo',
  NextJs = 'next',
  Nest = 'nest',
  Express = 'express',
  NodeStandalone = 'node-standalone',
  NodeMonorepo = 'node-monorepo',
  TsStandalone = 'ts-standalone',
}
