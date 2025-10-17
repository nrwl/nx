import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  readJson,
  updateFile,
  readFile,
} from '@nx/e2e-utils';

import {
  createDotNetProject,
  addProjectReference,
} from './utils/create-dotnet-project';

describe('.NET Plugin - Advanced MSBuild Features', () => {
  let projectName = uniq('dotnet-advanced');

  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
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

      runCLI('run-many -t restore');
    });

    it('should detect artifacts output configuration', () => {
      const projectDetails = runCLI(`show project ArtifactsApp --json`);
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
      const output = runCLI('build ArtifactsApp', {
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
      const projectDetails = runCLI(`show project CustomPathApp --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.build.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/build-output\/bin/),
          expect.stringMatching(/^\{workspaceRoot\}\/build-output\/obj/),
        ])
      );
    });

    it('should build to custom artifacts directory', () => {
      const output = runCLI('build CustomPathApp', {
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

      runCLI('run-many -t restore');
    });

    it('should detect multi-targeting configuration', () => {
      const projectDetails = runCLI(`show project MultiTargetLib --json`);
      const details = JSON.parse(projectDetails);

      // Should have detected multi-targeting configuration
      expect(details.targets.build).toBeDefined();
    });

    it('should build for all target frameworks', () => {
      const output = runCLI('build MultiTargetLib', {
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
      runCLI('run-many -t restore');
    });

    it('should detect custom output paths', () => {
      const projectDetails = runCLI(`show project CustomOutputApp --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.build.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/custom-bin/),
          expect.stringMatching(/custom-obj/),
        ])
      );
    });

    it('should build to custom output directory', () => {
      const output = runCLI('build CustomOutputApp', {
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
      const projectDetails = runCLI(`show project CustomTestResults --json`);
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

      runCLI('run-many -t restore');
    });

    it('should detect all project dependencies', () => {
      runCLI('graph --file=graph.json', { env: { NX_DAEMON: 'false' } });
      const { graph } = readJson('graph.json');

      // ApiGateway should depend on UserService and OrderService
      const apiDeps = graph.dependencies['ApiGateway'] || [];
      expect(apiDeps).toContainEqual(
        expect.objectContaining({ target: 'UserService' })
      );
      expect(apiDeps).toContainEqual(
        expect.objectContaining({ target: 'OrderService' })
      );

      // UserService should depend on Shared
      const userServiceDeps = graph.dependencies['UserService'] || [];
      expect(userServiceDeps).toContainEqual(
        expect.objectContaining({ target: 'Shared' })
      );

      // OrderService should depend on Shared
      const orderServiceDeps = graph.dependencies['OrderService'] || [];
      expect(orderServiceDeps).toContainEqual(
        expect.objectContaining({ target: 'Shared' })
      );
    });

    it('should build in correct dependency order', () => {
      const output = runCLI('build ApiGateway', {
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
      const projectDetails = runCLI(`show project NuGetPackage --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.pack.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/package/),
        ])
      );
    });

    it('should create NuGet package in artifacts directory', () => {
      // Build first
      runCLI('build NuGetPackage', { env: { NX_DAEMON: 'false' } });

      // Then pack
      const output = runCLI('pack NuGetPackage', {
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
      const projectDetails = runCLI(`show project PublishApp --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.publish.outputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\{workspaceRoot\}\/artifacts\/publish/),
        ])
      );
    });

    it('should publish to artifacts directory', () => {
      // Build first
      runCLI('build PublishApp', { env: { NX_DAEMON: 'false' } });

      // Then publish
      const output = runCLI('publish PublishApp', {
        verbose: true,
        env: { NX_DAEMON: 'false' },
      });
      expect(output).not.toContain('error');

      // Published files should be in artifacts/publish directory
      checkFilesExist('artifacts/publish/PublishApp');
    });
  });
});
