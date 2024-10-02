import 'nx/src/internal-testing-utils/mock-project-graph';

import { getProjects } from '@nx/devkit';
import { Schema } from './schema';
import { Schema as remoteSchma } from '../remote/schema';
import { federateModuleGenerator } from './federate-module';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { Linter } from '@nx/eslint';
import remoteGenerator from '../remote/remote';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

describe('federate-module', () => {
  let schema: Schema = {
    name: 'my-federated-module',
    remote: 'my-remote',
    path: 'apps/my-remote/src/my-federated-module.ts',
    remoteDirectory: 'apps/my-remote',
  };

  describe('no remote', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    beforeEach(() => {
      tree.write(schema.path, `export const isEven = true;`);
    });

    it('should generate a remote and e2e and should contain an entry for the new path for module federation', async () => {
      await federateModuleGenerator(tree, schema);

      const projects = getProjects(tree);

      expect(projects.get('my-remote').root).toEqual('apps/my-remote');

      expect(tree.exists('apps/my-remote/module-federation.config.ts')).toBe(
        true
      );

      const content = tree.read(
        'apps/my-remote/module-federation.config.ts',
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'apps/my-remote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths['my-remote/my-federated-module']
      ).toEqual(['apps/my-remote/src/my-federated-module.ts']);
    });
  });

  describe('with remote', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    let remoteSchema: remoteSchma = {
      name: 'my-remote',
      directory: 'my-remote',
      e2eTestRunner: E2eTestRunner.Cypress,
      skipFormat: true,
      linter: Linter.EsLint,
      style: 'css',
      unitTestRunner: UnitTestRunner.Jest,
    };

    beforeEach(async () => {
      remoteSchema.name = uniq('remote');
      await remoteGenerator(tree, {
        ...remoteSchema,
        directory: `apps/${remoteSchema.name}`,
      });
      tree.write(schema.path, `export const isEven = true;`);
    });

    it('should append the new path to the module federation config', async () => {
      let content = tree.read(
        `apps/${remoteSchema.name}/module-federation.config.ts`,
        'utf-8'
      );

      expect(content).not.toContain(
        `'./my-federated-module': 'apps/my-remote/src/my-federated-module.ts'`
      );

      await federateModuleGenerator(tree, {
        ...schema,
        remote: remoteSchema.name,
        skipFormat: true,
      });

      content = tree.read(
        `apps/${remoteSchema.name}/module-federation.config.ts`,
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'apps/my-remote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths[
          `${remoteSchema.name}/my-federated-module`
        ]
      ).toEqual(['apps/my-remote/src/my-federated-module.ts']);
    });
  });
});

function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}
