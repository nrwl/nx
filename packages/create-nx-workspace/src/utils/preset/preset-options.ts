import { Preset } from './preset';

export const presetOptions: { name: Preset; message: string }[] = [
  {
    name: Preset.Apps,
    message:
      'apps              [an empty monorepo with no plugins with a layout that works best for building apps]',
  },
  {
    name: Preset.TS,
    message:
      'ts                [an empty monorepo with the JS/TS plugin preinstalled]',
  },
  {
    name: Preset.ReactMonorepo,
    message: 'react             [a monorepo with a single React application]',
  },
  {
    name: Preset.AngularMonorepo,
    message: 'angular           [a monorepo with a single Angular application]',
  },
  {
    name: Preset.NextJs,
    message: 'next.js           [a monorepo with a single Next.js application]',
  },
  {
    name: Preset.Nest,
    message: 'nest              [a monorepo with a single Nest application]',
  },
  {
    name: Preset.ReactNative,
    message:
      'react-native      [a monorepo with a single React Native application]',
  },
];
