import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GatewayGeneratorOptions } from './gateway';
import { gatewayGenerator } from './gateway';

describe('gateway generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: GatewayGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(gatewayGenerator(tree, options)).resolves.not.toThrowError();
  });
});
