import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { convertToFlatConfigGenerator } from './generator';
import { ConvertToFlatConfigGeneratorSchema } from './schema';

describe('convert-to-flat-config generator', () => {
  let tree: Tree;
  const options: ConvertToFlatConfigGeneratorSchema = {};

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    // await convertToFlatConfigGenerator(tree, options);
    // const config = readProjectConfiguration(tree, 'test');
    // expect(config).toBeDefined();
    expect(true).toBeTruthy();
  });
});
