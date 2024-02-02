import { join } from 'path';
import { workspaceRoot } from './workspace-root';
import { readJsonFile } from './fileutils';
import {
  buildTargetFromScript,
  PackageJson,
  readModulePackageJson,
  readTargetsFromPackageJson,
} from './package-json';

describe('buildTargetFromScript', () => {
  it('should use nx:run-script', () => {
    const target = buildTargetFromScript('build', null);
    expect(target.executor).toEqual('nx:run-script');
  });

  it('should use options provided in nx target package json configuration', () => {
    const target = buildTargetFromScript('build', {
      targets: {
        build: {
          outputs: ['custom'],
        },
      },
    });

    expect(target.outputs).toEqual(['custom']);
  });

  it('should not override script or executor', () => {
    const target = buildTargetFromScript('build', {
      targets: {
        build: {
          outputs: ['custom'],
          options: {
            script: 'other',
          },
          executor: 'custom:execute',
        },
      },
    });

    expect(target.options.script).toEqual('build');
    expect(target.executor).toEqual('nx:run-script');
  });
});

describe('readTargetsFromPackageJson', () => {
  const packageJson: PackageJson = {
    name: 'my-app',
    version: '0.0.0',
    scripts: {
      build: 'echo 1',
    },
  };

  const packageJsonBuildTarget = {
    executor: 'nx:run-script',
    options: {
      script: 'build',
    },
  };

  it('should read targets from project.json and package.json', () => {
    const result = readTargetsFromPackageJson(packageJson);
    expect(result).toEqual({
      build: {
        executor: 'nx:run-script',
        options: {
          script: 'build',
        },
      },
      'nx-release-publish': {
        dependsOn: ['^nx-release-publish'],
        executor: '@nx/js:release-publish',
        options: {},
      },
    });
  });

  it('should contain extended options from nx property in package.json', () => {
    const result = readTargetsFromPackageJson({
      name: 'my-other-app',
      version: '',
      scripts: {
        build: 'echo 1',
      },
      nx: {
        targets: {
          build: {
            outputs: ['custom'],
          },
        },
      },
    });
    expect(result).toEqual({
      build: { ...packageJsonBuildTarget, outputs: ['custom'] },
      'nx-release-publish': {
        dependsOn: ['^nx-release-publish'],
        executor: '@nx/js:release-publish',
        options: {},
      },
    });
  });

  it('should ignore scripts that are not in includedScripts', () => {
    const result = readTargetsFromPackageJson({
      name: 'included-scripts-test',
      version: '',
      scripts: {
        test: 'echo testing',
        fail: 'exit 1',
      },
      nx: {
        includedScripts: ['test'],
      },
    });

    expect(result).toEqual({
      test: {
        executor: 'nx:run-script',
        options: { script: 'test' },
      },
      'nx-release-publish': {
        dependsOn: ['^nx-release-publish'],
        executor: '@nx/js:release-publish',
        options: {},
      },
    });
  });
});

const rootPackageJson: PackageJson = readJsonFile(
  join(workspaceRoot, 'package.json')
);

const dependencies = [
  ...Object.keys(rootPackageJson.dependencies),
  ...Object.keys(rootPackageJson.devDependencies),
];

const exclusions = new Set([
  // @types/js-yaml doesn't define a main field, but does define exports.
  // exports doesn't contain 'package.json', and main is an empty line.
  // This means the function fails.
  '@types/js-yaml',
]);

describe('readModulePackageJson', () => {
  it.each(dependencies.filter((x) => !exclusions.has(x)))(
    `should be able to find %s`,
    (s) => {
      expect(() => readModulePackageJson(s)).not.toThrow();
    }
  );
});
