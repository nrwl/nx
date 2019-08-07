import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { runSchematic, callRule } from '../../utils/testing';

describe('jestProject', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await callRule(
      updateJsonInTree('workspace.json', json => {
        json.projects.lib1 = {
          root: 'libs/lib1',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: []
              }
            }
          }
        };
        return json;
      }),
      appTree
    );
    appTree = await callRule(
      updateJsonInTree('libs/lib1/tsconfig.json', json => {
        return {
          compilerOptions: {
            types: []
          }
        };
      }),
      appTree
    );
  });

  it('should generate files', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular'
      },
      appTree
    );
    expect(resultTree.exists('/libs/lib1/src/test-setup.ts')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/jest.config.js')).toBeTruthy();
    expect(resultTree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
  });

  it('should alter workspace.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular'
      },
      appTree
    );
    const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
    expect(workspaceJson.projects.lib1.architect.test).toEqual({
      builder: '@nrwl/jest:jest',
      options: {
        jestConfig: 'libs/lib1/jest.config.js',
        setupFile: 'libs/lib1/src/test-setup.ts',
        tsConfig: 'libs/lib1/tsconfig.spec.json'
      }
    });
    expect(
      workspaceJson.projects.lib1.architect.lint.options.tsConfig
    ).toContain('libs/lib1/tsconfig.spec.json');
  });

  it('should create a jest.config.js', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    expect(resultTree.readContent('libs/lib1/jest.config.js'))
      .toBe(`module.exports = {
  name: 'lib1',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/libs/lib1',
  snapshotSerializers: [
    'jest-preset-angular/AngularSnapshotSerializer.js',
    'jest-preset-angular/HTMLCommentSerializer.js'
  ]
};
`);
  });

  it('should update the local tsconfig.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1'
      },
      appTree
    );
    const tsConfig = readJsonInTree(resultTree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.compilerOptions.types).toContain('jest');
    expect(tsConfig.compilerOptions.types).toContain('node');
  });

  it('should create a tsconfig.spec.json', async () => {
    const resultTree = await runSchematic(
      'jest-project',
      {
        project: 'lib1',
        setupFile: 'angular'
      },
      appTree
    );
    const tsConfig = readJsonInTree(resultTree, 'libs/lib1/tsconfig.spec.json');
    expect(tsConfig).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        types: ['jest', 'node']
      },
      files: ['src/test-setup.ts'],
      include: ['**/*.spec.ts', '**/*.d.ts']
    });
  });

  describe('--setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none'
        },
        appTree
      );
      expect(resultTree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in workspace.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none'
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(
        workspaceJson.projects.lib1.architect.test.options.setupFile
      ).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          setupFile: 'none'
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      expect(resultTree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in workspace.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(
        workspaceJson.projects.lib1.architect.test.options.setupFile
      ).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSetupFile: true
        },
        appTree
      );
      const tsConfig = readJsonInTree(
        resultTree,
        'libs/lib1/tsconfig.spec.json'
      );
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-serializers', () => {
    it('should not list the serializers in jest.config.js', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          skipSerializers: true
        },
        appTree
      );
      const jestConfig = resultTree.readContent('libs/lib1/jest.config.js');
      expect(jestConfig).not.toContain(`
  snapshotSerializers: [
    'jest-preset-angular/AngularSnapshotSerializer.js',
    'jest-preset-angular/HTMLCommentSerializer.js'
  ]
`);
    });
  });

  describe('--support-tsx', () => {
    it('should add tsx to moduleExtensions', async () => {
      const resultTree = await runSchematic(
        'jest-project',
        {
          project: 'lib1',
          supportTsx: true
        },
        appTree
      );
      const jestConfig = resultTree.readContent('libs/lib1/jest.config.js');
      expect(jestConfig).toContain(
        `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],`
      );
    });
  });
});
