import { CreateNodesContextV2 } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodesV2 } from './plugin';

describe('@nx/oxlint/plugin', () => {
  let context: CreateNodesContextV2;
  let workspaceRoot: string;
  let configFiles: string[] = [];

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'oxlint-plugin-'));
    context = {
      nxJsonConfiguration: {
        targetDefaults: {
          oxlint: {
            cache: false,
          },
        },
      },
      workspaceRoot,
    };
  });

  afterEach(() => {
    jest.resetModules();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('should not create nodes without config files', async () => {
    createFiles({
      'libs/a/project.json': `{"name":"a"}`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'oxlint',
    });
    expect(results).toEqual({ projects: {} });
  });

  it('should create a target for a project when config exists', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'oxlint',
    });

    expect(results.projects['libs/a'].targets.oxlint).toMatchObject({
      command: 'oxlint .',
      cache: true,
      options: { cwd: 'libs/a' },
    });
  });

  it('should create a target when using oxlint.config.ts', async () => {
    createFiles({
      'oxlint.config.ts': `export default { rules: {} };`,
      'libs/a/project.json': `{"name":"a"}`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'oxlint',
    });

    expect(results.projects['libs/a'].targets.oxlint).toBeDefined();
  });

  it('uses custom targetName', async () => {
    createFiles({
      '.oxlintrc.json': `{"rules":{}}`,
      'libs/a/project.json': `{"name":"a"}`,
    });

    const results = await invokeCreateNodesOnMatchingFiles(context, {
      targetName: 'lint',
    });

    expect(results.projects['libs/a'].targets.lint).toBeDefined();
  });

  function createFiles(files: Record<string, string>) {
    Object.entries(files).forEach(([filePath, fileContent]) => {
      const absPath = join(workspaceRoot, filePath);
      mkdirSync(join(absPath, '..'), { recursive: true });
      writeFileSync(absPath, fileContent, 'utf-8');
    });
    configFiles = Object.keys(files).filter((file) =>
      minimatch(file, createNodesV2[0], { dot: true })
    );
  }

  async function invokeCreateNodesOnMatchingFiles(
    context: CreateNodesContextV2,
    options = {}
  ) {
    const aggregateProjects: Record<string, any> = {};
    const results = await createNodesV2[1](configFiles, options, context);
    for (const [, nodes] of results) {
      Object.assign(aggregateProjects, nodes.projects);
    }
    return {
      projects: aggregateProjects,
    };
  }
});
