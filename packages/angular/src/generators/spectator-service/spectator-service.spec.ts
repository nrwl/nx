import { addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { spectatorServiceGenerator } from './spectator-service';

describe('service Generator', () => {
  it('should create service files for library', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    // ACT
    await spectatorServiceGenerator(tree, {
      name: 'services/example',
      project: 'lib1',
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/services/example.service.ts', 'utf-8')
    ).toMatchSnapshot('service');
    expect(
      tree.read('libs/lib1/src/lib/services/example.service.spec.ts', 'utf-8')
    ).toMatchSnapshot('service test file');
  });

  it('should create service files for application', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await spectatorServiceGenerator(tree, {
      name: 'services/example',
      project: 'app1',
    });

    // ASSERT
    expect(
      tree.read('apps/app1/src/app/services/example.service.ts', 'utf-8')
    ).toMatchSnapshot('service');
    expect(
      tree.read('apps/app1/src/app/services/example.service.spec.ts', 'utf-8')
    ).toMatchSnapshot('service test file');
  });

  it('should create test files not using jest', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    // ACT
    await spectatorServiceGenerator(tree, {
      name: 'services/example',
      project: 'lib1',
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/services/example.service.spec.ts', 'utf-8')
    ).not.toContain('jest');
  });

  it('should create test files using jest', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    // ACT
    await spectatorServiceGenerator(tree, {
      name: 'services/example',
      project: 'lib1',
      jest: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/services/example.service.spec.ts', 'utf-8')
    ).toContain('jest');
  });

  it('should not create test files', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    // ACT
    await spectatorServiceGenerator(tree, {
      name: 'services/example',
      project: 'lib1',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/services/example.service.ts', 'utf-8')
    ).toBeDefined();
    expect(
      tree.read('libs/lib1/src/services/example.service.spec.ts', 'utf-8')
    ).toEqual(null);
  });
});
