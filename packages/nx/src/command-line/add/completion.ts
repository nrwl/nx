import { registerCompletion } from '../completion/metadata';

// `nx add <plugin>` accepts any npm package; suggest the first-party set.
// Keep alphabetical.
const FIRST_PARTY_PLUGINS = [
  '@nx/angular',
  '@nx/angular-rspack',
  '@nx/cypress',
  '@nx/detox',
  '@nx/docker',
  '@nx/dotnet',
  '@nx/esbuild',
  '@nx/eslint',
  '@nx/expo',
  '@nx/express',
  '@nx/gradle',
  '@nx/jest',
  '@nx/js',
  '@nx/maven',
  '@nx/module-federation',
  '@nx/nest',
  '@nx/next',
  '@nx/node',
  '@nx/nuxt',
  '@nx/playwright',
  '@nx/react',
  '@nx/react-native',
  '@nx/remix',
  '@nx/rollup',
  '@nx/rsbuild',
  '@nx/rspack',
  '@nx/storybook',
  '@nx/vite',
  '@nx/vitest',
  '@nx/vue',
  '@nx/web',
  '@nx/webpack',
];

registerCompletion('add', {
  positionals: [
    {
      complete: (current) =>
        FIRST_PARTY_PLUGINS.filter((p) => p.startsWith(current)),
    },
  ],
});
