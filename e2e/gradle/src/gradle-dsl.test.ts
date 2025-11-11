import {
  cleanupProject,
  newProject,
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

      beforeAll(() => {
        gradleProjectName = uniq('gradle-dsl-test');
        newProject({ packages: [] });
        createGradleProject(gradleProjectName, type);
        runCLI(`add @nx/gradle`);
      });

      afterAll(() => cleanupProject());

      describe('Project-level DSL', () => {
        it('should handle string values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "custom-app-name")\n}`
              : `\nnx {\n  set 'type', 'custom-app-name'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.type).toBe('custom-app-name');
        });

        it('should handle number values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("priority", 10)\n}`
              : `\nnx {\n  set 'priority', 10\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.priority).toBe(10);
        });

        it('should handle boolean values', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("isPublic", true)\n}`
              : `\nnx {\n  set 'isPublic', true\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.isPublic).toBe(true);
        });

        it('should handle arrays', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  array("tags", "api", "backend", "tier:1")\n}`
              : `\nnx {\n  array 'tags', 'api', 'backend', 'tier:1'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.tags).toEqual(['api', 'backend', 'tier:1']);
        });

        it('should handle nested objects', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("generators") {\n    set("@nx/react:component", "components")\n    set("@nx/node:service", "services")\n  }\n}`
              : `\nnx {\n  set 'generators', {\n    set '@nx/react:component', 'components'\n    set '@nx/node:service', 'services'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.generators['@nx/react:component']).toBe('components');
          expect(config.generators['@nx/node:service']).toBe('services');
        });

        it('should handle complex nested structures', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "my-custom-app")\n  array("tags", "api", "service")\n  set("generators") {\n    set("owner", "platform-team")\n    array("environments", "dev", "staging", "prod")\n    set("tier", 1)\n  }\n}`
              : `\nnx {\n  set 'type', 'my-custom-app'\n  array 'tags', 'api', 'service'\n  set 'generators', {\n    set 'owner', 'platform-team'\n    array 'environments', 'dev', 'staging', 'prod'\n    set 'tier', 1\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

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
              : `\nnx {\n  set 'config', {\n    set 'level1', {\n      set 'level2', {\n        set 'value', 'deep'\n      }\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.config.level1.level2.value).toBe('deep');
        });

        it('should handle arrays with mixed content in objects', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("generators") {\n    array("frameworks", "react", "angular", "vue")\n    set("enabled", true)\n  }\n}`
              : `\nnx {\n  set 'generators', {\n    array 'frameworks', 'react', 'angular', 'vue'\n    set 'enabled', true\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.generators.frameworks).toEqual([
            'react',
            'angular',
            'vue',
          ]);
          expect(config.generators.enabled).toBe(true);
        });
      });

      describe('Task-level DSL', () => {
        it('should handle dependsOn property', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("customTask") {\n  nx {\n    dependsOn.add("^build")\n    dependsOn.add("app:test")\n  }\n}`
              : `\ntasks.register('customTask') {\n  nx {\n    dependsOn.add('^build')\n    dependsOn.add('app:test')\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.targets.customTask.dependsOn).toContain('^build');
          expect(config.targets.customTask.dependsOn).toContain('app:test');
        });

        it('should handle scalar values on targets', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("myBuild") {\n  nx {\n    set("cache", false)\n  }\n}`
              : `\ntasks.register('myBuild') {\n  nx {\n    set 'cache', false\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.targets.myBuild.cache).toBe(false);
        });

        it('should handle arrays on targets', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("myTest") {\n  nx {\n    array("inputs", "src/**/*", "config/**/*")\n  }\n}`
              : `\ntasks.register('myTest') {\n  nx {\n    array 'inputs', 'src/**/*', 'config/**/*'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.targets.myTest.inputs).toContain('src/**/*');
          expect(config.targets.myTest.inputs).toContain('config/**/*');
        });

        it('should handle nested objects in target config', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("deploy") {\n  nx {\n    set("configurations") {\n      set("production", true)\n      set("environment", "prod")\n    }\n  }\n}`
              : `\ntasks.register('deploy') {\n  nx {\n    set 'configurations', {\n      set 'production', true\n      set 'environment', 'prod'\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.targets.deploy.configurations.production).toBe(true);
          expect(config.targets.deploy.configurations.environment).toBe('prod');
        });

        it('should handle multiple properties on target', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("e2e") {\n  nx {\n    dependsOn.add("^build")\n    set("cache", false)\n    array("outputs", "coverage/**/*", "reports/**/*")\n    set("configurations") {\n      set("timeout", 3600)\n    }\n  }\n}`
              : `\ntasks.register('e2e') {\n  nx {\n    dependsOn.add('^build')\n    set 'cache', false\n    array 'outputs', 'coverage/**/*', 'reports/**/*'\n    set 'configurations', {\n      set 'timeout', 3600\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          expect(config.targets.e2e.dependsOn).toContain('^build');
          expect(config.targets.e2e.cache).toBe(false);
          expect(config.targets.e2e.outputs).toContain('coverage/**/*');
          expect(config.targets.e2e.outputs).toContain('reports/**/*');
          expect(config.targets.e2e.configurations.timeout).toBe(3600);
        });

        it('should configure multiple tasks', () => {
          const dslContent =
            type === 'kotlin'
              ? `\ntasks.register<DefaultTask>("customBuild") {\n  nx {\n    set("cache", true)\n  }\n}\n\ntasks.register<DefaultTask>("verify") {\n  nx {\n    set("cache", false)\n    array("inputs", "src/**/*", "test/**/*")\n  }\n}`
              : `\ntasks.register('customBuild') {\n  nx {\n    set 'cache', true\n  }\n}\n\ntasks.register('verify') {\n  nx {\n    set 'cache', false\n    array 'inputs', 'src/**/*', 'test/**/*'\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

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
              ? `\nnx {\n  set("type", "integrated-app")\n  array("tags", "api", "backend")\n}\n\ntasks.register<DefaultTask>("package") {\n  nx {\n    set("cache", false)\n    set("configurations") {\n      set("profile", "production")\n    }\n  }\n}`
              : `\nnx {\n  set 'type', 'integrated-app'\n  array 'tags', 'api', 'backend'\n}\n\ntasks.register('package') {\n  nx {\n    set 'cache', false\n    set 'configurations', {\n      set 'profile', 'production'\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          // Project-level config
          expect(config.type).toBe('integrated-app');
          expect(config.tags).toEqual(['api', 'backend']);

          // Task-level config
          expect(config.targets.package.cache).toBe(false);
          expect(config.targets.package.configurations.profile).toBe(
            'production'
          );
        });

        it('should handle complex project with multiple configured tasks', () => {
          const dslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "complex-app")\n  array("tags", "monorepo", "service")\n  set("generators") {\n    set("owner", "platform")\n    set("tier", 1)\n  }\n}\n\ntasks.register<DefaultTask>("compile") {\n  nx {\n    dependsOn.add("^build")\n    dependsOn.add("app:test")\n    set("cache", true)\n  }\n}\n\ntasks.register<DefaultTask>("validate") {\n  nx {\n    set("cache", false)\n    array("inputs", "src/**/*", "test/**/*")\n    set("configurations") {\n      set("parallel", true)\n    }\n  }\n}`
              : `\nnx {\n  set 'type', 'complex-app'\n  array 'tags', 'monorepo', 'service'\n  set 'generators', {\n    set 'owner', 'platform'\n    set 'tier', 1\n  }\n}\n\ntasks.register('compile') {\n  nx {\n    dependsOn.add('^build')\n    dependsOn.add('app:test')\n    set 'cache', true\n  }\n}\n\ntasks.register('validate') {\n  nx {\n    set 'cache', false\n    array 'inputs', 'src/**/*', 'test/**/*'\n    set 'configurations', {\n      set 'parallel', true\n    }\n  }\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + dslContent
          );

          runCLI('reset');
          const config = JSON.parse(runCLI('show project app --json'));

          // Project-level
          expect(config.type).toBe('complex-app');
          expect(config.tags).toEqual(['monorepo', 'service']);
          expect(config.generators.owner).toBe('platform');
          expect(config.generators.tier).toBe(1);

          // Compile target
          expect(config.targets.compile.dependsOn).toContain('^build');
          expect(config.targets.compile.dependsOn).toContain('app:test');
          expect(config.targets.compile.cache).toBe(true);

          // Validate target
          expect(config.targets.validate.cache).toBe(false);
          expect(config.targets.validate.inputs).toContain('src/**/*');
          expect(config.targets.validate.inputs).toContain('test/**/*');
          expect(config.targets.validate.configurations.parallel).toBe(true);
        });

        it('should configure multiple projects independently', () => {
          // Configure app project
          const appDslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "app-project")\n  array("tags", "app")\n}`
              : `\nnx {\n  set 'type', 'app-project'\n  array 'tags', 'app'\n}`;

          updateFile(
            `app/build.gradle${buildFileExt}`,
            (content) => content + appDslContent
          );

          // Configure list project
          const listDslContent =
            type === 'kotlin'
              ? `\nnx {\n  set("type", "list-project")\n  array("tags", "lib")\n}`
              : `\nnx {\n  set 'type', 'list-project'\n  array 'tags', 'lib'\n}`;

          updateFile(
            `list/build.gradle${buildFileExt}`,
            (content) => content + listDslContent
          );

          runCLI('reset');

          const appConfig = JSON.parse(runCLI('show project app --json'));
          const listConfig = JSON.parse(runCLI('show project list --json'));

          expect(appConfig.type).toBe('app-project');
          expect(appConfig.tags).toEqual(['app']);

          expect(listConfig.type).toBe('list-project');
          expect(listConfig.tags).toEqual(['lib']);
        });
      });
    }
  );
});
