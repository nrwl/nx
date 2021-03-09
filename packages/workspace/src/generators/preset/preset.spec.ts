import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import { presetGenerator } from './preset';
import * as path from 'path';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    overrideCollectionResolutionForTesting({
      '@nrwl/workspace': path.join(
        __dirname,
        '../../../../workspace/collection.json'
      ),
      '@nrwl/angular': path.join(
        __dirname,
        '../../../../angular/collection.json'
      ),
      '@nrwl/linter': path.join(
        __dirname,
        '../../../../linter/collection.json'
      ),
      '@nrwl/nest': path.join(__dirname, '../../../../nest/collection.json'),
      '@nrwl/node': path.join(__dirname, '../../../../node/collection.json'),
      '@nrwl/jest': path.join(__dirname, '../../../../jest/collection.json'),
      '@nrwl/cypress': path.join(
        __dirname,
        '../../../../cypress/collection.json'
      ),
      '@nrwl/express': path.join(
        __dirname,
        '../../../../express/collection.json'
      ),
    });
  });

  afterEach(() => {
    overrideCollectionResolutionForTesting(null);
  });

  it('should create files (preset = angular)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'angular',
      cli: 'nx',
    });
    expect(tree.children('apps/proj')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/app')).toMatchSnapshot();

    expect(
      JSON.parse(tree.read('/workspace.json').toString()).cli.defaultCollection
    ).toBe('@nrwl/angular');
  });

  it('should create files (preset = web-components)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'web-components',
      cli: 'nx',
    });
    expect(tree.exists('/apps/proj/src/main.ts')).toBe(true);
    expect(readJson(tree, '/workspace.json').cli.defaultCollection).toBe(
      '@nrwl/web'
    );
  });

  it('should create files (preset = react)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'react',
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
    });
    expect(tree.exists('/apps/proj/src/main.tsx')).toBe(true);
    expect(readJson(tree, '/workspace.json').cli.defaultCollection).toBe(
      '@nrwl/react'
    );
  });

  it('should create files (preset = next)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'next',
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
    });
    expect(tree.exists('/apps/proj/pages/index.tsx')).toBe(true);
    expect(readJson(tree, '/workspace.json').cli.defaultCollection).toBe(
      '@nrwl/next'
    );
  });

  it('should create files (preset = angular-nest)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'angular-nest',
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
    });

    expect(tree.exists('/apps/proj/src/app/app.component.ts')).toBe(true);
    expect(tree.exists('/apps/api/src/app/app.controller.ts')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')).toBe(
      true
    );
  });

  it('should create files (preset = react-express)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'react-express',
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
    });

    expect(tree.exists('/apps/proj/src/app/app.tsx')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')).toBe(
      true
    );
    expect(tree.exists('/apps/proj/.eslintrc.json')).toBe(true);
    expect(tree.exists('/apps/api/.eslintrc.json')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/.eslintrc.json')).toBe(true);
  });

  it('should create files (preset = express)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: 'express',
      linter: 'eslint',
      cli: 'nx',
    });

    expect(tree.exists('apps/proj/src/main.ts')).toBe(true);
    expect(tree.exists('apps/proj/.eslintrc.json')).toBe(true);
  });
});
