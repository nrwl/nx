import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { callRule, createEmptyWorkspace } from '../../../testing';
import { readJsonInTree } from '../ast-utils';
import { moveNpmPackages } from './move-npm-packages';

describe('moveNpmPackages Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should move an npm package from deps to devDeps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move': '1.2.3',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({ toDevDeps: 'package-to-move' }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        'package-to-move': '1.2.3',
      },
    });
  });

  it('should move multiple npm packages from deps to devDeps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move-1': '1.2.3',
          'package-to-move-2': '1.2.3',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDevDeps: ['package-to-move-1', 'package-to-move-2'],
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        'package-to-move-1': '1.2.3',
        'package-to-move-2': '1.2.3',
      },
    });
  });

  it('should move an npm package from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        devDependencies: {
          'package-to-move': '1.2.3',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({ toDeps: 'package-to-move' }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move': '1.2.3',
      },
      devDependencies: {},
    });
  });

  it('should move multiple npm packages from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        devDependencies: {
          'package-to-move-1': '1.2.3',
          'package-to-move-2': '1.2.3',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: ['package-to-move-1', 'package-to-move-2'],
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move-1': '1.2.3',
        'package-to-move-2': '1.2.3',
      },
      devDependencies: {},
    });
  });

  it('should move an npm package from deps to devDeps and one from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move-1': '1.2.3',
        },
        devDependencies: {
          'package-to-move-2': '3.2.1',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move-2',
        toDevDeps: 'package-to-move-1',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move-2': '3.2.1',
      },
      devDependencies: {
        'package-to-move-1': '1.2.3',
      },
    });
  });

  it('should move a npm package from deps to devDeps and mulitple ones from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move-1': '1.2.3',
        },
        devDependencies: {
          'package-to-move-2': '3.2.1',
          'package-to-move-3': '4.3.2',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: ['package-to-move-2', 'package-to-move-3'],
        toDevDeps: 'package-to-move-1',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move-2': '3.2.1',
        'package-to-move-3': '4.3.2',
      },
      devDependencies: {
        'package-to-move-1': '1.2.3',
      },
    });
  });

  it('should move multiple npm packages from deps to devDeps and one from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move-1': '1.2.3',
          'package-to-move-2': '3.2.1',
        },
        devDependencies: {
          'package-to-move-3': '4.3.2',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move-3',
        toDevDeps: ['package-to-move-1', 'package-to-move-2'],
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move-3': '4.3.2',
      },
      devDependencies: {
        'package-to-move-1': '1.2.3',
        'package-to-move-2': '3.2.1',
      },
    });
  });

  it('should move multiple npm packages from deps to devDeps and mulitple ones from devDeps to deps in package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move-1': '1.2.3',
          'package-to-move-2': '2.3.4',
        },
        devDependencies: {
          'package-to-move-3': '3.2.1',
          'package-to-move-4': '4.3.2',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: ['package-to-move-3', 'package-to-move-4'],
        toDevDeps: ['package-to-move-1', 'package-to-move-2'],
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move-3': '3.2.1',
        'package-to-move-4': '4.3.2',
      },
      devDependencies: {
        'package-to-move-1': '1.2.3',
        'package-to-move-2': '2.3.4',
      },
    });
  });

  it('should not move a npm package from devDeps to deps in package.json if it is not passed in PackageMoveOptions', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        devDependencies: {
          'package-to-move': '1.2.3',
          'package-to-stay': '2.3.4',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move': '1.2.3',
      },
      devDependencies: {
        'package-to-stay': '2.3.4',
      },
    });
  });

  it('should not move a npm package from deps to devDeps in package.json if it is not passed in PackageMoveOptions', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move': '1.2.3',
          'package-to-stay': '2.3.4',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDevDeps: 'package-to-move',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-stay': '2.3.4',
      },
      devDependencies: {
        'package-to-move': '1.2.3',
      },
    });
  });

  it('should do one move if a npm package is beign moved to both deps and devDeps in package.json depending on its current group', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move': '1.2.3',
          'package-to-stay': '2.3.4',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move',
        toDevDeps: 'package-to-move',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-stay': '2.3.4',
      },
      devDependencies: {
        'package-to-move': '1.2.3',
      },
    });
  });

  it('should do nothing if moving a npm package to deps in package.json that is already in deps', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'package-to-move': '1.2.3',
          'package-to-stay': '2.3.4',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'package-to-move': '1.2.3',
        'package-to-stay': '2.3.4',
      },
    });
  });

  it('should do nothing if moving a npm package to devDeps in package.json that is already in devDeps', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        devDependencies: {
          'package-to-move': '1.2.3',
          'package-to-stay': '2.3.4',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDevDeps: 'package-to-move',
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      devDependencies: {
        'package-to-move': '1.2.3',
        'package-to-stay': '2.3.4',
      },
    });
  });

  it('should do nothing if the packages are not found in the package.json', async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          'not-me': '1.0.0',
          'nor-me': '0.0.2',
        },
        devDependencies: {
          'me-neither': '5.0.0',
          'forget-about-it': '8.4.0',
        },
      })
    );

    tree = (await callRule(
      moveNpmPackages({
        toDeps: 'package-to-move-1',
        toDevDeps: [
          'package-to-move-1',
          'package-to-move-2',
          'package-to-move-3',
        ],
      }),
      tree
    )) as UnitTestTree;

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        'not-me': '1.0.0',
        'nor-me': '0.0.2',
      },
      devDependencies: {
        'me-neither': '5.0.0',
        'forget-about-it': '8.4.0',
      },
    });
  });
});
