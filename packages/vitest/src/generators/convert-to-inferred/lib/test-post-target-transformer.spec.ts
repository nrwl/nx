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

  it.each([
    '{projectRoot}/../../coverage/libs/a',
    '{workspaceRoot}/coverage/libs/a',
    '{workspaceRoot}/coverage/{projectRoot}',
  ])('resolves root tokens in reportsDirectory: %s', (reportsDirectory) => {
    const tree = createTreeWithEmptyWorkspace();
    const target = {
      options: {
        reportsDirectory,
      },
    };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'a', root: 'libs/a' },
      {}
    );

    expect(result.options['coverage.reportsDirectory']).toBe(
      '../../coverage/libs/a'
    );
  });

  it('translates testFiles into project-relative file filters', () => {
    const tree = createTreeWithEmptyWorkspace();
    const target = {
      options: {
        configFile: 'libs/lib1/vite.config.ts',
        testFiles: [
          'src/foo.spec.ts',
          'libs/lib1/src/bar.spec.ts',
          'baz',
          '/abs/libs/lib1/qux.spec.ts',
        ],
      },
      configurations: {
        single: { testFile: ['libs/lib1/src/one.spec.ts'] },
      },
    };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'lib1', root: 'libs/lib1' },
      {}
    );

    expect(result.options.args).toEqual([
      'src/foo.spec.ts',
      'src/bar.spec.ts',
      'baz',
      '/abs/libs/lib1/qux.spec.ts',
    ]);
    expect(result.options.testFiles).toBeUndefined();
    expect(result.options.testNamePattern).toBeUndefined();
    expect(result.configurations.single).toEqual({
      args: ['src/one.spec.ts'],
    });
  });

  it('keeps testFiles unchanged for a root project', () => {
    const tree = createTreeWithEmptyWorkspace();
    const target = { options: { testFiles: ['src/foo.spec.ts'] } };

    const result = testPostTargetTransformer(
      target,
      tree,
      { projectName: 'root', root: '.' },
      {}
    );

    expect(result.options.args).toEqual(['src/foo.spec.ts']);
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
