import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GatewayGeneratorOptions } from './gateway';
import { gatewayGenerator } from './gateway';

describe('gateway generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: GatewayGeneratorOptions = {
    name: 'test',
    path,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(path);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      gatewayGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
