import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle DSL - nx {} configuration', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName: string;
      const buildFileExt = type === 'kotlin' ? '.kts' : '';
      let cleanFileContent = '';

      beforeAll(() => {
        gradleProjectName = uniq('gradle-dsl-test');
        newProject({ packages: [] });
        createGradleProject(gradleProjectName, type);
        runCLI(`add @nx/gradle`);

        // Add import statement to the build file once
        const importStatement =
          type === 'kotlin'
            ? `import dev.nx.gradle.nx\n\n`
            : `import static dev.nx.gradle.Groovy.nx\n\n`;
        updateFile(
          `app/build.gradle${buildFileExt}`,
          (content) => importStatement + content
        );
      });

      beforeEach(() => {
        cleanFileContent = readFile(`app/build.gradle${buildFileExt}`);
      });

      afterEach(() => {
        updateFile(`app/build.gradle${buildFileExt}`, cleanFileContent);
      });

      afterAll(() => cleanupProject());

      describe('Project-level DSL', () => {
        it('should handle string values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "custom-app-name")\n}`
              : `\nnx(project) {\n  it.set 'type', 'custom-app-name'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.type).toBe('custom-app-name');
        });

        it('should handle number values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("priority", 10)\n}`
              : `\nnx(project) {\n  it.set 'priority', 10\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.priority).toBe(10);
        });

        it('should handle boolean values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("isPublic", true)\n}`
              : `\nnx(project) {\n  it.set 'isPublic', true\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.isPublic).toBe(true);
        });

        it('should handle arrays', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  array("tags", "api", "backend", "tier:1")\n}`
              : `\nnx(project) {\n  it.array 'tags', 'api', 'backend', 'tier:1'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.tags).toEqual(['api', 'backend', 'tier:1']);
        });

        it('should handle nested objects', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("generators") {\n    set("@nx/react:component", "components")\n    set("@nx/node:service", "services")\n  }\n}`
              : `\nnx(project) {\n  it.set 'generators', {\n    it.set '@nx/react:component', 'components'\n    it.set '@nx/node:service', 'services'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.generators['@nx/react:component']).toBe('components');
          expect(config.generators['@nx/node:service']).toBe('services');
        });

        it('should handle complex nested structures', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "my-custom-app")\n  array("tags", "api", "service")\n  set("generators") {\n    set("owner", "platform-team")\n    array("environments", "dev", "staging", "prod")\n    set("tier", 1)\n  }\n}`
              : `\nnx(project) {\n  it.set 'type', 'my-custom-app'\n  it.array 'tags', 'api', 'service'\n  it.set 'generators', {\n    it.set 'owner', 'platform-team'\n    it.array 'environments', 'dev', 'staging', 'prod'\n    it.set 'tier', 1\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.type).toBe('my-custom-app');
          expect(config.tags).toEqual(['api', 'service']);
          expect(config.generators.owner).toBe('platform-team');
          expect(config.generators.environments).toEqual([
            'dev',
            'staging',
            'prod',
          ]);
          expect(config.generators.tier).toBe(1);
        });

        it('should handle deeply nested objects', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("config") {\n    set("level1") {\n      set("level2") {\n        set("value", "deep")\n      }\n    }\n  }\n}`
              : `\nnx(project) {\n  it.set 'config', {\n    it.set 'level1', {\n      it.set 'level2', {\n        it.set 'value', 'deep'\n      }\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.config.level1.level2.value).toBe('deep');
        });

        it('should handle arrays with mixed content in objects', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("generators") {\n    array("frameworks", "react", "angular", "vue")\n    set("enabled", true)\n  }\n}`
              : `\nnx(project) {\n  it.set 'generators', {\n    it.array 'frameworks', 'react', 'angular', 'vue'\n    it.set 'enabled', true\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.generators.frameworks).toEqual([
            'react',
            'angular',
            'vue',
          ]);
          expect(config.generators.enabled).toBe(true);
        });
      });

      describe('Task-level DSL', () => {
        it('should handle scalar values on targets', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("myBuild") {\n  nx {\n    set("cache", false)\n  }\n}`
              : `\ntasks.register('myBuild') {\n  nx(it) {\n    it.set 'cache', false\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.targets.myBuild.cache).toBe(false);
        });

        it('should handle arrays on targets', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("myTest") {\n  nx {\n    array("inputs", "src/**/*", "config/**/*")\n  }\n}`
              : `\ntasks.register('myTest') {\n  nx(it) {\n    it.array 'inputs', 'src/**/*', 'config/**/*'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.targets.myTest.inputs).toContain('src/**/*');
          expect(config.targets.myTest.inputs).toContain('config/**/*');
        });

        it('should handle nested objects in target config', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("deploy") {\n  nx {\n    set("configurations") {\n      set("production") {\n        set("environment", true)\n      }\n    }\n  }\n}`
              : `\ntasks.register('deploy') {\n  nx(it) {\n    it.set 'configurations', {\n      it.set 'production', {\n        it.set 'environment', true\n      }\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(
            config.targets.deploy.configurations.production.environment
          ).toBe(true);
        });

        it('should handle multiple properties on target', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("e2e") {\n  nx {\n    set("cache", false)\n    array("outputs", "coverage/**/*", "reports/**/*")\n    set("configurations") {\n      set("debug") {\n        set("timeout", 3600)\n      }\n    }\n  }\n}`
              : `\ntasks.register('e2e') {\n  nx(it) {\n    it.set 'cache', false\n    it.array 'outputs', 'coverage/**/*', 'reports/**/*'\n    it.set 'configurations', {\n      it.set 'debug', {\n        it.set 'timeout', 3600\n      }\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.targets.e2e.cache).toBe(false);
          expect(config.targets.e2e.outputs).toContain('coverage/**/*');
          expect(config.targets.e2e.outputs).toContain('reports/**/*');
          expect(config.targets.e2e.configurations.debug.timeout).toBe(3600);
        });

        it('should configure multiple tasks', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("customBuild") {\n  nx {\n    set("cache", true)\n  }\n}\n\ntasks.register<DefaultTask>("verify") {\n  nx {\n    set("cache", false)\n    array("inputs", "src/**/*", "test/**/*")\n  }\n}`
              : `\ntasks.register('customBuild') {\n  nx(it) {\n    it.set 'cache', true\n  }\n}\n\ntasks.register('verify') {\n  nx(it) {\n    it.set 'cache', false\n    it.array 'inputs', 'src/**/*', 'test/**/*'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          expect(config.targets.customBuild.cache).toBe(true);
          expect(config.targets.verify.cache).toBe(false);
          expect(config.targets.verify.inputs).toContain('src/**/*');
          expect(config.targets.verify.inputs).toContain('test/**/*');
        });
      });

      describe('Integration - Project and Task DSL combined', () => {
        it('should handle both project and task-level config', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "integrated-app")\n  array("tags", "api", "backend")\n}\n\ntasks.register<DefaultTask>("package") {\n  nx {\n    set("cache", false)\n    array("inputs", "default")\n  }\n}`
              : `\nnx(project) {\n  it.set 'type', 'integrated-app'\n  it.array 'tags', 'api', 'backend'\n}\n\ntasks.register('package') {\n  nx(it) {\n    it.set 'cache', false\n    it.array 'inputs', 'default'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          // Project-level config
          expect(config.type).toBe('integrated-app');
          expect(config.tags).toEqual(['api', 'backend']);

          // Task-level config
          expect(config.targets.package.cache).toBe(false);
          expect(config.targets.package.inputs).toContain('default');
        });

        it('should handle complex project with multiple configured tasks', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "complex-app")\n  array("tags", "monorepo", "service")\n  set("generators") {\n    set("owner", "platform")\n    set("tier", 1)\n  }\n}\n\ntasks.register<DefaultTask>("compile") {\n  nx {\n    set("cache", true)\n  }\n}\n\ntasks.register<DefaultTask>("validate") {\n  nx {\n    set("cache", false)\n    array("inputs", "src/**/*", "test/**/*")\n    set("configurations") {\n      set("debug") {\n        set("parallel", true)\n      }\n    }\n  }\n}`
              : `\nnx(project) {\n  it.set 'type', 'complex-app'\n  it.array 'tags', 'monorepo', 'service'\n  it.set 'generators', {\n    it.set 'owner', 'platform'\n    it.set 'tier', 1\n  }\n}\n\ntasks.register('compile') {\n  nx(it) {\n    it.set 'cache', true\n  }\n}\n\ntasks.register('validate') {\n  nx(it) {\n    it.set 'cache', false\n    it.array 'inputs', 'src/**/*', 'test/**/*'\n    it.set 'configurations', {\n      it.set 'debug', {\n        it.set 'parallel', true\n      }\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );

          // Project-level
          expect(config.type).toBe('complex-app');
          expect(config.tags).toEqual(['monorepo', 'service']);
          expect(config.generators.owner).toBe('platform');
          expect(config.generators.tier).toBe(1);

          // Compile target
          expect(config.targets.compile.cache).toBe(true);

          // Validate target
          expect(config.targets.validate.cache).toBe(false);
          expect(config.targets.validate.inputs).toContain('src/**/*');
          expect(config.targets.validate.inputs).toContain('test/**/*');
          expect(config.targets.validate.configurations.debug.parallel).toBe(
            true
          );
        });

        it('should configure multiple projects independently', () => {
          // Configure app project
          const appDslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "app-project")\n  array("tags", "app")\n}`
              : `\nnx(project) {\n  it.set 'type', 'app-project'\n  it.array 'tags', 'app'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => cleanFileContent + appDslContent
          );

          const importStatement =
            type === 'kotlin'
              ? `import dev.nx.gradle.nx\n\n`
              : `import static dev.nx.gradle.Groovy.nx\n\n`;

          // Configure list project
          const listDslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "list-project")\n  array("tags", "lib")\n}`
              : `\nnx(project) {\n  it.set 'type', 'list-project'\n  it.array 'tags', 'lib'\n}`;

          updateFile(
            `list/build.gradle${buildFileExt}`,
            (content) => importStatement + content + listDslContent
          );

          runCLI('reset');

          const appConfig = JSON.parse(
            runCLI('show project app --json', { verbose: false })
          );
          const listConfig = JSON.parse(
            runCLI('show project list --json', { verbose: false })
          );

          expect(appConfig.type).toBe('app-project');
          expect(appConfig.tags).toEqual(['app']);

          expect(listConfig.type).toBe('list-project');
          expect(listConfig.tags).toEqual(['lib']);
        });
      });
    }
  );
});
