import {
  DependencyType,
  NxJson,
  ProjectNode,
  ProjectType
} from '../shared-models';
import { AffectedMetadataBuilder } from './affected-metadata-builder';
import { AffectedContext } from './affected-files-handler';

describe('createAffectedMetadata', () => {
  let builder: AffectedMetadataBuilder;
  let virtualReader: { read: (file: string, revision: string) => string };
  let ctx: Pick<
    AffectedContext,
    Exclude<keyof AffectedContext, 'readJsonAtRevision'>
  >;

  beforeEach(() => {
    virtualReader = {
      read: (f, r) => ''
    };
    builder = new AffectedMetadataBuilder();
    ctx = createContext();
  });

  it('should translate project nodes array to map', () => {
    builder.contextReady(ctx);
    builder.filesTouched([]);

    expect(builder.build().dependencyGraph.projects).toEqual({
      app1: expect.objectContaining({
        name: 'app1'
      }),
      app2: expect.objectContaining({
        name: 'app2'
      }),
      'app1-e2e': expect.objectContaining({
        name: 'app1-e2e'
      }),
      'customName-e2e': expect.objectContaining({
        name: 'customName-e2e'
      }),
      lib1: expect.objectContaining({
        name: 'lib1'
      }),
      lib2: expect.objectContaining({
        name: 'lib2'
      })
    });
  });

  it('should include the dependencies', () => {
    builder.contextReady(ctx);
    expect(builder.build().dependencyGraph.dependencies).toEqual(
      ctx.dependencies
    );
  });

  it('should find the roots', () => {
    builder.contextReady(ctx);
    expect(builder.build().dependencyGraph.roots).toEqual([
      'app1-e2e',
      'customName-e2e'
    ]);
  });

  it('should set projects as touched', () => {
    builder.contextReady(ctx);
    builder.filesTouched(['apps/app1/src/main.ts', 'libs/lib2/src/index.ts']);

    const { projectStates } = builder.build();

    expect(projectStates.app1.touched).toEqual(true);
    expect(projectStates.lib2.touched).toEqual(true);

    expect(projectStates.lib1.touched).toEqual(false);
    expect(projectStates.app2.touched).toEqual(false);
    expect(projectStates['customName-e2e'].touched).toEqual(false);
    expect(projectStates['app1-e2e'].touched).toEqual(false);
  });

  it('should set touched projects as affected', () => {
    builder.contextReady(ctx);
    builder.filesTouched(['apps/app1/src/main.ts', 'libs/lib2/src/index.ts']);

    const { projectStates } = builder.build();

    expect(projectStates.app1.affected).toEqual(true);
    expect(projectStates.lib2.affected).toEqual(true);
  });

  it('should set dependents of touched projects as affected', () => {
    builder.contextReady(ctx);
    builder.filesTouched(['apps/app1/src/main.ts']);

    const { projectStates } = builder.build();

    expect(projectStates.app1.affected).toEqual(true);
    expect(projectStates['app1-e2e'].affected).toEqual(true);

    expect(projectStates.lib1.affected).toEqual(false);
    expect(projectStates.lib2.affected).toEqual(false);
    expect(projectStates.app2.affected).toEqual(false);
    expect(projectStates['customName-e2e'].affected).toEqual(false);
  });

  it('should set dependents of touched projects as affected (2)', () => {
    builder.contextReady(ctx);
    builder.filesTouched(['libs/lib1/src/index.ts']);

    const { projectStates } = builder.build();

    expect(projectStates.app1.affected).toEqual(true);
    expect(projectStates['app1-e2e'].affected).toEqual(true);
    expect(projectStates.lib1.affected).toEqual(true);
    expect(projectStates.app2.affected).toEqual(true);
    expect(projectStates['customName-e2e'].affected).toEqual(true);

    expect(projectStates.lib2.affected).toEqual(false);
  });

  it('should not set any projects as affected when none are touched', () => {
    builder.contextReady(ctx);
    builder.filesTouched([]);

    const { projectStates } = builder.build();

    expect(projectStates.app1.affected).toEqual(false);
    expect(projectStates.app2.affected).toEqual(false);
    expect(projectStates.lib1.affected).toEqual(false);
    expect(projectStates.lib2.affected).toEqual(false);
    expect(projectStates['app1-e2e'].affected).toEqual(false);
    expect(projectStates['customName-e2e'].affected).toEqual(false);
  });

  it('should handle circular dependencies', () => {
    ctx.dependencies['lib2'].push({
      projectName: 'app2',
      type: DependencyType.es6Import
    });
    builder.contextReady(ctx);
    builder.filesTouched(['libs/lib2/src/index.ts']);

    const { dependencyGraph, projectStates } = builder.build();
    expect(dependencyGraph.roots).toEqual(['app1-e2e', 'customName-e2e']);
    expect(projectStates.app1.affected).toEqual(false);
    expect(projectStates.app2.affected).toEqual(true);
    expect(projectStates.lib1.affected).toEqual(false);
    expect(projectStates.lib2.affected).toEqual(true);
    expect(projectStates['app1-e2e'].affected).toEqual(false);
    expect(projectStates['customName-e2e'].affected).toEqual(true);
  });

  it('should cases where there is no root', () => {
    ctx.dependencies['lib1'].push({
      projectName: 'app1-e2e',
      type: DependencyType.es6Import
    });
    ctx.dependencies['lib2'].push({
      projectName: 'customName-e2e',
      type: DependencyType.es6Import
    });
    builder.contextReady(ctx);
    builder.filesTouched([
      'apps/app1-e2e/src/main.ts',
      'apps/customName-e2e/src/main.ts'
    ]);

    const { dependencyGraph, projectStates } = builder.build();
    expect(dependencyGraph.roots).toEqual([]);
    expect(projectStates.app1.affected).toEqual(true);
    expect(projectStates.app2.affected).toEqual(true);
    expect(projectStates.lib1.affected).toEqual(true);
    expect(projectStates.lib2.affected).toEqual(true);
    expect(projectStates['app1-e2e'].affected).toEqual(true);
    expect(projectStates['customName-e2e'].affected).toEqual(true);
  });

  it('should mark project as affected when imported node module changes', () => {
    virtualReader.read = (file, revision) => {
      if (file === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'happy-nrwl': revision === 'master' ? '1.0.0' : '2.0.0'
          }
        });
      }
      return '';
    };
    builder.contextReady(ctx);
    builder.filesTouched(['package.json']);

    const { projectStates } = builder.build();

    expect(projectStates.lib1.affected).toEqual(true);
  });

  it('should mark implied JSON dependencies', () => {
    virtualReader.read = (file, revision) => {
      if (file === 'package.json') {
        return JSON.stringify({
          scripts: {
            deploy:
              revision === 'master' ? 'echo deploy' : 'echo different deploy'
          }
        });
      }
      throw new Error('Cannot read file');
    };
    ctx.nxJson.implicitDependencies = {
      'package.json': {
        scripts: {
          deploy: '*'
        }
      }
    };
    builder.contextReady(ctx);
    builder.filesTouched(['package.json']);

    const { projectStates } = builder.build();

    expect(projectStates.lib1.affected).toEqual(true);
  });

  it('should handle null base and head revisions', () => {
    (ctx as any).revisionRange = { base: null, head: null };
    builder.contextReady(ctx);
    builder.filesTouched(['package.json']);

    const { projectStates } = builder.build();

    expect(projectStates.app1.affected).toEqual(false);
    expect(projectStates.app2.affected).toEqual(false);
    expect(projectStates.lib1.affected).toEqual(false);
    expect(projectStates.lib2.affected).toEqual(false);
    expect(projectStates['app1-e2e'].affected).toEqual(false);
    expect(projectStates['customName-e2e'].affected).toEqual(false);
  });

  describe('withDeps', () => {
    it('should mark all dependencies as affected', () => {
      (ctx as any).withDeps = true;
      builder.contextReady(ctx);
      builder.filesTouched(['libs/lib2/src/index.ts']);

      const { projectStates } = builder.build();

      expect(projectStates.app1.affected).toEqual(false);
      expect(projectStates.app2.affected).toEqual(true);
      expect(projectStates.lib1.affected).toEqual(true);
      expect(projectStates.lib2.affected).toEqual(true);
      expect(projectStates['app1-e2e'].affected).toEqual(false);
      expect(projectStates['customName-e2e'].affected).toEqual(true);
    });
  });

  function createContext() {
    const workspaceJson = {
      projects: {
        app1: {},
        app2: {},
        'app1-e2e': {},
        'customName-e2e': {},
        lib1: {},
        lib2: {}
      }
    };
    const nxJson: NxJson = {
      npmScope: 'proj',
      projects: {
        app1: {},
        app2: {},
        'app1-e2e': {},
        'customName-e2e': {},
        lib1: {},
        lib2: {}
      }
    };
    const projectNodes = [
      createProjectNode({
        name: 'app1',
        type: ProjectType.app
      }),
      createProjectNode({
        name: 'app2',
        type: ProjectType.app
      }),
      createProjectNode({
        name: 'app1-e2e',
        type: ProjectType.app
      }),
      createProjectNode({
        name: 'customName-e2e',
        type: ProjectType.app
      }),
      createProjectNode({
        name: 'lib1',
        type: ProjectType.lib
      }),
      createProjectNode({
        name: 'lib2',
        type: ProjectType.lib
      })
    ];
    const dependencies = {
      'app1-e2e': [
        {
          projectName: 'app1',
          type: DependencyType.implicit
        }
      ],
      'customName-e2e': [
        {
          projectName: 'app2',
          type: DependencyType.implicit
        }
      ],
      app1: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        }
      ],
      app2: [
        {
          projectName: 'lib1',
          type: DependencyType.es6Import
        },
        {
          projectName: 'lib2',
          type: DependencyType.es6Import
        }
      ],
      lib1: [
        {
          projectName: 'happy-nrwl',
          type: DependencyType.nodeModule
        }
      ],
      lib2: [
        {
          projectName: 'happy-nrwl',
          type: DependencyType.nodeModule
        }
      ]
    };
    return {
      workspaceJson,
      nxJson,
      dependencies,
      projectNodes,
      revisionRange: { base: 'master', head: 'HEAD' },
      withDeps: false,
      readFileAtRevision: (file, revision) => virtualReader.read(file, revision)
    };
  }

  function createProjectNode(attrs: Partial<ProjectNode>): ProjectNode {
    return {
      name: '',
      root: '',
      type: ProjectType.lib,
      tags: [],
      files:
        attrs.type === ProjectType.app
          ? [`apps/${attrs.name}/src/main.ts`]
          : [`libs/${attrs.name}/src/index.ts`],
      architect: {},
      implicitDependencies: [],
      fileMTimes: {},
      ...attrs
    };
  }
});
