import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { testPostTargetTransformer } from './test-post-target-transformer';

describe('testPostTargetTransformer', () => {
  it('rewrites configFile to project-relative config and drops default inputs', () => {
    const tree = createTreeWithEmptyWorkspace();
    const target = {
      inputs: ['default', '^production'],
      options: {
        configFile: 'apps/myapp/vite.config.ts',
        reportsDirectory: '../../coverage/apps/myapp',
      },
    };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'myapp', root: 'apps/myapp' },
      { outputs: ['{projectRoot}/test-output/vitest/coverage'] }
    );

    expect(result.options).toEqual({
      config: './vite.config.ts',
      'coverage.reportsDirectory': '../../coverage/apps/myapp',
    });
    expect(result.inputs).toBeUndefined();
  });

  it('translates testFiles into a testNamePattern regex', () => {
    const tree = createTreeWithEmptyWorkspace();
    const target = {
      options: {
        configFile: 'libs/lib1/vite.config.ts',
        testFiles: ['foo.spec.ts', 'bar.spec.ts'],
      },
    };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'lib1', root: 'libs/lib1' },
      {}
    );

    expect(result.options.testNamePattern).toBe(
      `"/(foo\\.spec.ts|bar\\.spec.ts)/"`
    );
    expect(result.options.testFiles).toBeUndefined();
  });

  it('drops empty configurations and stale defaultConfiguration', () => {
    const tree = createTreeWithEmptyWorkspace();
    const target = {
      defaultConfiguration: 'ci',
      configurations: {
        ci: { configFile: 'libs/lib1/vite.config.ts' },
      },
      options: { configFile: 'libs/lib1/vite.config.ts' },
    };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'lib1', root: 'libs/lib1' },
      {}
    );

    expect(result.configurations.ci).toEqual({ config: './vite.config.ts' });
    expect(result.defaultConfiguration).toBe('ci');
  });
});
