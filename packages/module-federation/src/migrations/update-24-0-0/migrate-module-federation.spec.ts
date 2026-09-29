import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateAngularModuleFederation from './migrate-angular-module-federation';
import migrateReactModuleFederation from './migrate-react-module-federation';

describe('update-24-0-0 Module Federation migrations', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      name: 'root',
      devDependencies: { '@nx/module-federation': '23.2.1', nx: '23.2.1' },
    });
  });

  function addProject(root: string, files: Record<string, string>) {
    writeJson(tree, `${root}/project.json`, { name: root.split('/').pop() });
    for (const [file, content] of Object.entries(files)) {
      tree.write(`${root}/${file}`, content);
    }
  }

  it('hands React projects to the prompt, flagging server-side rendering', async () => {
    addProject('apps/shell', {
      'webpack.config.ts': `import { withModuleFederation } from '@nx/module-federation/webpack';`,
      'module-federation.config.ts': `import { ModuleFederationConfig } from '@nx/module-federation';`,
      'src/bootstrap.tsx': `const x = 1;`,
    });
    addProject('apps/ssr-shell', {
      'webpack.server.config.ts': `import { withModuleFederationForSSR } from '@nx/module-federation/webpack';`,
    });

    const result = await migrateReactModuleFederation(tree);

    expect(result).toMatchInlineSnapshot(`
      {
        "agentContext": [
          "React projects that use Nx Module Federation, with the files that reference it:",
          "apps/shell: apps/shell/module-federation.config.ts, apps/shell/webpack.config.ts",
          "apps/ssr-shell (server-side rendering): apps/ssr-shell/webpack.server.config.ts",
        ],
        "nextSteps": [
          "Migrate 2 React project(s) off Nx Module Federation. See https://nx.dev/docs/kb/migrate-from-nx-module-federation",
        ],
      }
    `);
    expect(await migrateAngularModuleFederation(tree)).toEqual({
      skipAgentic: true,
    });
    expect(readJson(tree, 'package.json').devDependencies).toHaveProperty(
      '@nx/module-federation'
    );
  });

  it('detects Angular projects from configs, runtime helpers and executors', async () => {
    addProject('apps/shell', {
      'webpack.config.ts': `import { withModuleFederation } from '@nx/module-federation/angular';`,
      'module-federation.config.ts': `import { ModuleFederationConfig } from '@nx/module-federation';`,
    });
    addProject('apps/dyn-shell', {
      'src/main.ts': `import { setRemoteDefinitions } from '@nx/angular/mf';`,
    });
    writeJson(tree, 'apps/remote/project.json', {
      name: 'remote',
      targets: {
        serve: { executor: '@nx/angular:module-federation-dev-ssr' },
      },
    });

    const result = await migrateAngularModuleFederation(tree);

    expect(result).toMatchInlineSnapshot(`
      {
        "agentContext": [
          "Angular projects that use Nx Module Federation, with the files that reference it:",
          "apps/shell: apps/shell/module-federation.config.ts, apps/shell/webpack.config.ts",
          "apps/dyn-shell: apps/dyn-shell/src/main.ts",
          "apps/remote (server-side rendering): apps/remote/project.json",
        ],
        "nextSteps": [
          "Migrate 3 Angular project(s) off Nx Module Federation. See https://nx.dev/docs/kb/migrate-angular-module-federation",
        ],
      }
    `);
    expect(await migrateReactModuleFederation(tree)).toEqual({
      skipAgentic: true,
    });
  });

  it('lists a project with only shared-entry imports for both prompts', async () => {
    addProject('libs/mf-types', {
      'index.ts': `export type { ModuleFederationConfig } from '@nx/module-federation';`,
    });

    expect(
      (await migrateReactModuleFederation(tree)).agentContext
    ).toContainEqual('libs/mf-types: libs/mf-types/index.ts');
    expect(
      (await migrateAngularModuleFederation(tree)).agentContext
    ).toContainEqual('libs/mf-types: libs/mf-types/index.ts');
  });

  it('removes the unused dependency without an agent', async () => {
    tree.write(
      'package-lock.json',
      JSON.stringify({
        packages: {
          '': { devDependencies: { '@nx/module-federation': '23.2.1' } },
        },
      })
    );

    expect(await migrateReactModuleFederation(tree)).toEqual({
      skipAgentic: true,
    });
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      nx: '23.2.1',
    });
  });
});
