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
  updateFile,
  readFile,
} from '@nx/e2e-utils';

import {
  createDotNetProject,
  addProjectReference,
} from './utils/create-dotnet-project';
import { join } from 'path';

describe('.NET Plugin - Advanced MSBuild Features', () => {
  let projectName = uniq('dotnet-advanced');

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

  describe('Artifacts Output Layout', () => {
    beforeAll(() => {
      // Create a project with artifacts output enabled
      createDotNetProject({
        name: 'ArtifactsApp',
        type: 'console',
      });

      // Enable artifacts output in a Directory.Build.props file
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
  </PropertyGroup>
</Project>`
      );
    });

    it('should detect artifacts output configuration', () => {
      const projectDetails = runCLI(`show project artifacts-app --json`);
      const details = JSON.parse(projectDetails);

      // Build outputs should point to artifacts directory relative to workspace root
      expect(details.targets.build.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/bin/),
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/obj/),
        ])
      );
    });

    it('should build to artifacts directory', () => {
      const output = runCLI('build artifacts-app', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');

      // Check that artifacts were created in the artifacts directory
      checkFilesExist('artifacts/bin/ArtifactsApp');
      checkFilesExist('artifacts/obj/ArtifactsApp');
    });
  });

  describe('Custom Artifacts Path', () => {
    beforeAll(() => {
      // Use custom artifacts path - must be set BEFORE creating the project
      // so MSBuild evaluates it during project creation
      // Use $(MSBuildThisFileDirectory) to make path relative to workspace root
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
    <ArtifactsPath>$(MSBuildThisFileDirectory)build-output</ArtifactsPath>
  </PropertyGroup>
</Project>`
      );

      createDotNetProject({
        name: 'CustomPathApp',
        type: 'console',
      });
    });

    it('should use custom artifacts path', () => {
      const projectDetails = runCLI(`show project custom-path-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.build.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/build-output\/bin/),
          expect.stringMatching(/^\{workspaceRoot\}\/build-output\/obj/),
        ])
      );
    });

    it('should build to custom artifacts directory', () => {
      const output = runCLI('build custom-path-app', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');

      checkFilesExist('build-output/bin/CustomPathApp');
      checkFilesExist('build-output/obj/CustomPathApp');
    });
  });

  describe('Multi-Targeting', () => {
    beforeAll(() => {
      createDotNetProject({
        name: 'MultiTargetLib',
        type: 'classlib',
      });

      // Enable multi-targeting
      const csprojPath = tmpProjPath('MultiTargetLib/MultiTargetLib.csproj');
      const csproj = readFile(csprojPath);
      const updatedCsproj = csproj.replace(
        /<TargetFramework>.*?<\/TargetFramework>/,
        '<TargetFrameworks>net8.0;net9.0</TargetFrameworks>'
      );
      updateFile('MultiTargetLib/MultiTargetLib.csproj', updatedCsproj);

      // Enable artifacts output
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
  </PropertyGroup>
</Project>`
      );
    });

    it('should detect multi-targeting configuration', () => {
      const projectDetails = runCLI(`show project multi-target-lib --json`);
      const details = JSON.parse(projectDetails);

      // Should have detected multi-targeting configuration
      expect(details.targets.build).toBeDefined();
    });

    it('should build for all target frameworks', () => {
      const output = runCLI('build multi-target-lib', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');

      // Both frameworks should be built
      checkFilesExist('artifacts/bin/MultiTargetLib');
    });
  });

  describe('Custom Output Paths', () => {
    beforeAll(() => {
      createDotNetProject({
        name: 'CustomOutputApp',
        type: 'console',
      });

      // Remove Directory.Build.props to avoid inheriting UseArtifactsOutput
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
  </PropertyGroup>
</Project>`
      );

      // Customize output paths using traditional layout
      const csprojPath = tmpProjPath('CustomOutputApp/CustomOutputApp.csproj');
      const csproj = readFile(csprojPath);
      const updatedCsproj = csproj.replace(
        '</PropertyGroup>',
        `  <BaseOutputPath>custom-bin\</BaseOutputPath>
  <BaseIntermediateOutputPath>custom-obj\</BaseIntermediateOutputPath>
</PropertyGroup>`
      );
      updateFile('CustomOutputApp/CustomOutputApp.csproj', updatedCsproj);
    });

    it('should detect custom output paths', () => {
      const projectDetails = runCLI(`show project custom-output-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.build.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/custom-bin/),
          expect.stringMatching(/custom-obj/),
        ])
      );
    });

    it('should build to custom output directory', () => {
      const output = runCLI('build custom-output-app', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');

      checkFilesMatchingPatternExist(
        '.*/CustomOutputApp.dll',
        tmpProjPath('CustomOutputApp/custom-bin')
      );
    });
  });

  describe('Test Results Directory', () => {
    beforeAll(() => {
      createDotNetProject({
        name: 'CustomTestResults',
        type: 'xunit',
      });

      // Customize test results directory
      const csprojPath = tmpProjPath(
        'CustomTestResults/CustomTestResults.csproj'
      );
      const csproj = readFile(csprojPath);
      const updatedCsproj = csproj.replace(
        '</PropertyGroup>',
        `  <TestResultsDirectory>custom-test-results</TestResultsDirectory>
</PropertyGroup>`
      );
      updateFile('CustomTestResults/CustomTestResults.csproj', updatedCsproj);
    });

    it('should detect custom test results directory', () => {
      const projectDetails = runCLI(`show project custom-test-results --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.test.outputs).toEqual(
        expect.arrayContaining([expect.stringMatching(/custom-test-results/)])
      );
    });
  });

  describe('Complex Dependency Graph with Artifacts', () => {
    beforeAll(() => {
      // Create a complex project structure
      createDotNetProject({
        name: 'ApiGateway',
        type: 'webapi',
      });
      createDotNetProject({
        name: 'UserService',
        type: 'classlib',
      });
      createDotNetProject({
        name: 'OrderService',
        type: 'classlib',
      });
      createDotNetProject({
        name: 'Shared',
        type: 'classlib',
      });

      // Add references
      addProjectReference('ApiGateway', 'UserService');
      addProjectReference('ApiGateway', 'OrderService');
      addProjectReference('UserService', 'Shared');
      addProjectReference('OrderService', 'Shared');

      // Enable artifacts output
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
  </PropertyGroup>
</Project>`
      );
    });

    it('should detect all project dependencies', () => {
      runCLI('graph --file=graph.json', { env: { NX_DAEMON: 'false' } });
      const { graph } = readJson('graph.json');

      // ApiGateway should depend on UserService and OrderService
      const apiDeps = graph.dependencies['api-gateway'] || [];
      expect(apiDeps).toContainEqual(
        expect.objectContaining({ target: 'user-service' })
      );
      expect(apiDeps).toContainEqual(
        expect.objectContaining({ target: 'order-service' })
      );

      // UserService should depend on Shared
      const userServiceDeps = graph.dependencies['user-service'] || [];
      expect(userServiceDeps).toContainEqual(
        expect.objectContaining({ target: 'shared' })
      );

      // OrderService should depend on Shared
      const orderServiceDeps = graph.dependencies['order-service'] || [];
      expect(orderServiceDeps).toContainEqual(
        expect.objectContaining({ target: 'shared' })
      );
    });

    it('should build in correct dependency order', () => {
      const output = runCLI('build api-gateway', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).toContain('Build succeeded');

      // All dependencies should be built
      checkFilesExist('artifacts/bin/Shared');
      checkFilesExist('artifacts/bin/UserService');
      checkFilesExist('artifacts/bin/OrderService');
      checkFilesExist('artifacts/bin/ApiGateway');
    });
  });

  describe('Package Output with Artifacts', () => {
    beforeAll(() => {
      createDotNetProject({
        name: 'NuGetPackage',
        type: 'classlib',
      });

      // Enable artifacts output
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
  </PropertyGroup>
</Project>`
      );
    });

    it('should use artifacts path for NuGet packages', () => {
      const projectDetails = runCLI(`show project nu-get-package --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.pack.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/package/),
        ])
      );
    });

    it('should create NuGet package in artifacts directory', () => {
      // Build first
      runCLI('build nu-get-package', { env: { NX_DAEMON: 'false' } });

      // Then pack
      const output = runCLI('pack nu-get-package', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });

      // Package should be in artifacts/package directory
      checkFilesExist('artifacts/package');
    });
  });

  describe('Publish with Artifacts', () => {
    beforeAll(() => {
      createDotNetProject({
        name: 'PublishApp',
        type: 'console',
      });

      // Enable artifacts output
      updateFile(
        'Directory.Build.props',
        `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
  </PropertyGroup>
</Project>`
      );
    });

    it('should use artifacts path for publish output', () => {
      const projectDetails = runCLI(`show project publish-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.publish.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/publish/),
        ])
      );
    });

    it('should publish to artifacts directory', () => {
      // Build first
      runCLI('build publish-app', { env: { NX_DAEMON: 'false' } });

      // Then publish
      const output = runCLI('publish publish-app', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).not.toContain('error');

      // Published files should be in artifacts/publish directory
      checkFilesExist('artifacts/publish/PublishApp');
    });
  });
});
