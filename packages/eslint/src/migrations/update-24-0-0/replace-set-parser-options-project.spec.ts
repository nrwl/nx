import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './replace-set-parser-options-project';

describe('replace-set-parser-options-project migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setGenerators(generators: Record<string, any>) {
    const nxJson = readNxJson(tree);
    nxJson.generators = generators;
    updateNxJson(tree, nxJson);
  }

  it.each([
    '@nx/angular:add-linting',
    '@nx/angular:application',
    '@nx/angular:library',
    '@nx/cypress:configuration',
    '@nx/detox:application',
    '@nx/expo:application',
    '@nx/expo:library',
    '@nx/express:application',
    '@nx/js:library',
    '@nx/nest:application',
    '@nx/nest:library',
    '@nx/next:application',
    '@nx/next:library',
    '@nx/node:application',
    '@nx/node:library',
    '@nx/nuxt:application',
    '@nx/playwright:configuration',
    '@nx/plugin:plugin',
    '@nx/react:application',
    '@nx/react:library',
    '@nx/react-native:application',
    '@nx/react-native:library',
    '@nx/vue:application',
    '@nx/vue:library',
    '@nx/web:application',
  ])('should replace the option in the %s defaults', async (generator) => {
    setGenerators({ [generator]: { setParserOptionsProject: true } });

    await update(tree);

    expect(readNxJson(tree).generators).toEqual({
      [generator]: { enableTypedLinting: true },
    });
  });

  it('should replace the option in nested defaults and keep the other options', async () => {
    setGenerators({
      '@nx/angular': {
        application: { setParserOptionsProject: true, style: 'scss' },
      },
    });

    const result = await update(tree);

    expect(readNxJson(tree).generators).toEqual({
      '@nx/angular': {
        application: { style: 'scss', enableTypedLinting: true },
      },
    });
    expect(result).toBeUndefined();
  });

  it('should drop a disabled option and the defaults it leaves empty', async () => {
    setGenerators({
      '@nx/react:library': { setParserOptionsProject: false },
      '@nx/react': {
        application: { setParserOptionsProject: false, style: 'css' },
      },
      '@nx/vue': { library: { setParserOptionsProject: false } },
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      generators: { '@nx/vue:library': { setParserOptionsProject: false } },
    });

    await update(tree);

    expect(readNxJson(tree).generators).toEqual({
      '@nx/react': { application: { style: 'css' } },
    });
    expect(readJson(tree, 'libs/lib1/project.json')).not.toHaveProperty(
      'generators'
    );
  });

  it.each([
    [{ enableTypedLinting: false, setParserOptionsProject: true }, true],
    [{ enableTypedLinting: true, setParserOptionsProject: false }, true],
    [{ enableTypedLinting: false, setParserOptionsProject: false }, false],
    [{ setParserOptionsProject: 'true' }, true],
  ])(
    'should resolve %j to enableTypedLinting: %s',
    async (defaults, enableTypedLinting) => {
      setGenerators({ '@nx/node:application': defaults });

      await update(tree);

      expect(readNxJson(tree).generators).toEqual({
        '@nx/node:application': { enableTypedLinting },
      });
    }
  );

  it('should keep an nx.json setParserOptionsProject in effect over a project enableTypedLinting: false', async () => {
    setGenerators({ '@nx/react:library': { setParserOptionsProject: true } });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      generators: { '@nx/react:library': { enableTypedLinting: false } },
    });

    await update(tree);

    expect(readNxJson(tree).generators).toEqual({
      '@nx/react:library': { enableTypedLinting: true },
    });
    expect(readProjectConfiguration(tree, 'lib1').generators).toEqual({
      '@nx/react:library': { enableTypedLinting: true },
    });
  });

  it('should keep a higher layer that turns the option back off', async () => {
    setGenerators({
      '@nx/react': { library: { setParserOptionsProject: true } },
      '@nx/react:library': { setParserOptionsProject: false },
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      generators: {
        '@nx/react': { library: { setParserOptionsProject: true } },
        '@nx/react:library': { setParserOptionsProject: false },
      },
    });

    await update(tree);

    const expected = {
      '@nx/react': { library: { enableTypedLinting: true } },
      '@nx/react:library': { enableTypedLinting: false },
    };
    expect(readNxJson(tree).generators).toEqual(expected);
    expect(readProjectConfiguration(tree, 'lib1').generators).toEqual(expected);
  });

  it('should replace the option in angular.json project defaults', async () => {
    setGenerators({ '@nx/angular:library': { setParserOptionsProject: true } });
    writeJson(tree, 'angular.json', {
      version: 1,
      projects: {
        app1: {
          projectType: 'application',
          root: 'apps/app1',
          schematics: {
            '@nx/angular:application': { setParserOptionsProject: true },
            '@nx/angular:library': { enableTypedLinting: false },
            '@nx/angular': {
              'add-linting': { setParserOptionsProject: false },
            },
          },
        },
        app2: {
          projectType: 'application',
          root: 'apps/app2',
          generators: { '@nx/js:library': { setParserOptionsProject: false } },
        },
      },
    });

    await update(tree);

    expect(readJson(tree, 'angular.json').projects).toEqual({
      app1: {
        projectType: 'application',
        root: 'apps/app1',
        schematics: {
          '@nx/angular:application': { enableTypedLinting: true },
          '@nx/angular:library': { enableTypedLinting: true },
        },
      },
      app2: { projectType: 'application', root: 'apps/app2' },
    });
  });

  describe('defaults in both package.json and project.json', () => {
    it.each([
      {
        scenario: 'project.json overrides a package.json flat default',
        packageJsonDefaults: {
          '@nx/react:library': { setParserOptionsProject: true },
        },
        projectJsonDefaults: {
          '@nx/react:library': { setParserOptionsProject: false },
        },
        migratedPackageJsonDefaults: {
          '@nx/react:library': { enableTypedLinting: true },
        },
        migratedProjectJsonDefaults: {
          '@nx/react:library': { enableTypedLinting: false },
        },
      },
      {
        scenario:
          'a package.json flat default overrides a project.json nested one',
        packageJsonDefaults: {
          '@nx/react:library': { enableTypedLinting: false },
        },
        projectJsonDefaults: {
          '@nx/react': { library: { setParserOptionsProject: true } },
        },
        migratedPackageJsonDefaults: {
          '@nx/react:library': { enableTypedLinting: true },
        },
        migratedProjectJsonDefaults: {
          '@nx/react': { library: { enableTypedLinting: true } },
        },
      },
      {
        scenario: 'a project.json nested default replaces the package.json one',
        packageJsonDefaults: {
          '@nx/react': { library: { setParserOptionsProject: true } },
        },
        projectJsonDefaults: {
          '@nx/react': { library: { enableTypedLinting: false } },
        },
        migratedPackageJsonDefaults: {
          '@nx/react': { library: { enableTypedLinting: true } },
        },
        migratedProjectJsonDefaults: {
          '@nx/react': { library: { enableTypedLinting: false } },
        },
      },
    ])(
      'should migrate both files the same way on every run when $scenario',
      async ({
        packageJsonDefaults,
        projectJsonDefaults,
        migratedPackageJsonDefaults,
        migratedProjectJsonDefaults,
      }) => {
        writeJson(tree, 'libs/lib1/package.json', {
          name: 'lib1',
          nx: { tags: ['scope:lib1'], generators: packageJsonDefaults },
        });
        writeJson(tree, 'libs/lib1/project.json', {
          name: 'lib1',
          generators: projectJsonDefaults,
        });

        function expectMigrated() {
          expect(readJson(tree, 'libs/lib1/package.json')).toEqual({
            name: 'lib1',
            nx: {
              tags: ['scope:lib1'],
              generators: migratedPackageJsonDefaults,
            },
          });
          expect(readJson(tree, 'libs/lib1/project.json')).toEqual({
            name: 'lib1',
            generators: migratedProjectJsonDefaults,
          });
        }

        await update(tree);
        expectMigrated();
        await update(tree);
        expectMigrated();
      }
    );
  });

  it('should not change defaults of other generators', async () => {
    setGenerators({
      '@acme/plugin:application': { setParserOptionsProject: true },
      '@nx/react:component': { setParserOptionsProject: true },
      '@nx/react:library': { enableTypedLinting: true, style: 'css' },
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      generators: { '@nx/react:library': { style: 'css' } },
    });
    const nxJsonBefore = tree.read('nx.json', 'utf-8');
    const projectJsonBefore = tree.read('libs/lib1/project.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJsonBefore);
    expect(tree.read('libs/lib1/project.json', 'utf-8')).toEqual(
      projectJsonBefore
    );
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    setGenerators({
      '@nx/react': { library: { setParserOptionsProject: true } },
      '@nx/react:library': { setParserOptionsProject: false },
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      generators: { '@nx/react:library': { enableTypedLinting: false } },
    });
    await update(tree);
    const nxJsonAfterFirstRun = tree.read('nx.json', 'utf-8');
    const projectJsonAfterFirstRun = tree.read(
      'libs/lib1/project.json',
      'utf-8'
    );

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJsonAfterFirstRun);
    expect(tree.read('libs/lib1/project.json', 'utf-8')).toEqual(
      projectJsonAfterFirstRun
    );
    expect(result).toEqual({ skipAgentic: true });
  });
});
