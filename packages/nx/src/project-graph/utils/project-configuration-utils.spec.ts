import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { dirname } from 'path';
import { isProjectConfigurationsError } from '../error-types';
import { createNodesFromFiles, NxPluginV2 } from '../plugins';
import { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import {
  createProjectConfigurationsWithPlugins,
  CreateNodesResultEntry,
  MergeError,
  mergeCreateNodesResults,
} from './project-configuration-utils';
import { mergeProjectConfigurationIntoRootMap } from './project-configuration/project-nodes-manager';
import {
  mergeTargetConfigurations,
  isCompatibleTarget,
} from './project-configuration/target-merging';
import type {
  ConfigurationSourceMaps,
  SourceInformation,
} from './project-configuration/source-maps';

describe('project-configuration-utils', () => {
  describe('mergeCreateNodesResults', () => {
    it('should substitute gradle-style colon names with project names in dependsOn', () => {
      const {
        results,
        nxJsonConfiguration,
        workspaceRoot: root,
        errors,
      } = require('./__fixtures__/merge-create-nodes-args.json');
      // results[0] = specified plugin (@acme/gradle), results[1] = default plugin (project.json)
      const result = mergeCreateNodesResults(
        [results[0]],
        [results[1]],
        nxJsonConfiguration,
        root,
        errors
      );
      const projectConfig = result.projectRootMap['apps/my-app'];
      const targetConfig = projectConfig['targets']?.['gradle-test'];
      const dependsOn = targetConfig?.dependsOn;
      expect(dependsOn).toMatchInlineSnapshot(`
        [
          "my-app:compileTestJava",
          "my-app:testClasses",
          "my-app:classes",
          "my-app:compileJava",
          "lib-a:jar",
          "lib-b:jar",
        ]
      `);
    });

    // Regression: default-plugin batches merge into an intermediate
    // rootmap, not the manager's main rootmap, so filtering substitutor
    // registration to roots the manager already knows about used to drop
    // every default-plugin project's own dependsOn/inputs. Any
    // cross-project reference those arrays introduced therefore never
    // received a sentinel and stayed stale through applySubstitutions.
    //
    // This test drives that gap by having a default plugin rename a
    // specified-plugin project (libs/b 'b-old' → 'b-new') while a
    // separate default-plugin project.json owns a dependsOn referencing
    // the *old* name. Without sentinel registration on the default
    // batch, the final dependsOn would still say 'b-old:build'.
    it('should resolve dependsOn refs owned by default plugins when the referenced project is renamed during the default apply', () => {
      const specifiedResults: CreateNodesResultEntry[][] = [
        [
          [
            '@acme/tool',
            'libs/b/tool.config.ts',
            {
              projects: {
                'libs/b': {
                  name: 'b-old',
                  targets: { build: {} },
                },
              },
            },
          ],
        ],
      ];

      const defaultResults: CreateNodesResultEntry[][] = [
        [
          [
            'nx/core/project-json',
            'libs/a/project.json',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    test: {
                      dependsOn: ['b-old:build'],
                    },
                  },
                },
              },
            },
          ],
          [
            'nx/core/project-json',
            'libs/b/project.json',
            {
              projects: {
                'libs/b': {
                  name: 'b-new',
                  root: 'libs/b',
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        specifiedResults,
        defaultResults,
        {},
        '/tmp/test',
        errors
      );

      expect(errors).toEqual([]);
      const aTargets = result.projectRootMap['libs/a'].targets!;
      expect(aTargets.test.dependsOn).toEqual(['b-new:build']);
    });

    // Mirror of the dependsOn P2 regression for the inputs path:
    // processInputs and processDependsOn share writeReplacement /
    // createRef plumbing, but the top-level walk is separate. Locks in
    // that default-plugin inputs references get sentinel treatment too.
    it('should resolve inputs refs owned by default plugins when the referenced project is renamed during the default apply', () => {
      const specifiedResults: CreateNodesResultEntry[][] = [
        [
          [
            '@acme/tool',
            'libs/b/tool.config.ts',
            {
              projects: {
                'libs/b': {
                  name: 'b-old',
                  targets: { build: {} },
                },
              },
            },
          ],
        ],
      ];

      const defaultResults: CreateNodesResultEntry[][] = [
        [
          [
            'nx/core/project-json',
            'libs/a/project.json',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    test: {
                      executor: 'nx:noop',
                      inputs: [{ input: 'default', projects: 'b-old' }],
                    },
                  },
                },
              },
            },
          ],
          [
            'nx/core/project-json',
            'libs/b/project.json',
            {
              projects: {
                'libs/b': {
                  name: 'b-new',
                  root: 'libs/b',
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        specifiedResults,
        defaultResults,
        {},
        '/tmp/test',
        errors
      );

      expect(errors).toEqual([]);
      const aTargets = result.projectRootMap['libs/a'].targets!;
      expect(aTargets.test.inputs).toEqual([
        { input: 'default', projects: 'b-new' },
      ]);
    });

    // Forward reference from one default-plugin batch to another:
    // intermediate merges don't touch the manager's nameMap, so a
    // default-plugin reference to a project that won't be created
    // until a later default batch starts life as a usage (forward)
    // ref. The intermediate apply loop later fires
    // identifyProjectWithRoot for the new project; that promotion has
    // to reach the earlier batch's pending sentinel or the final
    // configuration will still hold a leftover NameRef object.
    it('should promote forward refs introduced by one default plugin to a project created by another default plugin', () => {
      const defaultResults: CreateNodesResultEntry[][] = [
        [
          [
            'nx/core/package-json',
            'libs/a/package.json',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    test: {
                      executor: 'nx:noop',
                      inputs: [{ input: 'default', projects: 'b-final' }],
                      dependsOn: ['b-final:build'],
                    },
                  },
                },
              },
            },
          ],
        ],
        [
          [
            'nx/core/project-json',
            'libs/b/project.json',
            {
              projects: {
                'libs/b': {
                  name: 'b-final',
                  root: 'libs/b',
                  targets: { build: {} },
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        [],
        defaultResults,
        {},
        '/tmp/test',
        errors
      );

      expect(errors).toEqual([]);
      const aTargets = result.projectRootMap['libs/a'].targets!;
      // Plain strings — no internal sentinel objects left behind.
      expect(aTargets.test.inputs).toEqual([
        { input: 'default', projects: 'b-final' },
      ]);
      expect(aTargets.test.dependsOn).toEqual(['b-final:build']);
      expect(typeof (aTargets.test.dependsOn as unknown[])[0]).toBe('string');
    });

    // Rebinding-after-spread regression: when a specified plugin seeds
    // a dependsOn array and a default plugin contributes a spread
    // (`['...', ...]`), the intermediate apply runs merge logic on the
    // owner and rebuilds the array. Sentinels inserted against the
    // specified-plugin merge now live in an array that's been
    // discarded — the follow-up
    //   nodesManager.registerNameRefs(intermediateDefaultRootMap)
    // call after the intermediate apply rebinds them to the merged
    // array. Without it, the later rename would leave an unresolved
    // sentinel in the first slot (the one originating from specified).
    it('should rebind sentinels inserted by specified plugins when the intermediate apply spread-merges their array', () => {
      const specifiedResults: CreateNodesResultEntry[][] = [
        [
          [
            '@acme/tool',
            'libs/a/tool.config.ts',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  targets: {
                    build: {
                      dependsOn: ['b-old:build'],
                    },
                  },
                },
                'libs/b': {
                  name: 'b-old',
                  targets: { build: {} },
                },
              },
            },
          ],
        ],
      ];

      const defaultResults: CreateNodesResultEntry[][] = [
        [
          [
            'nx/core/project-json',
            'libs/a/project.json',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    build: {
                      dependsOn: ['...', '^compile'],
                    },
                  },
                },
              },
            },
          ],
          [
            'nx/core/project-json',
            'libs/b/project.json',
            {
              projects: {
                'libs/b': {
                  name: 'b-new',
                  root: 'libs/b',
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        specifiedResults,
        defaultResults,
        {},
        '/tmp/test',
        errors
      );

      expect(errors).toEqual([]);
      const aTargets = result.projectRootMap['libs/a'].targets!;
      // The base dependsOn entry must have been rewritten to the new
      // name *in the merged array* — if rebinding were missed, the
      // replacement would have been written to the orphaned specified-
      // plugin array and the merged slot would still hold the sentinel.
      expect(aTargets.build.dependsOn).toEqual(['b-new:build', '^compile']);
      // And every slot is a plain string, not a leftover NameRef.
      for (const entry of aTargets.build.dependsOn as unknown[]) {
        expect(typeof entry).toBe('string');
      }
    });

    it('should apply target defaults between specified and default plugin results', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      inputs: ['inferred'],
                      options: { configFile: 'vite.config.ts' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/my-lib/project.json',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  root: 'libs/my-lib',
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        defaultResults as any,
        {
          targetDefaults: {
            '@nx/vite:build': {
              cache: true,
              inputs: ['production'],
            },
          },
        },
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      // Target defaults should be applied on top of specified plugin values
      expect(buildTarget.cache).toEqual(true);
      expect(buildTarget.inputs).toEqual(['production']);
      expect(buildTarget.options).toEqual({ configFile: 'vite.config.ts' });
      expect(errors).toEqual([]);
    });

    it('should let default plugin values override target defaults', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      inputs: ['inferred'],
                      options: { configFile: 'vite.config.ts' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/my-lib/project.json',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  root: 'libs/my-lib',
                  targets: {
                    build: {
                      inputs: ['explicit'],
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        defaultResults as any,
        {
          targetDefaults: {
            '@nx/vite:build': {
              cache: true,
              inputs: ['from-defaults'],
            },
          },
        },
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      // Default plugin (project.json) overrides target defaults for inputs
      expect(buildTarget.inputs).toEqual(['explicit']);
      // But cache from target defaults still applies (project.json didn't set it)
      expect(buildTarget.cache).toEqual(true);
    });

    it('should resolve spread tokens in default plugin values against target defaults', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      inputs: ['inferred'],
                      options: { configFile: 'vite.config.ts' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/my-lib/project.json',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  root: 'libs/my-lib',
                  targets: {
                    build: {
                      inputs: ['explicit', '...'],
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        defaultResults as any,
        {
          targetDefaults: {
            '@nx/vite:build': {
              inputs: ['from-defaults'],
            },
          },
        },
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      // '...' in project.json expands against (specified + target defaults)
      // The target defaults override specified, so base is ['from-defaults']
      // Then project.json's ['explicit', '...'] expands to ['explicit', 'from-defaults']
      expect(buildTarget.inputs).toEqual(['explicit', 'from-defaults']);
    });

    it('should handle empty specified results', () => {
      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/my-lib/project.json',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  root: 'libs/my-lib',
                  targets: {
                    build: {
                      executor: 'nx:run-commands',
                      options: { command: 'echo build' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        [],
        defaultResults as any,
        {
          targetDefaults: {
            build: { cache: true },
          },
        },
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      expect(buildTarget.executor).toEqual('nx:run-commands');
      expect(buildTarget.cache).toEqual(true);
      expect(errors).toEqual([]);
    });

    it('should handle empty default results', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      options: { configFile: 'vite.config.ts' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        [],
        {
          targetDefaults: {
            '@nx/vite:build': { cache: true },
          },
        },
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      expect(buildTarget.executor).toEqual('@nx/vite:build');
      expect(buildTarget.cache).toEqual(true);
      expect(errors).toEqual([]);
    });

    it('should handle no target defaults', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      inputs: ['inferred'],
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/my-lib/project.json',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  root: 'libs/my-lib',
                  targets: {
                    build: {
                      inputs: ['explicit', '...'],
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        defaultResults as any,
        {},
        '/tmp/test',
        errors
      );

      const buildTarget =
        result.projectRootMap['libs/my-lib'].targets!['build'];
      // No target defaults, so '...' expands against specified plugin's inputs
      expect(buildTarget.inputs).toEqual(['explicit', 'inferred']);
    });

    it('should not let a target-name-keyed default with a foreign executor replace an inferred command target', () => {
      // Repro: a polyglot workspace has a target-name keyed default
      // (`test-native`) configured for the rust plugin's executor, and
      // another plugin (e.g. the dotnet plugin) infers a target with the
      // same name using the `command` shorthand. The two are incompatible
      // (run-commands vs @monodon/rust:test), so the inferred target should
      // win — but currently the synthetic target-defaults entry layers on
      // top and replaces the executor + options with the rust ones.
      const specifiedResults = [
        [
          [
            '@nx/dotnet',
            'libs/dotnet-lib/MyLib.Tests.csproj',
            {
              projects: {
                'libs/dotnet-lib': {
                  name: 'dotnet-lib',
                  root: 'libs/dotnet-lib',
                  targets: {
                    'test-native': {
                      command: 'dotnet test',
                      options: { cwd: '{projectRoot}' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        [],
        {
          targetDefaults: {
            'test-native': {
              executor: '@monodon/rust:test',
              options: {},
              cache: true,
            },
          },
        },
        '/tmp/test',
        errors
      );

      const testTarget =
        result.projectRootMap['libs/dotnet-lib'].targets!['test-native'];
      // The inferred target should still be the run-commands invocation
      // for `dotnet test` — the rust default's executor is incompatible
      // and must not silently take over.
      expect(testTarget.executor).toEqual('nx:run-commands');
      expect(testTarget.options).toEqual(
        expect.objectContaining({ command: 'dotnet test' })
      );
      expect(errors).toEqual([]);
    });

    it('should not apply a target-name-keyed default with a foreign executor when project.json declares an empty target alongside an inferred command target', () => {
      // Same incompatibility, but project.json declares `{}` for the
      // target — historically the trigger that asks target-defaults to
      // fill the target in. The fill-in still shouldn't pull a
      // foreign-executor default on top of the inferred command target.
      const specifiedResults = [
        [
          [
            '@nx/dotnet',
            'libs/dotnet-lib/MyLib.Tests.csproj',
            {
              projects: {
                'libs/dotnet-lib': {
                  name: 'dotnet-lib',
                  root: 'libs/dotnet-lib',
                  targets: {
                    'test-native': {
                      command: 'dotnet test',
                      options: { cwd: '{projectRoot}' },
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const defaultResults = [
        [
          [
            'nx/core/project-json',
            'libs/dotnet-lib/project.json',
            {
              projects: {
                'libs/dotnet-lib': {
                  name: 'dotnet-lib',
                  root: 'libs/dotnet-lib',
                  targets: {
                    'test-native': {},
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        defaultResults as any,
        {
          targetDefaults: {
            'test-native': {
              executor: '@monodon/rust:test',
              options: {},
              cache: true,
            },
          },
        },
        '/tmp/test',
        errors
      );

      const testTarget =
        result.projectRootMap['libs/dotnet-lib'].targets!['test-native'];
      expect(testTarget.executor).toEqual('nx:run-commands');
      expect(testTarget.options).toEqual(
        expect.objectContaining({ command: 'dotnet test' })
      );
      expect(errors).toEqual([]);
    });

    it('should merge multiple specified plugins contributing to the same project', () => {
      const specifiedResults = [
        [
          [
            '@nx/vite',
            'libs/my-lib/vite.config.ts',
            {
              projects: {
                'libs/my-lib': {
                  name: 'my-lib',
                  targets: {
                    build: {
                      executor: '@nx/vite:build',
                      options: { configFile: 'vite.config.ts' },
                    },
                  },
                },
              },
            },
          ],
        ],
        [
          [
            '@nx/eslint',
            'libs/my-lib/.eslintrc.json',
            {
              projects: {
                'libs/my-lib': {
                  targets: {
                    lint: {
                      executor: '@nx/eslint:lint',
                    },
                  },
                },
              },
            },
          ],
        ],
      ] as const;

      const errors = [];
      const result = mergeCreateNodesResults(
        specifiedResults as any,
        [],
        {},
        '/tmp/test',
        errors
      );

      const project = result.projectRootMap['libs/my-lib'];
      expect(project.targets!['build'].executor).toEqual('@nx/vite:build');
      expect(project.targets!['lint'].executor).toEqual('@nx/eslint:lint');
      expect(errors).toEqual([]);
    });

    // Regression guard for the `defaultConfigurationSourceMaps` overlay
    // in project-configuration-utils.ts: when a default plugin target
    // lists keys before `...`, those keys yield to the specified-plugin
    // base during the final apply, but the intermediate merge already
    // wrote their attribution into `defaultConfigurationSourceMaps`.
    // The overlay uses "only fill missing" semantics so that stale
    // default-plugin entries can't clobber the correct specified-plugin
    // attribution already recorded in `configurationSourceMaps`.
    it('should attribute target-level keys that yield to base via `...` to the base source, not the default plugin', () => {
      const specifiedResults: CreateNodesResultEntry[][] = [
        [
          [
            '@acme/tool',
            'libs/a/tool.config.ts',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    build: {
                      executor: 'nx:run-commands',
                      cache: false,
                    },
                  },
                },
              },
            },
          ],
        ],
      ];

      const defaultResults: CreateNodesResultEntry[][] = [
        [
          [
            'nx/core/project-json',
            'libs/a/project.json',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    build: {
                      cache: true,
                      '...': true,
                    },
                  },
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        specifiedResults,
        defaultResults,
        {},
        '/tmp/test',
        errors
      );

      const build = result.projectRootMap['libs/a'].targets!.build;
      // Sanity: `cache` before `...` means base (specified) wins.
      expect(build.cache).toEqual(false);

      // But the overlay misattributes `cache` to the default plugin
      // because the intermediate merge wrote it into
      // defaultConfigurationSourceMaps before the final apply
      // decided base won.
      const sm = result.configurationSourceMaps['libs/a'];
      expect(sm['targets.build.cache']).toEqual([
        'libs/a/tool.config.ts',
        '@acme/tool',
      ]);
    });

    // Known gap in target-merging.ts#mergeConfigurations: the
    // per-configuration `mergeOptions` call is passed an undefined
    // source map, and a separate loop then unconditionally attributes
    // every property of every new configuration to the new source —
    // even when a spread inside the configuration made the base win
    // for a given property. Properties that survive only because of
    // the spread should keep base-plugin attribution.
    it('should attribute spread-shadowed configuration properties to the base, not the new plugin', () => {
      const specifiedResults: CreateNodesResultEntry[][] = [
        [
          [
            '@acme/base',
            'libs/a/base.config.ts',
            {
              projects: {
                'libs/a': {
                  name: 'a',
                  root: 'libs/a',
                  targets: {
                    build: {
                      executor: '@acme/build',
                      configurations: {
                        prod: {
                          minify: false,
                          sourceMap: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        ],
        [
          [
            '@acme/extend',
            'libs/a/extend.config.ts',
            {
              projects: {
                'libs/a': {
                  targets: {
                    build: {
                      configurations: {
                        prod: {
                          // `minify` is before `...` → base wins for it.
                          minify: true,
                          '...': true,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        ],
      ];

      const errors: MergeError[] = [];
      const result = mergeCreateNodesResults(
        specifiedResults,
        [],
        {},
        '/tmp/test',
        errors
      );

      const build = result.projectRootMap['libs/a'].targets!.build;
      // Sanity: spread resolved correctly — base wins for `minify`,
      // `sourceMap` survives via the `...` expansion.
      expect(build.configurations!.prod).toEqual({
        minify: false,
        sourceMap: true,
      });

      const sm = result.configurationSourceMaps['libs/a'];
      expect(sm['targets.build.configurations.prod.minify']).toEqual([
        'libs/a/base.config.ts',
        '@acme/base',
      ]);
      expect(sm['targets.build.configurations.prod.sourceMap']).toEqual([
        'libs/a/base.config.ts',
        '@acme/base',
      ]);
    });
  });

  describe('createProjectConfigurations', () => {
    /* A fake plugin that sets `fake-lib` tag to libs. */
    const fakeTagPlugin: NxPluginV2 = {
      name: 'fake-tag-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (vitestConfigPaths) =>
          createNodesFromFiles(
            (vitestConfigPath) => {
              const [_libs, name, _config] = vitestConfigPath.split('/');
              return {
                projects: {
                  [name]: {
                    name: name,
                    root: `libs/${name}`,
                    tags: ['fake-lib'],
                  },
                },
              };
            },
            vitestConfigPaths,
            null,
            null
          ),
      ],
    };

    const fakeTargetsPlugin: NxPluginV2 = {
      name: 'fake-targets-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (projectJsonPaths) =>
          createNodesFromFiles(
            (projectJsonPath) => {
              const root = dirname(projectJsonPath);
              return {
                projects: {
                  [root]: {
                    root,
                    targets: {
                      build: {
                        executor: 'nx:run-commands',
                        options: {
                          command: 'echo {projectName} @ {projectRoot}',
                        },
                      },
                    },
                  },
                },
              };
            },
            projectJsonPaths,
            null,
            null
          ),
      ],
    };

    const sameNamePlugin: NxPluginV2 = {
      name: 'same-name-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (projectJsonPaths) =>
          createNodesFromFiles(
            (projectJsonPath) => {
              const root = dirname(projectJsonPath);
              return {
                projects: {
                  [root]: {
                    root,
                    name: 'same-name',
                  },
                },
              };
            },
            projectJsonPaths,
            null,
            null
          ),
      ],
    };

    it('should create nodes for files matching included patterns only', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
              }),
            ],
          }
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
        'libs/b': {
          name: 'b',
          root: 'libs/b',
          tags: ['fake-lib'],
        },
      });
    });

    it('should create nodes for files matching included patterns only', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['libs/a/**'],
              }),
            ],
          }
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
      });
    });

    it('should not create nodes for files matching excluded patterns', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['libs/b/**'],
              }),
            ],
          }
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
      });
    });

    it('should normalize targets', async () => {
      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [
            ['libs/a/project.json'],
            ['libs/a/project.json'],
          ],
          defaultPluginFiles: [],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
            new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
          ],
          defaultPlugins: [],
        }
      );
      expect(projects['libs/a'].targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {},
          "executor": "nx:run-commands",
          "options": {
            "command": "echo a @ libs/a",
          },
          "parallelism": true,
        }
      `);
    });

    it('should validate that project names are unique', async () => {
      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            [
              'libs/a/project.json',
              'libs/b/project.json',
              'libs/c/project.json',
            ],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(sameNamePlugin, 'same-name-plugin'),
          ],
        }
      ).catch((e) => e);
      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors).toMatchInlineSnapshot(`
          [
            [MultipleProjectsWithSameNameError: The following projects are defined in multiple locations:
          - same-name: 
            - libs/a
            - libs/b
            - libs/c

          To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.],
          ]
        `);
      }
    });

    it('should validate that projects have a name', async () => {
      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            [
              'libs/a/project.json',
              'libs/b/project.json',
              'libs/c/project.json',
            ],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
          ],
        }
      ).catch((e) => e);
      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors).toMatchInlineSnapshot(`
          [
            [ProjectsWithNoNameError: The projects in the following directories have no name provided:
            - libs/a
            - libs/b
            - libs/c],
          ]
        `);
      }
    });

    it('should provide helpful error if project has task containing cache and continuous', async () => {
      const invalidCachePlugin: NxPluginV2 = {
        name: 'invalid-cache-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) => {
            const results = [];
            for (const projectJsonPath of projectJsonPaths) {
              const root = dirname(projectJsonPath);
              const name = root.split('/')[1];
              results.push([
                projectJsonPath,
                {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        build: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo foo',
                          },
                          cache: true,
                          continuous: true,
                        },
                      },
                    },
                  },
                },
              ] as const);
            }
            return results;
          },
        ],
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-lib/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(invalidCachePlugin, 'invalid-cache-plugin'),
          ],
        }
      ).catch((e) => e);

      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors.map((m) => m.toString())).toMatchInlineSnapshot(`
          [
            "[Configuration Error]:
          Errors detected in targets of project "my-lib":
          - "build" has both "cache" and "continuous" set to true. Continuous targets cannot be cached. Please remove the "cache" property.",
          ]
        `);
      }
    });

    it('should correctly set source maps', async () => {
      const { sourceMaps } = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [
            ['libs/a/project.json'],
            ['libs/a/project.json'],
          ],
          defaultPluginFiles: [],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
            new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
          ],
          defaultPlugins: [],
        }
      );
      expect(sourceMaps).toMatchInlineSnapshot(`
        {
          "libs/a": {
            "name": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "root": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "tags": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "tags.fake-lib": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "targets": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.executor": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.options": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.options.command": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
          },
        }
      `);
    });

    it('should include project and target context in error message when plugin returns invalid {workspaceRoot} token', async () => {
      const invalidTokenPlugin: NxPluginV2 = {
        name: 'invalid-token-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) =>
            createNodesFromFiles(
              (projectJsonPath) => {
                const root = dirname(projectJsonPath);
                const name = root.split('/')[1];
                return {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        build: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo foo/{workspaceRoot}/bar',
                          },
                        },
                      },
                    },
                  },
                };
              },
              projectJsonPaths,
              null,
              null
            ),
        ],
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-app/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(invalidTokenPlugin, 'invalid-token-plugin'),
          ],
        }
      ).catch((e) => e);

      expect(error.message).toContain(
        'The {workspaceRoot} token is only valid at the beginning of an option'
      );
      expect(error.message).toContain('libs/my-app:build');
    });

    it('should include nx.json context in error message when target defaults have invalid {workspaceRoot} token', async () => {
      const simplePlugin: NxPluginV2 = {
        name: 'simple-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) =>
            createNodesFromFiles(
              (projectJsonPath) => {
                const root = dirname(projectJsonPath);
                const name = root.split('/')[1];
                return {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        test: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo test',
                          },
                        },
                      },
                    },
                  },
                };
              },
              projectJsonPaths,
              null,
              null
            ),
        ],
      };

      const nxJsonWithInvalidDefaults = {
        targetDefaults: {
          test: {
            options: {
              config: 'path/{workspaceRoot}/config.json',
            },
          },
        },
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        nxJsonWithInvalidDefaults,
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-lib/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [new LoadedNxPlugin(simplePlugin, 'simple-plugin')],
        }
      ).catch((e) => e);

      expect(error.message).toContain(
        'The {workspaceRoot} token is only valid at the beginning of an option'
      );
      // Token validation now happens during normalization on the merged
      // rootMap, so the error is keyed by project root + target name.
      expect(error.message).toContain('libs/my-lib:test');
    });

    describe('negation pattern support', () => {
      it('should support negation patterns in exclude to re-include specific files', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a-e2e/project.json',
                  'libs/b-e2e/project.json',
                  'libs/toolkit-workspace-e2e/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['**/*-e2e/**', '!**/toolkit-workspace-e2e/**'],
                }),
              ],
            }
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/toolkit-workspace-e2e': {
            name: 'toolkit-workspace-e2e',
            root: 'libs/toolkit-workspace-e2e',
            tags: ['fake-lib'],
          },
        });
      });

      it('should support negation patterns in include to exclude specific files', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/**', '!libs/b/**'],
                }),
              ],
            }
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle multiple negation patterns correctly', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                  'libs/d/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['libs/**', '!libs/b/**', '!libs/c/**'],
                }),
              ],
            }
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/b': {
            name: 'b',
            root: 'libs/b',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle starting with negation pattern in exclude', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['!libs/a/**'],
                }),
              ],
            }
          );

        // Should exclude everything except libs/a (first pattern is negation)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle starting with negation pattern in include', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['!libs/b/**'],
                }),
              ],
            }
          );

        // Should include everything except libs/b (first pattern is negation)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should maintain backward compatibility with non-negation patterns', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                ['libs/a/project.json', 'libs/b/project.json'],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/a/**'],
                  exclude: ['libs/b/**'],
                }),
              ],
            }
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle overlapping patterns with last match winning', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/a/special/project.json',
                  'libs/b/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['libs/**', '!libs/a/**', 'libs/a/special/**'],
                }),
              ],
            }
          );

        // Exclude all libs, except a, but re-exclude a/special (last match wins)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should work with both include and exclude having negation patterns', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                  'libs/d/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/**', '!libs/d/**'],
                  exclude: ['libs/b/**', '!libs/c/**'],
                }),
              ],
            }
          );

        // Include: a, b, c (all except d)
        // Exclude: b (but not c due to negation)
        // Result: a, c
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle empty arrays with negation support intact', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                ['libs/a/project.json', 'libs/b/project.json'],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: [],
                  exclude: [],
                }),
              ],
            }
          );

        // Empty arrays should not filter anything
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/b': {
            name: 'b',
            root: 'libs/b',
            tags: ['fake-lib'],
          },
        });
      });
    });

    describe('mergeProjectConfigurationIntoRootMap spread syntax', () => {
      it('should spread arrays in target options when merging projects', () => {
        const rootMap = new RootMapBuilder()
          .addProject({
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  scripts: ['existing-script-1', 'existing-script-2'],
                },
              },
            },
          })
          .getRootMap();

        mergeProjectConfigurationIntoRootMap(rootMap, {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              options: {
                scripts: ['new-script', '...'],
              },
            },
          },
        });

        expect(rootMap['libs/lib-a'].targets?.build.options.scripts).toEqual([
          'new-script',
          'existing-script-1',
          'existing-script-2',
        ]);
      });

      it('should spread objects in target options when merging projects', () => {
        const rootMap = new RootMapBuilder()
          .addProject({
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    EXISTING_VAR: 'existing',
                    SHARED_VAR: 'existing-shared',
                  },
                },
              },
            },
          })
          .getRootMap();

        mergeProjectConfigurationIntoRootMap(rootMap, {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              options: {
                env: {
                  NEW_VAR: 'new',
                  '...': true,
                  SHARED_VAR: 'new-shared',
                },
              },
            },
          },
        });

        expect(rootMap['libs/lib-a'].targets?.build.options.env).toEqual({
          NEW_VAR: 'new',
          EXISTING_VAR: 'existing',
          SHARED_VAR: 'new-shared',
        });
      });

      it('should spread arrays in top-level target properties when merging projects', () => {
        const rootMap = new RootMapBuilder()
          .addProject({
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: ['default', '{projectRoot}/**/*'],
                outputs: ['{projectRoot}/dist'],
                dependsOn: ['^build'],
              },
            },
          })
          .getRootMap();

        mergeProjectConfigurationIntoRootMap(rootMap, {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              inputs: ['production', '...'],
              outputs: ['...', '{projectRoot}/coverage'],
              dependsOn: ['prebuild', '...'],
            },
          },
        });

        expect(rootMap['libs/lib-a'].targets?.build.inputs).toEqual([
          'production',
          'default',
          '{projectRoot}/**/*',
        ]);
        expect(rootMap['libs/lib-a'].targets?.build.outputs).toEqual([
          '{projectRoot}/dist',
          '{projectRoot}/coverage',
        ]);
        expect(rootMap['libs/lib-a'].targets?.build.dependsOn).toEqual([
          'prebuild',
          '^build',
        ]);
      });

      it('should spread arrays in configuration options when merging projects', () => {
        const rootMap = new RootMapBuilder()
          .addProject({
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                configurations: {
                  prod: {
                    fileReplacements: [
                      { replace: 'env.ts', with: 'env.prod.ts' },
                    ],
                  },
                },
              },
            },
          })
          .getRootMap();

        mergeProjectConfigurationIntoRootMap(rootMap, {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'config.ts', with: 'config.prod.ts' },
                    '...',
                  ],
                },
              },
            },
          },
        });

        expect(
          rootMap['libs/lib-a'].targets?.build.configurations?.prod
            ?.fileReplacements
        ).toEqual([
          { replace: 'config.ts', with: 'config.prod.ts' },
          { replace: 'env.ts', with: 'env.prod.ts' },
        ]);
      });

      it('should handle spread with source maps correctly', () => {
        const rootMap = new RootMapBuilder()
          .addProject({
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  scripts: ['base-script'],
                },
              },
            },
          })
          .getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {
            'targets.build': ['base', 'base-plugin'],
            'targets.build.options': ['base', 'base-plugin'],
            'targets.build.options.scripts': ['base', 'base-plugin'],
          },
        };

        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                options: {
                  scripts: ['new-script', '...'],
                },
              },
            },
          },
          sourceMap,
          ['new', 'new-plugin']
        );

        expect(rootMap['libs/lib-a'].targets?.build.options.scripts).toEqual([
          'new-script',
          'base-script',
        ]);
        expect(
          sourceMap['libs/lib-a']['targets.build.options.scripts']
        ).toEqual(['new', 'new-plugin']);
        // Per-element source tracking
        expect(
          sourceMap['libs/lib-a']['targets.build.options.scripts.0']
        ).toEqual(['new', 'new-plugin']);
        expect(
          sourceMap['libs/lib-a']['targets.build.options.scripts.1']
        ).toEqual(['base', 'base-plugin']);
      });
    });

    describe('two-phase spread: project.json spread includes target defaults', () => {
      const projectJsonPaths = ['libs/my-lib/project.json'];

      /**
       * Creates a specified plugin that infers targets for a project.
       * Simulates plugins like @nx/webpack, @nx/jest, etc.
       */
      function makeSpecifiedPlugin(
        targets: Record<string, TargetConfiguration>,
        projectRoot = 'libs/my-lib'
      ): NxPluginV2 {
        return {
          name: 'specified-plugin',
          createNodesV2: [
            'libs/*/project.json',
            (configFiles) =>
              createNodesFromFiles(
                (configFile) => {
                  const root = dirname(configFile);
                  if (root !== projectRoot) return {};
                  return {
                    projects: {
                      [root]: { targets },
                    },
                  };
                },
                configFiles,
                {} as any,
                {} as any
              ),
          ],
        };
      }

      /**
       * Creates a default plugin (like project.json) that defines targets.
       */
      function makeDefaultPlugin(
        targets: Record<string, TargetConfiguration>,
        projectRoot = 'libs/my-lib',
        name = 'default-plugin'
      ): NxPluginV2 {
        return {
          name,
          createNodesV2: [
            'libs/*/project.json',
            (configFiles) =>
              createNodesFromFiles(
                (configFile) => {
                  const root = dirname(configFile);
                  if (root !== projectRoot) return {};
                  return {
                    projects: {
                      [root]: {
                        name: 'my-lib',
                        targets,
                      },
                    },
                  };
                },
                configFiles,
                {} as any,
                {} as any
              ),
          ],
        };
      }

      it('Case C: spread in project.json target includes target defaults (specified + defaults)', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            inputs: ['inferred'],
            options: { command: 'echo build' },
          },
        });

        const defaultPlugin = makeDefaultPlugin({
          build: {
            inputs: ['explicit', '...'],
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                inputs: ['default'],
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // project.json spread expands with (specified + target defaults)
        // Since target defaults override specified: base is ['default']
        // project.json merges ['explicit', '...'] on top → ['explicit', 'default']
        expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
          'explicit',
          'default',
        ]);
      });

      it('Case B: spread in project.json-only target includes target defaults', async () => {
        const defaultPlugin = makeDefaultPlugin({
          deploy: {
            executor: 'nx:run-commands',
            inputs: ['explicit', '...'],
            options: { command: 'echo deploy' },
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              deploy: {
                inputs: ['default'],
              },
            },
          },
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // project.json spread expands with target defaults (no specified values)
        // Base is ['default'], project.json merges ['explicit', '...'] on top
        expect(projects['libs/my-lib'].targets!.deploy.inputs).toEqual([
          'explicit',
          'default',
        ]);
      });

      it('Case C without spread: project.json fully replaces (existing behavior)', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            inputs: ['inferred'],
            options: { command: 'echo build' },
          },
        });

        const defaultPlugin = makeDefaultPlugin({
          build: {
            inputs: ['explicit'],
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                inputs: ['default'],
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // No spread: project.json fully replaces
        expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
          'explicit',
        ]);
      });

      it('Case A: target defaults override specified plugin (no project.json target)', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            inputs: ['inferred'],
            options: { command: 'echo build' },
          },
        });

        const defaultPlugin = makeDefaultPlugin({});

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                inputs: ['default'],
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // Target defaults override specified plugin values
        expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
          'default',
        ]);
      });

      it('Case A: target defaults with spread include specified plugin values', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            inputs: ['inferred'],
            options: { command: 'echo build' },
          },
        });

        const defaultPlugin = makeDefaultPlugin({});

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                inputs: ['default', '...'],
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // Target defaults spread includes specified plugin values
        expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
          'default',
          'inferred',
        ]);
      });

      it('Case B without spread: project.json fully replaces target defaults', async () => {
        const defaultPlugin = makeDefaultPlugin({
          deploy: {
            executor: 'nx:run-commands',
            inputs: ['explicit'],
            options: { command: 'echo deploy' },
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              deploy: {
                inputs: ['default'],
              },
            },
          },
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // No spread: project.json fully replaces target defaults
        expect(projects['libs/my-lib'].targets!.deploy.inputs).toEqual([
          'explicit',
        ]);
      });

      it('full three-layer spread chain', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'echo build',
              assets: ['inferred'],
            },
          },
        });

        const defaultPlugin = makeDefaultPlugin({
          build: {
            options: {
              assets: ['explicit', '...'],
            },
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                options: {
                  assets: ['default', '...'],
                },
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // Three-layer chain:
        // 1. Specified: ['inferred']
        // 2. Target defaults: ['default', '...'] → ['default', 'inferred']
        // 3. project.json: ['explicit', '...'] → ['explicit', 'default', 'inferred']
        expect(projects['libs/my-lib'].targets!.build.options.assets).toEqual([
          'explicit',
          'default',
          'inferred',
        ]);
      });

      it('spread in project.json options includes target default options', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'echo build',
              env: { SPECIFIED: 'true' },
            },
          },
        });

        const defaultPlugin = makeDefaultPlugin({
          build: {
            options: {
              env: { PROJECT: 'true', '...': true },
            },
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                options: {
                  env: { DEFAULT: 'true', '...': true },
                },
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        // Object spread through all three layers
        expect(projects['libs/my-lib'].targets!.build.options.env).toEqual({
          PROJECT: 'true',
          DEFAULT: 'true',
          SPECIFIED: 'true',
        });
      });

      it('Case D: target defaults apply once when target is in default plugin results', async () => {
        const specifiedPlugin = makeSpecifiedPlugin({
          build: {
            executor: 'nx:run-commands',
            inputs: ['from-specified'],
            options: { command: 'echo build' },
          },
        });

        const defaultPlugin = makeDefaultPlugin({
          build: {
            inputs: ['from-default', '...'],
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              build: {
                inputs: ['from-defaults', '...'],
              },
            },
          },
          {
            specifiedPluginFiles: [projectJsonPaths],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [
              new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
            ],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
          'from-default',
          'from-defaults',
          'from-specified',
        ]);
      });

      it('Case E: target defaults provide cache/dependsOn when default plugin has executor but no cache', async () => {
        const defaultPlugin = makeDefaultPlugin({
          build: {
            executor: '@nx/esbuild:esbuild',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist',
            },
          },
        });

        const { projects } = await createProjectConfigurationsWithPlugins(
          undefined,
          {
            targetDefaults: {
              '@nx/esbuild:esbuild': {
                cache: true,
                dependsOn: ['^build'],
                inputs: ['production', '^production'],
              },
            },
          },
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [projectJsonPaths],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(defaultPlugin, 'default-plugin'),
            ],
          }
        );

        const buildTarget = projects['libs/my-lib'].targets!.build;
        expect(buildTarget.executor).toEqual('@nx/esbuild:esbuild');
        expect(buildTarget.cache).toEqual(true);
        expect(buildTarget.dependsOn).toEqual(['^build']);
        expect(buildTarget.inputs).toEqual(['production', '^production']);
        expect(buildTarget.outputs).toEqual(['{options.outputPath}']);
        expect(buildTarget.options).toEqual({ outputPath: 'dist' });
      });
    });
  });
});

class RootMapBuilder {
  private rootMap: Record<string, ProjectConfiguration> = {};

  addProject(p: ProjectConfiguration) {
    this.rootMap[p.root] = p;
    return this;
  }

  getRootMap() {
    return this.rootMap;
  }
}

function assertCorrectKeysInSourceMap(
  sourceMaps: ConfigurationSourceMaps,
  root: string,
  ...tuples: [string, string][]
) {
  const sourceMap = sourceMaps[root];
  tuples.forEach(([key, value]) => {
    if (!sourceMap[key]) {
      throw new Error(`Expected sourceMap to contain key ${key}`);
    }
    try {
      expect(sourceMap[key][0]).toEqual(value);
    } catch (error) {
      // Enhancing the error message with the problematic key
      throw new Error(
        `Assertion failed for key '${key}': \n ${(error as Error).message}`
      );
    }
  });
}
