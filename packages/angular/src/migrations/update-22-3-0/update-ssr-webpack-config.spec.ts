import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-ssr-webpack-config';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('update-ssr-webpack-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update tsconfig.server.json for webpack-based SSR projects', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        target: 'es2022',
        module: 'commonjs',
        moduleResolution: 'node',
        types: ['node'],
      },
      files: ['src/main.server.ts', 'src/server.ts'],
    });
    tree.write(
      'apps/app1/src/server.ts',
      `import * as express from 'express';`
    );

    await migration(tree);

    const tsConfig = readJson(tree, 'apps/app1/tsconfig.server.json');
    expect(tsConfig.compilerOptions.module).toBe('preserve');
    expect(tsConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should update server.ts imports from namespace to default imports', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    tree.write(
      'apps/app1/src/server.ts',
      `import * as express from 'express';
import * as compression from 'compression';
import * as cors from 'cors';

const app = express();
app.use(compression());
app.use(cors());
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import express from 'express';
      import compression from 'compression';
      import cors from 'cors';

      const app = express();
      app.use(compression());
      app.use(cors());
      "
    `);
  });

  it('should not convert namespace imports when there is already a default import', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    const serverContent = `import express, * as expressTypes from 'express';
import * as cors from 'cors';

const app = express();
`;
    tree.write('apps/app1/src/server.ts', serverContent);

    await migration(tree);

    // The default+namespace import should remain unchanged
    // The standalone namespace import should be converted
    expect(tree.read('apps/app1/src/server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import express, * as expressTypes from 'express';
      import cors from 'cors';

      const app = express();
      "
    `);
  });

  it('should work with @angular-devkit/build-angular:server executor', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@angular-devkit/build-angular:server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    tree.write(
      'apps/app1/src/server.ts',
      `import * as express from 'express';`
    );

    await migration(tree);

    const tsConfig = readJson(tree, 'apps/app1/tsconfig.server.json');
    expect(tsConfig.compilerOptions.module).toBe('preserve');
    expect(tsConfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(tree.read('apps/app1/src/server.ts', 'utf-8')).toBe(
      `import express from 'express';`
    );
  });

  it('should skip projects with the tsconfig.server.json already configured', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    const originalTsConfig = {
      compilerOptions: {
        module: 'preserve',
        moduleResolution: 'bundler',
      },
    };
    writeJson(tree, 'apps/app1/tsconfig.server.json', originalTsConfig);
    const originalServerContent = `import * as express from 'express';`;
    tree.write('apps/app1/src/server.ts', originalServerContent);

    await migration(tree);

    const tsConfig = readJson(tree, 'apps/app1/tsconfig.server.json');
    expect(tsConfig).toEqual(originalTsConfig);
    // Server file should NOT be modified when tsconfig is already correct
    expect(tree.read('apps/app1/src/server.ts', 'utf-8')).toBe(
      originalServerContent
    );
  });

  it('should skip projects without tsconfig.server.json', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    const originalServerContent = `import * as express from 'express';`;
    tree.write('apps/app1/src/server.ts', originalServerContent);

    await migration(tree);

    // Should not throw error
    expect(tree.exists('apps/app1/tsconfig.server.json')).toBe(false);
    // Server file should NOT be modified when tsconfig doesn't exist
    expect(tree.read('apps/app1/src/server.ts', 'utf-8')).toBe(
      originalServerContent
    );
  });

  it('should skip non-webpack builders', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@angular-devkit/build-angular:application',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    const originalTsConfig = {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    };
    writeJson(tree, 'apps/app1/tsconfig.server.json', originalTsConfig);
    tree.write(
      'apps/app1/src/server.ts',
      `import * as express from 'express';`
    );

    await migration(tree);

    const tsConfig = readJson(tree, 'apps/app1/tsconfig.server.json');
    expect(tsConfig).toEqual(originalTsConfig);
  });

  it('should skip library projects', async () => {
    addProject('lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'libs/lib1/src/server.ts',
          },
        },
      },
    });
    const originalTsConfig = {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    };
    writeJson(tree, 'libs/lib1/tsconfig.server.json', originalTsConfig);
    tree.write(
      'libs/lib1/src/server.ts',
      `import * as express from 'express';`
    );

    await migration(tree);

    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.server.json');
    expect(tsConfig).toEqual(originalTsConfig);
  });

  it('should handle multiple SSR projects', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app1/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    tree.write(
      'apps/app1/src/server.ts',
      `import * as express from 'express';`
    );

    addProject('app2', {
      root: 'apps/app2',
      sourceRoot: 'apps/app2/src',
      projectType: 'application',
      targets: {
        server: {
          executor: '@nx/angular:webpack-server',
          options: {
            main: 'apps/app2/src/server.ts',
          },
        },
      },
    });
    writeJson(tree, 'apps/app2/tsconfig.server.json', {
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    tree.write('apps/app2/src/server.ts', `import * as cors from 'cors';`);

    await migration(tree);

    const tsConfig1 = readJson(tree, 'apps/app1/tsconfig.server.json');
    const tsConfig2 = readJson(tree, 'apps/app2/tsconfig.server.json');
    expect(tsConfig1.compilerOptions.module).toBe('preserve');
    expect(tsConfig1.compilerOptions.moduleResolution).toBe('bundler');
    expect(tsConfig2.compilerOptions.module).toBe('preserve');
    expect(tsConfig2.compilerOptions.moduleResolution).toBe('bundler');
    expect(tree.read('apps/app1/src/server.ts', 'utf-8')).toBe(
      `import express from 'express';`
    );
    expect(tree.read('apps/app2/src/server.ts', 'utf-8')).toBe(
      `import cors from 'cors';`
    );
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[] = ['npm:@angular/ssr']
  ): void {
    const existingProjectGraph = projectGraph || {
      dependencies: {},
      nodes: {},
    };

    projectGraph = {
      dependencies: {
        ...existingProjectGraph.dependencies,
        [projectName]: dependencies.map((d) => ({
          source: projectName,
          target: d,
          type: 'static',
        })),
      },
      nodes: {
        ...existingProjectGraph.nodes,
        [projectName]: { data: config, name: projectName, type: 'app' },
      },
    };
    addProjectConfiguration(tree, projectName, config);
  }
});
