import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GatewayGeneratorOptions } from './gateway';
import { gatewayGenerator } from './gateway';

describe('gateway generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: GatewayGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(gatewayGenerator(tree, options)).resolves.not.toThrow();
  });
});
