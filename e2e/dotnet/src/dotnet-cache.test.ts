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

import {
  createDotNetProject,
  addProjectReference,
} from './utils/create-dotnet-project';

describe('.NET Plugin - Cache Tests', () => {
  beforeAll(() => {
    console.log('Creating new Nx workspace');
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);

    // Create a project structure with dependencies
    createDotNetProject({ name: 'Core', type: 'classlib' });
    createDotNetProject({ name: 'Infrastructure', type: 'classlib' });
    createDotNetProject({ name: 'Application', type: 'classlib' });
    createDotNetProject({ name: 'WebApi', type: 'webapi' });
    createDotNetProject({ name: 'Core.Tests', type: 'xunit' });

    // Set up project references to create a dependency chain
    // Core <- Infrastructure <- Application <- WebApi
    // Core <- Core.Tests
    addProjectReference('Infrastructure', 'Core');
    addProjectReference('Application', 'Infrastructure');
    addProjectReference('Application', 'Core');
    addProjectReference('WebApi', 'Application');
    addProjectReference('Core.Tests', 'Core');

    // Initialize git repository and make an initial commit
    runCommand('git init');
    runCommand('git config user.email "test@test.com"');
    runCommand('git config user.name "Test User"');
    runCommand('git add .');
    runCommand('git commit -m "Initial commit"');

    console.log('Nx workspace with .NET projects created and committed');
  });

  afterAll(() => {
    cleanupProject();
    console.log('Nx workspace cleaned up');
  });

  describe('Basic Cache Functionality', () => {
    beforeEach(() => {
      // Clean the workspace but preserve node_modules and .nx cache
      // bin/ and obj/ directories should be restored from Nx cache
      cleanBuildOutputsAndRestore();
      console.log('Cleaned workspace, preserving cache');
    });

    it('should store and use local cache for builds', () => {
      // First build - should not use cache
      const firstBuild = runCLI('build Core', { verbose: true });
      expect(firstBuild).toContain('Build succeeded');
      expect(firstBuild).not.toContain('local cache');
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));

      // Clean build artifacts but keep cache
      cleanBuildOutputsAndRestore();

      // Second build - should use cache
      const secondBuild = runCLI('build Core', { verbose: true });
      expect(secondBuild).toContain('local cache');
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
    });

    it('should use cache for multiple projects', () => {
      // Build all projects
      const firstBuild = runCLI('build WebApi', { verbose: true });
      expect(firstBuild).toContain('Build succeeded');

      // Verify all dependencies were built
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

      // Clean build artifacts
      cleanBuildOutputsAndRestore();

      // Rebuild - all should come from cache
      const cachedBuild = runCLI('build WebApi', { verbose: true });
      expect(cachedBuild).toContain('local cache');

      // Verify all artifacts were restored
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

    it('should invalidate cache when source files change', () => {
      // Initial build
      runCLI('build Core');

      // Clean and rebuild from cache
      cleanBuildOutputsAndRestore();
      const cachedBuild = runCLI('build Core', { verbose: true });
      expect(cachedBuild).toContain('local cache');

      // Modify source file
      const coreSourceFile = tmpProjPath('Core/Class1.cs');
      const fs = require('fs');
      const content = fs.readFileSync(coreSourceFile, 'utf-8');
      fs.writeFileSync(
        coreSourceFile,
        content + '\n// Cache invalidation test'
      );

      // Should rebuild without cache
      const rebuiltAfterChange = runCLI('build Core', { verbose: true });
      expect(rebuiltAfterChange).toContain('Build succeeded');
      expect(rebuiltAfterChange).not.toContain('local cache');
    });
  });

  describe('Dependent Builds with Cache', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should handle dependent builds when child is restored from cache', () => {
      // Build the entire dependency chain
      runCLI('build WebApi', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Build just the child (Core) from cache
      const coreCachedBuild = runCLI('build Core', { verbose: true });
      expect(coreCachedBuild).toContain('local cache');
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));

      // Now build a parent that depends on Core
      // Infrastructure should build successfully even though Core came from cache
      const infraBuild = runCLI('build Infrastructure', { verbose: true });
      expect(infraBuild).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin')
      );
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
    });

    it('should handle mixed cache hits and misses in dependency chain', () => {
      // Build everything
      runCLI('build Application', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Modify only Infrastructure
      const infraSourceFile = tmpProjPath('Infrastructure/Class1.cs');
      const fs = require('fs');
      const content = fs.readFileSync(infraSourceFile, 'utf-8');
      fs.writeFileSync(
        infraSourceFile,
        content + '\n// Invalidate Infrastructure cache'
      );

      // Build Application
      // - Core should come from cache
      // - Infrastructure should rebuild
      // - Application should rebuild (depends on changed Infrastructure)
      const mixedBuild = runCLI('build Application', { verbose: true });
      expect(mixedBuild).toContain('Build succeeded');

      // Verify all artifacts exist
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin')
      );
      checkFilesMatchingPatternExist(
        '.*/Application.dll',
        tmpProjPath('Application/bin')
      );
    });
  });

  describe('Tests with Cached Dependencies', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should run tests when dependency build is from cache', () => {
      // Build Core
      runCLI('build Core', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Run tests - Core should come from cache, tests should run successfully
      const testOutput = runCLI('test Core.Tests', { verbose: true });
      expect(testOutput).toContain('Test run for');
      expect(testOutput).toMatch(/Passed!|Total tests:/);

      // Verify Core was restored from cache
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
    });

    it('should handle test execution with fully cached dependency chain', () => {
      // Build Core and run tests
      runCLI('build Core', { verbose: true });
      const firstTestRun = runCLI('test Core.Tests', { verbose: true });
      expect(firstTestRun).toContain('Test run for');

      // Clean everything
      cleanBuildOutputsAndRestore();

      // Run tests again - everything should come from cache
      const cachedTestRun = runCLI('test Core.Tests', { verbose: true });
      expect(cachedTestRun).toContain('Test run for');
      expect(cachedTestRun).toMatch(/Passed!|Total tests:/);
    });
  });

  describe('Pack with Cached Dependencies', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should create NuGet package when build is from cache', () => {
      // Build Core
      runCLI('build Core', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Pack - build should come from cache, pack should succeed
      const packOutput = runCLI('pack Core', { verbose: true });
      expect(packOutput).not.toContain('error');

      // Verify package was created
      checkFilesMatchingPatternExist(
        '.*/Core.*.nupkg',
        tmpProjPath('Core/bin')
      );

      // Verify Core.dll was restored from cache
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
    });

    it('should handle pack with cached dependency chain', () => {
      // Build Infrastructure (which depends on Core)
      runCLI('build Infrastructure', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Pack Infrastructure - both Core and Infrastructure builds should restore from cache
      const packOutput = runCLI('pack Infrastructure', { verbose: true });
      expect(packOutput).not.toContain('error');

      // Verify packages and dependencies
      checkFilesMatchingPatternExist(
        '.*/Infrastructure.*.nupkg',
        tmpProjPath('Infrastructure/bin')
      );
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin')
      );
    });
  });

  describe('Publish with Cached Dependencies', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should publish when dependencies are from cache', () => {
      // Build everything
      runCLI('build WebApi', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Publish WebApi - dependencies should restore from cache
      const publishOutput = runCLI('publish WebApi', { verbose: true });
      expect(publishOutput).not.toContain('error');

      // Verify all dependencies were restored
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
  });

  describe('Cache with run-many', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should use cache when running multiple builds', () => {
      // Build multiple projects
      const firstRun = runCLI(
        'run-many --target=build --projects=Core,Infrastructure',
        { verbose: true }
      );
      expect(firstRun).toContain('Build succeeded');

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Run again - should use cache
      const cachedRun = runCLI(
        'run-many --target=build --projects=Core,Infrastructure',
        { verbose: true }
      );
      expect(cachedRun).toContain('local cache');
    });

    it('should handle partial cache hits with run-many', () => {
      // Build projects
      runCLI('run-many --target=build --projects=Core,Infrastructure', {
        verbose: true,
      });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Modify only Core
      const coreSourceFile = tmpProjPath('Core/Class1.cs');
      const fs = require('fs');
      const content = fs.readFileSync(coreSourceFile, 'utf-8');
      fs.writeFileSync(coreSourceFile, content + '\n// Invalidate Core cache');

      // Run again - Infrastructure should use cache, Core should rebuild
      const partialCacheRun = runCLI(
        'run-many --target=build --projects=Core,Infrastructure',
        { verbose: true }
      );
      expect(partialCacheRun).toContain('Build succeeded');

      // Both artifacts should exist
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
      checkFilesMatchingPatternExist(
        '.*/Infrastructure.dll',
        tmpProjPath('Infrastructure/bin')
      );
    });
  });

  describe('Project Graph with Cache', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should maintain correct dependencies after cache restoration', () => {
      // Build everything
      runCLI('build WebApi', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Generate graph
      runCLI('graph --file=graph.json');
      checkFilesExist('graph.json');
      const { graph } = readJson('graph.json');

      // Verify dependency chain is intact
      const webApiDeps = graph.dependencies['WebApi'] || [];
      expect(webApiDeps.some((dep: any) => dep.target === 'Application')).toBe(
        true
      );

      const appDeps = graph.dependencies['Application'] || [];
      expect(appDeps.some((dep: any) => dep.target === 'Infrastructure')).toBe(
        true
      );
      expect(appDeps.some((dep: any) => dep.target === 'Core')).toBe(true);

      const infraDeps = graph.dependencies['Infrastructure'] || [];
      expect(infraDeps.some((dep: any) => dep.target === 'Core')).toBe(true);

      // Build with cache and verify it still works
      const cachedBuild = runCLI('build WebApi', { verbose: true });
      expect(cachedBuild).toContain('local cache');
    });
  });

  describe('Cache with Clean Target', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should rebuild after clean even with cache available', () => {
      // Build Core
      const firstBuild = runCLI('build Core', { verbose: true });
      expect(firstBuild).toContain('Build succeeded');

      // Clean the project - should only remove build artifacts
      runCLI('clean Core', { verbose: true });

      // Build again - should use cache to restore outputs
      const rebuiltAfterClean = runCLI('build Core', { verbose: true });
      expect(rebuiltAfterClean).toContain('local cache');
      checkFilesMatchingPatternExist('.*/Core.dll', tmpProjPath('Core/bin'));
    });
  });

  describe('Cache Skip Flag', () => {
    beforeEach(() => {
      cleanBuildOutputsAndRestore();
    });

    it('should skip cache when flag is provided', () => {
      // Build Core
      runCLI('build Core', { verbose: true });

      // Clean artifacts
      cleanBuildOutputsAndRestore();

      // Build with cache
      const cachedBuild = runCLI('build Core', { verbose: true });
      expect(cachedBuild).toContain('local cache');

      // Clean artifacts again
      cleanBuildOutputsAndRestore();

      // Build with skip cache flag
      const skipCacheBuild = runCLI('build Core --skip-nx-cache', {
        verbose: true,
      });
      expect(skipCacheBuild).not.toContain('local cache');
      expect(skipCacheBuild).toContain('Build succeeded');
    });
  });
});

function cleanBuildOutputsAndRestore() {
  runCommand('git clean -xdf -e node_modules -e .nx -e project.assets.json');
}
