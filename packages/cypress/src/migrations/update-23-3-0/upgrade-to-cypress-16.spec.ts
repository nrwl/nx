import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';
import migration from './upgrade-to-cypress-16';

const REPLAN_COMMAND = `npx nx migrate @nx/cypress@${nxVersion} --from=@nx/cypress@23.3.0-beta.0`;
const RERUN_COMMAND = `${REPLAN_COMMAND} && npx nx migrate --run-migration=@nx/cypress:upgrade-to-cypress-16`;

const ANGULAR_CT_CONFIG = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`;
const REACT_VITE_CT_CONFIG = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
});
`;
const REACT_WEBPACK_CT_CONFIG = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    justInTimeCompile: false,
  },
});
`;
const REMIX_CT_CONFIG = `const { defineConfig } = require('cypress');
const { nxComponentTestingPreset } = require('@nx/remix/plugins/component-testing');

module.exports = defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`;
const INLINE_VITE_CT_CONFIG = `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: { framework: 'vue', bundler: 'vite' },
    specPattern: 'src/**/*.cy.ts',
  },
});
`;
const E2E_CONFIG = `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src', bundler: 'vite' }),
    experimentalMemoryManagement: true,
  },
});
`;

function addCypressProject(tree: Tree, name: string, config: string): string {
  const root = `apps/${name}`;
  const cypressConfigPath = `${root}/cypress.config.ts`;
  addProjectConfiguration(tree, name, {
    root,
    projectType: 'application',
    targets: {
      'component-test': {
        executor: '@nx/cypress:cypress',
        options: { cypressConfig: cypressConfigPath, testingType: 'component' },
      },
    },
  });
  tree.write(cypressConfigPath, config);
  return cypressConfigPath;
}

let tempFs: TempFs;

function installPackage(name: string, version: string, dir = ''): void {
  tempFs.createFileSync(
    `${dir}node_modules/${name}/package.json`,
    JSON.stringify({ name, version })
  );
}

function declareDevDependencies(
  tree: Tree,
  devDependencies: Record<string, string>
): void {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = { ...json.devDependencies, ...devDependencies };
    return json;
  });
}

function readDevDependencies(tree: Tree): Record<string, string> {
  return readJson(tree, 'package.json').devDependencies;
}

describe('upgrade-to-cypress-16', () => {
  let tree: Tree;

  beforeEach(() => {
    // Vite resolution and package manager detection read the disk.
    tempFs = new TempFs('upgrade-to-cypress-16');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
    declareDevDependencies(tree, { cypress: '^15.20.1' });
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should bump a webpack component testing workspace with a hoisted transitive Vite 7', async () => {
    declareDevDependencies(tree, { '@cypress/webpack-dev-server': '^5.4.1' });
    installPackage('vite', '7.3.2');
    const configPath = addCypressProject(tree, 'ng-app', ANGULAR_CT_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree)).toEqual({
      cypress: '^16.0.0',
      '@cypress/webpack-dev-server': '^6.0.0',
    });
    expect(tree.read(configPath, 'utf-8')).toBe(ANGULAR_CT_CONFIG);
    expect(result.skipAgentic).toBeUndefined();
    expect(result.nextSteps).toEqual([]);
    expect(result.agentContext).toEqual([
      'Bumped `cypress` to `^16.0.0`, `@cypress/webpack-dev-server` to `^6.0.0` in package.json',
    ]);
  });

  it('should bump an e2e-only workspace with a hoisted transitive Vite 7 and run the Cypress 16 rewrites', async () => {
    installPackage('vite', '7.1.0');
    const configPath = addCypressProject(tree, 'app-e2e', E2E_CONFIG);
    tree.write(
      'apps/app-e2e/src/support/commands.ts',
      `Cypress.Commands.overwrite('getCookie', (originalFn, name) => originalFn(name));
`
    );
    tree.write(
      'apps/app-e2e/src/support/component.ts',
      `import { mount } from 'cypress/angular-zoneless';
`
    );

    const result = await migration(tree);

    expect(readDevDependencies(tree)).toEqual({ cypress: '^16.0.0' });
    expect(tree.read(configPath, 'utf-8')).toContain(
      'manageBrowserMemory: true'
    );
    expect(
      tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')
    ).toContain("Cypress.Commands.overwriteQuery('getCookie'");
    expect(tree.read('apps/app-e2e/src/support/component.ts', 'utf-8')).toBe(
      `import { mount } from 'cypress/angular';
`
    );
    expect(result.skipAgentic).toBeUndefined();
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        'Adapt the `Cypress.Commands.overwriteQuery()` callback in apps/app-e2e/src/support/commands.ts'
      ),
    ]);
    expect(result.agentContext).toEqual([
      'Bumped `cypress` to `^16.0.0` in package.json',
      expect.stringContaining(
        'Renamed `Cypress.Commands.overwrite()` to `overwriteQuery()` in apps/app-e2e/src/support/commands.ts'
      ),
    ]);
  });

  it('should bump the vite dev server of a vite component testing workspace on Vite 8', async () => {
    declareDevDependencies(tree, {
      '@cypress/vite-dev-server': '^7.3.4',
      vite: '^8.0.0',
    });
    installPackage('vite', '8.3.0');
    addCypressProject(tree, 'app', REACT_VITE_CT_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree)).toEqual({
      cypress: '^16.0.0',
      '@cypress/vite-dev-server': '^8.0.0',
      vite: '^8.0.0',
    });
    expect(result.skipAgentic).toBeUndefined();
  });

  it('should bump a vite component testing workspace without a resolvable Vite', async () => {
    addCypressProject(tree, 'app', REACT_VITE_CT_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^16.0.0');
    expect(result.skipAgentic).toBeUndefined();
  });

  it.each([
    ['a react preset with the vite bundler', REACT_VITE_CT_CONFIG],
    ['the remix preset', REMIX_CT_CONFIG],
    ['an inline vite devServer', INLINE_VITE_CT_CONFIG],
  ])(
    'should keep Cypress 15 when %s resolves a Vite below 8',
    async (_, config) => {
      declareDevDependencies(tree, { '@cypress/webpack-dev-server': '^5.4.1' });
      installPackage('vite', '7.3.6');
      addCypressProject(tree, 'app', config);
      const e2eConfigPath = addCypressProject(tree, 'app-e2e', E2E_CONFIG);

      const result = await migration(tree);

      expect(readDevDependencies(tree)).toEqual({
        cypress: '^15.20.1',
        '@cypress/webpack-dev-server': '^5.4.1',
      });
      expect(tree.read(e2eConfigPath, 'utf-8')).toBe(E2E_CONFIG);
      expect(result).toEqual({
        skipAgentic: true,
        agentContext: [],
        nextSteps: [
          `Kept Cypress 15: Cypress 16 component testing requires Vite 8 and apps/app/cypress.config.ts resolves Vite 7.3.6. Update \`vite\` to 8 where each listed config resolves it from, and any \`@vitejs/*\` plugin whose peer range excludes Vite 8. Install, then run \`${RERUN_COMMAND}\` to move to Cypress 16.`,
        ],
      });
    }
  );

  it.each([
    [
      'a quoted component key',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  'component': {
    devServer: { framework: 'vue', bundler: 'vite' },
  },
});
`,
    ],
    [
      'a shorthand component property',
      `import { defineConfig } from 'cypress';

const component = {
  devServer: { framework: 'vue', bundler: 'vite' },
};

export default defineConfig({ component });
`,
    ],
    [
      'a component block reached through a spread',
      `import { defineConfig } from 'cypress';

const base = {
  component: {
    devServer: { framework: 'vue', bundler: 'vite' },
  },
};

export default defineConfig({ ...base, video: false });
`,
    ],
    [
      'preset options held in a variable',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

const ctOptions = { bundler: 'vite' };

export default defineConfig({
  component: nxComponentTestingPreset(__filename, ctOptions),
});
`,
    ],
    [
      'a spread without a devServer after the vite devServer',
      `import { defineConfig } from 'cypress';

const extra = { specPattern: 'src/**/*.cy.ts' };

export default defineConfig({
  component: {
    devServer: { framework: 'vue', bundler: 'vite' },
    ...extra,
  },
});
`,
    ],
  ])(
    'should keep Cypress 15 when a vite component testing config with %s resolves a Vite below 8',
    async (_, config) => {
      installPackage('vite', '7.3.6');
      addCypressProject(tree, 'app', config);

      const result = await migration(tree);

      expect(readDevDependencies(tree).cypress).toBe('^15.20.1');
      expect(result.skipAgentic).toBe(true);
      expect(result.nextSteps[0]).toContain(
        'apps/app/cypress.config.ts resolves Vite 7.3.6'
      );
    }
  );

  it.each([
    [
      'a spread that cannot be resolved',
      `import { defineConfig } from 'cypress';
import { base } from './cypress-base';

export default defineConfig({ ...base, video: false });
`,
    ],
    [
      'preset options that cannot be resolved',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { ctOptions } from './ct-options';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, ctOptions),
});
`,
    ],
    [
      'a devServer whose later spread cannot be resolved',
      `import { defineConfig } from 'cypress';
import { overrides } from './overrides';

export default defineConfig({
  component: {
    devServer: { framework: 'react', bundler: 'webpack', ...overrides() },
  },
});
`,
    ],
    [
      'preset options whose later spread cannot be resolved',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { overrides } from './overrides';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, { bundler: 'webpack', ...overrides }),
});
`,
    ],
    [
      'a preset bound through a require property access',
      `const { defineConfig } = require('cypress');
const nxComponentTestingPreset =
  require('@nx/remix/plugins/component-testing').nxComponentTestingPreset;

module.exports = defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`,
    ],
    [
      'a local function named like the preset',
      `import { defineConfig } from 'cypress';

function nxComponentTestingPreset() {
  return { devServer: { framework: 'react', bundler: 'vite' } };
}

export default defineConfig({
  component: nxComponentTestingPreset(),
});
`,
    ],
    [
      'preset arguments passed through a spread',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

const args = [__filename, { bundler: 'vite' }] as const;

export default defineConfig({
  component: nxComponentTestingPreset(...args),
});
`,
    ],
    [
      'a computed component key',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

const key = 'component';

export default defineConfig({
  [key]: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
});
`,
    ],
    [
      'a computed devServer key',
      `import { defineConfig } from 'cypress';

const key = 'devServer';

export default defineConfig({
  component: {
    [key]: { framework: 'vue', bundler: 'vite' },
  },
});
`,
    ],
  ])(
    'should keep Cypress 15 when a config with %s resolves a Vite below 8',
    async (_, config) => {
      installPackage('vite', '7.3.6');
      addCypressProject(tree, 'app', config);

      const result = await migration(tree);

      expect(readDevDependencies(tree).cypress).toBe('^15.20.1');
      expect(result.nextSteps[0]).toContain(
        'its bundler could not be determined statically'
      );
    }
  );

  it('should bump a pnpm catalog entry and keep the catalog reference', async () => {
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    tree.write(
      'pnpm-workspace.yaml',
      `packages:
  - apps/*
catalog:
  cypress: ^15.20.1
`
    );
    declareDevDependencies(tree, { cypress: 'catalog:' });
    const configPath = addCypressProject(tree, 'app-e2e', E2E_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('catalog:');
    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toContain(
      'cypress: ^16.0.0'
    );
    expect(tree.read(configPath, 'utf-8')).toContain(
      'manageBrowserMemory: true'
    );
    expect(result.skipAgentic).toBeUndefined();
  });

  it('should resolve Vite from the project directory before the workspace root', async () => {
    installPackage('vite', '8.3.0');
    installPackage('vite', '7.3.6', 'apps/app/');
    addCypressProject(tree, 'app', INLINE_VITE_CT_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^15.20.1');
    expect(result.skipAgentic).toBe(true);
    expect(result.nextSteps[0]).toContain(
      'apps/app/cypress.config.ts resolves Vite 7.3.6'
    );
  });

  it('should treat a Vite 8 prerelease as below 8', async () => {
    installPackage('vite', '8.0.0-beta.1');
    addCypressProject(tree, 'app', REACT_VITE_CT_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^15.20.1');
    expect(result.skipAgentic).toBe(true);
  });

  it('should ignore a Vite below 8 resolved by webpack component testing and e2e projects', async () => {
    installPackage('vite', '7.3.6');
    addCypressProject(tree, 'ng-app', ANGULAR_CT_CONFIG);
    addCypressProject(tree, 'react-app', REACT_WEBPACK_CT_CONFIG);
    addCypressProject(tree, 'app-e2e', E2E_CONFIG);

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^16.0.0');
    expect(result.skipAgentic).toBeUndefined();
  });

  it('should keep Cypress 15 when a config whose bundler cannot be read resolves a Vite below 8', async () => {
    installPackage('vite', '7.3.6');
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';
import { ctConfig } from './ct-config';

export default defineConfig({ component: ctConfig });
`
    );

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^15.20.1');
    expect(result.skipAgentic).toBe(true);
    expect(result.nextSteps[0]).toContain(
      `${configPath} resolves Vite 7.3.6 and its bundler could not be determined statically`
    );
  });

  it.each<[string, (tree: Tree) => string]>([
    [
      'referenced by an absolute path',
      (tree) => {
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          targets: {
            'component-test': {
              executor: '@nx/cypress:cypress',
              options: {
                cypressConfig: `${tree.root}/apps/app/cypress.ct.config.ts`,
              },
            },
          },
        });
        tree.write('apps/app/cypress.ct.config.ts', INLINE_VITE_CT_CONFIG);
        return 'apps/app/cypress.ct.config.ts resolves Vite 7.3.6';
      },
    ],
    [
      'outside any project',
      (tree) => {
        tree.write('tools/ct/cypress.config.ts', INLINE_VITE_CT_CONFIG);
        return 'tools/ct/cypress.config.ts resolves Vite 7.3.6';
      },
    ],
    [
      'that does not exist',
      (tree) => {
        const configPath = addCypressProject(
          tree,
          'app',
          INLINE_VITE_CT_CONFIG
        );
        tree.delete(configPath);
        return `${configPath} resolves Vite 7.3.6 and its bundler could not be determined statically`;
      },
    ],
  ])(
    'should keep Cypress 15 when a config %s resolves a Vite below 8',
    async (_, setup) => {
      installPackage('vite', '7.3.6');
      const blocker = setup(tree);

      const result = await migration(tree);

      expect(result.nextSteps).toEqual([
        `Kept Cypress 15: Cypress 16 component testing requires Vite 8 and ${blocker}. Update \`vite\` to 8 where each listed config resolves it from, and any \`@vitejs/*\` plugin whose peer range excludes Vite 8. Install, then run \`${RERUN_COMMAND}\` to move to Cypress 16.`,
      ]);
    }
  );

  it('should bump when a config whose bundler cannot be read resolves no Vite', async () => {
    addCypressProject(
      tree,
      'app',
      `import { config } from './cypress-shared';

export default config;
`
    );

    const result = await migration(tree);

    expect(readDevDependencies(tree).cypress).toBe('^16.0.0');
    expect(result.skipAgentic).toBeUndefined();
  });

  it.each(['latest', 'next'])(
    'should bump cypress declared as the %s dist tag',
    async (tag) => {
      declareDevDependencies(tree, { cypress: tag });

      await migration(tree);

      expect(readDevDependencies(tree).cypress).toBe('^16.0.0');
    }
  );

  it.each([
    [
      'not declared in the root package.json',
      undefined,
      false,
      '`cypress` is not declared in the root package.json',
    ],
    [
      'a catalog reference without a catalog manager',
      'catalog:',
      false,
      '`cypress` is declared as `catalog:` in package.json, which this migration cannot bump',
    ],
    [
      'a pnpm catalog reference without a cypress entry',
      'catalog:',
      true,
      '`cypress` is declared as `catalog:` in package.json, which this migration cannot bump',
    ],
  ])(
    'should skip with a message when cypress is %s',
    async (_, cypressRange, pnpm, reason) => {
      if (pnpm) {
        tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
        tree.write('pnpm-workspace.yaml', 'catalog:\n  vite: ^8.0.0\n');
      }
      updateJson(tree, 'package.json', (json) => {
        if (cypressRange) {
          json.devDependencies.cypress = cypressRange;
        } else {
          delete json.devDependencies.cypress;
        }
        return json;
      });
      const configPath = addCypressProject(tree, 'app-e2e', E2E_CONFIG);
      const packageJson = tree.read('package.json', 'utf-8');

      const result = await migration(tree);

      expect(tree.read('package.json', 'utf-8')).toBe(packageJson);
      expect(tree.read(configPath, 'utf-8')).toBe(E2E_CONFIG);
      expect(result.skipAgentic).toBe(true);
      expect(result.nextSteps).toEqual([
        `${reason}. Move it to \`^16.0.0\` by hand, install, and run \`${REPLAN_COMMAND} && npx nx migrate --run-migrations\` to apply the Cypress 16 migrations.`,
      ]);
    }
  );

  it('should be idempotent', async () => {
    addCypressProject(tree, 'app-e2e', E2E_CONFIG);
    await migration(tree);
    const packageJson = tree.read('package.json', 'utf-8');
    const config = tree.read('apps/app-e2e/cypress.config.ts', 'utf-8');

    await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(packageJson);
    expect(tree.read('apps/app-e2e/cypress.config.ts', 'utf-8')).toBe(config);
  });
});
