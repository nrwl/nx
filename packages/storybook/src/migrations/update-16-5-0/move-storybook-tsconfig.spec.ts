import {
  NxJsonConfiguration,
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as variousProjects from './test-configs/storybook-projects.json';
import moveStorybookTsconfig from './move-storybook-tsconfig';

describe('Ignore @nx/react/plugins/storybook in Storybook eslint plugin', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs = {
        production: ['default'],
      };
      return json;
    });
    setupProjects(tree);
    await moveStorybookTsconfig(tree);
  });

  it('should update projects tsconfig.json', async () => {
    expect(
      tree.read(`apps/webpack-app/tsconfig.json`).toString()
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/vite-app/tsconfig.json`).toString()
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/my/custom/place/nested-app/tsconfig.json`).toString()
    ).toMatchSnapshot();
  });

  it('should update Storybook tsconfig.json', async () => {
    expect(
      tree.read(`apps/webpack-app/tsconfig.storybook.json`).toString()
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/vite-app/tsconfig.storybook.json`).toString()
    ).toMatchSnapshot();
    expect(
      tree
        .read(`apps/my/custom/place/nested-app/tsconfig.storybook.json`)
        .toString()
    ).toMatchSnapshot();
  });

  it('should delete old Storybook tsconfig.json', async () => {
    expect(tree.exists(`apps/vite-app/.storybook/tsconfig.json`)).toBeFalsy();
    expect(
      tree.exists(`apps/webpack-app/.storybook/tsconfig.json`)
    ).toBeFalsy();
    expect(
      tree.exists(`apps/my/custom/place/nested-app/.storybook/tsconfig.json`)
    ).toBeFalsy();
  });

  it('should update nx.json inputs', () => {
    expect(tree.read(`nx.json`).toString()).toMatchSnapshot();
  });
});

function setupProjects(tree: Tree) {
  for (const [name, project] of Object.entries(variousProjects)) {
    addProjectConfiguration(tree, name, project as ProjectConfiguration);
  }
  tree.write(
    `apps/my/custom/place/nested-app/tsconfig.json`,
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: false,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
        types: ['vite/client', 'vitest'],
      },
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
        {
          path: './.storybook/tsconfig.json',
        },
      ],
      extends: '../../../../../tsconfig.base.json',
    })
  );
  tree.write(
    `apps/webpack-app/tsconfig.json`,
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: false,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
      },
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
        {
          path: './.storybook/tsconfig.json',
        },
      ],
      extends: '../../tsconfig.base.json',
    })
  );
  tree.write(
    'apps/vite-app/tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: false,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
        types: ['vite/client', 'vitest'],
      },
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
        {
          path: './.storybook/tsconfig.json',
        },
      ],
      extends: '../../tsconfig.base.json',
    })
  );

  tree.write(
    'apps/my/custom/place/nested-app/.storybook/tsconfig.json',
    JSON.stringify({
      extends: '../tsconfig.json',
      compilerOptions: {
        emitDecoratorMetadata: true,
        outDir: '',
      },
      files: [
        '../../../../../../node_modules/@nx/react/typings/styled-jsx.d.ts',
        '../../../../../../node_modules/@nx/react/typings/cssmodule.d.ts',
        '../../../../../../node_modules/@nx/react/typings/image.d.ts',
      ],
      exclude: [
        '../**/*.spec.ts',
        '../**/*.spec.js',
        '../**/*.spec.tsx',
        '../**/*.spec.jsx',
      ],
      include: [
        '../src/**/*.stories.ts',
        '../src/**/*.stories.js',
        '../src/**/*.stories.jsx',
        '../src/**/*.stories.tsx',
        '../src/**/*.stories.mdx',
        '*.js',
      ],
    })
  );

  tree.write(
    'apps/vite-app/.storybook/tsconfig.json',
    JSON.stringify({
      extends: '../tsconfig.json',
      compilerOptions: {
        emitDecoratorMetadata: true,
        outDir: '',
      },
      files: [
        '../../../node_modules/@nx/react/typings/styled-jsx.d.ts',
        '../../../node_modules/@nx/react/typings/cssmodule.d.ts',
        '../../../node_modules/@nx/react/typings/image.d.ts',
      ],
      exclude: [
        '../**/*.spec.ts',
        '../**/*.spec.js',
        '../**/*.spec.tsx',
        '../**/*.spec.jsx',
      ],
      include: [
        '../src/**/*.stories.ts',
        '../src/**/*.stories.js',
        '../src/**/*.stories.jsx',
        '../src/**/*.stories.tsx',
        '../src/**/*.stories.mdx',
        '*.js',
      ],
    })
  );

  tree.write(
    'apps/webpack-app/.storybook/tsconfig.json',
    JSON.stringify({
      extends: '../tsconfig.json',
      compilerOptions: {
        emitDecoratorMetadata: true,
        outDir: '',
      },
      files: [
        '../../../node_modules/@nx/react/typings/styled-jsx.d.ts',
        '../../../node_modules/@nx/react/typings/cssmodule.d.ts',
        '../../../node_modules/@nx/react/typings/image.d.ts',
      ],
      exclude: [
        '../**/*.spec.ts',
        '../**/*.spec.js',
        '../**/*.spec.tsx',
        '../**/*.spec.jsx',
      ],
      include: [
        '../src/**/*.stories.ts',
        '../src/**/*.stories.js',
        '../src/**/*.stories.jsx',
        '../src/**/*.stories.tsx',
        '../src/**/*.stories.mdx',
        '*.js',
      ],
    })
  );
}
