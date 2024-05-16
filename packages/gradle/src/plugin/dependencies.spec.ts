import { getSubprojects } from './dependencies';

describe('dependencies', () => {
  describe('getSubprojects', () => {
    it('should get subprojects', () => {
      const gradleProjectToCompositeProjectsMap = new Map<string, string[]>();
      gradleProjectToCompositeProjectsMap.set('root', ['sub1', 'sub2']);
      gradleProjectToCompositeProjectsMap.set('sub1', ['sub3']);
      gradleProjectToCompositeProjectsMap.set('sub2', ['sub4']);
      gradleProjectToCompositeProjectsMap.set('sub3', []);
      gradleProjectToCompositeProjectsMap.set('sub4', []);

      let subProjects = new Set<string>();
      getSubprojects(
        gradleProjectToCompositeProjectsMap,
        ['root', 'sub1', 'sub2', 'sub3', 'sub4'],
        'root',
        subProjects
      );
      expect(subProjects).toEqual(new Set(['sub1', 'sub2']));

      subProjects = new Set<string>();
      getSubprojects(
        gradleProjectToCompositeProjectsMap,
        ['root', 'sub3', 'sub4'],
        'root',
        subProjects
      );
      expect(subProjects).toEqual(new Set(['sub3', 'sub4']));
    });
  });
});
