import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, runSchematic } from '../../utils/testing-utils';
import { readJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

describe('karma', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic('karma', {}, appTree);
    expect(resultTree.exists('karma.conf.js')).toBeTruthy();
  });

  it('should add dependencies', async () => {
    const resultTree = await runSchematic('karma', {}, appTree);
    const packageJson = readJsonInTree(resultTree, 'package.json');

    expect(packageJson.devDependencies.karma).toBeDefined();
    expect(packageJson.devDependencies['karma-chrome-launcher']).toBeDefined();
    expect(
      packageJson.devDependencies['karma-coverage-istanbul-reporter']
    ).toBeDefined();
    expect(packageJson.devDependencies['karma-jasmine']).toBeDefined();
    expect(
      packageJson.devDependencies['karma-jasmine-html-reporter']
    ).toBeDefined();
  });
});
