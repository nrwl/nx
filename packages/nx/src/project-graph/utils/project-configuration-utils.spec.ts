import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import {
  mergeProjectConfigurationIntoRootMap,
  mergeTargetConfigurations,
  readProjectConfigurationsFromRootMap,
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

describe('mergeProjectConfigurationIntoRootMap', () => {
  it('should merge targets from different configurations', () => {
    const rootMap = new RootMapBuilder()
      .addProject({
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          echo: {
            command: 'echo lib-a',
          },
        },
      })
      .getRootMap();
    mergeProjectConfigurationIntoRootMap(
      rootMap,
      {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            command: 'tsc',
          },
        },
      },
      'inferred-project-config-file.ts'
    );
    expect(rootMap.get('libs/lib-a')).toMatchInlineSnapshot(`
      {
        "name": "lib-a",
        "root": "libs/lib-a",
        "targets": {
          "build": {
            "command": "tsc",
          },
          "echo": {
            "command": "echo lib-a",
          },
        },
      }
    `);
  });

  it("shouldn't overwrite project name, unless merging project from project.json", () => {
    const rootMap = new RootMapBuilder()
      .addProject({
        name: 'bad-name',
        root: 'libs/lib-a',
      })
      .getRootMap();
    mergeProjectConfigurationIntoRootMap(
      rootMap,
      {
        name: 'other-bad-name',
        root: 'libs/lib-a',
      },
      'libs/lib-a/package.json'
    );
    expect(rootMap.get('libs/lib-a').name).toEqual('bad-name');
    mergeProjectConfigurationIntoRootMap(
      rootMap,
      {
        name: 'lib-a',
        root: 'libs/lib-a',
      },
      'libs/lib-a/project.json'
    );
    expect(rootMap.get('libs/lib-a').name).toEqual('lib-a');
  });
});

describe('readProjectsConfigurationsFromRootMap', () => {
  it('should error if multiple roots point to the same project', () => {
    const rootMap = new RootMapBuilder()
      .addProject({
        name: 'lib',
        root: 'apps/lib-a',
      })
      .addProject({
        name: 'lib',
        root: 'apps/lib-b',
      })
      .getRootMap();

    expect(() => {
      readProjectConfigurationsFromRootMap(rootMap);
    }).toThrowErrorMatchingInlineSnapshot(`
      "The following projects are defined in multiple locations:
      - lib: 
        - apps/lib-a
        - apps/lib-b

      To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name."
    `);
  });

  it('should read root map into standard projects configurations form', () => {
    const rootMap = new RootMapBuilder()
      .addProject({
        name: 'lib-a',
        root: 'libs/a',
      })
      .addProject({
        name: 'lib-b',
        root: 'libs/b',
      })
      .addProject({
        name: 'lib-shared-b',
        root: 'libs/shared/b',
      })
      .getRootMap();
    expect(readProjectConfigurationsFromRootMap(rootMap))
      .toMatchInlineSnapshot(`
      {
        "lib-a": {
          "name": "lib-a",
          "root": "libs/a",
        },
        "lib-b": {
          "name": "lib-b",
          "root": "libs/b",
        },
        "lib-shared-b": {
          "name": "lib-shared-b",
          "root": "libs/shared/b",
        },
      }
    `);
  });
});

class RootMapBuilder {
  private rootMap: Map<string, ProjectConfiguration> = new Map();

  addProject(p: ProjectConfiguration) {
    this.rootMap.set(p.root, p);
    return this;
  }

  getRootMap() {
    return this.rootMap;
  }
}
