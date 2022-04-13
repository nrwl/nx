import {
  buildTargetFromScript,
  PackageJsonTargetConfiguration,
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
