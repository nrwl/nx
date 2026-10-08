import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { mockCjsModule as mockConverterModule } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { RollupPluginOptions } from '../../plugins/plugin';
import convertToInferred, * as converter from '../../generators/convert-to-inferred/convert-to-inferred';

interface CreateProjectOptions {
  name: string;
  root: string;
  targetName: string;
  targetOptions: Record<string, unknown>;
  targetOutputs: string[];
  targetInputs?: unknown[];
  additionalTargetProperties?: Record<string, unknown>;
}

const defaultCreateProjectOptions: CreateProjectOptions = {
  name: 'mypkg',
  root: 'mypkg',
  targetName: 'build',
  targetOptions: {},
  targetOutputs: ['{options.outputPath}'],
};

function createProject(tree: Tree, opts: Partial<CreateProjectOptions> = {}) {
  const projectOpts = {
    ...defaultCreateProjectOptions,
    ...opts,
    targetOptions:
      opts.targetOptions === null ? undefined : { ...opts.targetOptions },
  };

  if (projectOpts.targetOptions) {
    projectOpts.targetOptions.main ??= `${projectOpts.root}/src/index.ts`;
    projectOpts.targetOptions.outputPath ??= `dist/${projectOpts.root}`;
    projectOpts.targetOptions.tsConfig ??= `${projectOpts.root}/tsconfig.lib.json`;
    projectOpts.targetOptions.compiler ??= 'babel';
    projectOpts.targetOptions.format ??= projectOpts.targetOptions.f ?? ['esm'];
    projectOpts.targetOptions.external ??= [];
    projectOpts.targetOptions.assets ??= [];
  }

  const project: ProjectConfiguration = {
    name: projectOpts.name,
    root: projectOpts.root,
    projectType: 'library',
    targets: {
      [projectOpts.targetName]: {
        executor: '@nx/rollup:rollup',
        outputs: projectOpts.targetOutputs ?? ['{options.outputPath}'],
        options: projectOpts.targetOptions,
        ...projectOpts.additionalTargetProperties,
      },
    },
  };

  addProjectConfiguration(tree, project.name, project);

  return project;
}

import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockConverterModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createProject(tree, { name: 'mypkg', root: 'mypkg' });

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rollup/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
        },
        "plugin": "@nx/rollup/plugin",
      }
    `);
    expect(
      readProjectConfiguration(tree, project.name).targets
    ).toMatchInlineSnapshot(`{}`);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
