import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

describe('karma', () => {
  let appTree;
  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should add karma dependencies', async () => {
    const tree = await runSchematic('karma', {}, appTree);
    const { devDependencies } = readJsonInTree(tree, 'package.json');
    expect(devDependencies['karma']).toBeDefined();
    expect(devDependencies['karma-chrome-launcher']).toBeDefined();
    expect(devDependencies['karma-coverage-istanbul-reporter']).toBeDefined();
    expect(devDependencies['karma-jasmine']).toBeDefined();
    expect(devDependencies['karma-jasmine-html-reporter']).toBeDefined();
    expect(devDependencies['jasmine-core']).toBeDefined();
    expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
    expect(devDependencies['@types/jasmine']).toBeDefined();
  });

  it('should add karma configuration', async () => {
    const tree = await runSchematic('karma', {}, appTree);
    expect(tree.exists('karma.conf.js')).toBeTruthy();
  });
});
