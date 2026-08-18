import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './add-trust-proxy-headers';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

const TODO_COMMENT =
  '// TODO: This is a security-sensitive option. Remove if not needed. ' +
  'For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers';
const TRUST_PROXY_HEADERS = `trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],`;

describe('add-trust-proxy-headers migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = { nodes: {}, dependencies: {} };
  });

  it('should add trustProxyHeaders to a "AngularNodeAppEngine" with no arguments', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    tree.write(
      'apps/app1/server.ts',
      `import { AngularNodeAppEngine } from '@angular/ssr/node';\nconst angularApp = new AngularNodeAppEngine();\n`
    );

    await migration(tree);

    const content = tree.read('apps/app1/server.ts', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "import { AngularNodeAppEngine } from '@angular/ssr/node';
      const angularApp = new AngularNodeAppEngine({
        // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
        trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
      });
      "
    `);
  });

  it('should add trustProxyHeaders to a "AngularNodeAppEngine" with existing options', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    tree.write(
      'apps/app1/server.ts',
      `import { AngularNodeAppEngine } from '@angular/ssr/node';\n` +
        `const angularApp = new AngularNodeAppEngine({\n  allowedHosts: ['localhost'],\n});\n`
    );

    await migration(tree);

    const content = tree.read('apps/app1/server.ts', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "import { AngularNodeAppEngine } from '@angular/ssr/node';
      const angularApp = new AngularNodeAppEngine({
        // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
        trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
        allowedHosts: ['localhost'],
      });
      "
    `);
  });

  it('should add trustProxyHeaders to a "AngularAppEngine"', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    tree.write(
      'apps/app1/server.ts',
      `import { AngularAppEngine } from '@angular/ssr';\nconst angularApp = new AngularAppEngine();\n`
    );

    await migration(tree);

    const content = tree.read('apps/app1/server.ts', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "import { AngularAppEngine } from '@angular/ssr';
      const angularApp = new AngularAppEngine({
        // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
        trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
      });
      "
    `);
  });

  it('should not modify an engine that already sets trustProxyHeaders', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    const input =
      `import { AngularAppEngine } from '@angular/ssr';\n` +
      `const angularApp = new AngularAppEngine({\n  trustProxyHeaders: true,\n});\n`;
    tree.write('apps/app1/server.ts', input);

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toBe(input);
  });

  it('should be idempotent when the TODO comment is already present', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    const input =
      `import { AngularNodeAppEngine } from '@angular/ssr/node';\n` +
      `const angularApp = new AngularNodeAppEngine({\n  ${TODO_COMMENT}\n  ${TRUST_PROXY_HEADERS}\n});\n`;
    tree.write('apps/app1/server.ts', input);

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toBe(input);
  });

  it('should not modify projects that do not depend on "@angular/ssr"', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, []);
    const input = `const angularApp = new AngularNodeAppEngine();\n`;
    tree.write('apps/app1/server.ts', input);

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toBe(input);
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[]
  ): void {
    projectGraph.nodes[projectName] = {
      data: config,
      name: projectName,
      type: 'app',
    };
    projectGraph.dependencies[projectName] = dependencies.map((d) => ({
      source: projectName,
      target: d,
      type: 'static',
    }));
    addProjectConfiguration(tree, projectName, config);
  }
});
