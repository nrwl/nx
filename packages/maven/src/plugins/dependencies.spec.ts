import { CreateDependenciesContext, ProjectConfiguration } from '@nx/devkit';
import { DependencyType } from 'nx/src/config/project-graph';
import { RawProjectGraphDependency } from 'nx/src/project-graph/project-graph-builder';
import { setCurrentMavenData } from './maven-data-cache';
import { MavenAnalysisData } from './types';

// Must import after mocks are set up
let createDependencies: typeof import('./dependencies').createDependencies;

describe('Maven createDependencies', () => {
  const projects: Record<string, ProjectConfiguration> = {
    app: { root: 'app', name: 'app' },
    lib: { root: 'lib', name: 'lib' },
  };

  const baseContext: CreateDependenciesContext = {
    projects,
    externalNodes: {},
    workspaceRoot: '/workspace',
    nxJsonConfiguration: {},
    fileMap: { projectFileMap: {}, nonProjectFiles: [] },
    filesToProcess: { projectFileMap: {}, nonProjectFiles: [] },
  };

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import('./dependencies');
    createDependencies = mod.createDependencies;
    const cache = await import('./maven-data-cache');
    cache.setCurrentMavenData(null);
  });

  it('should return empty array when no maven data is available', async () => {
    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);
    expect(result).toEqual([]);
  });

  it('should transform workspace-to-workspace dependencies', async () => {
    const deps: RawProjectGraphDependency[] = [
      {
        source: 'app',
        target: 'lib',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ];
    const { setCurrentMavenData } = await import('./maven-data-cache');
    setCurrentMavenData({
      createNodesResults: [],
      createDependenciesResults: deps,
    });

    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);

    expect(result).toEqual([
      {
        source: 'app',
        target: 'lib',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ]);
  });

  it('should transform workspace-to-external dependencies', async () => {
    const deps: RawProjectGraphDependency[] = [
      {
        source: 'app',
        target: 'maven:org.springframework:spring-core',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ];
    const { setCurrentMavenData } = await import('./maven-data-cache');
    setCurrentMavenData({
      createNodesResults: [],
      createDependenciesResults: deps,
    });

    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);

    expect(result).toEqual([
      {
        source: 'app',
        target: 'maven:org.springframework:spring-core',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ]);
  });

  it('should filter out external-to-external dependencies', async () => {
    const deps: RawProjectGraphDependency[] = [
      // workspace -> workspace (keep)
      {
        source: 'app',
        target: 'lib',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
      // workspace -> external (keep)
      {
        source: 'app',
        target: 'maven:org.springframework.boot:spring-boot-starter-web',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
      // external -> external (drop — source can't resolve to workspace project)
      {
        source: 'maven:org.springframework:spring-core',
        target: 'maven:org.springframework:spring-jcl',
        type: DependencyType.static,
      },
      {
        source: 'maven:org.springframework.boot:spring-boot-starter-web',
        target: 'maven:org.springframework:spring-web',
        type: DependencyType.static,
      },
    ];
    const { setCurrentMavenData } = await import('./maven-data-cache');
    setCurrentMavenData({
      createNodesResults: [],
      createDependenciesResults: deps,
    });

    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);

    expect(result).toEqual([
      {
        source: 'app',
        target: 'lib',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
      {
        source: 'app',
        target: 'maven:org.springframework.boot:spring-boot-starter-web',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ]);
  });

  it('should filter out deps where source root is unknown', async () => {
    const deps: RawProjectGraphDependency[] = [
      {
        source: 'nonexistent-root',
        target: 'lib',
        type: DependencyType.static,
        sourceFile: 'nonexistent-root/pom.xml',
      },
    ];
    const { setCurrentMavenData } = await import('./maven-data-cache');
    setCurrentMavenData({
      createNodesResults: [],
      createDependenciesResults: deps,
    });

    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);

    expect(result).toEqual([]);
  });

  it('should filter out deps where target root is unknown', async () => {
    const deps: RawProjectGraphDependency[] = [
      {
        source: 'app',
        target: 'nonexistent-root',
        type: DependencyType.static,
        sourceFile: 'app/pom.xml',
      },
    ];
    const { setCurrentMavenData } = await import('./maven-data-cache');
    setCurrentMavenData({
      createNodesResults: [],
      createDependenciesResults: deps,
    });

    const result = await createDependencies({}, {
      ...baseContext,
    } as CreateDependenciesContext);

    expect(result).toEqual([]);
  });
});
