import { DependencyType } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';

let tempFs: TempFs;

describe('@nx/gradle/plugin/dependencies', () => {
  let createDependencies: typeof import('./dependencies').createDependencies;
  let reportDependencies: Array<{
    source: string;
    target: string;
    sourceFile: string;
  }>;

  beforeEach(async () => {
    tempFs = new TempFs('gradle-dependencies');
    reportDependencies = [];

    jest.resetModules();
    jest.doMock('./utils/get-project-graph-from-gradle-plugin', () => ({
      populateProjectGraph: jest.fn().mockResolvedValue(undefined),
      getCurrentProjectGraphReport: () => ({
        nodes: {},
        dependencies: reportDependencies,
      }),
    }));
    jest.doMock('@nx/devkit/internal', () => ({
      ...jest.requireActual('@nx/devkit/internal'),
      globWithWorkspaceContext: jest.fn().mockResolvedValue(['gradlew']),
    }));
    jest.doMock('@nx/devkit', () => {
      const actual = jest.requireActual('@nx/devkit');
      return {
        ...actual,
        workspaceRoot: tempFs.tempDir,
        validateDependency: jest.fn(),
      };
    });

    createDependencies = (await import('./dependencies')).createDependencies;
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  const contextWith = (projects: Record<string, string>) =>
    ({
      workspaceRoot: tempFs.tempDir,
      projects: Object.fromEntries(
        Object.entries(projects).map(([name, root]) => [name, { name, root }])
      ),
      externalNodes: {},
      fileMap: { projectFileMap: {}, nonProjectFiles: [] },
      filesToProcess: { projectFileMap: {}, nonProjectFiles: [] },
      nxJsonConfiguration: {},
    }) as any;

  it('records an edge as static when the source project owns the build file', async () => {
    await tempFs.createFiles({ 'build.gradle': '', gradlew: '' });
    reportDependencies = [
      { source: '.', target: 'clients', sourceFile: 'build.gradle' },
    ];

    const result = await createDependencies(
      {},
      contextWith({ root: '.', ':clients': 'clients' })
    );

    expect(result).toEqual([
      expect.objectContaining({
        source: 'root',
        target: ':clients',
        type: DependencyType.static,
        sourceFile: 'build.gradle',
      }),
    ]);
  });

  it('records a nested project that owns its build file as static', async () => {
    await tempFs.createFiles({
      'api-checker/core/build.gradle': '',
      gradlew: '',
    });
    reportDependencies = [
      {
        source: 'api-checker/core',
        target: 'clients',
        sourceFile: 'api-checker/core/build.gradle',
      },
    ];

    const result = await createDependencies(
      {},
      contextWith({
        ':api-checker:core': 'api-checker/core',
        ':clients': 'clients',
      })
    );

    expect(result[0]).toEqual(
      expect.objectContaining({ type: DependencyType.static })
    );
  });

  it('records an ancestor-configured project as implicit, since Nx rejects a sourceFile outside the source project', async () => {
    await tempFs.createFiles({ 'build.gradle': '', gradlew: '' });
    // `core` is configured by the ROOT build.gradle via `project(':core') { }`, so the file that
    // configures it lives outside it.
    reportDependencies = [
      { source: 'core', target: 'clients', sourceFile: 'build.gradle' },
    ];

    const result = await createDependencies(
      {},
      contextWith({ ':core': 'core', ':clients': 'clients' })
    );

    expect(result).toEqual([
      {
        source: ':core',
        target: ':clients',
        type: DependencyType.implicit,
      },
    ]);
    expect(result[0]).not.toHaveProperty('sourceFile');
  });
});
