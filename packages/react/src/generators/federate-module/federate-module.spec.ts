import { Tree, getProjects } from '@nx/devkit';
import { Schema } from './schema';
import { Schema as remoteSchma } from '../remote/schema';
import { federateModuleGenerator } from './federate-module';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { Linter } from '@nx/eslint';
import { remoteGeneratorInternal } from '../remote/remote';

describe('federate-module', () => {
  let tree: Tree;
  let schema: Schema = {
    name: 'my-federated-module',
    remote: 'my-remote',
    path: 'my-remote/src/my-federated-module.ts',
    style: 'css',
  };

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('my-remote/src/my-federated-module.ts', ''); // Ensure that the file exists
  });
  describe('no remote', () => {
    it('should generate a remote and e2e', async () => {
      await federateModuleGenerator(tree, schema);

      const projects = getProjects(tree);

      expect(projects.get('my-remote').root).toEqual('my-remote');
      expect(projects.get('my-remote-e2e').root).toEqual('my-remote-e2e');
    });

    it('should contain an entry for the new path for module federation', async () => {
      await federateModuleGenerator(tree, schema);

      expect(tree.exists('my-remote/module-federation.config.js')).toBe(true);

      const content = tree.read(
        'my-remote/module-federation.config.js',
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'my-remote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths['my-remote/my-federated-module']
      ).toEqual(['my-remote/src/my-federated-module.ts']);
    });

    it('should error when invalid path is provided', async () => {
      await federateModuleGenerator(tree, {
        ...schema,
        path: 'invalid/path',
      }).catch((e) => {
        expect(e.message).toContain(
          'The "path" provided  does not exist. Please verify the path is correct and pointing to a file that exists in the workspace.'
        );
      });
    });
  });

  describe('with remote', () => {
    let remoteSchema: remoteSchma = {
      name: 'my-remote',
      e2eTestRunner: 'none',
      skipFormat: false,
      linter: Linter.EsLint,
      style: 'css',
      unitTestRunner: 'none',
    };

    beforeEach(async () => {
      remoteSchema.name = uniq('remote');
      await remoteGeneratorInternal(tree, remoteSchema);
    });

    it('should append the new path to the module federation config', async () => {
      let content = tree.read(
        `${remoteSchema.name}/module-federation.config.js`,
        'utf-8'
      );

      expect(content).not.toContain(
        `'./my-federated-module': 'my-remote/src/my-federated-module.ts'`
      );

      await federateModuleGenerator(tree, {
        ...schema,
        remote: remoteSchema.name,
      });

      content = tree.read(
        `${remoteSchema.name}/module-federation.config.js`,
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'my-remote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths[
          `${remoteSchema.name}/my-federated-module`
        ]
      ).toEqual(['my-remote/src/my-federated-module.ts']);
    });
  });
});

function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}
