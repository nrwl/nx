import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './fix-invalid-babelrc';

describe('fix-invalid-babelrc', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each`
    webPlugin
    ${'@nrwl/web'}
    ${'@nx/web'}
  `('should skip update if Web plugin is installed', ({ webPlugin }) => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      name: 'proj',
    });
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies[webPlugin] = '16.0.0';
      return json;
    });
    writeJson(tree, 'proj/.babelrc', {
      presets: [['@nx/web/babel', {}]],
    });

    update(tree);

    expect(readJson(tree, 'proj/.babelrc')).toEqual({
      presets: [['@nx/web/babel', {}]],
    });
  });

  it.each`
    jsPlugin      | originalPreset
    ${'@nrwl/js'} | ${'@nrwl/web/babel'}
    ${'@nrwl/js'} | ${'@nx/web/babel'}
    ${'@nx/js'}   | ${'@nrwl/web/babel'}
    ${'@nx/js'}   | ${'@nx/web/babel'}
  `(
    'should rename @nrwl/web/babel to @nx/js/babel when JS plugin is installed',
    ({ jsPlugin, originalPreset }) => {
      addProjectConfiguration(tree, 'proj1', {
        root: 'proj1',
        name: 'proj1',
      });
      addProjectConfiguration(tree, 'proj2', {
        root: 'proj2',
        name: 'proj2',
      });
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies[jsPlugin] = '16.0.0';
        return json;
      });
      writeJson(tree, 'proj1/.babelrc', {
        presets: [[originalPreset, {}]],
      });
      writeJson(tree, 'proj2/.babelrc', {
        presets: [originalPreset],
      });

      update(tree);

      expect(readJson(tree, 'proj1/.babelrc')).toEqual({
        presets: [['@nx/js/babel', {}]],
      });
      expect(readJson(tree, 'proj2/.babelrc')).toEqual({
        presets: ['@nx/js/babel'],
      });
    }
  );

  it('should remove the invalid preset if neither Web nor JS plugins are present', () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      name: 'proj',
    });
    writeJson(tree, 'proj/.babelrc', {
      presets: [
        '@babel/preset-env',
        ['@nx/web/babel', {}],
        '@babel/preset-typescript',
      ],
    });

    update(tree);

    expect(readJson(tree, 'proj/.babelrc')).toEqual({
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
    });
  });
});
