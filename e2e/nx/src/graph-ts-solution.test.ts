import {
  checkFilesExist,
  cleanupProject,
  createFile,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { basename } from 'node:path';

describe('Graph - TS solution setup', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/js'],
      preset: 'ts',
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should detect dependencies from local packages included in the package manager workspaces', () => {
    const pm = getSelectedPackageManager();
    const pmc = getPackageManagerCommand({ packageManager: pm });

    createPackage('pkg-parent', { sourceFilePaths: ['index.ts'] });

    // invalid definition with no entry fields in package.json
    createPackage('pkg1');
    // only `main`
    createPackage('pkg2', {
      packageJsonEntryFields: { main: './dist/src/index.js' },
    });
    // invalid empty exports, no code is accessible
    createPackage('pkg3', {
      packageJsonEntryFields: {
        main: './dist/src/index.js',
        types: './dist/src/index.d.ts',
        exports: {},
      },
    });
    // '.' entry point
    createPackage('pkg4', {
      packageJsonEntryFields: {
        exports: {
          '.': {
            types: './dist/src/index.d.ts',
            default: './dist/src/index.js',
          },
        },
      },
    });
    // conditional exports
    createPackage('pkg5', {
      packageJsonEntryFields: {
        exports: {
          types: './dist/src/index.d.ts',
          default: './dist/src/index.js',
        },
      },
    });
    // exports set to a string
    createPackage('pkg6', {
      packageJsonEntryFields: {
        exports: './dist/src/index.js',
      },
    });
    // '.' entry point set to source (non buildable library)
    createPackage('pkg7', {
      packageJsonEntryFields: {
        exports: {
          '.': './src/index.ts',
        },
      },
    });
    // matches a path alias that resolves correctly
    createPackage('pkg8', {
      packageJsonEntryFields: {
        exports: {
          '.': {
            types: './dist/src/index.d.ts',
            default: './dist/src/index.js',
          },
        },
      },
    });
    // matches a path alias that doesn't resolve correctly, should still be
    // picked up by the package manager workspaces fallback resolution
    createPackage('pkg9', {
      packageJsonEntryFields: {
        exports: {
          '.': {
            types: './src/index.ts',
            default: './src/index.ts',
          },
        },
      },
    });
    // only named exports, no '.' entry point
    createPackage('pkg10', {
      packageJsonEntryFields: {
        exports: {
          './feature1': {
            types: './dist/src/index.d.ts',
            default: './dist/src/index.js',
          },
        },
      },
    });
    // wildcard exports
    createPackage('pkg11', {
      sourceFilePaths: ['src/utils/util1.ts'],
      packageJsonEntryFields: {
        exports: {
          './utils/*': {
            types: './dist/src/utils/*.d.ts',
            default: './dist/src/utils/*.js',
          },
        },
      },
    });
    // restricted exports, should not be picked up as a dependency
    createPackage('pkg12', {
      packageJsonEntryFields: {
        exports: { './feature1': null },
      },
    });
    // valid package that will be imported as @proj/pkg14 due to a TS path alias
    createPackage('pkg13', {
      packageJsonEntryFields: {
        exports: {
          '.': {
            types: './src/index.ts',
            default: './src/index.ts',
          },
        },
      },
    });
    // valid package that we'll be foreshadowed by a TS path alias pointing to
    // pkg13, so should not be picked up as a dependency
    createPackage('pkg14', {
      packageJsonEntryFields: {
        exports: {
          '.': {
            types: './src/index.ts',
            default: './src/index.ts',
          },
        },
      },
    });
    // wildcard exports with trailing values
    createPackage('pkg15', {
      sourceFilePaths: ['src/features/some-file.ts'],
      packageJsonEntryFields: {
        exports: {
          './features/*.js': {
            types: './dist/src/features/*.d.ts',
            default: './dist/src/features/*.js',
          },
        },
      },
    });
    // wildcard exports with no leading or trailing values
    createPackage('pkg16', {
      sourceFilePaths: ['src/features/subpath/extra-nested/index.ts'],
      packageJsonEntryFields: {
        exports: {
          './*': {
            types: './dist/src/features/*/index.d.ts',
            default: './dist/src/features/*/index.js',
          },
        },
      },
    });
    // project outside of the package manager workspaces
    createPackage('lib1', { root: 'libs/lib1' });

    if (pm === 'pnpm') {
      // for pnpm we need to add the local packages as dependencies to each consumer package.json
      // we keep out the ones we want to validate won't be picked up as dependencies, otherwise
      // they would be included because the package.json depends on them
      updateJson('packages/pkg-parent/package.json', (json) => {
        json.dependencies ??= {};
        json.dependencies['@proj/pkg2'] = 'workspace:*';
        json.dependencies['@proj/pkg4'] = 'workspace:*';
        json.dependencies['@proj/pkg5'] = 'workspace:*';
        json.dependencies['@proj/pkg6'] = 'workspace:*';
        json.dependencies['@proj/pkg7'] = 'workspace:*';
        json.dependencies['@proj/pkg8'] = 'workspace:*';
        json.dependencies['@proj/pkg9'] = 'workspace:*';
        json.dependencies['@proj/pkg10'] = 'workspace:*';
        json.dependencies['@proj/pkg11'] = 'workspace:*';
        json.dependencies['@proj/pkg13'] = 'workspace:*';
        json.dependencies['@proj/pkg15'] = 'workspace:*';
        json.dependencies['@proj/pkg16'] = 'workspace:*';
        return json;
      });
    }

    runCommand(pmc.install);

    updateJson('tsconfig.base.json', (json) => {
      json.compilerOptions.baseUrl = '.';
      json.compilerOptions.paths = {
        '@proj/pkg8': ['packages/pkg8/src/index.ts'],
        '@proj/pkg9': ['dist/packages/pkg9'],
        '@proj/pkg14': ['packages/pkg13/src/index.ts'],
      };
      return json;
    });
    // add TS project references to all packages, including the invalid ones
    // so they are all built ahead of pkg-parent and we can assert the test
    // correctly sets them up as invalid imports
    updateJson('packages/pkg-parent/tsconfig.json', (json) => {
      json.references = [
        { path: '../pkg1' },
        { path: '../pkg2' },
        { path: '../pkg3' },
        { path: '../pkg4' },
        { path: '../pkg5' },
        { path: '../pkg6' },
        { path: '../pkg7' },
        { path: '../pkg8' },
        { path: '../pkg9' },
        { path: '../pkg10' },
        { path: '../pkg11' },
        { path: '../pkg12' },
        { path: '../pkg13' },
        { path: '../pkg14' },
        { path: '../pkg15' },
        { path: '../pkg16' },
      ];
      return json;
    });
    updateFile(
      'packages/pkg-parent/index.ts',
      () => `
      import { pkg1 } from '@proj/pkg1';
      import { pkg2 } from '@proj/pkg2';
      import { pkg3 } from '@proj/pkg3';
      import { pkg4 } from '@proj/pkg4';
      import { pkg5 } from '@proj/pkg5';
      import { pkg6 } from '@proj/pkg6';
      import { pkg7 } from '@proj/pkg7';
      import { pkg8 } from '@proj/pkg8';
      import { pkg9 } from '@proj/pkg9';
      import { pkg10 } from '@proj/pkg10/feature1';
      import { util1 } from '@proj/pkg11/utils/util1';
      import { pkg12 } from '@proj/pkg12/feature1';
      import { pkg13 } from '@proj/pkg14';
      import { some_file } from '@proj/pkg15/features/some-file.js';
      import { pkg16 } from '@proj/pkg16/subpath/extra-nested';
      // this is an invalid import that doesn't match any TS path alias and
      // it's not included in the package manager workspaces, it should not
      // be picked up as a dependency
      import { lib1 } from '@proj/lib1';

      // use the correct imports, leave out the invalid ones so it's easier to remove them later
      export const pkgParent = pkg2 + pkg4 + pkg5 + pkg6 + pkg7 + pkg8 + pkg9 + pkg10 + util1 + pkg13 + some_file + pkg16;
    `
    );

    runCLI(`graph --file graph.json`);

    const { graph } = readJson('graph.json');
    // pkg1, pkg3, pkg12, pkg14, and lib1 are not detected as dependencies
    expect(
      graph.dependencies['@proj/pkg-parent'].map((d) => d.target)
    ).toStrictEqual([
      '@proj/pkg2',
      '@proj/pkg4',
      '@proj/pkg5',
      '@proj/pkg6',
      '@proj/pkg7',
      '@proj/pkg8',
      '@proj/pkg9',
      '@proj/pkg10',
      '@proj/pkg11',
      '@proj/pkg13',
      '@proj/pkg15',
      '@proj/pkg16',
    ]);

    // assert build fails due to the invalid imports
    const output = runCommand(`${pmc.exec} tsc -b packages/pkg-parent`);
    expect(output).toContain(
      `error TS2307: Cannot find module '@proj/pkg1' or its corresponding type declarations.`
    );
    expect(output).toContain(
      `error TS2307: Cannot find module '@proj/pkg3' or its corresponding type declarations.`
    );
    expect(output).toContain(
      `error TS2307: Cannot find module '@proj/pkg12/feature1' or its corresponding type declarations.`
    );
    expect(output).toContain(
      `error TS2307: Cannot find module '@proj/lib1' or its corresponding type declarations.`
    );

    // remove the invalid imports
    updateFile('packages/pkg-parent/index.ts', (content) =>
      content
        .replace(`import { pkg1 } from '@proj/pkg1';`, '')
        .replace(`import { pkg3 } from '@proj/pkg3';`, '')
        .replace(`import { pkg12 } from '@proj/pkg12/feature1';`, '')
        .replace(`import { lib1 } from '@proj/lib1';`, '')
    );

    // assert build succeeds, tsc outputs nothing when successful
    expect(runCommand(`${pmc.exec} tsc -b packages/pkg-parent`)).toBe('');
    checkFilesExist(
      'packages/pkg-parent/dist/index.js',
      'packages/pkg-parent/dist/index.d.ts'
    );
  });

  it('should detect dependencies correctly when using Node.js subpath imports', () => {
    const pmc = getPackageManagerCommand();

    const pkg1 = uniq('pkg1');
    createPackage(pkg1, {
      sourceFilePaths: [
        'src/file1.ts',
        'src/nested/file2.ts',
        'src/file3.ts',
        'src/file4.ts',
      ],
      packageJsonEntryFields: {
        imports: {
          '#*': './src/*.ts',
          '#file2': './src/nested/file2.ts',
          '#file3': {
            types: './src/file3.ts',
            default: './src/file3.ts',
          },
          '#file4': 'external-package',
        },
      },
    });
    const pkg2 = uniq('pkg2');
    createPackage(pkg2, {
      sourceFilePaths: [
        'src/file1.ts',
        'src/nested/file2.ts',
        'src/file3.ts',
        'src/file4.ts',
      ],
      packageJsonEntryFields: {
        imports: {
          '#*': './src/*.ts',
          '#file2': './src/nested/file2.ts',
          '#file3': {
            types: './src/file3.ts',
            default: './src/file3.ts',
          },
          '#file4': 'external-package',
        },
      },
    });

    // create a fake external package
    createFile(
      'temp-external-package/package.json',
      JSON.stringify(
        {
          name: 'external-package',
          version: '1.0.0',
          exports: {
            '.': {
              types: './index.d.ts',
              default: './index.js',
            },
            './package.json': './package.json',
          },
        },
        null,
        2
      )
    );
    createFile(
      'temp-external-package/index.js',
      `export const externalPackage = 'external-package';`
    );
    createFile(
      'temp-external-package/index.d.ts',
      `export const externalPackage: string;`
    );
    // create a tarball of the external package
    runCommand('cd temp-external-package && npm pack');
    // add the external package as a dependency
    updateJson('package.json', (json) => {
      json.dependencies ??= {};
      json.dependencies['external-package'] =
        'file:./temp-external-package/external-package-1.0.0.tgz';
      return json;
    });
    // install dependencies to update the lock file
    runCommand(pmc.install);

    createFile(
      `packages/${pkg1}/src/main.ts`,
      `
      import { file1 } from '#file1';
      import { file2 } from '#file2';
      import { file3 } from '#file3';
      import { externalPackage } from '#file4';

      export const main = file1 + file2 + file3 + externalPackage;
      `
    );
    createFile(
      `packages/${pkg2}/src/main.ts`,
      `
      import { file1 } from '#file1';
      import { file2 } from '#file2';
      import { file3 } from '#file3';
      import { externalPackage } from '#file4';

      export const main = file1 + file2 + file3 + externalPackage;
      `
    );

    // force the graph to be generated
    runCLI(`reset`);
    runCLI(`report`);
    const graph = readJson('.nx/workspace-data/project-graph.json');
    // only `external-package` is detected as a dependency, the rest of the
    // imports point to internal files of each project
    expect(
      graph.dependencies[`@proj/${pkg1}`].map((d) => d.target)
    ).toStrictEqual(['npm:external-package']);
    expect(
      graph.dependencies[`@proj/${pkg2}`].map((d) => d.target)
    ).toStrictEqual(['npm:external-package']);

    // assert build succeeds, tsc outputs nothing when successful
    expect(runCommand(`${pmc.exec} tsc -b packages/${pkg1}`)).toBe('');
    checkFilesExist(
      `packages/${pkg1}/dist/src/file1.js`,
      `packages/${pkg1}/dist/src/file1.d.ts`,
      `packages/${pkg1}/dist/src/nested/file2.js`,
      `packages/${pkg1}/dist/src/nested/file2.d.ts`,
      `packages/${pkg1}/dist/src/file3.js`,
      `packages/${pkg1}/dist/src/file3.d.ts`,
      `packages/${pkg1}/dist/src/file4.js`,
      `packages/${pkg1}/dist/src/file4.d.ts`,
      `packages/${pkg1}/dist/src/main.js`,
      `packages/${pkg1}/dist/src/main.d.ts`
    );
    // assert build succeeds, tsc outputs nothing when successful
    expect(runCommand(`${pmc.exec} tsc -b packages/${pkg2}`)).toBe('');
    checkFilesExist(
      `packages/${pkg2}/dist/src/file1.js`,
      `packages/${pkg2}/dist/src/file1.d.ts`,
      `packages/${pkg2}/dist/src/nested/file2.js`,
      `packages/${pkg2}/dist/src/nested/file2.d.ts`,
      `packages/${pkg2}/dist/src/file3.js`,
      `packages/${pkg2}/dist/src/file3.d.ts`,
      `packages/${pkg2}/dist/src/file4.js`,
      `packages/${pkg2}/dist/src/file4.d.ts`,
      `packages/${pkg2}/dist/src/main.js`,
      `packages/${pkg2}/dist/src/main.d.ts`
    );
  });

  function createPackage(
    name: string,
    options?: {
      root?: string;
      sourceFilePaths?: string[];
      packageJsonEntryFields?: {
        main?: string;
        types?: string;
        exports?: string | Record<string, any>;
        imports?: Record<string, any>;
      };
    }
  ): void {
    const root = options?.root ?? `packages/${name}`;

    createFile(
      `${root}/package.json`,
      JSON.stringify(
        {
          name: `@proj/${name}`,
          version: '1.0.0',
          ...options?.packageJsonEntryFields,
        },
        null,
        2
      )
    );
    createFile(
      `${root}/tsconfig.json`,
      JSON.stringify(
        {
          extends: '../../tsconfig.base.json',
          compilerOptions: {
            outDir: './dist',
            emitDeclarationOnly: false,
          },
          include: ['**/*.ts'],
        },
        null,
        2
      )
    );

    const sourceFilePaths = options?.sourceFilePaths ?? ['src/index.ts'];
    for (const sourceFilePath of sourceFilePaths) {
      const fileName = basename(sourceFilePath, '.ts').replace(/-/g, '_');
      createFile(
        `${root}/${sourceFilePath}`,
        `export const ${
          fileName !== 'index' ? fileName : name
        } = '${name} - ${fileName}';`
      );
    }
  }
});
