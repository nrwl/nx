import { registerCompletion } from '../completion/metadata';

// First-party Nx plugins installable via `nx add <plugin>`. Best-effort
// — `nx add` accepts any npm package, but the conventional `@nx/*` set
// is what users most often want to discover, and these names are stable
// enough that a hardcoded list is appropriate (mirrors `INFIX_TARGETS`).
// New first-party plugins land rarely; keep this list in alphabetical
// order so additions are obvious in diffs.
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

// `nx add <packageSpecifier>` — single positional. The user can supply
// any npm package, but we suggest the first-party `@nx/*` set since
// that's the most common case and there's no cheap way to enumerate
// arbitrary plugins on npm at TAB time.
registerCompletion('add', {
  positionals: [
    {
      complete: (current) =>
        FIRST_PARTY_PLUGINS.filter((p) => p.startsWith(current)),
    },
  ],
});
