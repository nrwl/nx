import { execSync } from 'child_process';
import * as path from 'path';

// E2E tests for Maven plugin integration
describe('Maven Plugin E2E Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    // Change to workspace root for each test
    process.chdir(workspaceRoot);
  });

  beforeAll(() => {
    // Ensure root Maven POM is installed for tests
    try {
      execSync('mvn install -N -q -Drat.skip=true', {
        cwd: workspaceRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      console.warn('Failed to install root POM, tests may fail:', error);
    }
  });

  // Helper function to run nx commands
  const runNx = (command: string, timeout = 120000): string => {
    try {
      return execSync(`nx ${command}`, {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout,
        stdio: 'pipe',
      });
    } catch (error: any) {
      throw new Error(
        `Command failed: nx ${command}\n${error.stdout || ''}\n${
          error.stderr || ''
        }`
      );
    }
  };

  describe('Project Detection', () => {
    it('should detect Maven projects', () => {
      const projects = runNx('show projects');

      // Check that key Maven projects are detected
      expect(projects).toContain('org.apache.maven.maven-cli');
      expect(projects).toContain('org.apache.maven.maven-core');
      expect(projects).toContain('org.apache.maven.maven-api-xml');
      expect(projects).toContain('org.apache.maven.maven-api-core');
    });

    it('should create projects with proper Maven targets', () => {
      const project = JSON.parse(
        runNx('show project org.apache.maven.maven-cli --json')
      );

      expect(project.targets).toBeDefined();
      expect(project.targets.install).toBeDefined();
      expect(project.targets.compile).toBeDefined();
      expect(project.targets.test).toBeDefined();
      expect(project.targets.package).toBeDefined();

      // Check that install target uses Maven command
      expect(project.targets.install.options.command).toContain('mvn install');
      expect(project.targets.install.options.command).toContain(
        'org.apache.maven:maven-cli'
      );
    });
  });

  describe('Dependency Relationships', () => {
    it('should create correct dependsOn relationships for parent POMs', () => {
      const project = JSON.parse(
        runNx('show project org.apache.maven.maven-api-xml --json')
      );

      expect(project.targets.install.dependsOn).toBeDefined();
      expect(project.targets.install.dependsOn).toContain(
        'org.apache.maven.maven-api:install'
      );
      expect(project.targets.install.dependsOn).toContain(
        'org.apache.maven.maven-api-annotations:install'
      );
    });

    it('should create dependsOn relationships for regular dependencies', () => {
      const project = JSON.parse(
        runNx('show project org.apache.maven.maven-core --json')
      );

      expect(project.targets.install.dependsOn).toBeDefined();
      expect(project.targets.install.dependsOn.length).toBeGreaterThan(10); // maven-core has many dependencies
    });

    it('should handle test scope dependencies', () => {
      const project = JSON.parse(
        runNx('show project org.apache.maven.maven-core --json')
      );

      // maven-core should depend on maven-toolchain-builder (test scope)
      expect(project.targets.install.dependsOn).toContain(
        'org.apache.maven.maven-toolchain-builder:install'
      );
    });
  });

  describe('Maven Command Execution', () => {
    it('should successfully run install for simple Maven project', async () => {
      // Test with maven-api-annotations (simple project with few dependencies)
      expect(() => {
        runNx('run org.apache.maven.maven-api-annotations:install', 60000);
      }).not.toThrow();
    }, 90000);

    it('should successfully run install for project with parent POM', async () => {
      // Test with maven-api-xml (has parent POM dependency)
      expect(() => {
        runNx('run org.apache.maven.maven-api-xml:install', 120000);
      }).not.toThrow();
    }, 150000);

    it('should successfully run compile for multiple projects', async () => {
      // Test compile phase which is faster than install
      expect(() => {
        runNx('run org.apache.maven.maven-api-annotations:compile', 60000);
      }).not.toThrow();

      expect(() => {
        runNx('run org.apache.maven.maven-api-xml:compile', 60000);
      }).not.toThrow();
    }, 150000);
  });

  describe('Complex Dependencies - maven-cli', () => {
    it('should have all required dependencies for maven-cli', () => {
      const project = JSON.parse(
        runNx('show project org.apache.maven.maven-cli --json')
      );

      expect(project.targets.install.dependsOn).toBeDefined();

      // maven-cli depends on maven-core and other components
      expect(project.targets.install.dependsOn).toContain(
        'org.apache.maven.maven-core:install'
      );
    });

    // This is the main test requested - can be slow due to many dependencies
    it('should successfully run maven-cli install', async () => {
      expect(() => {
        runNx('run org.apache.maven.maven-cli:install', 300000); // 5 minute timeout
      }).not.toThrow();
    }, 400000); // 6.5 minute Jest timeout
  });

  describe('Parallel Execution', () => {
    it('should handle multiple independent installs', async () => {
      // Run multiple independent projects that can be built in parallel
      const projects = [
        'org.apache.maven.maven-api-annotations',
        'org.apache.maven.maven-api-di',
      ];

      for (const project of projects) {
        expect(() => {
          runNx(`run ${project}:compile`, 60000);
        }).not.toThrow();
      }
    }, 180000);
  });

  describe('Error Handling', () => {
    it('should provide meaningful error for non-existent project', () => {
      expect(() => {
        runNx('run non.existent.project:install');
      }).toThrow(/project.*not found/i);
    });

    it('should provide meaningful error for non-existent target', () => {
      expect(() => {
        runNx('run org.apache.maven.maven-api-annotations:nonexistent');
      }).toThrow();
    });
  });
});
