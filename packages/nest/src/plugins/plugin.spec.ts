import * as childProcess from 'node:child_process';
import * as devkitModule from '@nx/devkit';
import type { CreateNodesContext } from '@nx/devkit';
import { TS_SOLUTION_SETUP_TSCONFIG_INPUT } from '@nx/js/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodes } from './plugin';

const defaultNestCliConfig = {
  $schema: 'https://json.schemastore.org/nest-cli',
  collection: '@nestjs/schematics',
  sourceRoot: 'src',
};

describe('@nx/nest/plugin', () => {
  const createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(() => {
    tempFs = new TempFs('nest-plugin-tests');
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
    context = {
      workspaceRoot: tempFs.tempDir,
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
    };

    jest
      .spyOn(childProcess, 'exec')
      .mockImplementation((() => undefined) as any);
    jest.spyOn(childProcess, 'execSync').mockImplementation((() => {
      throw new Error('execSync should not be called by @nx/nest/plugin');
    }) as any);
    jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
      throw new Error('spawn should not be called by @nx/nest/plugin');
    }) as any);
    jest.spyOn(childProcess, 'spawnSync').mockImplementation((() => {
      throw new Error('spawnSync should not be called by @nx/nest/plugin');
    }) as any);
    jest.spyOn(devkitModule, 'generateFiles').mockImplementation(() => {});
    jest.spyOn(devkitModule, 'formatFiles').mockResolvedValue(undefined);
    jest
      .spyOn(devkitModule, 'runTasksInSerial')
      .mockImplementation((() => () => Promise.resolve()) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    tempFs.cleanup();
    process.chdir(cwd);
  });

  it('detects a root Nest CLI project', async () => {
    await tempFs.createFiles(createNestProjectFiles('.'));

    const results = await createNodesFunction(['nest-cli.json'], {}, context);

    expect(results).toEqual([
      [
        'nest-cli.json',
        {
          projects: {
            '.': {
              root: '.',
              targets: {
                build: {
                  cache: true,
                  command: 'nest build',
                  dependsOn: ['^build'],
                  inputs: [
                    'production',
                    '^production',
                    {
                      externalDependencies: ['@nestjs/cli'],
                    },
                    TS_SOLUTION_SETUP_TSCONFIG_INPUT,
                  ],
                  metadata: {
                    description: 'Build the Nest project.',
                    technologies: ['nest'],
                  },
                  options: {
                    cwd: '.',
                  },
                  outputs: ['{projectRoot}/dist'],
                },
                start: {
                  command: 'nest start',
                  continuous: true,
                  metadata: {
                    description: 'Run the Nest project.',
                    technologies: ['nest'],
                  },
                  options: {
                    cwd: '.',
                  },
                },
              },
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        },
      ],
    ]);
  });

  it('detects a nested Nest CLI project', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const results = await createNodesFunction(
      ['apps/api/nest-cli.json'],
      {},
      context
    );

    expect(results[0][1].projects['apps/api']).toMatchObject({
      root: 'apps/api',
      metadata: {
        technologies: ['nest'],
      },
    });
  });

  it('ignores nest-cli.json without package.json or project.json', async () => {
    await tempFs.createFiles({
      'tools/nest-cli.json': JSON.stringify(defaultNestCliConfig, null, 2),
    });

    const results = await createNodesFunction(
      ['tools/nest-cli.json'],
      {},
      context
    );

    expect(results).toEqual([]);
  });

  it('infers a build target', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.build).toBeDefined();
  });

  it('infers a start target', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.start).toBeDefined();
  });

  it('build target uses the Nest CLI command', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.build).toMatchObject({
      command: 'nest build',
      options: {
        cwd: 'apps/api',
      },
    });
  });

  it('start target uses the Nest CLI command', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.start).toMatchObject({
      command: 'nest start',
      continuous: true,
      options: {
        cwd: 'apps/api',
      },
    });
  });

  it('build target includes the root tsconfig input', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.build.inputs).toContainEqual(
      TS_SOLUTION_SETUP_TSCONFIG_INPUT
    );
  });

  it('build target has conservative outputs', async () => {
    await tempFs.createFiles(
      createNestProjectFiles('apps/api', {
        compilerOptions: {
          outputPath: 'build',
        },
      })
    );

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.build.outputs).toEqual(['{projectRoot}/build']);
  });

  it('custom buildTargetName works', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json', {
      buildTargetName: 'compile',
    });

    expect(project.targets.compile).toMatchObject({
      command: 'nest build',
      dependsOn: ['^compile'],
    });
    expect(project.targets.build).toBeUndefined();
  });

  it('custom startTargetName works', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json', {
      startTargetName: 'dev',
    });

    expect(project.targets.dev).toMatchObject({
      command: 'nest start',
      continuous: true,
    });
    expect(project.targets.start).toBeUndefined();
  });

  it('deprecated serveTargetName still works', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json', {
      serveTargetName: 'dev',
    });

    expect(project.targets.dev).toMatchObject({
      command: 'nest start',
      continuous: true,
    });
    expect(project.targets.start).toBeUndefined();
  });

  it('detects a Nest project when project.json is present', async () => {
    const files = createNestProjectFiles('apps/api');
    delete files['apps/api/package.json'];
    files['apps/api/project.json'] = JSON.stringify({ name: 'api' }, null, 2);

    await tempFs.createFiles(files);

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.root).toBe('apps/api');
  });

  it('does not infer a test target', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.test).toBeUndefined();
  });

  it('does not infer a lint target', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    const project = await createProject('apps/api/nest-cli.json');

    expect(project.targets.lint).toBeUndefined();
  });

  it('does not execute a Nest CLI process', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    await createProject('apps/api/nest-cli.json');

    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it('does not execute a package manager', async () => {
    await tempFs.createFiles({
      ...createNestProjectFiles('apps/api'),
      'package-lock.json': '{}',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0',
    });

    await createProject('apps/api/nest-cli.json');

    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it('does not invoke generators', async () => {
    await tempFs.createFiles(createNestProjectFiles('apps/api'));

    await createProject('apps/api/nest-cli.json');

    expect(devkitModule.generateFiles).not.toHaveBeenCalled();
    expect(devkitModule.formatFiles).not.toHaveBeenCalled();
    expect(devkitModule.runTasksInSerial).not.toHaveBeenCalled();
  });

  async function createProject(
    configFilePath: string,
    options: Record<string, string> = {}
  ) {
    const results = await createNodesFunction(
      [configFilePath],
      options,
      context
    );
    const projectRoot =
      configFilePath === 'nest-cli.json'
        ? '.'
        : configFilePath.replace('/nest-cli.json', '');
    return results[0][1].projects[projectRoot];
  }
});

function createNestProjectFiles(
  projectRoot: string,
  nestCliConfig: Record<string, unknown> = {}
): Record<string, string> {
  const root = projectRoot === '.' ? '' : `${projectRoot}/`;

  return {
    [`${root}nest-cli.json`]: JSON.stringify(
      {
        ...defaultNestCliConfig,
        ...nestCliConfig,
      },
      null,
      2
    ),
    [`${root}package.json`]: JSON.stringify(
      {
        name: projectRoot === '.' ? 'workspace-root' : 'api',
      },
      null,
      2
    ),
    [`${root}src/main.ts`]: 'console.log("nest");\n',
    [`${root}tsconfig.json`]: '{}\n',
    [`${root}tsconfig.build.json`]: '{}\n',
  };
}
