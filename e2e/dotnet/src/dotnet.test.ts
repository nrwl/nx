import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  readJson,
} from '@nx/e2e-utils';

import {
  createSimpleDotNetWorkspace,
  createWebApiWorkspace,
  addProjectReference,
} from './utils/create-dotnet-project';

describe('.NET Plugin', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
    createSimpleDotNetWorkspace();
  });

  afterAll(() => cleanupProject());

  describe('Basic Project Detection', () => {
    beforeAll(() => {});

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
    });
  });

  describe('Build Operations', () => {
    beforeAll(() => {
      addProjectReference('MyApp', 'MyLibrary');
      addProjectReference('MyApp.Tests', 'MyApp');
    });

    it('should restore dependencies', () => {
      const output = runCLI('restore MyApp', { verbose: true });
      expect(output).toContain('Determining projects to restore');
    });

    it('should build a console application', () => {
      const output = runCLI('build MyApp', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist('.*/MyApp.dll', tmpProjPath('MyApp/bin'));
    });

    it('should have expected dependencies', () => {
      runCLI('graph --file=graph.json', { env: { NX_DAEMON: 'false' } });
      const { graph } = readJson('graph.json');

      const myAppDeps = graph.dependencies['MyApp'] || [];
      expect(myAppDeps).toContainEqual(
        expect.objectContaining({ target: 'MyLibrary' })
      );
    });

    it('should build a class library', () => {
      const output = runCLI('build MyLibrary', { verbose: true });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin')
      );
    });

    it('should run tests', () => {
      const output = runCLI('test MyApp.Tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });

    it('should clean build outputs', () => {
      // First build to create outputs
      runCLI('build MyApp');
      checkFilesMatchingPatternExist('.*/MyApp.dll', tmpProjPath('MyApp/bin'));

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

      expect(projectsData).toContain('WebApi');
      expect(projectsData).toContain('Core');
      expect(projectsData).toContain('Core.Tests');
      expect(projectsData).toContain('WebApi.Tests');
    });

    it('should build projects in dependency order', () => {
      const output = runCLI('build WebApi', { verbose: true });
      expect(output).toContain('Build succeeded');

      // Should have built the dependency first
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));

      checkFilesMatchingPatternExist(
        '.*/WebApi.dll',
        tmpProjPath('WebApi/bin')
      );
    });

    it('should create NuGet packages for libraries', () => {
      const output = runCLI('pack Core', { verbose: true });

      checkFilesMatchingPatternExist(
        '.*/Core.*.nupkg',
        tmpProjPath('Core/bin')
      );
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
      const myAppDeps = graph.dependencies['MyApp'] || [];
      expect(myAppDeps.some((dep: any) => dep.target === 'MyLibrary')).toBe(
        true
      );

      // Find MyApp.Tests dependencies
      const testDeps = graph.dependencies['MyApp.Tests'] || [];
      expect(testDeps.some((dep: any) => dep.target === 'MyApp')).toBe(true);
    });
  });
});
