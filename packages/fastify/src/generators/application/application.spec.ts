import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { fastifyVersion } from '../../utils/versions';
import { applicationGenerator } from './application';

describe('application generator', () => {
  let tree: Tree;
  const appName = 'myFastifyApp';
  const appDirectory = 'my-fastify-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  it('should generate files', async () => {
    await applicationGenerator(tree, { name: appName });

    expect(tree.exists(`apps/${appDirectory}/src/main.ts`)).toBeTruthy();

    const mainFile = tree.read(`apps/${appDirectory}/src/main.ts`).toString();
    expect(mainFile).toContain(
      `import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';`
    );
  });

  it('should configure tsconfig correctly', async () => {
    await applicationGenerator(tree, { name: appName });

    const tsConfig = devkit.readJson(
      tree,
      `apps/${appDirectory}/tsconfig.app.json`
    );
    expect(tsConfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    expect(tsConfig.compilerOptions.target).toBe('es2015');
    expect(tsConfig.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
  });

  describe('--skipFormat', () => {
    it('should format files', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: appName });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: appName, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe('Fastify versions', () => {
    it('should use Fastify 3 for empty workspace', async () => {
      await applicationGenerator(tree, { name: appName });
      const pkg = devkit.readJson(tree, `package.json`);

      expect(pkg.dependencies['fastify']).toBe(fastifyVersion);
    });
  });
});
