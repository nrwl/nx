import { CreateNodesContext } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { mkdirSync, rmSync } from 'node:fs';
import { createNodesV2, OxlintPluginOptions } from './plugin.js';

jest.mock('nx/src/utils/cache-directory', () => ({
  ...jest.requireActual('nx/src/utils/cache-directory'),
  workspaceDataDirectory: 'tmp/oxlint-project-graph-cache',
}));

describe('@nx/oxlint/plugin', () => {
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let configFiles: string[] = [];

  beforeEach(async () => {
    mkdirSync('tmp/oxlint-project-graph-cache', { recursive: true });
    tempFs = new TempFs('oxlint-plugin');
    context = {
      nxJsonConfiguration: {
        // Should be overridden by the plugin.
        targetDefaults: {
          lint: {
            cache: false,
            inputs: ['foo', '^foo'],
          },
        },
        namedInputs: {
          default: ['{projectRoot}/**/*'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    } as CreateNodesContext;
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
    rmSync('tmp/oxlint-project-graph-cache', { recursive: true, force: true });
  });

  it('should not create nodes when there is no oxlint config', async () => {
    createFiles({
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    expect(await invokeCreateNodesOnMatchingFiles(context)).toEqual({
      projects: {},
    });
  });

  it('should create a target for a project with lintable files', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint).toMatchObject({
      command: 'oxlint .',
      options: { cwd: 'libs/a' },
      cache: true,
    });
  });

  it('should not create a target for a project with no lintable files', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/docs/project.json': `{"name":"docs"}`,
      'libs/docs/README.md': `# docs`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/docs']).toBeUndefined();
  });

  it('should declare the config and its extends chain as inputs', async () => {
    createFiles({
      '.oxlintrc.json': `{"extends":["./configs/base.json"],"rules":{}}`,
      'configs/base.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint.inputs).toEqual(
      expect.arrayContaining([
        '{workspaceRoot}/.oxlintrc.json',
        '{workspaceRoot}/configs/base.json',
        { externalDependencies: ['oxlint'] },
      ])
    );
  });

  it('should create a target when using oxlint.config.mts', async () => {
    createFiles({
      'oxlint.config.mts': `export default { rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['libs/a'].targets.lint).toBeDefined();
  });

  it('should use a custom targetName', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
      'libs/a/src/index.ts': `export const a = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'oxlint',
    });

    expect(results.projects['libs/a'].targets.oxlint).toBeDefined();
  });

  it('should point a root project at ./src', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'package.json': `{"name":"root-workspace"}`,
      'src/index.ts': `export const value = 1;`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context);

    expect(results.projects['.'].targets.lint).toMatchObject({
      command: 'oxlint ./src',
    });
  });

  function createFiles(fileSys: Record<string, string>) {
    tempFs.createFilesSync(fileSys);
    configFiles = Object.keys(fileSys).filter((file) =>
      minimatch(file, createNodesV2[0], { dot: true })
    );
  }

  async function invokeCreateNodesOnMatchingFiles(
    context: CreateNodesContext,
    options: OxlintPluginOptions = {}
  ) {
    const aggregateProjects: Record<string, any> = {};
    const results = await createNodesV2[1](configFiles, options, context);
    for (const [, nodes] of results) {
      Object.assign(aggregateProjects, nodes.projects);
    }
    return { projects: aggregateProjects };
  }
});
