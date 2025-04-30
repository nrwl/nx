import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import updateBabelLoose from './update-babel-loose';

describe('update-babel-loose migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update classProperties.loose to loose in .babelrc', async () => {
    const filePath = '.babelrc';
    tree.write(
      filePath,
      JSON.stringify({
        presets: [
          [
            '@nx/react/babel',
            {
              runtime: 'automatic',
              classProperties: {
                loose: true,
              },
              useBuiltIns: 'usage',
            },
          ],
        ],
        plugins: [],
      })
    );

    await updateBabelLoose(tree);

    const content = tree.read(filePath, 'utf-8');
    const updatedConfig = JSON.parse(content);
    expect(updatedConfig.presets[0][1]).toEqual({
      runtime: 'automatic',
      loose: true,
      useBuiltIns: 'usage',
    });
  });

  it('should skip invalid JSON files', async () => {
    const filePath = '.babelrc';
    tree.write(filePath, 'invalid json content');

    await updateBabelLoose(tree);

    const content = tree.read(filePath, 'utf-8');
    expect(content).toBe('invalid json content');
  });
});
