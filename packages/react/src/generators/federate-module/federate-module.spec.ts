import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, getProjects } from '@nx/devkit';
import { Schema } from './schema';
import { Schema as remoteSchma } from '../remote/schema';
import { federateModuleGenerator } from './federate-module';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { Linter } from '@nx/eslint';
import remoteGeneratorInternal from '../remote/remote';

describe('federate-module', () => {
  let tree: Tree;
  let schema: Schema = {
    name: 'my-federated-module',
    remote: 'myremote',
    remoteDirectory: 'myremote',
    path: 'myremote/src/my-federated-module.ts',
    style: 'css',
    skipFormat: true,
    bundler: 'webpack',
  };
  // TODO(@jaysoo): Turn this back to adding the plugin
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('myremote/src/my-federated-module.ts', ''); // Ensure that the file exists
  });
  describe('no remote', () => {
    it('should generate a remote and e2e', async () => {
      await federateModuleGenerator(tree, schema);

      const projects = getProjects(tree);

      expect(projects.get('myremote').root).toEqual('myremote');
      expect(projects.get('myremote-e2e').root).toEqual('myremote-e2e');
    });

    it('should contain an entry for the new path for module federation', async () => {
      await federateModuleGenerator(tree, schema);

      expect(tree.exists('myremote/module-federation.config.ts')).toBe(true);

      const content = tree.read(
        'myremote/module-federation.config.ts',
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'myremote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths['myremote/my-federated-module']
      ).toEqual(['myremote/src/my-federated-module.ts']);
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
      directory: 'my-existing-remote',
      e2eTestRunner: 'none',
      skipFormat: false,
      linter: Linter.EsLint,
      style: 'css',
      unitTestRunner: 'none',
      bundler: 'webpack',
    };

    beforeEach(async () => {
      remoteSchema.name = uniq('remote');
      await remoteGeneratorInternal(tree, remoteSchema);
    });

    it('should append the new path to the module federation config', async () => {
      let content = tree.read(
        `${remoteSchema.directory}/module-federation.config.ts`,
        'utf-8'
      );

      expect(content).not.toContain(
        `'./my-federated-module': 'myremote/src/my-federated-module.ts'`
      );

      await federateModuleGenerator(tree, {
        ...schema,
        remoteDirectory: remoteSchema.directory,
      });

      content = tree.read(
        `${remoteSchema.directory}/module-federation.config.ts`,
        'utf-8'
      );
      expect(content).toContain(
        `'./my-federated-module': 'myremote/src/my-federated-module.ts'`
      );

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      expect(
        tsconfig.compilerOptions.paths[`${schema.remote}/my-federated-module`]
      ).toEqual(['myremote/src/my-federated-module.ts']);
    });
  });
});

function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}
