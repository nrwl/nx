import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { serviceGenerator } from './service';

describe('service generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      serviceGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });

  it.each(['jest', 'vitest'] as const)(
    'should generate a spec file for %s',
    async (unitTestRunner) => {
      await serviceGenerator(tree, { path: 'api/test', unitTestRunner });

      expect(tree.exists('api/test.service.spec.ts')).toBeTruthy();
    }
  );

  it('should not generate a spec file when unitTestRunner is none', async () => {
    await serviceGenerator(tree, { path: 'api/test', unitTestRunner: 'none' });

    expect(tree.exists('api/test.service.spec.ts')).toBeFalsy();
  });
});
