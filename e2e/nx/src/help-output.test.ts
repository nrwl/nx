import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e-utils';

// @todo(@AgentEnder): Re-enable once we fix the underlying issues with the e2e tests
xdescribe('--help output', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/js', '@nx/jest', '@nx/eslint', '@nx/webpack'],
    });
  });

  afterAll(() => cleanupProject());

  describe('infix commands (nx test, nx build, etc)', () => {
    let libName: string;

    beforeAll(() => {
      libName = uniq('testlib');
      // Generate a library with real Jest setup
      runCLI(`generate @nx/js:lib ${libName} --unitTestRunner=jest`, {
        redirectStderr: true,
      });
    });

    it('should show underlying tool help for "nx test <project> --help"', () => {
      const output = runCLI(`test ${libName} --help`, { redirectStderr: true });

      // Should contain Jest's actual help output
      expect(output).toContain('Usage: jest');
      expect(output).toMatch(/--coverage|--watch|--bail/i);

      // Should NOT contain Nx's help
      expect(output).not.toContain('Smart Repos');
      expect(output).not.toContain('Run target');
      expect(output).not.toContain('Run a target for a project');
    });

    it('should show underlying tool help for "nx run <project>:test --help"', () => {
      const output = runCLI(`run ${libName}:test --help`, {
        redirectStderr: true,
      });

      // Should contain Jest's actual help output
      expect(output).toContain('Usage: jest');
      expect(output).toMatch(/--coverage|--watch|--bail/i);

      // Should NOT contain Nx's help
      expect(output).not.toContain('Smart Repos');
      expect(output).not.toContain('Run target');
      expect(output).not.toContain('Run a target for a project');
    });

    it('should handle lint infix command correctly', () => {
      // The library already has a lint target configured
      const lintOutput = runCLI(`lint ${libName} --help`, {
        redirectStderr: true,
      });

      // Should contain ESLint's actual help output
      expect(lintOutput).toMatch(/eslint.*\[options\]/i);
      expect(lintOutput).toMatch(/--fix|--format|--quiet/i);

      // Should NOT contain Nx's help
      expect(lintOutput).not.toContain('Smart Repos');
      expect(lintOutput).not.toContain('Run target');
    });

    it('should handle build infix command correctly', () => {
      // Generate an app with webpack build
      const appName = uniq('testapp');
      runCLI(`generate @nx/web:app ${appName} --bundler=webpack`, {
        redirectStderr: true,
      });

      const buildOutput = runCLI(`build ${appName} --help`, {
        redirectStderr: true,
      });

      // Should contain webpack's help or executor help
      expect(buildOutput).toMatch(/webpack|build.*production/i);

      // Should NOT contain Nx's help
      expect(buildOutput).not.toContain('Smart Repos');
      expect(buildOutput).not.toContain('Run target');
    });
  });

  describe('nx commands (should show Nx help)', () => {
    it('should show Nx help for "nx graph --help"', () => {
      const output = runCLI(`graph --help`, { redirectStderr: true });

      // Should contain command description and common options
      expect(output).toContain('nx graph');
      expect(output).toMatch(/graph.*dependencies/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--file|--focus|--affected/);

      // Should NOT contain tool-specific output
      expect(output).not.toContain('Usage: jest');
      expect(output).not.toContain('Usage: webpack');
    });

    it('should show Nx help for "nx affected --help"', () => {
      const output = runCLI(`affected --help`, { redirectStderr: true });

      // Should contain command description and target options
      expect(output).toContain('nx affected');
      expect(output).toMatch(/run.*affected/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--base|--head|--target/);

      // Should NOT be tool help
      expect(output).not.toContain('Usage: jest');
    });

    it('should show Nx help for "nx list --help"', () => {
      const output = runCLI(`list --help`, { redirectStderr: true });

      // Should describe listing plugins
      expect(output).toContain('nx list');
      expect(output).toMatch(/list.*installed.*plugin|plugin.*capabilities/i);
      expect(output).toContain('Options:');

      // Should NOT be tool help
      expect(output).not.toContain('Usage: npm');
    });

    it('should show Nx help for "nx generate --help"', () => {
      const output = runCLI(`generate --help`, { redirectStderr: true });

      // Should describe code generation
      expect(output).toContain('nx generate');
      expect(output).toMatch(/generate.*generator|run.*generator/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--dry-run|--interactive/);

      // Should NOT be tool help
      expect(output).not.toContain('Usage: jest');
    });

    it('should show Nx help for "nx migrate --help"', () => {
      const output = runCLI(`migrate --help`, { redirectStderr: true });

      // Should describe migration process
      expect(output).toContain('nx migrate');
      expect(output).toMatch(/update.*dependencies|migrate.*version/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--from|--to|--createCommits/);

      // Should NOT be npm/yarn help
      expect(output).not.toContain('npm update');
    });

    it('should show Nx help for "nx init --help"', () => {
      const output = runCLI(`init --help`, { redirectStderr: true });

      // Should describe initialization
      expect(output).toContain('nx init');
      expect(output).toMatch(/add.*nx.*workspace|initialize/i);
      expect(output).toContain('Options:');

      // Should NOT be git init help
      expect(output).not.toContain('git init');
    });

    it('should show Nx help for "nx format:check --help"', () => {
      const output = runCLI(`format:check --help`, { redirectStderr: true });

      // Should describe format checking
      expect(output).toContain('nx format:check');
      expect(output).toMatch(/check.*formatted|format.*check/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--files|--projects/);

      // Should NOT be prettier help directly
      expect(output).not.toContain('Usage: prettier');
    });

    it('should show Nx help for "nx format:write --help"', () => {
      const output = runCLI(`format:write --help`, { redirectStderr: true });

      // Should describe formatting files
      expect(output).toContain('nx format:write');
      expect(output).toMatch(/format.*files|write.*formatted/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--files|--projects/);

      // Should NOT be prettier help directly
      expect(output).not.toContain('Usage: prettier');
    });

    it('should show Nx help for "nx daemon --help"', () => {
      const output = runCLI(`daemon --help`, { redirectStderr: true });

      // Should describe daemon operations
      expect(output).toContain('nx daemon');
      expect(output).toMatch(/daemon.*process|background.*process/i);
      expect(output).toContain('Options:');

      // Should have daemon-specific options
      expect(output).toMatch(/--start|--stop|--status/);
    });

    it('should show Nx help for "nx report --help"', () => {
      const output = runCLI(`report --help`, { redirectStderr: true });

      // Should describe report generation
      expect(output).toContain('nx report');
      expect(output).toMatch(
        /report.*information|system.*info|workspace.*details/i
      );
      expect(output).toContain('Options:');

      // Should NOT be a system command
      expect(output).not.toContain('/usr/bin');
    });

    it('should show Nx help for "nx run-many --help"', () => {
      const output = runCLI(`run-many --help`, { redirectStderr: true });

      // Should describe running multiple targets
      expect(output).toContain('nx run-many');
      expect(output).toMatch(/run.*target.*multiple.*project/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--target|--projects|--parallel/);

      // Should NOT be tool help
      expect(output).not.toContain('Usage: jest');
    });

    it('should show Nx help for "nx show --help"', () => {
      const output = runCLI(`show --help`, { redirectStderr: true });

      // Should describe show functionality
      expect(output).toContain('nx show');
      expect(output).toMatch(/show.*project|display.*information/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/projects|project/);

      // Should NOT be git show
      expect(output).not.toContain('git show');
    });

    it('should show Nx help for "nx watch --help"', () => {
      const output = runCLI(`watch --help`, { redirectStderr: true });

      // Should describe watch functionality
      expect(output).toContain('nx watch');
      expect(output).toMatch(/watch.*changes|file.*changes/i);
      expect(output).toContain('Options:');
      expect(output).toMatch(/--projects|--includeDependentProjects/);

      // Should NOT be a file watcher tool
      expect(output).not.toContain('inotify');
      expect(output).not.toContain('chokidar');
    });

    it('should show Nx help for "nx reset --help"', () => {
      const output = runCLI(`reset --help`, { redirectStderr: true });

      // Should describe reset functionality
      expect(output).toContain('nx reset');
      expect(output).toMatch(/reset.*cache|clear.*cache/i);
      expect(output).toContain('Options:');

      // Should NOT be git reset
      expect(output).not.toContain('git reset');
      expect(output).not.toContain('HEAD');
    });
  });

  describe('edge cases', () => {
    it('should show Nx help when --help comes before project:target', () => {
      const libName = uniq('testlib3');
      runCLI(`generate @nx/js:lib ${libName} --unitTestRunner=jest`, {
        redirectStderr: true,
      });

      // When --help comes BEFORE the project:target, it should show Nx's help
      const output = runCLI(`run --help ${libName}:test`, {
        redirectStderr: true,
      });

      // Should contain Nx's help for the run command
      expect(output).toContain('run');
      expect(output).toMatch(/Run a target for a project/i);

      // Should NOT contain Jest's help
      expect(output).not.toContain('Usage: jest');
    });

    it('should show Nx help when --help comes before project in infix command', () => {
      const libName = uniq('testlib4');
      runCLI(`generate @nx/js:lib ${libName} --unitTestRunner=jest`, {
        redirectStderr: true,
      });

      // When --help comes BEFORE the project name in infix command, it should show Nx's help
      const output = runCLI(`test --help ${libName}`, { redirectStderr: true });

      // Should contain Nx's help for the test command
      expect(output).toContain('test');
      expect(output).toMatch(/Test.*project/i);

      // Should NOT contain Jest's help
      expect(output).not.toContain('Usage: jest');
    });

    it('should handle --help with additional flags', () => {
      const libName = uniq('testlib2');
      runCLI(`generate @nx/js:lib ${libName} --unitTestRunner=jest`, {
        redirectStderr: true,
      });

      const output = runCLI(`test ${libName} --help --verbose`, {
        redirectStderr: true,
      });

      // Should still show Jest help even with additional flags
      expect(output).toContain('Usage: jest');
      expect(output).not.toContain('Smart Repos');
    });
  });
});
