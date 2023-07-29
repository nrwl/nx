export enum Preset {
  Apps = 'apps',
  Empty = 'empty', // same as apps, deprecated
  Core = 'core', // same as npm, deprecated
  NPM = 'npm',
  TS = 'ts',
  WebComponents = 'web-components',
  AngularMonorepo = 'angular-monorepo',
  AngularStandalone = 'angular-standalone',
  ReactMonorepo = 'react-monorepo',
  ReactStandalone = 'react-standalone',
  NextJs = 'next',
  NextJsStandalone = 'nextjs-standalone',
  ReactNative = 'react-native',
  Expo = 'expo',
  Nest = 'nest',
  Express = 'express',
  React = 'react',
  Angular = 'angular',
  NodeStandalone = 'node-standalone',
  NodeMonorepo = 'node-monorepo',
  TsStandalone = 'ts-standalone',
}

/**
 * This function is used to check if a preset is a known Nx preset.
 * @param preset
 * @returns true if the preset is a known Nx preset, false otherwise.
 */
export function isKnownPreset(preset: string): preset is Preset {
  return Object.values(Preset).includes(preset as Preset);
}
