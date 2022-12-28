import { joinPathFragments } from '../utils/path';
import { parseNpmLockFile } from './npm-v2';

describe('NPM lock file utility', () => {
  it('should parse next.js generated', async () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package-lock.json'
    ));
    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package.json'
    ));
    const result = parseNpmLockFile(JSON.stringify(rootLockFile), packageJson);
    expect(result.root.children.size).toEqual(1143);
    expect(result.isValid).toBeTruthy();
  });

  it('should parse auxiliary packages', async () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package-lock.json'
    ));
    const rootV2LockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package-lock-v2.json'
    ));
    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package.json'
    ));

    const resultV1 = parseNpmLockFile(
      JSON.stringify(rootLockFile),
      packageJson
    );

    expect(resultV1.root.children.size).toEqual(202);
    expect(resultV1.isValid).toBeTruthy();

    const resultV2 = parseNpmLockFile(
      JSON.stringify(rootV2LockFile),
      packageJson
    );
    expect(resultV1.root.children.size).toEqual(resultV2.root.children.size);
    expect(resultV2.isValid).toBeTruthy();
  });

  xit('should prune', async () => {
    // TODO: Check what arborist loads and how are we different
    // TODO: probably the whole structure needs to be revisited
    const Arborist = require('@npmcli/arborist');
    const arb = new Arborist({
      path: joinPathFragments(__dirname, '__fixtures__/nextjs'),
    });
    console.time('load actual');
    const actualTree = await arb.loadVirtual();
    // console.log(actualTree.children.get('ansi-styles'));
    // console.log(actualTree.children.get('wrap-ansi').children);
    // console.log(Object.keys(tree.children).length, tree.edgesOut);
    const newTree = await arb.buildIdealTree({
      // path: joinPathFragments(__dirname, '__fixtures__/nextjs/app'),
      add: [],
      rm: [
        '@babel/preset-react',
        '@nrwl/cypress',
        '@nrwl/eslint-plugin-nx',
        '@nrwl/jest',
        '@nrwl/linter',
        // '@nrwl/next',
        '@nrwl/react',
        '@nrwl/web',
        '@nrwl/workspace',
        '@testing-library/react',
        '@types/jest',
        '@types/node',
        '@types/react',
        '@types/react-dom',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'babel-jest',
        'core-js',
        'cypress',
        'eslint',
        'eslint-config-next',
        'eslint-config-prettier',
        'eslint-plugin-cypress',
        'eslint-plugin-import',
        'eslint-plugin-jsx-a11y',
        'eslint-plugin-react',
        'eslint-plugin-react-hooks',
        'jest',
        'jest-environment-jsdom',
        // 'next',
        'nx',
        'prettier',
        // 'react',
        // 'react-dom',
        'react-test-renderer',
        'regenerator-runtime',
        'ts-jest',
        'ts-node',
        'tslib',
        // 'typescript'
      ],
    });
    const newTree2 = await arb.buildIdealTree({
      path: joinPathFragments(__dirname, '__fixtures__/nextjs/app'),
    });
    console.log(newTree2.children.size);
    // console.log(newTree.children.get('@nrwl/next'), newTree.children.size);
    // const expectedLockFile = require(joinPathFragments(
    //   __dirname,
    //   '__fixtures__/nextjs/app/package-lock.json'
    // ));
    // console.log(Object.keys(expectedLockFile.packages).length);
  });
});
