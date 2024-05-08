import { ProjectGraph } from '@nx/devkit';
import { isCtProjectUsingBuildProject } from './ct-helpers';

describe('ct-helpers', () => {
  /**
   * app1 -> lib1 -> lib2 -> lib3 -> lib1
   *                              -> lib4 -> lib5
   * lib6
   */
  const projectGraph: ProjectGraph = {
    dependencies: {
      app1: [{ source: 'app1', target: 'lib1', type: 'static' }],
      lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
      lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
      lib3: [
        { source: 'lib3', target: 'lib1', type: 'static' },
        { source: 'lib3', target: 'lib4', type: 'static' },
      ],
      lib4: [{ source: 'lib4', target: 'lib5', type: 'static' }],
      lib5: [],
      lib6: [],
    },
    nodes: {},
    externalNodes: {},
  };

  it('should handle circular deps and find the relation', () => {
    expect(isCtProjectUsingBuildProject(projectGraph, 'app1', 'lib5')).toBe(
      true
    );
  });

  it('should handle circular deps and find no relation', () => {
    expect(isCtProjectUsingBuildProject(projectGraph, 'app1', 'lib6')).toBe(
      false
    );
  });
});
