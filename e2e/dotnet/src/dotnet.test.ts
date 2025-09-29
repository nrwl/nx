import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

import {
  createSimpleDotNetWorkspace,
  createWebApiWorkspace,
  addProjectReference,
} from './utils/create-dotnet-project';

describe('.NET Plugin', () => {
  let projectName = uniq('dotnet-workspace');

  beforeAll(() => {
    newProject({
      packages: ['@nx/dotnet'],
    });
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/dotnet');
      return json;
    });
  });

  afterAll(() => cleanupProject());

  describe('Basic Project Detection', () => {
    beforeAll(() => {
      createSimpleDotNetWorkspace();
    });

    it('should detect .NET projects', () => {
      const projects = runCLI(`show projects --json`);
      const projectsData = JSON.parse(projects);

      expect(projectsData).toContain('MyApp');
      expect(projectsData).toContain('MyLibrary');
      expect(projectsData).toContain('MyApp.Tests');
    });

    it('should show project details with .NET targets', () => {
      const projectDetails = runCLI(`show project MyApp --json`);
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
      const projectDetails = runCLI(`show project MyLibrary --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('clean');
      expect(details.targets).toHaveProperty('restore');
      expect(details.targets).toHaveProperty('pack'); // Libraries should have pack
      expect(details.targets).not.toHaveProperty('publish'); // Libraries shouldn't have publish
    });

    it('should show test targets for test projects', () => {
      const projectDetails = runCLI(`show project MyApp.Tests --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('test');
      expect(details.metadata.technologies).toContain('test');
    });
  });

  describe('Build Operations', () => {
    beforeAll(() => {
      createSimpleDotNetWorkspace();
      addProjectReference('MyApp', 'MyLibrary');
      addProjectReference('MyApp.Tests', 'MyApp');
    });

    it('should restore dependencies', () => {
      const output = runCLI('restore MyApp', { verbose: true });
      expect(output).toContain('Determining projects to restore');
    });

    it('should build a console application', () => {
      const output = runCLI('build MyApp', { verbose: true });
      expect(output).toContain('Build succeeded');
      checkFilesExist('MyApp/bin/Debug/net8.0/MyApp.dll');
    });

    it('should build a class library', () => {
      const output = runCLI('build MyLibrary', { verbose: true });
      expect(output).toContain('Build succeeded');
      checkFilesExist('MyLibrary/bin/Debug/net8.0/MyLibrary.dll');
    });

    it('should run tests', () => {
      const output = runCLI('test MyApp.Tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });

    it('should clean build outputs', () => {
      // First build to create outputs
      runCLI('build MyApp');
      checkFilesExist('MyApp/bin/Debug/net8.0/MyApp.dll');

      // Then clean
      const output = runCLI('clean MyApp', { verbose: true });
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
      checkFilesExist(
        'Core/bin/Debug/net8.0/Core.dll',
        'WebApi/bin/Debug/net8.0/WebApi.dll'
      );
    });

    it('should create NuGet packages for libraries', () => {
      const output = runCLI('pack core', { verbose: true });
      expect(output).toContain('Successfully created package');
      checkFilesExist('Core/bin/Debug/Core.*.nupkg');
    });
  });

  describe('Project Graph', () => {
    beforeAll(() => {
      createSimpleDotNetWorkspace();
      addProjectReference('MyApp', 'MyLibrary');
      addProjectReference('MyApp.Tests', 'MyApp');
    });

    it('should detect project dependencies', () => {
      const output = runCLI('graph --file=graph.json');

      checkFilesExist('graph.json');
      const graph = require(`${process.cwd()}/graph.json`);

      // Find MyApp dependencies
      const myAppDeps = graph.dependencies.MyApp || [];
      expect(myAppDeps.some((dep) => dep.target === 'my-library')).toBe(true);

      // Find MyApp.Tests dependencies
      const testDeps = graph.dependencies['my-app-tests'] || [];
      expect(testDeps.some((dep) => dep.target === 'my-app')).toBe(true);
    });
  });
});
