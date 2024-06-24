import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

import update from './add-project-report-all';

describe('AddProjectReportAll', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update build.gradle', async () => {
    tree.write('settings.gradle', '');
    await update(tree);
    const buildGradle = tree.read('build.gradle').toString();
    expect(buildGradle).toContain('project-report');
    expect(buildGradle).toContain('projectReportAll');
  });

  it('should update build.gradle.kts', async () => {
    tree.write('settings.gradle.kts', '');
    await update(tree);
    const buildGradle = tree.read('build.gradle.kts').toString();
    expect(buildGradle).toContain('project-report');
    expect(buildGradle).toContain('projectReportAll');
  });
});
