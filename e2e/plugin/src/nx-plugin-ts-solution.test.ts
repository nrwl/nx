import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  renameFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
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
    runCLI(`generate @nx/plugin:plugin packages/${plugin}`);

    // Setup project inference + target inference
    updateFile(`packages/${plugin}/src/index.ts`, NX_PLUGIN_V2_CONTENTS);

    // Register plugin in nx.json (required for inference)
    updateJson(`nx.json`, (nxJson) => {
      nxJson.plugins = [
        {
          plugin: `@${workspaceName}/${plugin}`,
          options: { inferredTags: ['my-tag'] },
        },
      ];
      return nxJson;
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

    runCLI(`generate @nx/plugin:plugin packages/${plugin} --linter eslint`);

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

    updateJson(`libs/${generatedProject}/project.json`, (project) => {
      project.targets['execute'] = {
        executor: `@${workspaceName}/${plugin}:${executor}`,
      };
      return project;
    });

    expect(() => checkFilesExist(`libs/${generatedProject}`)).not.toThrow();
    expect(() => runCLI(`execute ${generatedProject}`)).not.toThrow();
    expect(() => runCLI(`lint ${generatedProject}`)).not.toThrow();
  });

  it('should be able to resolve local generators and executors using package.json development condition export', async () => {
    const plugin = uniq('plugin');
    const generator = uniq('generator');
    const executor = uniq('executor');
    const generatedProject = uniq('project');

    runCLI(`generate @nx/plugin:plugin packages/${plugin}`);

    // move/generate everything in the "code" folder, which is not a standard location and wouldn't
    // be considered by the fall back resolution logic, so the only way it could be resolved is if
    // the development condition export is used
    renameFile(
      `packages/${plugin}/src/index.ts`,
      `packages/${plugin}/code/index.ts`
    );

    runCLI(
      `generate @nx/plugin:generator --name ${generator} --path packages/${plugin}/code/generators/${generator}/generator`
    );
    runCLI(
      `generate @nx/plugin:executor --name ${executor} --path packages/${plugin}/code/executors/${executor}/executor`
    );

    updateJson(`packages/${plugin}/package.json`, (pkg) => {
      pkg.nx.sourceRoot = `packages/${plugin}/code`;
      pkg.nx.targets.build.options.main = `packages/${plugin}/code/index.ts`;
      pkg.nx.targets.build.options.rootDir = `packages/${plugin}/code`;
      pkg.nx.targets.build.options.assets.forEach(
        (asset: { input: string }) => {
          asset.input = `./packages/${plugin}/code`;
        }
      );
      pkg.exports = {
        '.': {
          types: './dist/index.d.ts',
          development: './code/index.ts',
          default: './dist/index.js',
        },
        './package.json': './package.json',
        './generators.json': {
          development: './generators.json',
          default: './generators.json',
        },
        './executors.json': './executors.json',
        './dist/generators/*/schema.json': {
          development: './code/generators/*/schema.json',
          default: './dist/generators/*/schema.json',
        },
        './dist/generators/*/generator': {
          types: './dist/generators/*/generator.d.ts',
          development: './code/generators/*/generator.ts',
          default: './dist/generators/*/generator.js',
        },
        './dist/executors/*/schema.json': {
          development: './code/executors/*/schema.json',
          default: './dist/executors/*/schema.json',
        },
        './dist/executors/*/executor': {
          types: './dist/executors/*/executor.d.ts',
          development: './code/executors/*/executor.ts',
          default: './dist/executors/*/executor.js',
        },
      };
      return pkg;
    });

    updateJson(`packages/${plugin}/tsconfig.lib.json`, (tsconfig) => {
      tsconfig.compilerOptions.rootDir = 'code';
      tsconfig.include = ['code/**/*.ts'];
      return tsconfig;
    });

    updateFile(
      `packages/${plugin}/code/executors/${executor}/executor.ts`,
      ASYNC_GENERATOR_EXECUTOR_CONTENTS
    );

    runCLI(
      `generate @${workspaceName}/${plugin}:${generator} --name ${generatedProject}`
    );

    updateJson(`libs/${generatedProject}/project.json`, (project) => {
      project.targets['execute'] = {
        executor: `@${workspaceName}/${plugin}:${executor}`,
      };
      return project;
    });

    expect(() => checkFilesExist(`libs/${generatedProject}`)).not.toThrow();
    expect(() => runCLI(`execute ${generatedProject}`)).not.toThrow();
  });
});
