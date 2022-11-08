import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from 'nx/src/utils/fileutils';

const defaultTsConfig = {
  extends: '../../tsconfig.base.json',
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
};

const defaultTsConfigApp = {
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: '../../dist/out-tsc',
    types: ['node'],
  },
  files: [
    '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
    '../../node_modules/@nrwl/react/typings/image.d.ts',
  ],
  exclude: ['**/*.spec.ts', '**/*.spec.tsx'],
  include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
};

const defaultTsConfigSpec = {
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: '../../dist/out-tsc',
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
    '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
    '../../node_modules/@nrwl/react/typings/image.d.ts',
  ],
};

export function setupTsConfig(appName: string) {
  if (fileExists(`apps/${appName}/tsconfig.json`)) {
    const json = readJsonFile(`apps/${appName}/tsconfig.json`);
    json.extends = '../../tsconfig.base.json';
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
    writeJsonFile(`apps/${appName}/tsconfig.json`, json);
  } else {
    writeJsonFile(`apps/${appName}/tsconfig.json`, defaultTsConfig);
  }

  if (fileExists(`apps/${appName}/tsconfig.app.json`)) {
    const json = readJsonFile(`apps/${appName}/tsconfig.app.json`);
    json.extends = './tsconfig.json';
    writeJsonFile(`apps/${appName}/tsconfig.app.json`, json);
  } else {
    writeJsonFile(`apps/${appName}/tsconfig.app.json`, defaultTsConfigApp);
  }

  if (fileExists(`apps/${appName}/tsconfig.spec.json`)) {
    const json = readJsonFile(`apps/${appName}/tsconfig.spec.json`);
    json.extends = './tsconfig.json';
    writeJsonFile(`apps/${appName}/tsconfig.spec.json`, json);
  } else {
    writeJsonFile(`apps/${appName}/tsconfig.spec.json`, defaultTsConfigSpec);
  }
}
