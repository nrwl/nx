import { Tree } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import { join } from 'path';
import { generateFiles } from './generate-files';

describe('generateFiles', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should generate files from template in a directory', () => {
    const target = './tools/target';
    const name = 'my-project';
    const projectName = 'my-project-api';

    generateFiles(tree, join(__dirname, '../tests/generate-files'), target, {
      dot: '.',
      name,
      projectName,
      tmpl: '',
    });

    expect(tree.exists(`${target}/${name}.service.ts`)).toBeTruthy();
    expect(tree.exists(`${target}/src/common-util.ts`)).toBeTruthy();
    expect(
      tree.exists(`${target}/src/${projectName}/create-${name}.input.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(
        `${target}/src/${projectName}/${name}/${projectName}.${name}.model.ts`
      )
    ).toBeTruthy();
    expect(
      tree.exists(`${target}/src/${projectName}/output/.gitkeep`)
    ).toBeTruthy();
    expect(tree.exists(`${target}/src/${name}.module.ts`)).toBeTruthy();
  });
});
