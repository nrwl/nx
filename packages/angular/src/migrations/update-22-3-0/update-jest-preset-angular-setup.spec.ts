import {
  addProjectConfiguration,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-jest-preset-angular-setup';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('update-jest-preset-angular-setup migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = { dependencies: {}, nodes: {} };
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: { 'jest-preset-angular': '~16.0.0' },
    });
  });

  describe('import replacement', () => {
    it('should replace import with single quotes', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });

    it('should replace import with double quotes', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import "jest-preset-angular/setup-jest";`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });

    it('should replace import with .js extension', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest.js';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });

    it('should replace import with .mjs extension and preserve the extension', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest.mjs';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone/index.mjs';

        setupZoneTestEnv();"
      `);
    });

    it('should replace require syntax and preserve it', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `require('jest-preset-angular/setup-jest');`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');

        setupZoneTestEnv();"
      `);
    });
  });

  describe('content preservation', () => {
    it('should preserve content before the import', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `// Jest setup file
import 'zone.js';
import 'zone.js/testing';
import 'jest-preset-angular/setup-jest';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "// Jest setup file
        import 'zone.js';
        import 'zone.js/testing';
        import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });

    it('should preserve content after the import', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';

// Additional test setup
globalThis.someGlobal = 'test';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();
        // Additional test setup
        globalThis.someGlobal = 'test';"
      `);
    });
  });

  describe('skip scenarios', () => {
    it('should not modify files already using the new format', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      const originalContent = `import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();`;
      tree.write('apps/app1/src/test-setup.ts', originalContent);

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8')).toBe(
        originalContent
      );
    });

    it('should skip non-.ts files', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      const originalContent = `import 'jest-preset-angular/setup-jest';`;
      tree.write('apps/app1/src/setup.js', originalContent);

      await migration(tree);

      expect(tree.read('apps/app1/src/setup.js', 'utf-8')).toBe(
        originalContent
      );
    });

    it('should skip projects without jest-preset-angular dependency', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' }, ['npm:@angular/core']);
      const originalContent = `import 'jest-preset-angular/setup-jest';`;
      tree.write('apps/app1/src/test-setup.ts', originalContent);

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8')).toBe(
        originalContent
      );
    });
  });

  describe('multiple projects', () => {
    it('should process multiple projects', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      addProject(tree, 'app2', { root: 'apps/app2' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';`
      );
      tree.write(
        'apps/app2/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
      expect(tree.read('apps/app2/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });

    it('should process both apps and libraries', async () => {
      addProject(tree, 'app1', { root: 'apps/app1' });
      addProject(tree, 'lib1', { root: 'libs/lib1' });
      tree.write(
        'apps/app1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';`
      );
      tree.write(
        'libs/lib1/src/test-setup.ts',
        `import 'jest-preset-angular/setup-jest';`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
      expect(tree.read('libs/lib1/src/test-setup.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

        setupZoneTestEnv();"
      `);
    });
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: Partial<ProjectConfiguration>,
  dependencies: string[] = ['npm:@angular/core', 'npm:jest-preset-angular']
): void {
  const fullConfig: ProjectConfiguration = {
    root: config.root || `apps/${projectName}`,
    ...config,
  };

  projectGraph = {
    dependencies: {
      ...projectGraph.dependencies,
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      ...projectGraph.nodes,
      [projectName]: { data: fullConfig, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, fullConfig);
}
