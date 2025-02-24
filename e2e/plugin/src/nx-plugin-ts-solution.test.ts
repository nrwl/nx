import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  readJson,
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

  it('should be able to generate a Nx Plugin with generators, executors and migrations', async () => {
    const plugin = uniq('plugin');
    const generator = uniq('generator');
    const executor = uniq('executor');
    const migrationVersion = '1.0.0';

    runCLI(
      `generate @nx/plugin:plugin packages/${plugin} --linter=eslint --unitTestRunner=jest --e2eTestRunner=jest --publishable`
    );
    runCLI(
      `generate @nx/plugin:generator packages/${plugin}/src/generators/${generator}/generator --name ${generator}`
    );
    runCLI(
      `generate @nx/plugin:executor packages/${plugin}/src/executors/${executor}/executor --name ${executor} --includeHasher`
    );
    runCLI(
      `generate @nx/plugin:migration packages/${plugin}/src/migrations/update-${migrationVersion}/update-${migrationVersion} --packageVersion=${migrationVersion} --packageJsonUpdates=false`
    );

    expect(runCLI(`lint @proj/${plugin}`)).toContain(
      `Successfully ran target lint for project @proj/${plugin}`
    );
    expect(runCLI(`typecheck @proj/${plugin}`)).toContain(
      `Successfully ran target typecheck for project @proj/${plugin}`
    );
    expect(runCLI(`build @proj/${plugin}`)).toContain(
      `Successfully ran target build for project @proj/${plugin}`
    );
    checkFilesExist(
      // entry point
      `packages/${plugin}/dist/index.js`,
      `packages/${plugin}/dist/index.d.ts`,
      // generator
      `packages/${plugin}/dist/generators/${generator}/schema.json`,
      `packages/${plugin}/dist/generators/${generator}/schema.d.ts`,
      `packages/${plugin}/dist/generators/${generator}/generator.js`,
      `packages/${plugin}/dist/generators/${generator}/generator.d.ts`,
      // executor
      `packages/${plugin}/dist/executors/${executor}/schema.json`,
      `packages/${plugin}/dist/executors/${executor}/schema.d.ts`,
      `packages/${plugin}/dist/executors/${executor}/executor.js`,
      `packages/${plugin}/dist/executors/${executor}/executor.d.ts`,
      `packages/${plugin}/dist/executors/${executor}/hasher.js`,
      `packages/${plugin}/dist/executors/${executor}/hasher.d.ts`,
      // migration
      `packages/${plugin}/dist/migrations/update-${migrationVersion}/update-${migrationVersion}.js`,
      `packages/${plugin}/dist/migrations/update-${migrationVersion}/update-${migrationVersion}.d.ts`
    );
    expect(runCLI(`test @proj/${plugin}`)).toContain(
      `Successfully ran target test for project @proj/${plugin}`
    );
    expect(runCLI(`e2e @proj/${plugin}-e2e`)).toContain(
      `Successfully ran target e2e for project @proj/${plugin}-e2e`
    );

    // Check that inferred targets also work
    updateJson('nx.json', (json) => {
      json.plugins.push({
        plugin: '@nx/jest/plugin',
        include: ['packages/*-e2e/**/*'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      return json;
    });
    updateJson(`packages/${plugin}-e2e/package.json`, (json) => {
      delete json.targets;
      return json;
    });
    expect(() => runCLI(`e2e @proj/${plugin}-e2e`)).not.toThrow();
  }, 90000);

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

  it('should respect and support generating plugins with a name different than the import path', async () => {
    const plugin = uniq('plugin');

    runCLI(
      `generate @nx/plugin:plugin packages/${plugin} --name=${plugin} --linter=eslint --publishable`
    );

    const packageJson = readJson(`packages/${plugin}/package.json`);
    expect(packageJson.nx.name).toBe(plugin);

    expect(runCLI(`build ${plugin}`)).toContain(
      `Successfully ran target build for project ${plugin}`
    );
    expect(runCLI(`typecheck ${plugin}`)).toContain(
      `Successfully ran target typecheck for project ${plugin}`
    );
    expect(runCLI(`lint ${plugin}`)).toContain(
      `Successfully ran target lint for project ${plugin}`
    );
  }, 90000);
});
