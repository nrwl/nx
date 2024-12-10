import type { ProjectConfiguration } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import {
  ASYNC_GENERATOR_EXECUTOR_CONTENTS,
  NX_PLUGIN_V2_CONTENTS,
} from './nx-plugin.fixtures';

describe('Nx Plugin (TS solution)', () => {
  let workspaceName: string;

  beforeAll(() => {
    workspaceName = newProject({ preset: 'ts', packages: ['@nx/plugin'] });
  });

  afterAll(() => cleanupProject());

  it('should be able to infer projects and targets', async () => {
    const plugin = uniq('plugin');
    runCLI(`generate @nx/plugin:plugin packages/${plugin} --linter=eslint`);

    // Setup project inference + target inference
    updateFile(`packages/${plugin}/src/index.ts`, NX_PLUGIN_V2_CONTENTS);

    // Register plugin in nx.json (required for inference)
    updateFile(`nx.json`, (nxJson) => {
      const nx = JSON.parse(nxJson);
      nx.plugins = [
        {
          plugin: `@${workspaceName}/${plugin}`,
          options: { inferredTags: ['my-tag'] },
        },
      ];
      return JSON.stringify(nx, null, 2);
    });

    // Create project that should be inferred by Nx
    const inferredProject = uniq('inferred');
    createFile(
      `packages/${inferredProject}/package.json`,
      JSON.stringify({
        name: inferredProject,
        version: '0.0.1',
      })
    );
    createFile(`packages/${inferredProject}/my-project-file`);

    // Attempt to use inferred project w/ Nx
    expect(runCLI(`build ${inferredProject}`)).toContain(
      'custom registered target'
    );
    const configuration = JSON.parse(
      runCLI(`show project ${inferredProject} --json`)
    );
    expect(configuration.tags).toContain('my-tag');
    expect(configuration.metadata.technologies).toEqual(['my-plugin']);
  });

  it('should be able to use local generators and executors', async () => {
    const plugin = uniq('plugin');
    const generator = uniq('generator');
    const executor = uniq('executor');
    const generatedProject = uniq('project');

    runCLI(`generate @nx/plugin:plugin packages/${plugin} --linter=eslint`);

    runCLI(
      `generate @nx/plugin:generator --name ${generator} --path packages/${plugin}/src/generators/${generator}/generator`
    );

    runCLI(
      `generate @nx/plugin:executor --name ${executor} --path packages/${plugin}/src/executors/${executor}/executor`
    );

    updateFile(
      `packages/${plugin}/src/executors/${executor}/executor.ts`,
      ASYNC_GENERATOR_EXECUTOR_CONTENTS
    );

    runCLI(
      `generate @${workspaceName}/${plugin}:${generator} --name ${generatedProject}`
    );

    updateFile(`libs/${generatedProject}/project.json`, (f) => {
      const project: ProjectConfiguration = JSON.parse(f);
      project.targets['execute'] = {
        executor: `@${workspaceName}/${plugin}:${executor}`,
      };
      return JSON.stringify(project, null, 2);
    });

    expect(() => checkFilesExist(`libs/${generatedProject}`)).not.toThrow();
    expect(() => runCLI(`execute ${generatedProject}`)).not.toThrow();
  });
});
