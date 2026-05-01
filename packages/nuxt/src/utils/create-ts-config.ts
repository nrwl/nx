import { Tree, writeJson } from '@nx/devkit';
import * as shared from '@nx/js/src/utils/typescript/create-ts-config';

export function createTsConfig(
  host: Tree,
  options: {
    projectRoot: string;
    rootProject?: boolean;
    unitTestRunner?: string;
    isUsingTsSolutionConfig: boolean;
    useAppDir?: boolean;
  },
  relativePathToRootTsConfig: string
) {
  createAppTsConfig(host, options);
  const json = {
    files: [],
    include: options.isUsingTsSolutionConfig ? undefined : ['.nuxt/nuxt.d.ts'],
    references: [
      {
        path: './tsconfig.app.json',
      },
    ],
  } as any;

  if (options.unitTestRunner !== 'none') {
    json.references.push({
      path: './tsconfig.spec.json',
    });
  }

  // inline tsconfig.base.json into the project
  if (options.rootProject) {
    json.compileOnSave = false;
    json.compilerOptions = {
      ...shared.tsConfigBaseOptions,
      ...json.compilerOptions,
    };
    json.exclude = ['node_modules', 'tmp'];
  } else {
    json.extends = './.nuxt/tsconfig.json';
  }

  writeJson(host, `${options.projectRoot}/tsconfig.json`, json);
}

function createAppTsConfig(
  host: Tree,
  options: { projectRoot: string; useAppDir?: boolean }
) {
  const sourceDir = options.useAppDir ? 'app' : 'src';

  // Build include array
  const include = ['.nuxt/nuxt.d.ts', `${sourceDir}/**/*`];
  if (options.useAppDir) {
    include.push('server/**/*');
  }

  // Build exclude array with test patterns
  // Order: extension-grouped (ts, tsx, js, jsx) with test/spec interleaved
  const testExcludes = ['ts', 'tsx', 'js', 'jsx'].flatMap((ext) =>
    ['test', 'spec'].map((type) => `${sourceDir}/**/*.${type}.${ext}`)
  );
  if (options.useAppDir) {
    testExcludes.push(
      ...['ts', 'tsx', 'js', 'jsx'].flatMap((ext) =>
        ['test', 'spec'].map((type) => `server/**/*.${type}.${ext}`)
      )
    );
  }

  const exclude = [
    'out-tsc',
    'dist',
    'vite.config.ts',
    'vite.config.mts',
    'vitest.config.ts',
    'vitest.config.mts',
    ...testExcludes,
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.mjs',
  ];

  const json = {
    extends: './tsconfig.json',
    compilerOptions: {
      composite: true,
      rootDir: sourceDir,
    },
    include,
    exclude,
  };

  writeJson(host, `${options.projectRoot}/tsconfig.app.json`, json);
}
