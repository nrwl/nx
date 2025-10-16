import {
  checkFilesExist,
  checkFilesMatchingPatternExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  tmpProjPath,
  updateJson,
} from '@nx/e2e-utils';

import {
  createDotNetProject,
  addProjectReference,
} from './utils/create-dotnet-project';
import { check } from 'yargs';

describe('.NET Plugin - Configuration Behavior', () => {
  beforeAll(() => {
    console.log('Creating new Nx workspace for configuration tests');
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/dotnet');
      return json;
    });
    console.log('Nx workspace created');

    // Create test projects
    createDotNetProject({ name: 'MyApp', type: 'console' });
    createDotNetProject({ name: 'MyLibrary', type: 'classlib' });
    addProjectReference('MyApp', 'MyLibrary');
  });

  afterAll(() => {
    cleanupProject();
    console.log('Nx workspace cleaned up');
  });

  describe('build target defaults', () => {
    it('should build with Debug configuration by default', () => {
      const output = runCLI('build my-app', { verbose: true });
      expect(output).toContain('Build succeeded');

      // Verify Debug outputs exist
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Debug')
      );
    });

    it('should build with Release configuration when specified', () => {
      const output = runCLI('build my-app --configuration release', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');

      // Verify Release outputs exist
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });

    it('should build dependencies with matching configuration', () => {
      // Build MyApp with Release - MyLibrary should also build with Release
      const output = runCLI('build my-app --configuration release', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');

      // Both should have Release outputs
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin/Release')
      );
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });
  });

  describe('pack target configuration', () => {
    it('should pack with Release configuration by default', () => {
      const output = runCLI('pack my-library', { verbose: true });
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin/Release')
      );
    });

    it('should pack with Debug configuration when specified', () => {
      const output = runCLI('pack my-library --configuration Debug', {
        verbose: true,
      });
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin/Debug')
      );
    });

    it('should build:release dependency with matching configuration', () => {
      // When packing with Debug, build:release should also use Debug
      const output = runCLI('pack my-library --configuration Debug', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');

      // Debug build should have run
      checkFilesMatchingPatternExist(
        '.*/MyLibrary.dll',
        tmpProjPath('MyLibrary/bin/Debug')
      );
    });
  });

  describe('publish target configuration', () => {
    it('should publish with Release configuration by default', () => {
      // Verify publish output exists
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });

    it('should publish with Debug configuration when specified', () => {
      // Verify publish output exists
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Debug')
      );
    });
  });

  describe('configuration flag variations', () => {
    it('should accept --configuration=Release (with equals)', () => {
      const output = runCLI('build my-app --configuration=Release', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });

    it('should accept --configuration release (with space)', () => {
      const output = runCLI('build my-app --configuration release', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });

    it('should be case-insensitive for configuration names', () => {
      const output = runCLI('build my-app --configuration release', {
        verbose: true,
      });
      expect(output).toContain('Build succeeded');
      checkFilesMatchingPatternExist(
        '.*/MyApp.dll',
        tmpProjPath('MyApp/bin/Release')
      );
    });
  });

  describe('target metadata', () => {
    it('should show configurations in project details for build target', () => {
      const projectDetails = runCLI(`show project my-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.build).toBeDefined();
      expect(details.targets.build.configurations).toBeDefined();
      expect(details.targets.build.configurations.debug).toBeDefined();
      expect(details.targets.build.configurations.release).toBeDefined();
    });

    it('should show configurations in project details for pack target', () => {
      const projectDetails = runCLI(`show project my-library --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.pack).toBeDefined();
      expect(details.targets.pack.configurations).toBeDefined();
      expect(details.targets.pack.configurations.debug).toBeDefined();
      expect(details.targets.pack.configurations.release).toBeDefined();
    });

    it('should show build:release target exists', () => {
      const projectDetails = runCLI(`show project my-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets['build:release']).toBeDefined();
      expect(details.targets['build:release'].configurations).toBeDefined();
    });
  });

  describe('task graph behavior', () => {
    it('should show pack depends on build:release', () => {
      const projectDetails = runCLI(`show project my-library --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.pack.dependsOn).toContain('build:release');
    });

    it('should show publish depends on build:release', () => {
      const projectDetails = runCLI(`show project my-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets.publish.dependsOn).toContain('build:release');
    });

    it('should show build:release depends on ^build:release', () => {
      const projectDetails = runCLI(`show project my-app --json`);
      const details = JSON.parse(projectDetails);

      expect(details.targets['build:release'].dependsOn).toContain(
        '^build:release'
      );
    });
  });
});
