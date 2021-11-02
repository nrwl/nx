import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import subject from './remove-node-sass-13-0-0';

describe('Migration: node-sass to sass', () => {
  it(`should remove node-sass if present in devDependencies or dependencies`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: { a: '1.0.0' },
        devDependencies: { b: '1.0.0', 'node-sass': '1.0.0' },
      })
    );

    await subject(tree);

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: { a: '1.0.0' },
      devDependencies: { b: '1.0.0' },
    });

    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: { a: '1.0.0', 'node-sass': '1.0.0' },
        devDependencies: { b: '1.0.0' },
      })
    );

    await subject(tree);

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: { a: '1.0.0' },
      devDependencies: { b: '1.0.0' },
    });
  });
});
