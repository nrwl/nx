import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './disable-webpack-ct-just-in-time-compile';

function addCypressProject(tree: Tree, name: string, config: string): string {
  const root = `apps/${name}`;
  const cypressConfigPath = `${root}/cypress.config.ts`;
  const project: ProjectConfiguration = {
    root,
    projectType: 'application',
    targets: {
      'component-test': {
        executor: '@nx/cypress:cypress',
        options: { cypressConfig: cypressConfigPath, testingType: 'component' },
      },
    },
  };
  addProjectConfiguration(tree, name, project);
  tree.write(cypressConfigPath, config);
  return cypressConfigPath;
}

function expectValidTypeScript(content: string): void {
  const ts = require('typescript');
  const { diagnostics } = ts.transpileModule(content, {
    reportDiagnostics: true,
    compilerOptions: {},
  });
  expect(diagnostics ?? []).toEqual([]);
}

describe('disable-webpack-ct-just-in-time-compile', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set justInTimeCompile:false for a webpack preset config', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('...nxComponentTestingPreset(__filename)');
    expect(updated).toContain('justInTimeCompile: false');
  });

  it('should set justInTimeCompile:false for an angular preset config', async () => {
    const configPath = addCypressProject(
      tree,
      'ng-app',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toContain(
      'justInTimeCompile: false'
    );
  });

  it('should set justInTimeCompile:false for an inline webpack devServer config', async () => {
    const configPath = addCypressProject(
      tree,
      'inline',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('justInTimeCompile: false');
    expect(updated).toContain("framework: 'react'");
  });

  it('should not touch a vite bundler config', async () => {
    const configPath = addCypressProject(
      tree,
      'vite-app',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
});
`
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).not.toContain('justInTimeCompile');
  });

  it('should not touch a remix (vite) preset config', async () => {
    const configPath = addCypressProject(
      tree,
      'remix-app',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/remix/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).not.toContain('justInTimeCompile');
  });

  it('should not touch a config that already sets justInTimeCompile', async () => {
    const original = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    justInTimeCompile: true,
  },
});
`;
    const configPath = addCypressProject(tree, 'opted-in', original);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(original);
    expect(tree.read(configPath, 'utf-8')).not.toContain(
      'justInTimeCompile: false'
    );
  });

  it('should not touch an e2e-only config', async () => {
    const original = `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`;
    const configPath = addCypressProject(tree, 'e2e-app', original);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(original);
  });

  it('should preserve comments when migrating an inline config', async () => {
    const configPath = addCypressProject(
      tree,
      'commented',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    // keep the viewport small for component tests
    viewportWidth: 500,
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('justInTimeCompile: false');
    expect(updated).toContain('// keep the viewport small for component tests');
    expect(updated).toContain('viewportWidth: 500');
  });

  it('should not touch a component that does not use the preset (stale import)', async () => {
    const original = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    specPattern: 'src/**/*.cy.tsx',
  },
});
`;
    const configPath = addCypressProject(tree, 'stale-custom', original);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(original);
  });

  it('should not corrupt an empty component object with a stale preset import', async () => {
    const original = `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {},
});
`;
    const configPath = addCypressProject(tree, 'stale-empty', original);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(original);
  });

  it('should keep valid syntax when the last property has no trailing comma before a comment', async () => {
    const configPath = addCypressProject(
      tree,
      'trailing-comment',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack'
    }
    // keep the webpack devServer settings above
  },
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('justInTimeCompile: false');
    expect(updated).toContain('// keep the webpack devServer settings above');
    expectValidTypeScript(updated);
  });

  it('should migrate a webpack preset config even when a stale remix preset path appears elsewhere', async () => {
    const configPath = addCypressProject(
      tree,
      'stale-remix',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
// migrated from '@nx/remix/plugins/component-testing'

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('...nxComponentTestingPreset(__filename)');
    expect(updated).toContain('justInTimeCompile: false');
  });

  it('should set justInTimeCompile:false for a CommonJS require-based preset config', async () => {
    const configPath = addCypressProject(
      tree,
      'cjs-app',
      `const { nxComponentTestingPreset } = require('@nx/react/plugins/component-testing');
const { defineConfig } = require('cypress');
module.exports = defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );

    await migration(tree);

    const updated = tree.read(configPath, 'utf-8');
    expect(updated).toContain('...nxComponentTestingPreset(__filename)');
    expect(updated).toContain('justInTimeCompile: false');
  });
});
