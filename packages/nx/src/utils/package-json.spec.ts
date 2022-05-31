import { join } from 'path';
import { workspaceRoot } from './workspace-root';
import { readJsonFile } from './fileutils';
import {
  buildTargetFromScript,
  PackageJson,
  PackageJsonTargetConfiguration,
  readModulePackageJson,
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
        } as PackageJsonTargetConfiguration,
      },
    });

    expect(target.options.script).toEqual('build');
    expect(target.executor).toEqual('nx:run-script');
  });
});

const rootPackageJson: PackageJson = readJsonFile(
  join(workspaceRoot, 'package.json')
);

const dependencies = [
  ...Object.keys(rootPackageJson.dependencies),
  ...Object.keys(rootPackageJson.devDependencies),
];

describe('readModulePackageJson', () => {
  it.each(dependencies)(`should be able to find %s`, (s) => {
    expect(() => readModulePackageJson(s)).not.toThrow();
  });
});
