import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '../../src/utils/fileutils';

import * as path from 'path';
import { readJsonInTree, updateJsonInTree } from '../../src/utils/ast-utils';

describe('Update 7.2.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        scripts: {}
      })
    );
    createJson('tsconfig.json', {});
    createJson('angular.json', {
      projects: {
        app1: {
          root: 'apps/app1',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:browser',
              options: {
                tsConfig: 'apps/app1/tsconfig.app.json'
              }
            },
            test: {
              builder: '@angular-devkit/build-angular:karma',
              options: {
                tsConfig: 'apps/app1/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/app1/tsconfig.app.json',
                  'apps/app1/tsconfig.spec.json'
                ]
              }
            }
          }
        },
        'app1-e2e': {
          root: 'apps/app1-e2e',
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                tsConfig: 'apps/app1-e2e/tsconfig.e2e.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: 'apps/app1-e2e/tsconfig.e2e.json'
              }
            }
          }
        },
        app2: {
          root: 'apps/app2',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:browser',
              options: {
                tsConfig: 'apps/app2/tsconfig.app.json'
              }
            },
            test: {
              builder: '@nrwl/schematics:jest',
              options: {
                tsConfig: 'apps/app2/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/app2/tsconfig.app.json',
                  'apps/app2/tsconfig.spec.json'
                ]
              }
            }
          }
        },
        'app2-e2e': {
          root: 'apps/app2-e2e',
          architect: {
            e2e: {
              builder: '@nrwl/builders:cypress',
              options: {
                tsConfig: 'apps/app2-e2e/tsconfig.e2e.json'
              }
            }
          }
        },
        'node-app': {
          root: 'apps/node-app',
          architect: {
            build: {
              builder: '@nrwl/builders:node-build',
              options: {
                tsConfig: 'apps/node-app/tsconfig.app.json'
              }
            },
            test: {
              builder: '@nrwl/schematics:jest',
              options: {
                tsConfig: 'apps/node-app/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/node-app/tsconfig.app.json',
                  'apps/node-app/tsconfig.spec.json'
                ]
              }
            }
          }
        },
        'weird-app': {
          root: 'apps/weird/app',
          architect: {
            build: {
              builder: '@nrwl/builders:node-build',
              options: {
                tsConfig: 'apps/weird/app/src/tsconfig.app.json'
              }
            },
            test: {
              builder: '@nrwl/schematics:jest',
              options: {
                tsConfig: 'apps/weird/app/src/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'apps/weird/app/src/tsconfig.app.json',
                  'apps/weird/app/src/tsconfig.spec.json'
                ]
              }
            }
          }
        },
        lib1: {
          root: 'libs/lib1',
          architect: {
            test: {
              builder: '@angular-devkit/build-angular:karma',
              options: {
                tsConfig: 'libs/lib1/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'libs/lib1/tsconfig.lib.json',
                  'libs/lib1/tsconfig.spec.json'
                ]
              }
            }
          }
        },
        lib2: {
          root: 'libs/lib2',
          architect: {
            test: {
              builder: '@angular-devkit/build-angular:jest',
              options: {
                tsConfig: 'libs/lib2/tsconfig.spec.json'
              }
            },
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: [
                  'libs/lib2/tsconfig.lib.json',
                  'libs/lib2/tsconfig.spec.json'
                ]
              }
            }
          }
        }
      }
    });
    createJson('apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jquery']
      }
    });
    createJson('apps/app1/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jasmine', 'node', 'sinon']
      }
    });
    createJson('apps/app1-e2e/tsconfig.e2e.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jasmine', 'jasminewd2', 'node']
      }
    });
    createJson('apps/app2/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: []
      }
    });
    createJson('apps/app2/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jest', 'node']
      }
    });
    createJson('apps/app2-e2e/tsconfig.e2e.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['cypress', 'node']
      }
    });
    createJson('apps/node-app/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['node']
      }
    });
    createJson('apps/node-app/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jest', 'node']
      }
    });
    createJson('apps/weird/app/src/tsconfig.app.json', {
      extends: '../../../tsconfig.json',
      compilerOptions: {}
    });
    createJson('apps/weird/app/src/tsconfig.spec.json', {
      extends: '../../../tsconfig.json',
      compilerOptions: {}
    });
    createJson('libs/lib1/tsconfig.lib.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: []
      }
    });
    createJson('libs/lib1/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jasmine', 'node']
      }
    });
    createJson('libs/lib2/tsconfig.lib.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: []
      }
    });
    createJson('libs/lib2/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        types: ['jest', 'node']
      }
    });

    function createJson(path: string, value: any) {
      initialTree.create(path, serializeJson(value));
    }

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should create tsconfigs for existing projects', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.2.0', {}, initialTree)
      .toPromise();
    expect(result.files).toContain('/tsconfig.json');
    expect(result.files).toContain('/apps/app1/tsconfig.json');
    expect(result.files).toContain('/apps/app1-e2e/tsconfig.json');
    expect(result.files).toContain('/apps/app2/tsconfig.json');
    expect(result.files).toContain('/apps/app2-e2e/tsconfig.json');
    expect(result.files).toContain('/apps/node-app/tsconfig.json');
    expect(result.files).toContain('/apps/weird/app/tsconfig.json');
    expect(result.files).toContain('/libs/lib1/tsconfig.json');
    expect(result.files).toContain('/libs/lib2/tsconfig.json');
    [
      '/apps/app1/tsconfig.json',
      '/apps/app1-e2e/tsconfig.json',
      '/apps/app2/tsconfig.json',
      '/apps/app2-e2e/tsconfig.json',
      '/apps/node-app/tsconfig.json',
      '/libs/lib1/tsconfig.json',
      '/libs/lib2/tsconfig.json'
    ].forEach(tsConfig => {
      const value = readJsonInTree(result, tsConfig);
      expect(value.extends).toEqual('../../tsconfig.json');
    });
    expect(
      readJsonInTree(result, 'apps/weird/app/tsconfig.json').extends
    ).toEqual('../../../tsconfig.json');
  });

  it('should edit existing tsconfigs to extend the new one', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.2.0', {}, initialTree)
      .toPromise();
    [
      '/apps/app1/tsconfig.app.json',
      '/apps/app1/tsconfig.spec.json',
      '/apps/app1-e2e/tsconfig.e2e.json',
      '/apps/app2/tsconfig.app.json',
      '/apps/app2/tsconfig.spec.json',
      '/apps/app2-e2e/tsconfig.e2e.json',
      '/apps/node-app/tsconfig.app.json',
      '/apps/node-app/tsconfig.spec.json',
      '/libs/lib1/tsconfig.lib.json',
      '/libs/lib1/tsconfig.spec.json',
      '/libs/lib2/tsconfig.lib.json',
      '/libs/lib2/tsconfig.spec.json'
    ].forEach(tsConfig => {
      const value = readJsonInTree(result, tsConfig);
      expect(value.extends).toEqual('./tsconfig.json');
    });
    expect(
      readJsonInTree(result, 'apps/weird/app/src/tsconfig.app.json').extends
    ).toEqual('../tsconfig.json');
    expect(
      readJsonInTree(result, 'apps/weird/app/src/tsconfig.spec.json').extends
    ).toEqual('../tsconfig.json');
  });

  it('should edit existing tsconfigs to have a union of all types being used', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.2.0', {}, initialTree)
      .toPromise();

    function getTypes(path: string) {
      return readJsonInTree(result, path).compilerOptions.types;
    }

    expect(getTypes('apps/app1/tsconfig.json')).toEqual([
      'jquery',
      'jasmine',
      'node',
      'sinon'
    ]);
    expect(getTypes('apps/app1-e2e/tsconfig.json')).toEqual([
      'jasmine',
      'jasminewd2',
      'node'
    ]);
    expect(getTypes('apps/app2/tsconfig.json')).toEqual(['jest', 'node']);
    expect(getTypes('apps/app2-e2e/tsconfig.json')).toEqual([
      'cypress',
      'node'
    ]);
    expect(getTypes('apps/node-app/tsconfig.json')).toEqual(['node', 'jest']);
    expect(getTypes('apps/weird/app/tsconfig.json')).toBeUndefined();
    expect(getTypes('libs/lib1/tsconfig.json')).toEqual(['jasmine', 'node']);
    expect(getTypes('libs/lib2/tsconfig.json')).toEqual(['jest', 'node']);
  });

  it("should not set types if one of the project's tsconfigs do not have types defined", async () => {
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('apps/app1/tsconfig.app.json', json => {
          delete json.compilerOptions.types;
          return json;
        }),
        initialTree
      )
      .toPromise();
    const result = await schematicRunner
      .runSchematicAsync('update-7.2.0', {}, initialTree)
      .toPromise();

    function getTypes(path: string) {
      return readJsonInTree(result, path).compilerOptions.types;
    }

    expect(getTypes('apps/app1/tsconfig.json')).toBeUndefined();
  });
});
