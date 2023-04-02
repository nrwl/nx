import 'nx/src/utils/testing/mock-fs';

import { GeneratePackageJsonExecutorOptions } from './schema';
import executor from './generate-package-json.impl';
import { ExecutorContext } from '@nx/devkit';
import { vol } from 'memfs';
import { readFileSync, statSync } from 'fs';
import { readdirSync } from 'fs-extra';
import { join } from 'path';

const getAllFiles = (dirPath: string, arrayOfFiles = []) => {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    const filepath = join(dirPath, file);
    if (statSync(filepath).isDirectory()) {
      arrayOfFiles = getAllFiles(filepath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filepath);
    }
  });

  return arrayOfFiles;
};

describe('GeneratePackageJson Executor', () => {
  const projectName = 'parent';
  const projectPath = `apps/${projectName}`;
  const outputPath = `dist/apps/${projectName}`;

  const mockWorkspaceRoot = process.cwd();

  const mockBuildOptions: GeneratePackageJsonExecutorOptions = {
    main: `${projectPath}/index.js`,
    outputPath,
    tsConfig: `${projectPath}/tsconfig.app.json`,
  };

  const mockContext: ExecutorContext = {
    cwd: '',
    isVerbose: false,
    root: mockWorkspaceRoot,
    projectName,
    target: {
      options: mockBuildOptions,
    },
    targetName: 'build',
    projectGraph: {
      nodes: {
        parent: {
          type: 'app',
          name: 'parent',
          data: {
            files: [],
            root: projectPath,
            targets: {
              build: {
                inputs: [],
                options: mockBuildOptions,
              },
            },
          },
        },
        child1: {
          type: 'lib',
          name: 'child1',
          data: {},
        },
        child2: {
          type: 'lib',
          name: 'child2',
          data: {},
        },
      } as any,
      externalNodes: {
        'npm:react': {
          type: 'npm',
          name: 'npm:react',
          data: { packageName: 'react', version: '18.0.0' },
        },
        'npm:axios': {
          type: 'npm',
          name: 'npm:axios',
          data: { packageName: 'axios', version: '1.0.0' },
        },
        'npm:dayjs': {
          type: 'npm',
          name: 'npm:dayjs',
          data: { packageName: 'dayjs', version: '1.11.0' },
        },
      },
      dependencies: {
        parent: [
          { source: 'parent', target: 'child1', type: 'static' },
          { source: 'parent', target: 'npm:react', type: 'static' },
        ],
        child1: [
          { source: 'child1', target: 'child2', type: 'static' },
          { source: 'child1', target: 'npm:axios', type: 'static' },
        ],
        child2: [{ source: 'child2', target: 'npm:dayjs', type: 'static' }],
      },
    },
  };

  beforeEach(async () => {
    vol.reset();
    const fileSys = {
      [`${projectPath}/package.json`]: JSON.stringify({
        name: '@company/parent',
        author: 'John Doe',
        something: 'else',
      }),
      'package.json': JSON.stringify({
        name: 'package.name.does.not.matter',
      }),
      'package-lock.json': JSON.stringify({
        name: 'package-lock.name.does.not.matter',
        version: 'package-lock.version.does.not.matter',
        lockfileVersion: 3,
        packages: {
          '': {},
          'node_modules/axios': {
            version: '1.0.0',
          },
          'node_modules/dayjs': {
            version: '1.11.0',
          },
          'node_modules/react': {
            version: '18.0.0',
          },
        },
      }),
    };
    vol.fromJSON(fileSys, mockWorkspaceRoot);
  });

  it('generates a package.json and package-lock.json with child dependencies', async () => {
    const output = await executor(mockBuildOptions, mockContext);

    const expectedPackageLockJson = {
      name: '@company/parent',
      lockfileVersion: 3,
      version: '0.0.1',
      packages: {
        '': {
          name: '@company/parent',
          dependencies: {
            axios: '1.0.0',
            dayjs: '1.11.0',
            react: '18.0.0',
          },
        },
        'node_modules/axios': {
          version: '1.0.0',
        },
        'node_modules/dayjs': {
          version: '1.11.0',
        },
        'node_modules/react': {
          version: '18.0.0',
        },
      },
    };

    const expectedPackageJson = {
      name: '@company/parent',
      author: 'John Doe',
      something: 'else',
      dependencies: {
        axios: '1.0.0',
        dayjs: '1.11.0',
        react: '18.0.0',
      },
      module: './index.js',
      type: 'module',
      main: './index.js',
    };

    expect(
      JSON.parse(readFileSync(`${outputPath}/package-lock.json`, 'utf-8'))
    ).toEqual(expectedPackageLockJson);

    expect(
      JSON.parse(readFileSync(`${outputPath}/package.json`, 'utf-8'))
    ).toEqual(expectedPackageJson);

    expect(output.success).toBe(true);

    expect(getAllFiles('')).toEqual([
      `${projectPath}/package.json`,
      `${outputPath}/package-lock.json`,
      `${outputPath}/package.json`,
      'package-lock.json',
      'package.json',
      'tmp/apps/parent/tsconfig.generated.json',
    ]);
  });
});
