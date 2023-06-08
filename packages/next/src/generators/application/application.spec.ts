import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add a .gitkeep file to the public directory', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
    });

    expect(tree.exists('apps/my-app/public/.gitkeep')).toBe(true);
  });

  it('should update tags and implicit dependencies', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
      tags: 'one,two',
    });

    const projects = Object.fromEntries(getProjects(tree));

    expect(projects).toMatchObject({
      'my-app': {
        tags: ['one', 'two'],
      },
      'my-app-e2e': {
        tags: [],
        implicitDependencies: ['my-app'],
      },
    });
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
    });

    const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
    expect(tsConfig.extends).toBe('../../tsconfig.json');
  });

  describe('App Router', () => {
    it('should generate files for app layout', async () => {
      await applicationGenerator(tree, {
        name: 'testApp',
        style: 'css',
      });

      const tsConfig = readJson(tree, 'apps/test-app/tsconfig.json');
      expect(tsConfig.include).toEqual([
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '../../apps/test-app/.next/types/**/*.ts',
        '../../dist/apps/test-app/.next/types/**/*.ts',
        'next-env.d.ts',
      ]);
      expect(tree.exists('apps/test-app/pages/styles.css')).toBeFalsy();
      expect(tree.exists('apps/test-app/app/global.css')).toBeTruthy();
      expect(tree.exists('apps/test-app/app/page.tsx')).toBeTruthy();
      expect(tree.exists('apps/test-app/app/layout.tsx')).toBeTruthy();
      expect(tree.exists('apps/test-app/app/api/hello/route.ts')).toBeTruthy();
      expect(tree.exists('apps/test-app/app/page.module.css')).toBeTruthy();
      expect(tree.exists('apps/test-app/public/favicon.ico')).toBeTruthy();
    });

    it('should add layout types correctly for standalone apps', async () => {
      await applicationGenerator(tree, {
        name: 'testApp',
        style: 'css',
        appDir: true,
        rootProject: true,
      });

      const tsConfig = readJson(tree, 'tsconfig.json');
      expect(tsConfig.include).toEqual([
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '.next/types/**/*.ts',
        'dist/test-app/.next/types/**/*.ts',
        'next-env.d.ts',
      ]);
    });

    it('should generate an unstyled component page', async () => {
      await applicationGenerator(tree, {
        name: 'testApp',
        style: 'none',
        appDir: true,
        rootProject: true,
      });

      const content = tree.read('app/page.tsx').toString();

      expect(content).not.toContain('import styles from');
      expect(content).not.toContain('const StyledPage');
      expect(content).not.toContain('className={styles.page}');
    });
  });

  describe('Pages Router', () => {
    it('should generate files for pages layout', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        appDir: false,
      });
      expect(tree.exists('apps/my-app/tsconfig.json')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.module.css')).toBeTruthy();
    });

    it('should update configurations', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
      });

      expect(readProjectConfiguration(tree, 'my-app').root).toEqual(
        'apps/my-app'
      );
      expect(readProjectConfiguration(tree, 'my-app-e2e').root).toEqual(
        'apps/my-app-e2e'
      );
    });

    it('should generate an unstyled component page', async () => {
      await applicationGenerator(tree, {
        name: 'testApp',
        style: 'none',
        appDir: false,
      });

      const content = tree.read('apps/test-app/pages/index.tsx').toString();

      expect(content).not.toContain('import styles from');
      expect(content).not.toContain('const StyledPage');
      expect(content).not.toContain('className={styles.page}');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'scss',
      });

      expect(tree.exists('apps/my-app/app/page.module.scss')).toBeTruthy();
      expect(tree.exists('apps/my-app/app/global.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');
      expect(indexContent).toContain(`import styles from './page.module.scss'`);
      expect(tree.read('apps/my-app/app/layout.tsx', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';

        export const metadata = {
          title: 'Welcome to my-app',
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
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'less',
      });

      expect(tree.exists('apps/my-app/app/page.module.less')).toBeTruthy();
      expect(tree.exists('apps/my-app/app/global.less')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');
      expect(indexContent).toContain(`import styles from './page.module.less'`);
      expect(tree.read('apps/my-app/app/layout.tsx', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.less';

        export const metadata = {
          title: 'Welcome to my-app',
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

  describe('--style styl', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styl',
      });

      expect(tree.exists('apps/my-app/app/page.module.styl')).toBeTruthy();
      expect(tree.exists('apps/my-app/app/global.styl')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');
      expect(indexContent).toContain(`import styles from './page.module.styl'`);
    });
  });

  describe('--style styled-components', () => {
    it('should generate styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-components',
      });

      expect(
        tree.exists('apps/my-app/app/page.module.styled-components')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/app/global.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');
      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).toContain(`import styled from 'styled-components'`);
      expect(tree.read('apps/my-app/app/layout.tsx', 'utf-8'))
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
      expect(tree.read('apps/my-app/app/registry.tsx', 'utf-8'))
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
    it('should generate styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: '@emotion/styled',
      });

      expect(
        tree.exists('apps/my-app/app/page.module.styled-components')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/app/global.css')).toBeTruthy();

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');
      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).toContain(`import styled from '@emotion/styled'`);
      expect(tree.read('apps/my-app/app/layout.tsx', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import './global.css';

        export const metadata = {
          title: 'Welcome to my-app',
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
      await applicationGenerator(tree, {
        name: 'myApp',
        style: '@emotion/styled',
      });

      const tsconfigJson = readJson(tree, 'apps/my-app/tsconfig.json');

      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });
  });

  describe('--style styled-jsx', () => {
    it('should use <style jsx> in index page', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'styled-jsx',
      });

      const indexContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');

      expect(indexContent).toMatchSnapshot();
      expect(tree.exists('apps/my-app/app/page.module.styled-jsx')).toBeFalsy();
      expect(tree.exists('apps/my-app/app/global.css')).toBeTruthy();

      expect(indexContent).not.toContain(`import styles from './page.module`);
      expect(indexContent).not.toContain(
        `import styled from 'styled-components'`
      );
      expect(tree.read('apps/my-app/app/layout.tsx', 'utf-8'))
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
      expect(tree.read('apps/my-app/app/registry.tsx', 'utf-8'))
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
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with SVGR support', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    expect(tree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
      `'^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest'`
    );
  });

  it('should set up the nx next build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.build.executor).toEqual(
      '@nx/next:build'
    );
    expect(projectConfiguration.targets.build.options).toEqual({
      outputPath: 'dist/apps/my-app',
    });
  });

  it('should set up the nx next server builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.serve.executor).toEqual(
      '@nx/next:server'
    );
    expect(projectConfiguration.targets.serve.options).toEqual({
      buildTarget: 'my-app:build',
      dev: true,
    });
    expect(projectConfiguration.targets.serve.configurations).toEqual({
      development: {
        buildTarget: 'my-app:build:development',
        dev: true,
      },
      production: { dev: false, buildTarget: 'my-app:build:production' },
    });
  });

  it('should set up the nx next export builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
    });

    const projectConfiguration = readProjectConfiguration(tree, 'my-app');
    expect(projectConfiguration.targets.export.executor).toEqual(
      '@nx/next:export'
    );
    expect(projectConfiguration.targets.export.options).toEqual({
      buildTarget: 'my-app:build:production',
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        unitTestRunner: 'none',
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        e2eTestRunner: 'none',
      });
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(tree, {
      name: 'myApp',
      style: 'css',
    });

    const appContent = tree.read('apps/my-app/app/page.tsx', 'utf-8');

    expect(appContent).not.toMatch(/extends Component/);
  });

  describe('--linter', () => {
    describe('default (eslint)', () => {
      it('should add .eslintrc.json and dependencies', async () => {
        await applicationGenerator(tree, {
          name: 'myApp',
          style: 'css',
        });

        const packageJson = readJson(tree, '/package.json');
        expect(packageJson).toMatchObject({
          devDependencies: {
            'eslint-plugin-react': expect.anything(),
            'eslint-plugin-react-hooks': expect.anything(),
          },
        });

        const eslintJson = readJson(tree, '/apps/my-app/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
          {
            "env": {
              "jest": true,
            },
            "extends": [
              "plugin:@nx/react-typescript",
              "next",
              "next/core-web-vitals",
              "../../.eslintrc.json",
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
                    "apps/my-app/pages",
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
            ],
            "rules": {
              "@next/next/no-html-link-for-pages": "off",
            },
          }
        `);
      });
    });

    describe('root level', () => {
      it('should adjust eslint config for root level projects', async () => {
        await applicationGenerator(tree, {
          name: 'testApp',
          style: 'css',
          appDir: true,
          rootProject: true,
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
    });
  });

  describe('--js', () => {
    it('generates JS files', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'css',
        js: true,
      });

      expect(tree.exists('apps/my-app/app/page.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.js')).toBeTruthy();
      expect(tree.exists('apps/my-app/index.d.js')).toBeFalsy();
      expect(tree.exists('apps/my-app/index.d.ts')).toBeFalsy();

      const tsConfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.compilerOptions.allowJs).toEqual(true);

      const tsConfigApp = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsConfigApp.include).toContain('**/*.js');
      expect(tsConfigApp.exclude).not.toContain('**/*.spec.js');
    });
  });
});
