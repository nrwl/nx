import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';

import { createDotNetProject } from './utils/create-dotnet-project';

describe('.NET Plugin - Multi-Project Scenarios', () => {
  beforeAll(() => {
    console.log('Creating new Nx workspace');
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`, { verbose: true });
    console.log('Nx workspace created');
  });

  afterAll(() => {
    cleanupProject();
    console.log('Nx workspace cleaned up');
  });

  describe('Complex Dependency Scenarios', () => {
    beforeAll(() => {
      // Create a more complex project structure
      createDotNetProject({ name: 'Core', type: 'classlib' });
      createDotNetProject({ name: 'Infrastructure', type: 'classlib' });
      createDotNetProject({ name: 'Application', type: 'classlib' });
      createDotNetProject({ name: 'WebApi', type: 'webapi' });
      createDotNetProject({ name: 'Core.Tests', type: 'xunit' });
      createDotNetProject({ name: 'Application.Tests', type: 'xunit' });

      // Set up project references to create a dependency chain
      runCommand(
        `dotnet add Infrastructure/Infrastructure.csproj reference Core/Core.csproj`
      );
      runCommand(
        `dotnet add Application/Application.csproj reference Core/Core.csproj`
      );
      runCommand(
        `dotnet add Application/Application.csproj reference Infrastructure/Infrastructure.csproj`
      );
      runCommand(
        `dotnet add WebApi/WebApi.csproj reference Application/Application.csproj`
      );
      runCommand(
        `dotnet add Core.Tests/Core.Tests.csproj reference Core/Core.csproj`
      );
      runCommand(
        `dotnet add Application.Tests/Application.Tests.csproj reference Application/Application.csproj`
      );
    });

    it('should detect complex dependency relationships', () => {
      const output = runCLI('graph --file=complex-graph.json');

      checkFilesExist('complex-graph.json');
      const { graph } = readJson('complex-graph.json');

      // Verify dependency chain
      const webApiDeps = graph.dependencies['WebApi'] || [];
      expect(webApiDeps.some((dep) => dep.target === 'Application')).toBe(true);

      const appDeps = graph.dependencies['Application'] || [];
      expect(appDeps.some((dep) => dep.target === 'Core')).toBe(true);
      expect(appDeps.some((dep) => dep.target === 'Infrastructure')).toBe(true);

      const infraDeps = graph.dependencies['Infrastructure'] || [];
      expect(infraDeps.some((dep) => dep.target === 'Core')).toBe(true);
    });

    it('should build projects in correct order', () => {
      const output = runCLI('build WebApi --verbose', { verbose: true });
      expect(output).toContain('Build succeeded');

      // All dependencies should have been built
      // Note: Paths include target framework (e.g., net8.0, net9.0)
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));

      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin')
      );

      checkFilesMatchingPatternExist(
        '.*/Application.dll',
        tmpProjPath('Application/bin')
      );

      checkFilesMatchingPatternExist(
        '.*/WebApi.dll',
        tmpProjPath('WebApi/bin')
      );
    });

    it('should run tests with proper dependencies', () => {
      const output = runCLI('test Application.Tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });
  });
});
