import { ProjectConfiguration } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  createFile,
  expectTestsPass,
  getPackageManagerCommand,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import type { PackageJson } from 'nx/src/utils/package-json';

import { join } from 'path';
import {
  ASYNC_GENERATOR_EXECUTOR_CONTENTS,
  NX_PLUGIN_V2_CONTENTS,
} from './nx-plugin.fixtures';

describe('Nx Plugin', () => {
  let workspaceName: string;

  beforeAll(() => {
    workspaceName = newProject();
  });

  afterAll(() => cleanupProject());

  it('should be able to generate a Nx Plugin ', async () => {
    const plugin = uniq('plugin');

    runCLI(
      `generate @nx/plugin:plugin ${plugin} --linter=eslint --e2eTestRunner=jest --publishable`
    );
    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting');

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/${plugin}/package.json`,
      `dist/${plugin}/src/index.js`
    );
    const project = readJson(`${plugin}/project.json`);
    expect(project).toMatchObject({
      tags: [],
    });

    runCLI(`e2e ${plugin}-e2e`);
  }, 90000);

  it('should be able to generate a migration', async () => {
    const plugin = uniq('plugin');
    const version = '1.0.0';

    runCLI(`generate @nx/plugin:plugin ${plugin} --linter=eslint`);
    runCLI(
      `generate @nx/plugin:migration --path=${plugin}/src/migrations/update-${version}/update-${version} --packageVersion=${version} --packageJsonUpdates=false`
    );

    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/${plugin}/src/migrations/update-${version}/update-${version}.js`,
      `${plugin}/src/migrations/update-${version}/update-${version}.ts`
    );
    const migrationsJson = readJson(`${plugin}/migrations.json`);
    expect(migrationsJson).toMatchObject({
      generators: expect.objectContaining({
        [`update-${version}`]: {
          version,
          description: `Migration for v1.0.0`,
          implementation: `./src/migrations/update-${version}/update-${version}`,
        },
      }),
    });
  }, 90000);

  it('should be able to generate a generator', async () => {
    const plugin = uniq('plugin');
    const generator = uniq('generator');

    runCLI(`generate @nx/plugin:plugin ${plugin} --linter=eslint`);
    runCLI(
      `generate @nx/plugin:generator ${plugin}/src/generators/${generator}/generator --name ${generator}`
    );

    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `${plugin}/src/generators/${generator}/schema.d.ts`,
      `${plugin}/src/generators/${generator}/schema.json`,
      `${plugin}/src/generators/${generator}/generator.ts`,
      `${plugin}/src/generators/${generator}/generator.spec.ts`,
      `dist/${plugin}/src/generators/${generator}/schema.d.ts`,
      `dist/${plugin}/src/generators/${generator}/schema.json`,
      `dist/${plugin}/src/generators/${generator}/generator.js`
    );
    const generatorJson = readJson(`${plugin}/generators.json`);
    expect(generatorJson).toMatchObject({
      generators: expect.objectContaining({
        [generator]: {
          factory: `./src/generators/${generator}/generator`,
          schema: `./src/generators/${generator}/schema.json`,
          description: `${generator} generator`,
        },
      }),
    });
  }, 90000);

  it('should be able to generate an executor', async () => {
    const plugin = uniq('plugin');
    const executor = uniq('executor');

    runCLI(`generate @nx/plugin:plugin ${plugin} --linter=eslint`);
    runCLI(
      `generate @nx/plugin:executor --name ${executor} --path=${plugin}/src/executors/${executor}/executor --includeHasher`
    );

    const lintResults = runCLI(`lint ${plugin}`);
    expect(lintResults).toContain('All files pass linting');

    expectTestsPass(await runCLIAsync(`test ${plugin}`));

    const buildResults = runCLI(`build ${plugin}`);
    expect(buildResults).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `${plugin}/src/executors/${executor}/schema.d.ts`,
      `${plugin}/src/executors/${executor}/schema.json`,
      `${plugin}/src/executors/${executor}/executor.ts`,
      `${plugin}/src/executors/${executor}/hasher.ts`,
      `${plugin}/src/executors/${executor}/executor.spec.ts`,
      `dist/${plugin}/src/executors/${executor}/schema.d.ts`,
      `dist/${plugin}/src/executors/${executor}/schema.json`,
      `dist/${plugin}/src/executors/${executor}/executor.js`,
      `dist/${plugin}/src/executors/${executor}/hasher.js`
    );
    const executorsJson = readJson(`${plugin}/executors.json`);
    expect(executorsJson).toMatchObject({
      executors: expect.objectContaining({
        [executor]: {
          implementation: `./src/executors/${executor}/executor`,
          hasher: `./src/executors/${executor}/hasher`,
          schema: `./src/executors/${executor}/schema.json`,
          description: `${executor} executor`,
        },
      }),
    });
  }, 90000);

  it('should catch invalid implementations, schemas, and version in lint', async () => {
    const plugin = uniq('plugin');
    const goodGenerator = uniq('good-generator');
    const goodExecutor = uniq('good-executor');
    const badExecutorBadImplPath = uniq('bad-executor');
    const goodMigration = uniq('good-migration');
    const badFactoryPath = uniq('bad-generator');
    const badMigrationVersion = uniq('bad-version');
    const missingMigrationVersion = uniq('missing-version');

    // Generating the plugin results in a generator also called {plugin},
    // as well as an executor called "build"
    runCLI(`generate @nx/plugin:plugin ${plugin} --linter=eslint`);

    runCLI(
      `generate @nx/plugin:generator --name=${goodGenerator} --path=${plugin}/src/generators/${goodGenerator}/generator`
    );

    runCLI(
      `generate @nx/plugin:generator --name=${badFactoryPath} --path=${plugin}/src/generators/${badFactoryPath}/generator`
    );

    runCLI(
      `generate @nx/plugin:executor --name=${goodExecutor} --path=${plugin}/src/executors/${goodExecutor}/executor`
    );

    runCLI(
      `generate @nx/plugin:executor --name=${badExecutorBadImplPath} --path=${plugin}/src/executors/${badExecutorBadImplPath}/executor`
    );

    runCLI(
      `generate @nx/plugin:migration --name=${badMigrationVersion} --path=${plugin}/src/migrations --packageVersion="invalid"`
    );

    runCLI(
      `generate @nx/plugin:migration --name=${missingMigrationVersion} --path=${plugin}/migrations/0.1.0 --packageVersion="0.1.0"`
    );

    runCLI(
      `generate @nx/plugin:migration --name=${goodMigration} --path=${plugin}/migrations/0.1.0  --packageVersion="0.1.0"`
    );

    updateFile(`${plugin}/generators.json`, (f) => {
      const json = JSON.parse(f);
      // @proj/plugin:plugin has an invalid implementation path
      json.generators[
        badFactoryPath
      ].factory = `./generators/${plugin}/bad-path`;
      // @proj/plugin:non-existant has a missing implementation path amd schema
      json.generators['non-existant-generator'] = {};
      return JSON.stringify(json);
    });

    updateFile(`${plugin}/executors.json`, (f) => {
      const json = JSON.parse(f);
      // @proj/plugin:badExecutorBadImplPath has an invalid implementation path
      json.executors[badExecutorBadImplPath].implementation =
        './executors/bad-path';
      // @proj/plugin:non-existant has a missing implementation path amd schema
      json.executors['non-existant-executor'] = {};
      return JSON.stringify(json);
    });

    updateFile(`${plugin}/migrations.json`, (f) => {
      const json = JSON.parse(f);
      delete json.generators[missingMigrationVersion].version;
      return JSON.stringify(json);
    });

    const results = runCLI(`lint ${plugin}`, { silenceError: true });
    expect(results).toContain(
      `${badFactoryPath}: Implementation path should point to a valid file`
    );
    expect(results).toContain(
      `non-existant-generator: Missing required property - \`schema\``
    );
    expect(results).toContain(
      `non-existant-generator: Missing required property - \`implementation\``
    );
    expect(results).not.toContain(goodGenerator);

    expect(results).toContain(
      `${badExecutorBadImplPath}: Implementation path should point to a valid file`
    );
    expect(results).toContain(
      `non-existant-executor: Missing required property - \`schema\``
    );
    expect(results).toContain(
      `non-existant-executor: Missing required property - \`implementation\``
    );
    expect(results).not.toContain(goodExecutor);

    expect(results).toContain(
      `${missingMigrationVersion}: Missing required property - \`version\``
    );
    expect(results).toContain(
      `${badMigrationVersion}: Version should be a valid semver`
    );
    expect(results).not.toContain(goodMigration);
  });

  describe('local plugins', () => {
    let plugin: string;
    beforeEach(() => {
      plugin = uniq('plugin');
      runCLI(`generate @nx/plugin:plugin ${plugin} --linter=eslint`);
    });

    it('should be able to infer projects and targets', async () => {
      // Setup project inference + target inference
      updateFile(`${plugin}/src/index.ts`, NX_PLUGIN_V2_CONTENTS);

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
      createFile(`${inferredProject}/my-project-file`);

      // Attempt to use inferred project w/ Nx
      expect(runCLI(`build ${inferredProject}`)).toContain(
        'custom registered target'
      );
      const configuration = JSON.parse(
        runCLI(`show project ${inferredProject} --json`)
      );
      expect(configuration.tags).toEqual(['my-tag']);
      expect(configuration.metadata.technologies).toEqual(['my-plugin']);
    });

    it('should be able to use local generators and executors', async () => {
      const generator = uniq('generator');
      const executor = uniq('executor');
      const generatedProject = uniq('project');

      runCLI(
        `generate @nx/plugin:generator --name ${generator} --path ${plugin}/src/generators/${generator}/generator`
      );

      runCLI(
        `generate @nx/plugin:executor --name ${executor} --path ${plugin}/src/executors/${executor}/executor`
      );

      updateFile(
        `${plugin}/src/executors/${executor}/executor.ts`,
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

    it('should work with ts-node only', async () => {
      const oldPackageJson: PackageJson = readJson('package.json');
      updateJson<PackageJson>('package.json', (j) => {
        delete j.dependencies['@swc-node/register'];
        delete j.devDependencies['@swc-node/register'];
        return j;
      });
      runCommand(getPackageManagerCommand().install);

      const generator = uniq('generator');

      expect(() => {
        runCLI(
          `generate @nx/plugin:generator ${plugin}/src/generators/${generator}/generator --name ${generator}`
        );

        runCLI(
          `generate @${workspaceName}/${plugin}:${generator} --name ${uniq(
            'test'
          )}`
        );
      }).not.toThrow();
      updateFile('package.json', JSON.stringify(oldPackageJson, null, 2));
      runCommand(getPackageManagerCommand().install);
    });
  });

  describe('--directory', () => {
    it('should create a plugin in the specified directory', async () => {
      const plugin = uniq('plugin');
      runCLI(
        `generate @nx/plugin:plugin libs/subdir/${plugin} --linter=eslint  --e2eTestRunner=jest`
      );
      checkFilesExist(`libs/subdir/${plugin}/package.json`);
      const pluginProject = readJson(
        join('libs', 'subdir', plugin, 'project.json')
      );
      const pluginE2EProject = readJson(
        join('libs', 'subdir', `${plugin}-e2e`, 'project.json')
      );
      expect(pluginProject.targets).toBeDefined();
      expect(pluginE2EProject).toBeTruthy();
    }, 90000);
  });
  describe('--tags', () => {
    it('should add tags to project configuration', () => {
      const plugin = uniq('plugin');
      runCLI(
        `generate @nx/plugin:plugin ${plugin} --linter=eslint --tags=e2etag,e2ePackage `
      );
      const pluginProject = readJson(join(plugin, 'project.json'));
      expect(pluginProject.tags).toEqual(['e2etag', 'e2ePackage']);
    }, 90000);
  });

  it('should be able to generate a create-package plugin without e2e tests', async () => {
    const plugin = uniq('plugin');
    const createAppName = `create-${plugin}-app`;
    runCLI(
      `generate @nx/plugin:plugin ${plugin} --e2eTestRunner jest --publishable`
    );
    runCLI(
      `generate @nx/plugin:create-package ${createAppName} --name=${createAppName} --project=${plugin} --verbose`
    );

    const buildResults = runCLI(`build ${createAppName}`);
    expect(buildResults).toContain('Done compiling TypeScript files');

    checkFilesExist(
      `${plugin}/src/generators/preset`,
      `${createAppName}`,
      `dist/${createAppName}/bin/index.js`
    );
  });

  it('should be able to generate a create-package plugin ', async () => {
    const plugin = uniq('plugin');
    const createAppName = `create-${plugin}-app`;
    runCLI(
      `generate @nx/plugin:plugin ${plugin} --e2eTestRunner jest --publishable`
    );
    runCLI(
      `generate @nx/plugin:create-package ${createAppName} --name=${createAppName} --project=${plugin} --e2eProject=${plugin}-e2e --verbose`
    );

    const buildResults = runCLI(`build ${createAppName}`);
    expect(buildResults).toContain('Done compiling TypeScript files');

    checkFilesExist(
      `${plugin}/src/generators/preset`,
      `${createAppName}`,
      `dist/${createAppName}/bin/index.js`
    );

    runCLI(`e2e ${plugin}-e2e`);
  });

  it('should throw an error when run create-package for an invalid plugin ', async () => {
    const plugin = uniq('plugin');
    expect(() =>
      runCLI(
        `generate @nx/plugin:create-package create-${plugin} --name=create-${plugin} --project=invalid-plugin`
      )
    ).toThrow();
  });

  it('should support the new name and root format', async () => {
    const plugin = uniq('plugin');
    const createAppName = `create-${plugin}-app`;

    runCLI(
      `generate @nx/plugin:plugin ${plugin} --e2eTestRunner jest --publishable`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${plugin}/src/index.ts`);
    // check build works
    expect(runCLI(`build ${plugin}`)).toContain(
      `Successfully ran target build for project ${plugin}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${plugin}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${plugin}`
    );

    runCLI(
      `generate @nx/plugin:create-package ${createAppName} --name=${createAppName} --project=${plugin} --e2eProject=${plugin}-e2e`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${plugin}/src/generators/preset`, `${createAppName}`);
    // check build works
    expect(runCLI(`build ${createAppName}`)).toContain(
      `Successfully ran target build for project ${createAppName}`
    );
    // check tests pass
    const libTestResult = runCLI(`test ${createAppName}`);
    expect(libTestResult).toContain(
      `Successfully ran target test for project ${createAppName}`
    );
  });
});
