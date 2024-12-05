import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { gatewayGenerator } from './gateway';

describe('gateway generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      gatewayGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
