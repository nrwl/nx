import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { PackageJson } from 'nx/src/utils/package-json';
import pluginGenerator from '../plugin/plugin';
import { createPackageGenerator } from './create-package';
import { CreatePackageSchema } from './schema';
import { setCwd } from '@nx/devkit/internal-testing-utils';
import { tsLibVersion } from '@nx/js/src/utils/versions';
import { nxVersion } from 'nx/src/utils/versions';

const getSchema: (
  overrides?: Partial<CreatePackageSchema>
) => CreatePackageSchema = (overrides = {}) => ({
  name: 'create-a-workspace',
  directory: 'packages/create-a-workspace',
  project: 'my-plugin',
  compiler: 'tsc',
  skipTsConfig: false,
  skipFormat: false,
  skipLintChecks: false,
  linter: Linter.EsLint,
  unitTestRunner: 'jest',
  projectNameAndRootFormat: 'as-provided',
  ...overrides,
});

describe('NxPlugin Create Package Generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    setCwd('');
    await pluginGenerator(tree, {
      name: 'my-plugin',
      directory: 'packages/my-plugin',
      compiler: 'tsc',
      skipTsConfig: false,
      skipFormat: false,
      skipLintChecks: false,
      linter: Linter.EsLint,
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
    });
  });

  it('should update the project.json file', async () => {
    await createPackageGenerator(tree, getSchema());
    const project = readProjectConfiguration(tree, 'create-a-workspace');
    expect(project.root).toEqual('packages/create-a-workspace');
    expect(project.sourceRoot).toEqual('packages/create-a-workspace/bin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/packages/create-a-workspace',
        tsConfig: 'packages/create-a-workspace/tsconfig.lib.json',
        main: 'packages/create-a-workspace/bin/index.ts',
        assets: ['packages/create-a-workspace/*.md'],
      },
    });
  });

  it('should place the create-package plugin in a directory', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        directory: 'clis/create-a-workspace',
      } as Partial<CreatePackageSchema>)
    );
    const project = readProjectConfiguration(tree, 'create-a-workspace');
    expect(project.root).toEqual('clis/create-a-workspace');
  });

  it('should create a preset generator in the plugin', async () => {
    await createPackageGenerator(tree, getSchema());

    expect(
      tree.exists('packages/my-plugin/src/generators/preset/generator.ts')
    ).toBeTruthy();
  });

  it('should specify tsc as compiler', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        compiler: 'tsc',
      })
    );

    const { build } = readProjectConfiguration(
      tree,
      'create-a-workspace'
    ).targets;

    expect(build.executor).toEqual('@nx/js:tsc');
  });

  it('should specify swc as compiler', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        compiler: 'swc',
      })
    );

    const { build } = readProjectConfiguration(
      tree,
      'create-a-workspace'
    ).targets;

    expect(build.executor).toEqual('@nx/js:swc');
  });

  it("should use name as default for the package.json's name", async () => {
    await createPackageGenerator(tree, getSchema());

    const { root } = readProjectConfiguration(tree, 'create-a-workspace');
    const { name } = readJson<PackageJson>(
      tree,
      joinPathFragments(root, 'package.json')
    );

    expect(name).toEqual('create-a-workspace');
  });

  it("should have valid default package.json's dependencies", async () => {
    await createPackageGenerator(tree, getSchema());

    const { root } = readProjectConfiguration(tree, 'create-a-workspace');
    const { dependencies } = readJson<PackageJson>(
      tree,
      joinPathFragments(root, 'package.json')
    );

    expect(dependencies).toEqual(
      expect.objectContaining({
        'create-nx-workspace': nxVersion,
        tslib: tsLibVersion,
      })
    );
  });
});
