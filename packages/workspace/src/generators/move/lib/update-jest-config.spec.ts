import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateJestConfig } from './update-jest-config';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateJestConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should handle jest config not existing', async () => {
    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    expect(() => updateJestConfig(tree, schema, projectConfig)).not.toThrow();
  });

  it('should update the name and coverage directory', async () => {
    const jestConfig = `module.exports = {
      name: 'my-source',
      preset: '../../jest.config.ts',
      coverageDirectory: '../coverage/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = 'my-destination/jest.config.ts';
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(jestConfigPath, jestConfig);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const jestConfigAfter = tree.read(jestConfigPath, 'utf-8');
    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(jestConfigAfter).toContain(`name: 'my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../coverage/my-destination'`
    );
    expect(rootJestConfigAfter).toContain('getJestProjectsAsync()');
  });

  it('should update the name and dir correctly when moving to a nested dir', async () => {
    const jestConfig = `module.exports = {
      name: 'my-source',
      preset: '../../jest.config.ts',
      coverageDirectory: '../coverage/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = 'my-source/data-access/jest.config.ts';
    await libraryGenerator(tree, {
      directory: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(jestConfigPath, jestConfig);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-source/data-access',
      importPath: '@proj/my-soource-data-access',
      updateImportPath: true,
      newProjectName: 'my-source-data-access',
      relativeToRootDestination: 'my-source/data-access',
    };

    updateJestConfig(tree, schema, projectConfig);

    const jestConfigAfter = tree.read(jestConfigPath, 'utf-8');
    expect(jestConfigAfter).toContain(`name: 'my-source-data-access'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../coverage/my-source/data-access'`
    );
  });

  it('should update jest configs properly even if project is in many layers of subfolders', async () => {
    const jestConfig = `module.exports = {
      name: 'some-test-dir-my-source',
      preset: '../jest.config.ts',
      coverageDirectory: '../coverage/some/test/dir/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = 'other/test/dir/my-destination/jest.config.ts';
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some-test-dir-my-source',
      directory: 'some/test/dir/my-source',
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
      relativeToRootDestination: 'other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);
    const jestConfigAfter = tree.read(jestConfigPath, 'utf-8');
    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(jestConfigAfter).toContain(`name: 'other-test-dir-my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../coverage/other/test/dir/my-destination'`
    );
    expect(rootJestConfigAfter).toContain('getJestProjectsAsync()');
  });

  it('updates the root config if not using `getJestProjects()`', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some-test-dir-my-source',
      directory: 'some/test/dir/my-source',
    });
    tree.write(
      rootJestConfigPath,
      `module.exports = {
  projects: ['<rootDir>/some/test/dir/my-source']
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
      relativeToRootDestination: 'other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).toContain(
      '<rootDir>/other/test/dir/my-destination'
    );
  });

  it('updates the root config if `getJestProjects()` is used but old path exists', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some-test-dir-my-source',
      directory: 'some/test/dir/my-source',
    });
    tree.write(
      rootJestConfigPath,
      `const { getJestProjects } = require('@nx/jest');

module.exports = {
  projects: [...getJestProjects(), '<rootDir>/some/test/dir/my-source']
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
      relativeToRootDestination: 'other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/other/test/dir/my-destination'
    );
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });

  it('updates the root config if `getJestProjects()` is used with other projects in the array', async () => {
    const rootJestConfigPath = '/jest.config.ts';
    await libraryGenerator(tree, {
      name: 'some-test-dir-my-source',
      directory: 'some/test/dir/my-source',
    });
    tree.write(
      rootJestConfigPath,
      `const { getJestProjects } = require('@nx/jest');

module.exports = {
  projects: [...getJestProjects(), '<rootDir>/some/test/dir/my-source', '<rootDir>/foo']
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
      relativeToRootDestination: 'other/test/dir/my-destination',
    };

    updateJestConfig(tree, schema, projectConfig);

    const rootJestConfigAfter = tree.read(rootJestConfigPath, 'utf-8');
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/some/test/dir/my-source'
    );
    expect(rootJestConfigAfter).not.toContain(
      '<rootDir>/other/test/dir/my-destination'
    );
    expect(rootJestConfigAfter).toContain('<rootDir>/foo');
    expect(rootJestConfigAfter).toContain('getJestProjects()');
  });
});
