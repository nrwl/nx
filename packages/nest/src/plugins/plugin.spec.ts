import { CreateNodesContextV2 } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodesV2 } from './plugin';

const nestCliConfig = JSON.stringify(
  {
    $schema: 'https://json.schemastore.org/nest-cli',
    collection: '@nestjs/schematics',
    sourceRoot: 'src',
  },
  null,
  2
);

describe('@nx/nest/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;
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
  });

  afterEach(() => {
    tempFs.cleanup();
    process.chdir(cwd);
  });

  it('detects a root-level Nest project with package.json', async () => {
    await tempFs.createFiles({
      'nest-cli.json': nestCliConfig,
      'package.json': JSON.stringify({ name: 'workspace-root' }),
    });

    const results = await createNodesFunction(['nest-cli.json'], {}, context);

    expect(results).toEqual([
      [
        'nest-cli.json',
        {
          projects: {
            '.': {
              root: '.',
              targets: {},
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        },
      ],
    ]);
  });

  it('detects a nested Nest project with package.json', async () => {
    await tempFs.createFiles({
      'apps/api/nest-cli.json': nestCliConfig,
      'apps/api/package.json': JSON.stringify({ name: 'api' }),
    });

    const results = await createNodesFunction(
      ['apps/api/nest-cli.json'],
      {},
      context
    );

    expect(results).toEqual([
      [
        'apps/api/nest-cli.json',
        {
          projects: {
            'apps/api': {
              root: 'apps/api',
              targets: {},
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        },
      ],
    ]);
  });

  it('detects a Nest project when project.json is present', async () => {
    await tempFs.createFiles({
      'apps/api/nest-cli.json': nestCliConfig,
      'apps/api/project.json': JSON.stringify({ name: 'api' }),
    });

    const results = await createNodesFunction(
      ['apps/api/nest-cli.json'],
      {},
      context
    );

    expect(results).toEqual([
      [
        'apps/api/nest-cli.json',
        {
          projects: {
            'apps/api': {
              root: 'apps/api',
              targets: {},
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        },
      ],
    ]);
  });

  it('ignores nest-cli.json files without package.json or project.json', async () => {
    await tempFs.createFiles({
      'tools/nest-cli.json': nestCliConfig,
    });

    const results = await createNodesFunction(
      ['tools/nest-cli.json'],
      {},
      context
    );

    expect(results).toEqual([]);
  });

  it('does not infer any targets yet', async () => {
    await tempFs.createFiles({
      'apps/api/nest-cli.json': nestCliConfig,
      'apps/api/package.json': JSON.stringify({ name: 'api' }),
    });

    const results = await createNodesFunction(
      ['apps/api/nest-cli.json'],
      {},
      context
    );
    const project = results[0][1].projects['apps/api'];

    expect(project.targets).toEqual({});
    expect(project.targets.build).toBeUndefined();
    expect(project.targets.serve).toBeUndefined();
    expect(project.targets.test).toBeUndefined();
    expect(project.targets.lint).toBeUndefined();
  });

  it('ignores unrelated sibling files when detecting Nest projects', async () => {
    await tempFs.createFiles({
      'apps/api/nest-cli.json': nestCliConfig,
      'apps/api/package.json': JSON.stringify({ name: 'api' }),
      'apps/api/README.md': '# api',
      'apps/api/tsconfig.json': '{}',
      'apps/api/.env': 'PORT=3000',
    });

    const results = await createNodesFunction(
      ['apps/api/nest-cli.json'],
      {},
      context
    );

    expect(results).toEqual([
      [
        'apps/api/nest-cli.json',
        {
          projects: {
            'apps/api': {
              root: 'apps/api',
              targets: {},
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        },
      ],
    ]);
  });
});
