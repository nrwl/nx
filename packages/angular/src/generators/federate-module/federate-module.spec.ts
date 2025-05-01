import 'nx/src/internal-testing-utils/mock-project-graph';

import { getProjects } from '@nx/devkit';
import { Schema } from './schema';
import { Schema as remoteSchma } from '../remote/schema';
import { federateModuleGenerator } from './federate-module';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import remoteGenerator from '../remote/remote';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

describe('federate-module', () => {
  let schema: Schema = {
    name: 'my-federated-module',
    remote: 'myremote',
    path: 'apps/myremote/src/my-federated-module.ts',
    remoteDirectory: 'apps/myremote',
  };

  describe('no remote', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    beforeEach(() => {
      tree.write(schema.path, `export const isEven = true;`);
    });

    it('should generate a remote and e2e and should contain an entry for the new path for module federation', async () => {
      await federateModuleGenerator(tree, schema);

      const projects = getProjects(tree);

      expect(projects.get('myremote').root).toEqual('apps/myremote');

      expect(tree.exists('apps/myremote/module-federation.config.ts')).toBe(
        true
      );

      const content = tree.read(
        'apps/myremote/module-federation.config.ts',
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'apps/myremote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths['myremote/my-federated-module']
      ).toEqual(['apps/myremote/src/my-federated-module.ts']);
    });
  });

  describe('with remote', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    let remoteSchema: remoteSchma = {
      name: 'myremote',
      directory: 'myremote',
      e2eTestRunner: E2eTestRunner.Cypress,
      skipFormat: true,
      linter: 'eslint',
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
        `'./my-federated-module': 'apps/myremote/src/my-federated-module.ts'`
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
        `'./my-federated-module': 'apps/myremote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths[
          `${remoteSchema.name}/my-federated-module`
        ]
      ).toEqual(['apps/myremote/src/my-federated-module.ts']);
    });
  });
});

function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}
