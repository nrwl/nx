import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import * as fs from 'fs';

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
    const data = fs.readFileSync(`apps/${appName}/tsconfig.json`);
    const json = JSON.parse(data.toString());
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
    fs.writeFileSync(
      `apps/${appName}/tsconfig.json`,
      JSON.stringify(json, null, 2)
    );
  } else {
    fs.writeFileSync(
      `apps/${appName}/tsconfig.json`,
      JSON.stringify(defaultTsConfig, null, 2)
    );
  }

  if (fileExists(`apps/${appName}/tsconfig.app.json`)) {
    const data = fs.readFileSync(`apps/${appName}/tsconfig.app.json`);
    const json = JSON.parse(data.toString());
    json.extends = './tsconfig.json';
    fs.writeFileSync(
      `apps/${appName}/tsconfig.app.json`,
      JSON.stringify(json, null, 2)
    );
  } else {
    fs.writeFileSync(
      `apps/${appName}/tsconfig.app.json`,
      JSON.stringify(defaultTsConfigApp, null, 2)
    );
  }

  if (fileExists(`apps/${appName}/tsconfig.spec.json`)) {
    const data = fs.readFileSync(`apps/${appName}/tsconfig.spec.json`);
    const json = JSON.parse(data.toString());
    json.extends = './tsconfig.json';
    fs.writeFileSync(
      `apps/${appName}/tsconfig.spec.json`,
      JSON.stringify(json, null, 2)
    );
  } else {
    fs.writeFileSync(
      `apps/${appName}/tsconfig.spec.json`,
      JSON.stringify(defaultTsConfigSpec, null, 2)
    );
  }
}
