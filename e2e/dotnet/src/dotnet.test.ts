import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
  readJson,
} from '@nx/e2e-utils';

import {
  createSimpleDotNetWorkspace,
  createWebApiWorkspace,
  addProjectReference,
} from './utils/create-dotnet-project';

describe('.NET Plugin', () => {
  let projectName = uniq('dotnet-workspace');

  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/dotnet');
      return json;
    });
    createSimpleDotNetWorkspace();
  });

  afterAll(() => cleanupProject());

  describe('Basic Project Detection', () => {
    beforeAll(() => {});

    it('should detect .NET projects', () => {
      const projects = runCLI(`show projects --json`);
      const projectsData = JSON.parse(projects);

      expect(projectsData).toContain('my-app');
      expect(projectsData).toContain('my-library');
      expect(projectsData).toContain('my-app-tests');
    });

    it('should show project details with .NET targets', () => {
      const projectDetails = runCLI(`show project my-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('clean');
      expect(details.targets).toHaveProperty('restore');

      // Should not have pack target for console app
      expect(details.targets).not.toHaveProperty('pack');

      // Should have publish target for executable
      expect(details.targets).toHaveProperty('publish');
    });

    it('should show different targets for library projects', () => {
      const projectDetails = runCLI(`show project my-library --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('clean');
      expect(details.targets).toHaveProperty('restore');
      expect(details.targets).toHaveProperty('pack'); // Libraries should have pack
      expect(details.targets).not.toHaveProperty('publish'); // Libraries shouldn't have publish
    });

    it('should show test targets for test projects', () => {
      const projectDetails = runCLI(`show project my-app-tests --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('test');
      expect(details.metadata.technologies).toContain('test');
    });
  });

  describe('Build Operations', () => {
    beforeAll(() => {
      addProjectReference('MyApp', 'MyLibrary');
      addProjectReference('MyApp.Tests', 'MyApp');
    });

    it('should restore dependencies', () => {
      const output = runCLI('restore my-app', { verbose: true });
      expect(output).toContain('Determining projects to restore');
    });

    it('should build a console application', () => {
      const output = runCLI('build my-app', { verbose: true });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Debug')
      );
    });

    it('should have expected dependencies', () => {
      runCLI('graph --file=graph.json');
      const { graph } = readJson('graph.json');

      console.log('GRAPH DEBUG OUTPUT', JSON.stringify(graph, null, 2));

      const myAppDeps = graph.dependencies['my-app'] || [];
      expect(myAppDeps).toContainEqual(
        expect.objectContaining({ target: 'my-library' })
      );
    });

    it('should build a class library', () => {
      const output = runCLI('build my-library', { verbose: true });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin/Debug')
      );
    });

    it('should run tests', () => {
      const output = runCLI('test my-app-tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });

    it('should clean build outputs', () => {
      // First build to create outputs
      runCLI('build my-app');
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Debug')
      );

      // Then clean
      const output = runCLI('clean my-app', { verbose: true });
      expect(output).not.toContain('error');
    });
  });

  describe('Advanced Scenarios', () => {
    beforeAll(() => {
      createWebApiWorkspace();
    });

    it('should handle web API projects', () => {
      const projects = runCLI(`show projects --json`);
      const projectsData = JSON.parse(projects);

      expect(projectsData).toContain('web-api');
      expect(projectsData).toContain('core');
      expect(projectsData).toContain('core-tests');
      expect(projectsData).toContain('web-api-tests');
    });

    it('should build projects in dependency order', () => {
      const output = runCLI('build web-api', { verbose: true });
      expect(output).toContain('Build succeeded');

      // Should have built the dependency first
      checkFilesMatchingPatternExist(
        '.*/Core.dll',
        tmpProjPath('Core/bin/Debug')
      );

      checkFilesMatchingPatternExist(
        '.*/WebApi.dll',
        tmpProjPath('WebApi/bin/Debug')
      );
    });

    it('should create NuGet packages for libraries', () => {
      const output = runCLI('pack core', { verbose: true });
      expect(output).toContain('Successfully created package');
      // Note: The .nupkg file location varies by dotnet version
      // Just verify the command succeeded
    });
  });

  describe('Project Graph', () => {
    beforeAll(() => {
      createSimpleDotNetWorkspace();
      addProjectReference('MyApp', 'MyLibrary');
      addProjectReference('MyApp.Tests', 'MyApp');
    });

    it('should detect project dependencies', () => {
      runCLI('graph --file=graph.json');

      checkFilesExist('graph.json');
      const { graph } = readJson('graph.json');

      // Find MyApp dependencies
      const myAppDeps = graph.dependencies['my-app'] || [];
      expect(myAppDeps.some((dep: any) => dep.target === 'my-library')).toBe(
        true
      );

      // Find MyApp.Tests dependencies
      const testDeps = graph.dependencies['my-app-tests'] || [];
      expect(testDeps.some((dep: any) => dep.target === 'my-app')).toBe(true);
    });
  });
});
