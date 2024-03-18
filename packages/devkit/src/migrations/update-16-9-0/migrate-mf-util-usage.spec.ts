import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { stripIndents } from 'nx/src/utils/strip-indents';
import { readJson } from 'nx/src/generators/utils/json';

import migrateMfUtilUsage from './migrate-mf-util-usage';

describe('migrate-mf-util-usage', () => {
  it('should do nothing if it does not find files using the mf public api', async () => {
    // ARRANGE
    const testFileContents = `${stripIndents`import { readFileSync } from 'fs';
    const file = readFileSync('test.ts');`}\n`;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.ts', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.ts', 'utf-8')).toEqual(testFileContents);
  });

  it('should do nothing if it does not find files using the mf public api even if they use devkit', async () => {
    // ARRANGE
    const testFileContents = `${stripIndents`import { readJson } from '@nx/devkit';
    const file = readJson('test.json');`}\n`;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.ts', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.ts', 'utf-8')).toEqual(testFileContents);
  });

  it('should replace imports to utils from devkit with webpack', async () => {
    // ARRANGE
    const testFileContents = stripIndents`import {ModuleFederationConfig} from '@nx/devkit';
    const config: ModuleFederationConfig = {};
    `;
    const expectedTestFileContents = `${stripIndents`import { ModuleFederationConfig } from '@nx/webpack';
    const config: ModuleFederationConfig = {};`}\n`;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.ts', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/webpack']
    ).toBeDefined();
  });

  it('should extract imports to utils from devkit and replace with imports from webpack', async () => {
    // ARRANGE
    const testFileContents = stripIndents`import {joinPathFragments, ModuleFederationConfig} from '@nx/devkit';
    const config: ModuleFederationConfig = {};
    `;
    const expectedTestFileContents = `${stripIndents`import { joinPathFragments } from '@nx/devkit';
    import { ModuleFederationConfig } from '@nx/webpack';
    const config: ModuleFederationConfig = {};`}\n`;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.ts', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/webpack']
    ).toBeDefined();
  });

  it('should extract imports to utils from devkit and replace with imports from webpack, even with multiple devkit imports', async () => {
    // ARRANGE
    const testFileContents = stripIndents`import {joinPathFragments, ModuleFederationConfig} from '@nx/devkit';
    import {readJson, WorkspaceLibrary} from '@nx/devkit';
    const config: ModuleFederationConfig = {};
    `;
    const expectedTestFileContents = `${stripIndents`import { joinPathFragments } from '@nx/devkit';
    import { readJson } from '@nx/devkit';
    import { ModuleFederationConfig, WorkspaceLibrary } from '@nx/webpack';
    const config: ModuleFederationConfig = {};`}\n`;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.ts', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/webpack']
    ).toBeDefined();
  });

  describe('require()', () => {
    it('should do nothing if it does not find files using the mf public api', async () => {
      // ARRANGE
      const testFileContents = `${stripIndents`const { readFileSync } = require('fs');
    const file = readFileSync('test.ts');`}\n`;

      const tree = createTreeWithEmptyWorkspace();
      tree.write('test.ts', testFileContents);

      // ACT
      await migrateMfUtilUsage(tree);

      // ASSERT
      expect(tree.read('test.ts', 'utf-8')).toEqual(testFileContents);
    });

    it('should do nothing if it does not find files using the mf public api even if they use devkit', async () => {
      // ARRANGE
      const testFileContents = `${stripIndents`const { readJson } = require('@nx/devkit');
    const file = readJson('test.json');`}\n`;

      const tree = createTreeWithEmptyWorkspace();
      tree.write('test.ts', testFileContents);

      // ACT
      await migrateMfUtilUsage(tree);

      // ASSERT
      expect(tree.read('test.ts', 'utf-8')).toEqual(testFileContents);
    });

    it('should replace imports to utils from devkit with webpack', async () => {
      // ARRANGE
      const testFileContents = stripIndents`const {ModuleFederationConfig} = require('@nx/devkit');
    const config: ModuleFederationConfig = {};
    `;
      const expectedTestFileContents = `${stripIndents`const { ModuleFederationConfig } = require('@nx/webpack');
    const config: ModuleFederationConfig = {};`}\n`;

      const tree = createTreeWithEmptyWorkspace();
      tree.write('test.ts', testFileContents);

      // ACT
      await migrateMfUtilUsage(tree);

      // ASSERT
      expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
      expect(
        readJson(tree, 'package.json').devDependencies['@nx/webpack']
      ).toBeDefined();
    });

    it('should extract imports to utils from devkit and replace with imports from webpack', async () => {
      // ARRANGE
      const testFileContents = stripIndents`const {joinPathFragments, ModuleFederationConfig} = require("@nx/devkit");
    const config: ModuleFederationConfig = {};
    `;
      const expectedTestFileContents = `${stripIndents`const { joinPathFragments } = require('@nx/devkit');
    const { ModuleFederationConfig } = require('@nx/webpack');
    const config: ModuleFederationConfig = {};`}\n`;

      const tree = createTreeWithEmptyWorkspace();
      tree.write('test.ts', testFileContents);

      // ACT
      await migrateMfUtilUsage(tree);

      // ASSERT
      expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
      expect(
        readJson(tree, 'package.json').devDependencies['@nx/webpack']
      ).toBeDefined();
    });

    it('should extract imports to utils from devkit and replace with imports from webpack, even with multiple devkit imports', async () => {
      // ARRANGE
      const testFileContents = stripIndents`const {joinPathFragments, ModuleFederationConfig} = require('@nx/devkit');
    const {readJson, WorkspaceLibrary} = require('@nx/devkit');
    const config: ModuleFederationConfig = {};
    `;
      const expectedTestFileContents = `${stripIndents`const { joinPathFragments } = require('@nx/devkit');
    const { readJson } = require('@nx/devkit');
    const { ModuleFederationConfig, WorkspaceLibrary } = require('@nx/webpack');
    const config: ModuleFederationConfig = {};`}\n`;

      const tree = createTreeWithEmptyWorkspace();
      tree.write('test.ts', testFileContents);

      // ACT
      await migrateMfUtilUsage(tree);

      // ASSERT
      expect(tree.read('test.ts', 'utf-8')).toEqual(expectedTestFileContents);
      expect(
        readJson(tree, 'package.json').devDependencies['@nx/webpack']
      ).toBeDefined();
    });
  });

  it('should replace imports to utils from devkit with webpack in JSDoc comments', async () => {
    // ARRANGE
    const testFileContents = stripIndents`
    /**
    * @type {import('@nx/devkit').ModuleFederationConfig}
    **/
    const config = {};
    `;

    const tree = createTreeWithEmptyWorkspace();
    tree.write('test.js', testFileContents);

    // ACT
    await migrateMfUtilUsage(tree);

    // ASSERT
    expect(tree.read('test.js', 'utf-8')).toMatchInlineSnapshot(`
      "/**
       * @type {import('@nx/webpack').ModuleFederationConfig}
       **/
      const config = {};
      "
    `);
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/webpack']
    ).toBeDefined();
  });
});
