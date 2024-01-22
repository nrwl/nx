import { join } from 'path';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../../utils/fileutils';

const defaultTsConfig = (relativePathToRoot: string) => ({
  extends: relativePathToRoot
    ? join(relativePathToRoot, 'tsconfig.base.json')
    : './tsconfig.base.json',
  compilerOptions: {
    jsx: 'react',
    allowJs: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
  },
  files: [],
  include: [],
  references: [
    {
      path: './tsconfig.app.json',
    },
    {
      path: './tsconfig.spec.json',
    },
  ],
});

const defaultTsConfigApp = (relativePathToRoot: string) => ({
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: join(relativePathToRoot, 'dist/out-tsc'),
    types: ['node'],
  },
  files: [
    join(relativePathToRoot, 'node_modules/@nx/react/typings/cssmodule.d.ts'),
    join(relativePathToRoot, 'node_modules/@nx/react/typings/image.d.ts'),
  ],
  exclude: ['**/*.spec.ts', '**/*.spec.tsx'],
  include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
});

const defaultTsConfigSpec = (relativePathToRoot: string) => ({
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: join(relativePathToRoot, 'dist/out-tsc'),
    module: 'commonjs',
    types: ['jest', 'node'],
  },
  include: [
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/*.spec.js',
    '**/*.spec.jsx',
    '**/*.d.ts',
  ],
  files: [
    join(relativePathToRoot, 'node_modules/@nx/react/typings/cssmodule.d.ts'),
    join(relativePathToRoot, 'node_modules/@nx/react/typings/image.d.ts'),
  ],
});

export function setupTsConfig(appName: string, isStandalone: boolean) {
  const tsconfigPath = isStandalone
    ? 'tsconfig.json'
    : `apps/${appName}/tsconfig.json`;
  const tsconfigAppPath = isStandalone
    ? 'tsconfig.app.json'
    : `apps/${appName}/tsconfig.app.json`;
  const tsconfiSpecPath = isStandalone
    ? 'tsconfig.spec.json'
    : `apps/${appName}/tsconfig.spec.json`;
  const tsconfigBasePath = isStandalone
    ? './tsconfig.base.json'
    : '../../tsconfig.base.json';
  const relativePathToRoot = isStandalone ? '' : '../../';
  if (fileExists(tsconfigPath)) {
    const json = readJsonFile(tsconfigPath);
    json.extends = tsconfigBasePath;
    if (json.compilerOptions) {
      json.compilerOptions.jsx = 'react';
    } else {
      json.compilerOptions = {
        jsx: 'react',
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      };
    }
    writeJsonFile(tsconfigPath, json);
  } else {
    writeJsonFile(tsconfigPath, defaultTsConfig(relativePathToRoot));
  }

  if (fileExists(tsconfigAppPath)) {
    const json = readJsonFile(tsconfigAppPath);
    json.extends = './tsconfig.json';
    writeJsonFile(tsconfigAppPath, json);
  } else {
    writeJsonFile(tsconfigAppPath, defaultTsConfigApp(relativePathToRoot));
  }

  if (fileExists(tsconfiSpecPath)) {
    const json = readJsonFile(tsconfiSpecPath);
    json.extends = './tsconfig.json';
    writeJsonFile(tsconfiSpecPath, json);
  } else {
    writeJsonFile(tsconfiSpecPath, defaultTsConfigSpec(relativePathToRoot));
  }
}
