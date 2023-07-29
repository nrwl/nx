import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { PackageJson } from 'nx/src/utils/package-json';
import pluginGenerator from '../plugin/plugin';
import { createPackageGenerator } from './create-package';
import { CreatePackageSchema } from './schema';

const getSchema: (
  overrides?: Partial<CreatePackageSchema>
) => CreatePackageSchema = (overrides = {}) => ({
  name: 'create-a-workspace',
  project: 'my-plugin',
  compiler: 'tsc',
  skipTsConfig: false,
  skipFormat: false,
  skipLintChecks: false,
  linter: Linter.EsLint,
  unitTestRunner: 'jest',
  ...overrides,
});

describe('NxPlugin Create Package Generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await pluginGenerator(tree, {
      name: 'my-plugin',
      compiler: 'tsc',
      skipTsConfig: false,
      skipFormat: false,
      skipLintChecks: false,
      linter: Linter.EsLint,
      unitTestRunner: 'jest',
    });
  });

  it('should update the project.json file', async () => {
    await createPackageGenerator(tree, getSchema());
    const project = readProjectConfiguration(tree, 'create-a-workspace');
    expect(project.root).toEqual('libs/create-a-workspace');
    expect(project.sourceRoot).toEqual('libs/create-a-workspace/bin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/libs/create-a-workspace',
        tsConfig: 'libs/create-a-workspace/tsconfig.lib.json',
        main: 'libs/create-a-workspace/bin/index.ts',
        assets: ['libs/create-a-workspace/*.md'],
        updateBuildableProjectDepsInPackageJson: false,
      },
    });
  });

  it('should place the create-package plugin in a directory', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        directory: 'plugins',
      } as Partial<CreatePackageSchema>)
    );
    const project = readProjectConfiguration(
      tree,
      'plugins-create-a-workspace'
    );
    expect(project.root).toEqual('libs/plugins/create-a-workspace');
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
});
