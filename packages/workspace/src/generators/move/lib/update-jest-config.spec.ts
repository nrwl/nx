import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../../library/library';
import { NormalizedSchema } from '../schema';
import { updateJestConfig } from './update-jest-config';

describe('updateJestConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle jest config not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'libs/my-destination',
    };

    expect(() => updateJestConfig(tree, schema, projectConfig)).not.toThrow();
  });

  it('should update the name and coverage directory', async () => {
    const jestConfig = `module.exports = {
      name: 'my-source',
      preset: '../../jest.config.ts',
      coverageDirectory: '../../coverage/libs/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = '/libs/my-destination/jest.config.ts';
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'my-source',
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(jestConfigPath, jestConfig);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'libs/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const jestConfigAfter = tree.read(jestConfigPath, 'utf-8');
    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(jestConfigAfter).toContain(`name: 'my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../../coverage/libs/my-destination'`
    );
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });

  it('should update jest configs properly even if project is in many layers of subfolders', async () => {
    const jestConfig = `module.exports = {
      name: 'some-test-dir-my-source',
      preset: '../../jest.config.ts',
      coverageDirectory: '../../coverage/libs/some/test/dir/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = '/libs/other/test/dir/my-destination/jest.config.ts';
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some/test/dir/my-source',
      standaloneConfig: false,
    });
    const projectConfig = readProjectConfiguration(
      tree,
      'some-test-dir-my-source'
    );
    tree.write(jestConfigPath, jestConfig);
    const schema: NormalizedSchema = {
      projectName: 'some-test-dir-my-source',
      destination: 'other/test/dir/my-destination',
      importPath: '@proj/other-test-dir-my-destination',
      updateImportPath: true,
      newProjectName: 'other-test-dir-my-destination',
      relativeToRootDestination: 'libs/other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);
    const jestConfigAfter = tree.read(jestConfigPath, 'utf-8');
    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(jestConfigAfter).toContain(`name: 'other-test-dir-my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../../coverage/libs/other/test/dir/my-destination'`
    );
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });

  it('updates the root config if not using `getJestProjects()`', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some/test/dir/my-source',
      standaloneConfig: false,
    });
    tree.write(
      rootJestConfigPath,
      `module.exports = {
  projects: ['<rootDir>/libs/some/test/dir/my-source']
};
`
    );
    const projectConfig = readProjectConfiguration(
      tree,
      'some-test-dir-my-source'
    );
    const schema: NormalizedSchema = {
      projectName: 'some-test-dir-my-source',
      destination: 'other/test/dir/my-destination',
      importPath: '@proj/other-test-dir-my-destination',
      updateImportPath: true,
      newProjectName: 'other-test-dir-my-destination',
      relativeToRootDestination: 'libs/other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/libs/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).toContain(
      '<rootDir>/libs/other/test/dir/my-destination'
    );
  });

  it('updates the root config if `getJestProjects()` is used but old path exists', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some/test/dir/my-source',
      standaloneConfig: false,
    });
    tree.write(
      rootJestConfigPath,
      `const { getJestProjects } = require('@nrwl/jest');
      
module.exports = {
  projects: [...getJestProjects(), '<rootDir>/libs/some/test/dir/my-source']
};
`
    );
    const projectConfig = readProjectConfiguration(
      tree,
      'some-test-dir-my-source'
    );
    const schema: NormalizedSchema = {
      projectName: 'some-test-dir-my-source',
      destination: 'other/test/dir/my-destination',
      importPath: '@proj/other-test-dir-my-destination',
      updateImportPath: true,
      newProjectName: 'other-test-dir-my-destination',
      relativeToRootDestination: 'libs/other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/libs/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/libs/other/test/dir/my-destination'
    );
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });

  it('updates the root config if `getJestProjects()` is used with other projects in the array', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some/test/dir/my-source',
      standaloneConfig: false,
    });
    tree.write(
      rootJestConfigPath,
      `const { getJestProjects } = require('@nrwl/jest');
      
module.exports = {
  projects: [...getJestProjects(), '<rootDir>/libs/some/test/dir/my-source', '<rootDir>/libs/foo']
};
`
    );
    const projectConfig = readProjectConfiguration(
      tree,
      'some-test-dir-my-source'
    );
    const schema: NormalizedSchema = {
      projectName: 'some-test-dir-my-source',
      destination: 'other/test/dir/my-destination',
      importPath: '@proj/other-test-dir-my-destination',
      updateImportPath: true,
      newProjectName: 'other-test-dir-my-destination',
      relativeToRootDestination: 'libs/other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/libs/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/libs/other/test/dir/my-destination'
    );
    expect(rootJestConfigAfter).toContain('<rootDir>/libs/foo');
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });
});
