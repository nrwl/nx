import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import libraryGenerator from './library';
import { Linter } from '@nrwl/linter';
import { readJson } from '@nrwl/devkit';
import { Schema } from './schema';

describe('next library', () => {
  it('should use "next/babel" preset in babelrc', async () => {
    const baseOptions: Schema = {
      name: '',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      style: 'css',
      component: true,
    };

    const appTree = createTreeWithEmptyWorkspace();

    await libraryGenerator(appTree, {
      ...baseOptions,
      name: 'myLib',
    });
    await libraryGenerator(appTree, {
      ...baseOptions,
      name: 'myLib2',
      style: '@emotion/styled',
    });
    await libraryGenerator(appTree, {
      ...baseOptions,
      name: 'myLib3',
      directory: 'myDir',
    });

    expect(readJson(appTree, 'libs/my-lib/.babelrc')).toEqual({
      presets: ['next/babel'],
      plugins: [],
    });
    expect(readJson(appTree, 'libs/my-lib2/.babelrc')).toEqual({
      presets: [
        'next/babel',
        {
          'preset-react': {
            importSource: '@emotion/react',
          },
        },
      ],
      plugins: ['@emotion/babel-plugin'],
    });
    expect(readJson(appTree, 'libs/my-dir/my-lib3/.babelrc')).toEqual({
      presets: ['next/babel'],
      plugins: [],
    });
  });
});
