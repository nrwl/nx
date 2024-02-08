import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

import { Schema } from './schema';
import { applicationGenerator } from './application';
import { join } from 'path';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add a .gitkeep file to the public directory', async () => {
    const name = uniq();
    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.exists(`${name}/public/.gitkeep`)).toBe(true);
  });

  it('should update tags and implicit dependencies', async () => {
    const name = uniq();
    await applicationGenerator(tree, {
      name,
      style: 'css',
      tags: 'one,two',
      projectNameAndRootFormat: 'as-provided',
    });

    const projects = Object.fromEntries(getProjects(tree));

    expect(projects).toMatchObject({
      [`${name}`]: {
        tags: ['one', 'two'],
      },
      [`${name}-e2e`]: {
        tags: [],
        implicitDependencies: [name],
      },
    });
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    const name = uniq();
    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    const tsConfig = readJson(tree, `${name}/tsconfig.json`);
    expect(tsConfig.extends).toBe('../tsconfig.json');
  });

  describe('App Router', () => {
    it('should generate files for app layout', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'css',
        projectNameAndRootFormat: 'as-provided',
      });

      const tsConfig = readJson(tree, `${name}/tsconfig.json`);
      expect(tsConfig.include).toEqual([
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        `../${name}/.next/types/**/*.ts`,
        `../dist/${name}/.next/types/**/*.ts`,
        'next-env.d.ts',
      ]);
      expect(tree.exists(`${name}/src/pages/styles.css`)).toBeFalsy();
      expect(tree.exists(`${name}/src/app/global.css`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/page.tsx`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/layout.tsx`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/api/hello/route.ts`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/page.module.css`)).toBeTruthy();
      expect(tree.exists(`${name}/public/favicon.ico`)).toBeTruthy();
    });

    it('should add layout types correctly for standalone apps', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'css',
        appDir: true,
        rootProject: true,
        projectNameAndRootFormat: 'as-provided',
      });

      const tsConfig = readJson(tree, 'tsconfig.json');
      expect(tsConfig.include).toEqual([
        'src/**/*.ts',
        'src/**/*.tsx',
        'src/**/*.js',
        'src/**/*.jsx',
        '.next/types/**/*.ts',
        `dist/${name}/.next/types/**/*.ts`,
        'next-env.d.ts',
      ]);
    });

    it('should generate an unstyled component page', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'none',
        appDir: true,
        rootProject: true,
        projectNameAndRootFormat: 'as-provided',
      });

      const content = tree.read('src/app/page.tsx').toString();

      expect(content).not.toContain('import styles from');
      expect(content).not.toContain('const StyledPage');
      expect(content).not.toContain('className={styles.page}');
    });
  });

  describe('Pages Router', () => {
    it('should generate files for pages layout', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'css',
        appDir: false,
        src: false,
        projectNameAndRootFormat: 'as-provided',
      });
      expect(tree.exists(`${name}/tsconfig.json`)).toBeTruthy();
      expect(tree.exists(`${name}/pages/index.tsx`)).toBeTruthy();
      expect(tree.exists(`${name}/specs/index.spec.tsx`)).toBeTruthy();
      expect(tree.exists(`${name}/pages/index.module.css`)).toBeTruthy();
    });

    it('should update configurations', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'css',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(readProjectConfiguration(tree, name).root).toEqual(name);
      expect(readProjectConfiguration(tree, `${name}-e2e`).root).toEqual(
        `${name}-e2e`
      );
    });

    it('should generate an unstyled component page', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'none',
        appDir: false,
        src: false,
        projectNameAndRootFormat: 'as-provided',
      });

      const content = tree.read(`${name}/pages/index.tsx`).toString();

      expect(content).not.toContain('import styles from');
      expect(content).not.toContain('const StyledPage');
      expect(content).not.toContain('className={styles.page}');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'scss',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists(`${name}/src/app/page.module.scss`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/global.css`)).toBeTruthy();

      const indexContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');
      expect(indexContent).toContain(`import styles from './page.module.scss'`);
      expect(tree.read(`${name}/src/app/layout.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';

        export const metadata = {
          title: 'Welcome to ${name}',
          description: 'Generated by create-nx-workspace',
        };

        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html lang="en">
              <body>{children}</body>
            </html>
          );
        }
        "
      `);
    });
  });

  describe('--style less', () => {
    it('should generate less styles', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'less',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists(`${name}/src/app/page.module.less`)).toBeTruthy();
      expect(tree.exists(`${name}/src/app/global.less`)).toBeTruthy();

      const indexContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');
      expect(indexContent).toContain(`import styles from './page.module.less'`);
      expect(tree.read(`${name}/src/app/layout.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.less';

        export const metadata = {
          title: 'Welcome to ${name}',
          description: 'Generated by create-nx-workspace',
        };

        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html lang="en">
              <body>{children}</body>
            </html>
          );
        }
        "
      `);
    });
  });

  describe('--style styled-components', () => {
    it('should generate styled-components styles', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'styled-components',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(
        tree.exists(`${name}/src/app/page.module.styled-components`)
      ).toBeFalsy();
      expect(tree.exists(`${name}/src/app/global.css`)).toBeTruthy();

      const indexContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');
      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);
      expect(tree.read(`${name}/src/app/layout.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';
        import { StyledComponentsRegistry } from './registry';

        export const metadata = {
          title: 'Welcome to demo2',
          description: 'Generated by create-nx-workspace',
        };

        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html lang="en">
              <body>
                <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
              </body>
            </html>
          );
        }
        "
      `);
      expect(tree.read(`${name}/src/app/registry.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "'use client';

        import React, { useState } from 'react';
        import { useServerInsertedHTML } from 'next/navigation';
        import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

        export function StyledComponentsRegistry({
          children,
        }: {
          children: React.ReactNode;
        }) {
          // Only create stylesheet once with lazy initial state
          // x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
          const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

          useServerInsertedHTML(() => {
            const styles = styledComponentsStyleSheet.getStyleElement();

            // Types are out of date, clearTag is not defined.
            // See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/65021
            (styledComponentsStyleSheet.instance as any).clearTag();

            return <>{styles}</>;
          });

          if (typeof window !== 'undefined') return <>{children}</>;

          return (
            <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
              {children}
            </StyleSheetManager>
          );
        }
        "
      `);
    });
  });

  describe('--style @emotion/styled', () => {
    it('should generate  @emotion/styled styles', async () => {
      const name = uniq();

      await applicationGenerator(tree, {
        name,
        style: '@emotion/styled',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(
        tree.exists(`${name}/src/app/page.module.styled-components`)
      ).toBeFalsy();
      expect(tree.exists(`${name}/src/app/global.css`)).toBeTruthy();

      const indexContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');
      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);
      expect(tree.read(`${name}/src/app/layout.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';

        export const metadata = {
          title: 'Welcome to ${name}',
          description: 'Generated by create-nx-workspace',
        };

        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html lang="en">
              <body>{children}</body>
            </html>
          );
        }
        "
      `);
    });

    it('should add jsxImportSource in tsconfig.json', async () => {
      const name = uniq();

      await applicationGenerator(tree, {
        name,
        style: '@emotion/styled',
        projectNameAndRootFormat: 'as-provided',
      });

      const tsconfigJson = readJson(tree, `${name}/tsconfig.json`);

      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });
  });

  describe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      const name = 'my-app';

      await applicationGenerator(tree, {
        name,
        style: 'styled-jsx',
        projectNameAndRootFormat: 'as-provided',
      });

      const indexContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');

      expect(indexContent).toMatchSnapshot();
      expect(tree.exists(`${name}/src/app/page.module.styled-jsx`)).toBeFalsy();
      expect(tree.exists(`${name}/src/app/global.css`)).toBeTruthy();

      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).not.toContain(
        `import styled from 'styled-components'`
      );
      expect(tree.read(`${name}/src/app/layout.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';
        import { StyledJsxRegistry } from './registry';

        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html>
              <body>
                <StyledJsxRegistry>{children}</StyledJsxRegistry>
              </body>
            </html>
          );
        }
        "
      `);
      expect(tree.read(`${name}/src/app/registry.tsx`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "'use client';

        import React, { useState } from 'react';
        import { useServerInsertedHTML } from 'next/navigation';
        import { StyleRegistry, createStyleRegistry } from 'styled-jsx';

        export function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
          // Only create stylesheet once with lazy initial state
          // x-ref: https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
          const [jsxStyleRegistry] = useState(() => createStyleRegistry());

          useServerInsertedHTML(() => {
            const styles = jsxStyleRegistry.styles();
            jsxStyleRegistry.flush();
            return <>{styles}</>;
          });

          return <StyleRegistry registry={jsxStyleRegistry}>{children}</StyleRegistry>;
        }
        "
      `);
    });
  });

  it('should setup jest with tsx support', async () => {
    const name = uniq();

    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.read(`${name}/jest.config.ts`, 'utf-8')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    const name = uniq();

    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.read(`${name}/jest.config.ts`, 'utf-8')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest'`
    );
  });

  it('should set up the nx next build builder', async () => {
    const name = uniq();

    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.read(join(name, 'next.config.js'), 'utf-8'))
      .toMatchInlineSnapshot(`
      "//@ts-check

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { composePlugins, withNx } = require('@nx/next');

      /**
       * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
       **/
      const nextConfig = {
        nx: {
          // Set this to true if you would like to use SVGR
          // See: https://github.com/gregberge/svgr
          svgr: false,
        },
      };

      const plugins = [
        // Add more Next.js plugins to this list if needed.
        withNx,
      ];

      module.exports = composePlugins(...plugins)(nextConfig);
      "
    `);
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const name = uniq();
      await applicationGenerator(tree, {
        name,
        style: 'css',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(tree.exists(`${name}/specs/index.spec.tsx`)).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const name = uniq();

      await applicationGenerator(tree, {
        name,
        style: 'css',
        e2eTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
      });
      expect(tree.exists(`${name}-e2e`)).toBeFalsy();
    });
  });

  it('should generate functional components by default', async () => {
    const name = uniq();

    await applicationGenerator(tree, {
      name,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });

    const appContent = tree.read(`${name}/src/app/page.tsx`, 'utf-8');

    expect(appContent).not.toMatch(/extends Component/);
  });

  describe('--linter', () => {
    describe('default (eslint)', () => {
      it('should add .eslintrc.json and dependencies', async () => {
        const name = uniq();

        await applicationGenerator(tree, {
          name,
          style: 'css',
          projectNameAndRootFormat: 'as-provided',
        });

        const packageJson = readJson(tree, '/package.json');
        expect(packageJson).toMatchObject({
          devDependencies: {
            'eslint-plugin-react': expect.anything(),
            'eslint-plugin-react-hooks': expect.anything(),
          },
        });

        const eslintJson = readJson(tree, `${name}/.eslintrc.json`);
        expect(eslintJson).toMatchInlineSnapshot(`
          {
            "extends": [
              "plugin:@nx/react-typescript",
              "next",
              "next/core-web-vitals",
              "../.eslintrc.json",
            ],
            "ignorePatterns": [
              "!**/*",
              ".next/**/*",
            ],
            "overrides": [
              {
                "files": [
                  "*.ts",
                  "*.tsx",
                  "*.js",
                  "*.jsx",
                ],
                "rules": {
                  "@next/next/no-html-link-for-pages": [
                    "error",
                    "${name}/pages",
                  ],
                },
              },
              {
                "files": [
                  "*.ts",
                  "*.tsx",
                ],
                "rules": {},
              },
              {
                "files": [
                  "*.js",
                  "*.jsx",
                ],
                "rules": {},
              },
              {
                "env": {
                  "jest": true,
                },
                "files": [
                  "*.spec.ts",
                  "*.spec.tsx",
                  "*.spec.js",
                  "*.spec.jsx",
                ],
              },
            ],
          }
        `);
      });
    });

    describe('root level', () => {
      it('should adjust eslint config for root level projects', async () => {
        const name = uniq();

        await applicationGenerator(tree, {
          name,
          style: 'css',
          appDir: true,
          rootProject: true,
          projectNameAndRootFormat: 'as-provided',
        });

        const eslintJSON = readJson(tree, '.eslintrc.json');

        expect(eslintJSON.extends).toMatchInlineSnapshot(
          {},
          `
          [
            "plugin:@nx/react-typescript",
            "next",
            "next/core-web-vitals",
          ]
        `
        );
      });

      it('should scope tsconfig to the src/ project directory', async () => {
        const name = uniq();

        await applicationGenerator(tree, {
          name,
          style: 'css',
          appDir: true,
          rootProject: true,
          projectNameAndRootFormat: 'as-provided',
          src: true,
        });

        const tsconfigJSON = readJson(tree, `tsconfig.json`);

        expect(tsconfigJSON.include).toEqual([
          'src/**/*.ts',
          'src/**/*.tsx',
          'src/**/*.js',
          'src/**/*.jsx',
          '.next/types/**/*.ts',
          `dist/${name}/.next/types/**/*.ts`,
          'next-env.d.ts',
        ]);
      });

      it('should scope tsconfig to the app/ project directory', async () => {
        const name = uniq();

        await applicationGenerator(tree, {
          name,
          style: 'css',
          appDir: true,
          rootProject: true,
          projectNameAndRootFormat: 'as-provided',
          src: false,
        });

        const tsconfigJSON = readJson(tree, `tsconfig.json`);

        expect(tsconfigJSON.include).toEqual([
          'app/**/*.ts',
          'app/**/*.tsx',
          'app/**/*.js',
          'app/**/*.jsx',
          '.next/types/**/*.ts',
          `dist/${name}/.next/types/**/*.ts`,
          'next-env.d.ts',
        ]);
      });

      it('should scope tsconfig to the pages/ project directory', async () => {
        const name = uniq();

        await applicationGenerator(tree, {
          name,
          style: 'css',
          appDir: false,
          rootProject: true,
          projectNameAndRootFormat: 'as-provided',
          src: false,
        });

        const tsconfigJSON = readJson(tree, `tsconfig.json`);
        expect(tsconfigJSON.include).toEqual([
          'pages/**/*.ts',
          'pages/**/*.tsx',
          'pages/**/*.js',
          'pages/**/*.jsx',
          'next-env.d.ts',
        ]);
      });
    });
  });

  describe('--js', () => {
    it('generates JS files', async () => {
      const name = uniq();

      await applicationGenerator(tree, {
        name,
        style: 'css',
        js: true,
      });

      expect(tree.exists(`${name}/src/app/page.js`)).toBeTruthy();
      expect(tree.exists(`${name}/specs/index.spec.js`)).toBeTruthy();
      expect(tree.exists(`${name}/index.d.js`)).toBeFalsy();
      expect(tree.exists(`${name}/index.d.ts`)).toBeFalsy();

      const tsConfig = readJson(tree, `${name}/tsconfig.json`);
      expect(tsConfig.compilerOptions.allowJs).toEqual(true);

      const tsConfigApp = readJson(tree, `${name}/tsconfig.json`);
      expect(tsConfigApp.include).toContain('**/*.js');
      expect(tsConfigApp.exclude).not.toContain('**/*.spec.js');
    });
  });
});

describe('app (legacy)', () => {
  let tree: Tree;
  let originalEnv;

  const schema: Schema = {
    name: 'app',
    appDir: true,
    unitTestRunner: 'jest',
    style: 'css',
    e2eTestRunner: 'cypress',
    projectNameAndRootFormat: 'as-provided',
  };

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
    originalEnv = process.env['NX_ADD_PLUGINS'];
    process.env['NX_ADD_PLUGINS'] = 'false';
  });

  afterAll(() => {
    if (originalEnv) {
      process.env['NX_ADD_PLUGINS'] = originalEnv;
    } else {
      delete process.env['NX_ADD_PLUGINS'];
    }
  });

  it('should generate build serve and export targets', async () => {
    const name = uniq();

    await applicationGenerator(tree, {
      ...schema,
      name,
    });

    const projectConfiguration = readProjectConfiguration(tree, name);
    expect(projectConfiguration.targets.build).toBeDefined();
    expect(projectConfiguration.targets.serve).toBeDefined();
    expect(projectConfiguration.targets.export).toBeDefined();
  });
});

function uniq() {
  return `str-${(Math.random() * 10000).toFixed(0)}`;
}
