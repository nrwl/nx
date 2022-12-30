import { ProjectNode } from './project-node';

describe('ProjectNode', () => {
  describe('app nodes', () => {
    it('should not set parentId if groupByFolder is false', () => {
      const projectNode = new ProjectNode(
        {
          name: 'sub-app',
          type: 'app',
          data: {
            projectType: 'application',
            root: 'apps/sub/app',
            sourceRoot: 'apps/sub/app/src',
            prefix: 'sub-app',
            tags: [],
            files: [],
          },
        },
        'apps'
      );

      const result = projectNode.getCytoscapeNodeDef(false);

      expect(result.data.parent).toBeNull();
    });

    it('should not set parentId if app is not nested', () => {
      const projectNode = new ProjectNode(
        {
          name: 'app',
          type: 'app',
          data: {
            projectType: 'application',
            root: 'apps/app',
            sourceRoot: 'apps/app/src',
            prefix: 'app',
            tags: [],
            files: [],
          },
        },
        'apps'
      );

      const result = projectNode.getCytoscapeNodeDef(false);

      expect(result.data.parent).toBeNull();
    });

    it('should set parentId if the app is nested and groupByFolder is true', () => {
      const projectNode = new ProjectNode(
        {
          name: 'sub-app',
          type: 'app',
          data: {
            projectType: 'application',
            root: 'apps/sub/app',
            sourceRoot: 'apps/sub/app/src',
            prefix: 'sub-app',
            tags: [],
            files: [],
          },
        },
        'apps'
      );

      const result = projectNode.getCytoscapeNodeDef(true);

      expect(result.data.parent).toEqual('dir-sub');
    });
  });

  describe('lib nodes', () => {
    it('should not set parentId if groupByFolder is false', () => {
      const projectNode = new ProjectNode(
        {
          name: 'sub-lib',
          type: 'lib',
          data: {
            root: 'libs/sub/lib',
            sourceRoot: 'libs/sub/lib/src',
            projectType: 'library',
            files: [],
          },
        },
        'libs'
      );

      const result = projectNode.getCytoscapeNodeDef(false);

      expect(result.data.parent).toBeNull();
    });

    it('should not set parentId if lib is not nested', () => {
      const projectNode = new ProjectNode(
        {
          name: 'lib',
          type: 'lib',
          data: {
            root: 'libs/lib',
            sourceRoot: 'libs/lib/src',
            projectType: 'library',
            files: [],
          },
        },
        'libs'
      );

      const result = projectNode.getCytoscapeNodeDef(false);

      expect(result.data.parent).toBeNull();
    });

    it('should set parentId if the lib is nested and groupByFolder is true', () => {
      const projectNode = new ProjectNode(
        {
          name: 'sub-lib',
          type: 'lib',
          data: {
            root: 'libs/sub/lib',
            sourceRoot: 'libs/sub/lib/src',
            projectType: 'library',
            files: [],
          },
        },
        'libs'
      );

      const result = projectNode.getCytoscapeNodeDef(true);

      expect(result.data.parent).toEqual('dir-sub');
    });
  });
});
