import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  createFile,
  newProject,
  readJson,
  renameFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

import { createDotNetProject } from './utils/create-dotnet-project';
import { mkdirSync } from 'fs';

describe('.NET Plugin - Multi-Project Scenarios', () => {
  beforeAll(() => {
    console.log('Creating new Nx workspace');
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/dotnet');
      return json;
    });
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
        `exec -- dotnet add Infrastructure/Infrastructure.csproj reference Core/Core.csproj`
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
      const webApiDeps = graph.dependencies['web-api'] || [];
      expect(webApiDeps.some((dep) => dep.target === 'application')).toBe(true);

      const appDeps = graph.dependencies['application'] || [];
      expect(appDeps.some((dep) => dep.target === 'core')).toBe(true);
      expect(appDeps.some((dep) => dep.target === 'infrastructure')).toBe(true);

      const infraDeps = graph.dependencies['infrastructure'] || [];
      expect(infraDeps.some((dep) => dep.target === 'core')).toBe(true);
    });

    it('should build projects in correct order', () => {
      const output = runCLI('build web-api --verbose', { verbose: true });
      expect(output).toContain('Build succeeded');

      // All dependencies should have been built
      checkFilesMatchingPatternExist(
        '.*/Core.dll',
        tmpProjPath('Core/bin/Debug')
      );

      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin/Debug')
      );

      checkFilesMatchingPatternExist(
        '.*/Application.dll',
        tmpProjPath('Application/bin/Debug')
      );

      checkFilesMatchingPatternExist(
        '.*/WebApi.dll',
        tmpProjPath('WebApi/bin/Debug')
      );
    });

    it('should run tests with proper dependencies', () => {
      const output = runCLI('test application-tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });
  });
});
