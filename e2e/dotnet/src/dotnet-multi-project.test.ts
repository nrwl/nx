import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

import { createDotNetProject } from './utils/create-dotnet-project';

describe('.NET Plugin - Multi-Project Scenarios', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/dotnet');
      return json;
    });
  });

  afterAll(() => cleanupProject());

  describe('Multiple Projects in Same Directory', () => {
    const sharedDir = 'shared-services';

    beforeAll(() => {
      // Create multiple projects in the same directory
      createDotNetProject({
        name: 'UserService',
        type: 'webapi',
        cwd: sharedDir,
      });
      createDotNetProject({
        name: 'OrderService',
        type: 'webapi',
        cwd: sharedDir,
      });
      createDotNetProject({
        name: 'SharedLibrary',
        type: 'classlib',
        cwd: sharedDir,
      });
    });

    it('should detect all projects in the directory', () => {
      const projects = runCLI(`show projects --json`);
      const projectsData = JSON.parse(projects);

      expect(projectsData).toContain('shared-services');
    });

    it('should create project-specific targets', () => {
      const projectDetails = runCLI(`show project shared-services --json`);
      const details = JSON.parse(projectDetails);

      // Should have umbrella targets
      expect(details.targets).toHaveProperty('build');
      expect(details.targets).toHaveProperty('restore');
      expect(details.targets).toHaveProperty('clean');

      // Should have project-specific targets
      expect(details.targets).toHaveProperty('build:user-service');
      expect(details.targets).toHaveProperty('build:order-service');
      expect(details.targets).toHaveProperty('build:shared-library');

      expect(details.targets).toHaveProperty('restore:user-service');
      expect(details.targets).toHaveProperty('restore:order-service');
      expect(details.targets).toHaveProperty('restore:shared-library');
    });

    it('should build individual projects', () => {
      const output = runCLI('build:user-service shared-services', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');
      checkFilesExist(
        'shared-services/UserService/bin/Debug/net8.0/UserService.dll'
      );
    });

    it('should build all projects with umbrella target', () => {
      const output = runCLI('build shared-services', { verbose: true });
      expect(output).toContain('Build succeeded');

      checkFilesExist(
        'shared-services/UserService/bin/Debug/net8.0/UserService.dll',
        'shared-services/OrderService/bin/Debug/net8.0/OrderService.dll',
        'shared-services/SharedLibrary/bin/Debug/net8.0/SharedLibrary.dll'
      );
    });
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
      expect(output).toContain('Project graph saved');

      checkFilesExist('complex-graph.json');
      const graph = require(`${process.cwd()}/complex-graph.json`);

      // Verify dependency chain
      const webApiDeps = graph.dependencies.WebApi || [];
      expect(webApiDeps.some((dep) => dep.target === 'Application')).toBe(true);

      const appDeps = graph.dependencies.Application || [];
      expect(appDeps.some((dep) => dep.target === 'Core')).toBe(true);
      expect(appDeps.some((dep) => dep.target === 'Infrastructure')).toBe(true);

      const infraDeps = graph.dependencies.Infrastructure || [];
      expect(infraDeps.some((dep) => dep.target === 'Core')).toBe(true);
    });

    it('should build projects in correct order', () => {
      const output = runCLI('build WebApi --verbose', { verbose: true });
      expect(output).toContain('Build succeeded');

      // All dependencies should have been built
      checkFilesExist(
        'Core/bin/Debug/net8.0/Core.dll',
        'Infrastructure/bin/Debug/net8.0/Infrastructure.dll',
        'Application/bin/Debug/net8.0/Application.dll',
        'WebApi/bin/Debug/net8.0/WebApi.dll'
      );
    });

    it('should run tests with proper dependencies', () => {
      const output = runCLI('test Application.Tests', { verbose: true });
      expect(output).toContain('Test run for');
      expect(output).toMatch(/Passed!|Total tests:/);
    });
  });
});
