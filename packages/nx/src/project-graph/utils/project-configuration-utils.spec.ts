import { TargetConfiguration } from '../../config/workspace-json-project-json';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from './project-configuration-utils';

describe('target defaults', () => {
  const targetDefaults = {
    'nx:run-commands': {
      options: {
        key: 'default-value-for-executor',
      },
    },
    build: {
      options: {
        key: 'default-value-for-targetname',
      },
    },
  };

  it('should prefer executor key', () => {
    expect(
      readTargetDefaultsForTarget(
        'other-target',
        targetDefaults,
        'nx:run-commands'
      ).options['key']
    ).toEqual('default-value-for-executor');
  });

  it('should fallback to target key', () => {
    expect(
      readTargetDefaultsForTarget('build', targetDefaults, 'other-executor')
        .options['key']
    ).toEqual('default-value-for-targetname');
  });

  it('should return undefined if not found', () => {
    expect(
      readTargetDefaultsForTarget(
        'other-target',
        targetDefaults,
        'other-executor'
      )
    ).toBeNull();
  });

  describe('options', () => {
    it('should merge if executor matches', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'project-value-a',
                },
              },
            },
          },
          'build',
          {
            executor: 'target',
            options: {
              a: 'default-value-a',
              b: 'default-value-b',
            },
          }
        ).options
      ).toEqual({ a: 'project-value-a', b: 'default-value-b' });
    });

    it('should merge if executor is only provided on the project', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                options: {
                  a: 'project-value',
                },
              },
            },
          },
          'build',
          {
            options: {
              a: 'default-value',
              b: 'default-value',
            },
          }
        ).options
      ).toEqual({ a: 'project-value', b: 'default-value' });
    });

    it('should merge if executor is only provided in the defaults', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                options: {
                  a: 'project-value',
                },
              },
            },
          },
          'build',
          {
            executor: 'target',
            options: {
              a: 'default-value',
              b: 'default-value',
            },
          }
        ).options
      ).toEqual({ a: 'project-value', b: 'default-value' });
    });

    it('should not merge if executor is different', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '',
            targets: {
              build: {
                executor: 'other',
                options: {
                  a: 'project-value',
                },
              },
            },
          },
          'build',
          {
            executor: 'default-executor',
            options: {
              b: 'default-value',
            },
          }
        ).options
      ).toEqual({ a: 'project-value' });
    });
  });

  describe('configurations', () => {
    const projectConfigurations: TargetConfiguration['configurations'] = {
      dev: {
        foo: 'project-value-foo',
      },
      prod: {
        bar: 'project-value-bar',
      },
    };

    const defaultConfigurations: TargetConfiguration['configurations'] = {
      dev: {
        foo: 'default-value-foo',
        other: 'default-value-other',
      },
      baz: {
        x: 'default-value-x',
      },
    };

    const merged: TargetConfiguration['configurations'] = {
      dev: {
        foo: projectConfigurations.dev.foo,
        other: defaultConfigurations.dev.other,
      },
      prod: { bar: projectConfigurations.prod.bar },
      baz: { x: defaultConfigurations.baz.x },
    };

    it('should merge configurations if executor matches', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                configurations: projectConfigurations,
              },
            },
          },
          'build',
          {
            executor: 'target',
            configurations: defaultConfigurations,
          }
        ).configurations
      ).toEqual(merged);
    });

    it('should merge if executor is only provided on the project', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                configurations: projectConfigurations,
              },
            },
          },
          'build',
          {
            configurations: defaultConfigurations,
          }
        ).configurations
      ).toEqual(merged);
    });

    it('should merge if executor is only provided in the defaults', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                configurations: projectConfigurations,
              },
            },
          },
          'build',
          {
            executor: 'target',
            configurations: defaultConfigurations,
          }
        ).configurations
      ).toEqual(merged);
    });

    it('should not merge if executor doesnt match', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '',
            targets: {
              build: {
                executor: 'other',
                configurations: projectConfigurations,
              },
            },
          },
          'build',
          {
            executor: 'target',
            configurations: defaultConfigurations,
          }
        ).configurations
      ).toEqual(projectConfigurations);
    });
  });

  describe('defaultConfiguration', () => {
    const projectDefaultConfiguration: TargetConfiguration['defaultConfiguration'] =
      'dev';
    const defaultDefaultConfiguration: TargetConfiguration['defaultConfiguration'] =
      'prod';

    const merged: TargetConfiguration['defaultConfiguration'] =
      projectDefaultConfiguration;

    it('should merge defaultConfiguration if executor matches', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                defaultConfiguration: projectDefaultConfiguration,
              },
            },
          },
          'build',
          {
            executor: 'target',
            defaultConfiguration: defaultDefaultConfiguration,
          }
        ).defaultConfiguration
      ).toEqual(merged);
    });

    it('should merge if executor is only provided on the project', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                executor: 'target',
                defaultConfiguration: projectDefaultConfiguration,
              },
            },
          },
          'build',
          {
            defaultConfiguration: defaultDefaultConfiguration,
          }
        ).defaultConfiguration
      ).toEqual(merged);
    });

    it('should merge if executor is only provided in the defaults', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '.',
            targets: {
              build: {
                defaultConfiguration: projectDefaultConfiguration,
              },
            },
          },
          'build',
          {
            executor: 'target',
            defaultConfiguration: defaultDefaultConfiguration,
          }
        ).defaultConfiguration
      ).toEqual(merged);
    });

    it('should not merge if executor doesnt match', () => {
      expect(
        mergeTargetConfigurations(
          {
            root: '',
            targets: {
              build: {
                executor: 'other',
                defaultConfiguration: projectDefaultConfiguration,
              },
            },
          },
          'build',
          {
            executor: 'target',
            defaultConfiguration: defaultDefaultConfiguration,
          }
        ).defaultConfiguration
      ).toEqual(projectDefaultConfiguration);
    });
  });
});
