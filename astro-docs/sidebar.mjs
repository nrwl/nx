/**
 * @type {import('@astrojs/starlight/types').StarlightUserConfig['sidebar']}
 **/
export const sidebar = [
  {
    label: 'Getting Started',
    collapsed: false,
    autogenerate: { directory: 'getting-started', collapsed: true },
  },
  {
    label: 'Features',
    collapsed: false,
    autogenerate: { directory: 'features', collapsed: true },
  },
  {
    label: 'Guides',
    collapsed: true,
    autogenerate: { directory: 'guides', collapsed: true },
  },
  {
    label: 'Concepts',
    collapsed: true,
    autogenerate: { directory: 'concepts', collapsed: true },
  },
  {
    label: 'Technologies',
    items: [
      {
        label: 'TypeScript',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/typescript/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'Switch to Workspaces and TS Project References',
                link: 'technologies/typescript/recipes/switch-to-workspaces-project-references',
              },
              {
                label: 'Enable Typescript Batch Mode',
                link: 'technologies/typescript/recipes/enable-tsc-batch-mode',
              },
              {
                label: 'Define Secondary Entrypoints for Typescript Packages',
                link: 'technologies/typescript/recipes/define-secondary-entrypoints',
              },
              {
                label: 'Compile Typescript Packages to Multiple Formats',
                link: 'technologies/typescript/recipes/compile-multiple-formats',
              },
              {
                label: 'Use JavaScript instead TypeScript',
                link: 'technologies/typescript/recipes/js-and-ts',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'executors',
                collapsed: true,
                items: [
                  {
                    label: 'copy-workspace-modules',
                    link: 'technologies/typescript/api/executors/copy-workspace-modules',
                  },
                  {
                    label: 'tsc',
                    link: 'technologies/typescript/api/executors/tsc',
                  },
                  {
                    label: 'swc',
                    link: 'technologies/typescript/api/executors/swc',
                  },
                  {
                    label: 'node',
                    link: 'technologies/typescript/api/executors/node',
                  },
                  {
                    label: 'prune-lockfile',
                    link: 'technologies/typescript/api/executors/prune-lockfile',
                  },
                  {
                    label: 'release-publish',
                    link: 'technologies/typescript/api/executors/release-publish',
                  },
                  {
                    label: 'verdaccio',
                    link: 'technologies/typescript/api/executors/verdaccio',
                  },
                ],
              },
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'library',
                    link: 'technologies/typescript/api/generators/library',
                  },
                  {
                    label: 'init',
                    link: 'technologies/typescript/api/generators/init',
                  },
                  {
                    label: 'convert-to-swc',
                    link: 'technologies/typescript/api/generators/convert-to-swc',
                  },
                  {
                    label: 'release-version',
                    link: 'technologies/typescript/api/generators/release-version',
                  },
                  {
                    label: 'setup-verdaccio',
                    link: 'technologies/typescript/api/generators/setup-verdaccio',
                  },
                  {
                    label: 'setup-build',
                    link: 'technologies/typescript/api/generators/setup-build',
                  },
                  {
                    label: 'typescript-sync',
                    link: 'technologies/typescript/api/generators/typescript-sync',
                  },
                  {
                    label: 'setup-prettier',
                    link: 'technologies/typescript/api/generators/setup-prettier',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/typescript/api/migrations',
              },
            ],
          },
        ],
      },
      {
        label: 'Angular',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/angular/introduction',
          },
          {
            label: 'Migration',
            collapsed: true,
            items: [
              {
                label: 'Migrating from Angular CLI',
                link: 'technologies/angular/migration/angular',
              },
              {
                label: 'Migrating From Multiple Angular CLI Repos',
                link: 'technologies/angular/migration/angular-multiple',
              },
            ],
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'Use Environment Variables in Angular',
                link: 'technologies/angular/recipes/use-environment-variables-in-angular',
              },
              {
                label: 'Using Tailwind CSS with Angular projects',
                link: 'technologies/angular/recipes/using-tailwind-css-with-angular-projects',
              },
              {
                label: 'Setup Module Federation with SSR for Angular',
                link: 'technologies/angular/recipes/module-federation-with-ssr',
              },
              {
                label:
                  'Advanced Micro Frontends with Angular using Dynamic Federation',
                link: 'technologies/angular/recipes/dynamic-module-federation-with-angular',
              },
              {
                label: 'Setup incremental builds for Angular applications',
                link: 'technologies/angular/recipes/setup-incremental-builds-angular',
              },
              {
                label: 'Nx and the Angular CLI',
                link: 'technologies/angular/recipes/nx-and-angular',
              },
              {
                label: 'Nx Devkit and Angular Devkit',
                link: 'technologies/angular/recipes/nx-devkit-angular-devkit',
              },
              {
                label: 'Angular and Nx Version Matrix',
                link: 'technologies/angular/recipes/angular-nx-version-matrix',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'executors',
                collapsed: true,
                items: [
                  {
                    label: 'delegate-build',
                    link: 'technologies/angular/api/executors/delegate-build',
                  },
                  {
                    label: 'ng-packagr-lite',
                    link: 'technologies/angular/api/executors/ng-packagr-lite',
                  },
                  {
                    label: 'package',
                    link: 'technologies/angular/api/executors/package',
                  },
                  {
                    label: 'browser-esbuild',
                    link: 'technologies/angular/api/executors/browser-esbuild',
                  },
                  {
                    label: 'module-federation-dev-server',
                    link: 'technologies/angular/api/executors/module-federation-dev-server',
                  },
                  {
                    label: 'module-federation-dev-ssr',
                    link: 'technologies/angular/api/executors/module-federation-dev-ssr',
                  },
                  {
                    label: 'application',
                    link: 'technologies/angular/api/executors/application',
                  },
                  {
                    label: 'extract-i18n',
                    link: 'technologies/angular/api/executors/extract-i18n',
                  },
                  {
                    label: 'webpack-browser',
                    link: 'technologies/angular/api/executors/webpack-browser',
                  },
                  {
                    label: 'dev-server',
                    link: 'technologies/angular/api/executors/dev-server',
                  },
                  {
                    label: 'webpack-server',
                    link: 'technologies/angular/api/executors/webpack-server',
                  },
                ],
              },
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'add-linting',
                    link: 'technologies/angular/api/generators/add-linting',
                  },
                  {
                    label: 'application',
                    link: 'technologies/angular/api/generators/application',
                  },
                  {
                    label: 'component',
                    link: 'technologies/angular/api/generators/component',
                  },
                  {
                    label: 'component-story',
                    link: 'technologies/angular/api/generators/component-story',
                  },
                  {
                    label: 'component-test',
                    link: 'technologies/angular/api/generators/component-test',
                  },
                  {
                    label: 'convert-to-application-executor',
                    link: 'technologies/angular/api/generators/convert-to-application-executor',
                  },
                  {
                    label: 'convert-to-rspack',
                    link: 'technologies/angular/api/generators/convert-to-rspack',
                  },
                  {
                    label: 'directive',
                    link: 'technologies/angular/api/generators/directive',
                  },
                  {
                    label: 'federate-module',
                    link: 'technologies/angular/api/generators/federate-module',
                  },
                  {
                    label: 'init',
                    link: 'technologies/angular/api/generators/init',
                  },
                  {
                    label: 'library',
                    link: 'technologies/angular/api/generators/library',
                  },
                  {
                    label: 'library-secondary-entry-point',
                    link: 'technologies/angular/api/generators/library-secondary-entry-point',
                  },
                  {
                    label: 'remote',
                    link: 'technologies/angular/api/generators/remote',
                  },
                  {
                    label: 'move',
                    link: 'technologies/angular/api/generators/move',
                  },
                  {
                    label: 'convert-to-with-mf',
                    link: 'technologies/angular/api/generators/convert-to-with-mf',
                  },
                  {
                    label: 'host',
                    link: 'technologies/angular/api/generators/host',
                  },
                  {
                    label: 'ng-add',
                    link: 'technologies/angular/api/generators/ng-add',
                  },
                  {
                    label: 'ngrx',
                    link: 'technologies/angular/api/generators/ngrx',
                  },
                  {
                    label: 'ngrx-feature-store',
                    link: 'technologies/angular/api/generators/ngrx-feature-store',
                  },
                  {
                    label: 'ngrx-root-store',
                    link: 'technologies/angular/api/generators/ngrx-root-store',
                  },
                  {
                    label: 'pipe',
                    link: 'technologies/angular/api/generators/pipe',
                  },
                  {
                    label: 'scam-to-standalone',
                    link: 'technologies/angular/api/generators/scam-to-standalone',
                  },
                  {
                    label: 'scam',
                    link: 'technologies/angular/api/generators/scam',
                  },
                  {
                    label: 'scam-directive',
                    link: 'technologies/angular/api/generators/scam-directive',
                  },
                  {
                    label: 'scam-pipe',
                    link: 'technologies/angular/api/generators/scam-pipe',
                  },
                  {
                    label: 'setup-mf',
                    link: 'technologies/angular/api/generators/setup-mf',
                  },
                  {
                    label: 'setup-ssr',
                    link: 'technologies/angular/api/generators/setup-ssr',
                  },
                  {
                    label: 'setup-tailwind',
                    link: 'technologies/angular/api/generators/setup-tailwind',
                  },
                  {
                    label: 'stories',
                    link: 'technologies/angular/api/generators/stories',
                  },
                  {
                    label: 'storybook-configuration',
                    link: 'technologies/angular/api/generators/storybook-configuration',
                  },
                  {
                    label: 'cypress-component-configuration',
                    link: 'technologies/angular/api/generators/cypress-component-configuration',
                  },
                  {
                    label: 'web-worker',
                    link: 'technologies/angular/api/generators/web-worker',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/angular/api/migrations',
              },
            ],
          },
          {
            label: 'Angular Rspack',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/angular/angular-rspack/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'Getting Started with Angular and Rspack',
                    link: 'technologies/angular/angular-rspack/recipes/getting-started',
                  },
                  {
                    label: 'Migrate from Angular Webpack',
                    link: 'technologies/angular/angular-rspack/recipes/migrate-from-webpack',
                  },
                  {
                    label: 'Handling Configurations',
                    link: 'technologies/angular/angular-rspack/recipes/handling-configurations',
                  },
                  {
                    label: 'Internationalization (i18n)',
                    link: 'technologies/angular/angular-rspack/recipes/internationalization',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'Create Config',
                    link: 'technologies/angular/angular-rspack/api/create-config',
                  },
                  {
                    label: 'Create Server',
                    link: 'technologies/angular/angular-rspack/api/create-server',
                  },
                ],
              },
            ],
          },
          {
            label: 'Angular Rsbuild',
            collapsed: true,
            items: [
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'Create Config',
                    link: 'technologies/angular/angular-rsbuild/api/create-config',
                  },
                  {
                    label: 'Create Server',
                    link: 'technologies/angular/angular-rsbuild/api/create-server',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'React',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/react/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'React Native with Nx',
                link: 'technologies/react/recipes/react-native',
              },
              {
                label: 'Remix with Nx',
                link: 'technologies/react/recipes/remix',
              },
              {
                label: 'React Router with Nx',
                link: 'technologies/react/recipes/react-router',
              },
              {
                label: 'Use Environment Variables in React',
                link: 'technologies/react/recipes/use-environment-variables-in-react',
              },
              {
                label: 'Using Tailwind CSS in React',
                link: 'technologies/react/recipes/using-tailwind-css-in-react',
              },
              {
                label: 'Adding Images, Fonts, and Files',
                link: 'technologies/react/recipes/adding-assets-react',
              },
              {
                label: 'Setup Module Federation with SSR for React',
                link: 'technologies/react/recipes/module-federation-with-ssr',
              },
              {
                label: 'Deploying Next.js applications to Vercel',
                link: 'technologies/react/recipes/deploy-nextjs-to-vercel',
              },
              {
                label: 'React Compiler with Nx',
                link: 'technologies/react/recipes/react-compiler',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'executors',
                collapsed: true,
                items: [
                  {
                    label: 'module-federation-dev-server',
                    link: 'technologies/react/api/executors/module-federation-dev-server',
                  },
                  {
                    label: 'module-federation-ssr-dev-server',
                    link: 'technologies/react/api/executors/module-federation-ssr-dev-server',
                  },
                  {
                    label: 'module-federation-static-server',
                    link: 'technologies/react/api/executors/module-federation-static-server',
                  },
                ],
              },
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'init',
                    link: 'technologies/react/api/generators/init',
                  },
                  {
                    label: 'application',
                    link: 'technologies/react/api/generators/application',
                  },
                  {
                    label: 'library',
                    link: 'technologies/react/api/generators/library',
                  },
                  {
                    label: 'component',
                    link: 'technologies/react/api/generators/component',
                  },
                  {
                    label: 'redux',
                    link: 'technologies/react/api/generators/redux',
                  },
                  {
                    label: 'storybook-configuration',
                    link: 'technologies/react/api/generators/storybook-configuration',
                  },
                  {
                    label: 'component-story',
                    link: 'technologies/react/api/generators/component-story',
                  },
                  {
                    label: 'stories',
                    link: 'technologies/react/api/generators/stories',
                  },
                  {
                    label: 'hook',
                    link: 'technologies/react/api/generators/hook',
                  },
                  {
                    label: 'host',
                    link: 'technologies/react/api/generators/host',
                  },
                  {
                    label: 'remote',
                    link: 'technologies/react/api/generators/remote',
                  },
                  {
                    label: 'cypress-component-configuration',
                    link: 'technologies/react/api/generators/cypress-component-configuration',
                  },
                  {
                    label: 'component-test',
                    link: 'technologies/react/api/generators/component-test',
                  },
                  {
                    label: 'setup-tailwind',
                    link: 'technologies/react/api/generators/setup-tailwind',
                  },
                  {
                    label: 'setup-ssr',
                    link: 'technologies/react/api/generators/setup-ssr',
                  },
                  {
                    label: 'federate-module',
                    link: 'technologies/react/api/generators/federate-module',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/react/api/migrations',
              },
            ],
          },
          {
            label: 'Next',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/react/next/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'How to configure Next.js plugins',
                    link: 'technologies/react/next/recipes/next-config-setup',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'build',
                        link: 'technologies/react/next/api/executors/build',
                      },
                      {
                        label: 'server',
                        link: 'technologies/react/next/api/executors/server',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/react/next/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/react/next/api/generators/application',
                      },
                      {
                        label: 'page',
                        link: 'technologies/react/next/api/generators/page',
                      },
                      {
                        label: 'component',
                        link: 'technologies/react/next/api/generators/component',
                      },
                      {
                        label: 'library',
                        link: 'technologies/react/next/api/generators/library',
                      },
                      {
                        label: 'custom-server',
                        link: 'technologies/react/next/api/generators/custom-server',
                      },
                      {
                        label: 'cypress-component-configuration',
                        link: 'technologies/react/next/api/generators/cypress-component-configuration',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/react/next/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/react/next/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Remix',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/react/remix/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/react/remix/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'serve',
                        link: 'technologies/react/remix/api/executors/serve',
                      },
                      {
                        label: 'build',
                        link: 'technologies/react/remix/api/executors/build',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'preset',
                        link: 'technologies/react/remix/api/generators/preset',
                      },
                      {
                        label: 'setup',
                        link: 'technologies/react/remix/api/generators/setup',
                      },
                      {
                        label: 'application',
                        link: 'technologies/react/remix/api/generators/application',
                      },
                      {
                        label: 'cypress-component-configuration',
                        link: 'technologies/react/remix/api/generators/cypress-component-configuration',
                      },
                      {
                        label: 'library',
                        link: 'technologies/react/remix/api/generators/library',
                      },
                      {
                        label: 'init',
                        link: 'technologies/react/remix/api/generators/init',
                      },
                      {
                        label: 'route',
                        link: 'technologies/react/remix/api/generators/route',
                      },
                      {
                        label: 'resource-route',
                        link: 'technologies/react/remix/api/generators/resource-route',
                      },
                      {
                        label: 'action',
                        link: 'technologies/react/remix/api/generators/action',
                      },
                      {
                        label: 'loader',
                        link: 'technologies/react/remix/api/generators/loader',
                      },
                      {
                        label: 'style',
                        link: 'technologies/react/remix/api/generators/style',
                      },
                      {
                        label: 'setup-tailwind',
                        link: 'technologies/react/remix/api/generators/setup-tailwind',
                      },
                      {
                        label: 'storybook-configuration',
                        link: 'technologies/react/remix/api/generators/storybook-configuration',
                      },
                      {
                        label: 'meta',
                        link: 'technologies/react/remix/api/generators/meta',
                      },
                      {
                        label: 'error-boundary',
                        link: 'technologies/react/remix/api/generators/error-boundary',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/react/remix/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/react/remix/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'React Native',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/react/react-native/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/react/react-native/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'run-android',
                        link: 'technologies/react/react-native/api/executors/run-android',
                      },
                      {
                        label: 'run-ios',
                        link: 'technologies/react/react-native/api/executors/run-ios',
                      },
                      {
                        label: 'bundle',
                        link: 'technologies/react/react-native/api/executors/bundle',
                      },
                      {
                        label: 'build-android',
                        link: 'technologies/react/react-native/api/executors/build-android',
                      },
                      {
                        label: 'build-ios',
                        link: 'technologies/react/react-native/api/executors/build-ios',
                      },
                      {
                        label: 'start',
                        link: 'technologies/react/react-native/api/executors/start',
                      },
                      {
                        label: 'sync-deps',
                        link: 'technologies/react/react-native/api/executors/sync-deps',
                      },
                      {
                        label: 'ensure-symlink',
                        link: 'technologies/react/react-native/api/executors/ensure-symlink',
                      },
                      {
                        label: 'storybook',
                        link: 'technologies/react/react-native/api/executors/storybook',
                      },
                      {
                        label: 'pod-install',
                        link: 'technologies/react/react-native/api/executors/pod-install',
                      },
                      {
                        label: 'upgrade',
                        link: 'technologies/react/react-native/api/executors/upgrade',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/react/react-native/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/react/react-native/api/generators/application',
                      },
                      {
                        label: 'library',
                        link: 'technologies/react/react-native/api/generators/library',
                      },
                      {
                        label: 'component',
                        link: 'technologies/react/react-native/api/generators/component',
                      },
                      {
                        label: 'upgrade-native',
                        link: 'technologies/react/react-native/api/generators/upgrade-native',
                      },
                      {
                        label: 'web-configuration',
                        link: 'technologies/react/react-native/api/generators/web-configuration',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/react/react-native/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/react/react-native/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Expo',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/react/expo/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/react/expo/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'update',
                        link: 'technologies/react/expo/api/executors/update',
                      },
                      {
                        label: 'build',
                        link: 'technologies/react/expo/api/executors/build',
                      },
                      {
                        label: 'build-list',
                        link: 'technologies/react/expo/api/executors/build-list',
                      },
                      {
                        label: 'run',
                        link: 'technologies/react/expo/api/executors/run',
                      },
                      {
                        label: 'start',
                        link: 'technologies/react/expo/api/executors/start',
                      },
                      {
                        label: 'sync-deps',
                        link: 'technologies/react/expo/api/executors/sync-deps',
                      },
                      {
                        label: 'ensure-symlink',
                        link: 'technologies/react/expo/api/executors/ensure-symlink',
                      },
                      {
                        label: 'prebuild',
                        link: 'technologies/react/expo/api/executors/prebuild',
                      },
                      {
                        label: 'install',
                        link: 'technologies/react/expo/api/executors/install',
                      },
                      {
                        label: 'export',
                        link: 'technologies/react/expo/api/executors/export',
                      },
                      {
                        label: 'submit',
                        link: 'technologies/react/expo/api/executors/submit',
                      },
                      {
                        label: 'serve',
                        link: 'technologies/react/expo/api/executors/serve',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/react/expo/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/react/expo/api/generators/application',
                      },
                      {
                        label: 'library',
                        link: 'technologies/react/expo/api/generators/library',
                      },
                      {
                        label: 'component',
                        link: 'technologies/react/expo/api/generators/component',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/react/expo/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/react/expo/api/migrations',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'Vue',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/vue/introduction',
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'init',
                    link: 'technologies/vue/api/generators/init',
                  },
                  {
                    label: 'application',
                    link: 'technologies/vue/api/generators/application',
                  },
                  {
                    label: 'library',
                    link: 'technologies/vue/api/generators/library',
                  },
                  {
                    label: 'component',
                    link: 'technologies/vue/api/generators/component',
                  },
                  {
                    label: 'setup-tailwind',
                    link: 'technologies/vue/api/generators/setup-tailwind',
                  },
                  {
                    label: 'storybook-configuration',
                    link: 'technologies/vue/api/generators/storybook-configuration',
                  },
                  {
                    label: 'stories',
                    link: 'technologies/vue/api/generators/stories',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/vue/api/migrations',
              },
            ],
          },
          {
            label: 'Nuxt',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/vue/nuxt/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'Deploying Nuxt applications to Vercel',
                    link: 'technologies/vue/nuxt/recipes/deploy-nuxt-to-vercel',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/vue/nuxt/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/vue/nuxt/api/generators/application',
                      },
                      {
                        label: 'storybook-configuration',
                        link: 'technologies/vue/nuxt/api/generators/storybook-configuration',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/vue/nuxt/api/migrations',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'Node.js',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/node/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'Deploying a Node App to Fly.io',
                link: 'technologies/node/recipes/node-server-fly-io',
              },
              {
                label: 'Add and Deploy Netlify Edge Functions with Node',
                link: 'technologies/node/recipes/node-serverless-functions-netlify',
              },
              {
                label: 'Deploying AWS lambda in Node.js (deprecated)',
                link: 'technologies/node/recipes/node-aws-lambda',
              },
              {
                label: 'Set Up Application Proxies',
                link: 'technologies/node/recipes/application-proxies',
              },
              {
                label: 'Wait for Tasks to Finish',
                link: 'technologies/node/recipes/wait-for-tasks',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'init',
                    link: 'technologies/node/api/generators/init',
                  },
                  {
                    label: 'application',
                    link: 'technologies/node/api/generators/application',
                  },
                  {
                    label: 'library',
                    link: 'technologies/node/api/generators/library',
                  },
                  {
                    label: 'setup-docker',
                    link: 'technologies/node/api/generators/setup-docker',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/node/api/migrations',
              },
            ],
          },
          {
            label: 'Express',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/node/express/introduction',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/node/express/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/node/express/api/generators/application',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: 'Nest',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/node/nest/introduction',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'application',
                        link: 'technologies/node/nest/api/generators/application',
                      },
                      {
                        label: 'init',
                        link: 'technologies/node/nest/api/generators/init',
                      },
                      {
                        label: 'library',
                        link: 'technologies/node/nest/api/generators/library',
                      },
                      {
                        label: 'class',
                        link: 'technologies/node/nest/api/generators/class',
                      },
                      {
                        label: 'controller',
                        link: 'technologies/node/nest/api/generators/controller',
                      },
                      {
                        label: 'decorator',
                        link: 'technologies/node/nest/api/generators/decorator',
                      },
                      {
                        label: 'filter',
                        link: 'technologies/node/nest/api/generators/filter',
                      },
                      {
                        label: 'gateway',
                        link: 'technologies/node/nest/api/generators/gateway',
                      },
                      {
                        label: 'guard',
                        link: 'technologies/node/nest/api/generators/guard',
                      },
                      {
                        label: 'interceptor',
                        link: 'technologies/node/nest/api/generators/interceptor',
                      },
                      {
                        label: 'interface',
                        link: 'technologies/node/nest/api/generators/interface',
                      },
                      {
                        label: 'middleware',
                        link: 'technologies/node/nest/api/generators/middleware',
                      },
                      {
                        label: 'module',
                        link: 'technologies/node/nest/api/generators/module',
                      },
                      {
                        label: 'pipe',
                        link: 'technologies/node/nest/api/generators/pipe',
                      },
                      {
                        label: 'provider',
                        link: 'technologies/node/nest/api/generators/provider',
                      },
                      {
                        label: 'resolver',
                        link: 'technologies/node/nest/api/generators/resolver',
                      },
                      {
                        label: 'resource',
                        link: 'technologies/node/nest/api/generators/resource',
                      },
                      {
                        label: 'service',
                        link: 'technologies/node/nest/api/generators/service',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/node/nest/api/migrations',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'Java',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/java/introduction',
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'executors',
                collapsed: true,
                items: [
                  {
                    label: 'gradle',
                    link: 'technologies/java/api/executors/gradle',
                  },
                ],
              },
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'init',
                    link: 'technologies/java/api/generators/init',
                  },
                  {
                    label: 'ci-workflow',
                    link: 'technologies/java/api/generators/ci-workflow',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/java/api/migrations',
              },
            ],
          },
        ],
      },
      {
        label: 'Module Federation',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/module-federation/introduction',
          },
          {
            label: 'Concepts',
            collapsed: true,
            items: [
              {
                label: 'Module Federation and Nx',
                link: 'technologies/module-federation/concepts/module-federation-and-nx',
              },
              {
                label: 'Nx Module Federation Technical Overview',
                link: 'technologies/module-federation/concepts/nx-module-federation-technical-overview',
              },
              {
                label: 'Faster Builds with Module Federation',
                link: 'technologies/module-federation/concepts/faster-builds-with-module-federation',
              },
              {
                label: 'Micro Frontend Architecture',
                link: 'technologies/module-federation/concepts/micro-frontend-architecture',
              },
              {
                label: 'Manage Library Versions with Module Federation',
                link: 'technologies/module-federation/concepts/manage-library-versions-with-module-federation',
              },
            ],
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'How to create a Module Federation Host Application',
                link: 'technologies/module-federation/recipes/create-a-host',
              },
              {
                label: 'How to create a Module Federation Remote Application',
                link: 'technologies/module-federation/recipes/create-a-remote',
              },
              {
                label: 'How to Federate a Module',
                link: 'technologies/module-federation/recipes/federate-a-module',
              },
              {
                label: 'NxModuleFederationPlugin',
                link: 'technologies/module-federation/recipes/nx-module-federation-plugin',
              },
              {
                label: 'NxModuleFederationDevServerPlugin',
                link: 'technologies/module-federation/recipes/nx-module-federation-dev-server-plugin',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'migrations',
                link: 'technologies/module-federation/api/migrations',
              },
            ],
          },
        ],
      },
      {
        label: 'ESLint',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/eslint/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            items: [
              {
                label: 'Configuring ESLint with Typescript',
                link: 'technologies/eslint/recipes/eslint',
              },
              {
                label: "Switching to ESLint's flat config format",
                link: 'technologies/eslint/recipes/flat-config',
              },
            ],
          },
          {
            label: 'API',
            collapsed: true,
            items: [
              {
                label: 'executors',
                collapsed: true,
                items: [
                  {
                    label: 'lint',
                    link: 'technologies/eslint/api/executors/lint',
                  },
                ],
              },
              {
                label: 'generators',
                collapsed: true,
                items: [
                  {
                    label: 'init',
                    link: 'technologies/eslint/api/generators/init',
                  },
                  {
                    label: 'workspace-rules-project',
                    link: 'technologies/eslint/api/generators/workspace-rules-project',
                  },
                  {
                    label: 'workspace-rule',
                    link: 'technologies/eslint/api/generators/workspace-rule',
                  },
                  {
                    label: 'convert-to-flat-config',
                    link: 'technologies/eslint/api/generators/convert-to-flat-config',
                  },
                  {
                    label: 'convert-to-inferred',
                    link: 'technologies/eslint/api/generators/convert-to-inferred',
                  },
                ],
              },
              {
                label: 'migrations',
                link: 'technologies/eslint/api/migrations',
              },
            ],
          },
          {
            label: 'ESLint Plugin',
            collapsed: true,
            items: [
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'The enforce-module-boundaries rule',
                    link: 'technologies/eslint/eslint-plugin/recipes/enforce-module-boundaries',
                  },
                  {
                    label: 'The dependency-checks rule',
                    link: 'technologies/eslint/eslint-plugin/recipes/dependency-checks',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'migrations',
                    link: 'technologies/eslint/eslint-plugin/api/migrations',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'Build Tools',
        collapsed: true,
        items: [
          {
            label: 'Webpack',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/webpack/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'How to configure Webpack in your Nx workspace',
                    link: 'technologies/build-tools/webpack/recipes/webpack-config-setup',
                  },
                  {
                    label: 'Webpack plugins',
                    link: 'technologies/build-tools/webpack/recipes/webpack-plugins',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'webpack',
                        link: 'technologies/build-tools/webpack/api/executors/webpack',
                      },
                      {
                        label: 'dev-server',
                        link: 'technologies/build-tools/webpack/api/executors/dev-server',
                      },
                      {
                        label: 'ssr-dev-server',
                        link: 'technologies/build-tools/webpack/api/executors/ssr-dev-server',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/build-tools/webpack/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/webpack/api/generators/configuration',
                      },
                      {
                        label: 'convert-config-to-webpack-plugin',
                        link: 'technologies/build-tools/webpack/api/generators/convert-config-to-webpack-plugin',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/build-tools/webpack/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/build-tools/webpack/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Vite',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/vite/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'Configure Vite on your Nx workspace',
                    link: 'technologies/build-tools/vite/recipes/configure-vite',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'dev-server',
                        link: 'technologies/build-tools/vite/api/executors/dev-server',
                      },
                      {
                        label: 'build',
                        link: 'technologies/build-tools/vite/api/executors/build',
                      },
                      {
                        label: 'test',
                        link: 'technologies/build-tools/vite/api/executors/test',
                      },
                      {
                        label: 'preview-server',
                        link: 'technologies/build-tools/vite/api/executors/preview-server',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/build-tools/vite/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/vite/api/generators/configuration',
                      },
                      {
                        label: 'setup-paths-plugin',
                        link: 'technologies/build-tools/vite/api/generators/setup-paths-plugin',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/build-tools/vite/api/generators/convert-to-inferred',
                      },
                      {
                        label: 'vitest',
                        link: 'technologies/build-tools/vite/api/generators/vitest',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/build-tools/vite/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Rollup',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/rollup/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/build-tools/rollup/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'rollup',
                        link: 'technologies/build-tools/rollup/api/executors/rollup',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/build-tools/rollup/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/rollup/api/generators/configuration',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/build-tools/rollup/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/build-tools/rollup/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'ESBuild',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/esbuild/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/build-tools/esbuild/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'esbuild',
                        link: 'technologies/build-tools/esbuild/api/executors/esbuild',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/build-tools/esbuild/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/esbuild/api/generators/configuration',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: 'Rspack',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/rspack/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/build-tools/rspack/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'rspack',
                        link: 'technologies/build-tools/rspack/api/executors/rspack',
                      },
                      {
                        label: 'dev-server',
                        link: 'technologies/build-tools/rspack/api/executors/dev-server',
                      },
                      {
                        label: 'ssr-dev-server',
                        link: 'technologies/build-tools/rspack/api/executors/ssr-dev-server',
                      },
                      {
                        label: 'module-federation-dev-server',
                        link: 'technologies/build-tools/rspack/api/executors/module-federation-dev-server',
                      },
                      {
                        label: 'module-federation-ssr-dev-server',
                        link: 'technologies/build-tools/rspack/api/executors/module-federation-ssr-dev-server',
                      },
                      {
                        label: 'module-federation-static-server',
                        link: 'technologies/build-tools/rspack/api/executors/module-federation-static-server',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/rspack/api/generators/configuration',
                      },
                      {
                        label: 'init',
                        link: 'technologies/build-tools/rspack/api/generators/init',
                      },
                      {
                        label: 'preset',
                        link: 'technologies/build-tools/rspack/api/generators/preset',
                      },
                      {
                        label: 'application',
                        link: 'technologies/build-tools/rspack/api/generators/application',
                      },
                      {
                        label: 'convert-webpack',
                        link: 'technologies/build-tools/rspack/api/generators/convert-webpack',
                      },
                      {
                        label: 'convert-config-to-rspack-plugin',
                        link: 'technologies/build-tools/rspack/api/generators/convert-config-to-rspack-plugin',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/build-tools/rspack/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/build-tools/rspack/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Rsbuild',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/build-tools/rsbuild/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/build-tools/rsbuild/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/build-tools/rsbuild/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/build-tools/rsbuild/api/generators/configuration',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: 'Test Tools',
        collapsed: true,
        items: [
          {
            label: 'Cypress',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/test-tools/cypress/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label: 'Component Testing',
                    link: 'technologies/test-tools/cypress/recipes/cypress-component-testing',
                  },
                  {
                    label: 'Using setupNodeEvents with Cypress preset',
                    link: 'technologies/test-tools/cypress/recipes/cypress-setup-node-events',
                  },
                  {
                    label: 'Cypress v11 Migration Guide',
                    link: 'technologies/test-tools/cypress/recipes/cypress-v11-migration',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'cypress',
                        link: 'technologies/test-tools/cypress/api/executors/cypress',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/test-tools/cypress/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/test-tools/cypress/api/generators/configuration',
                      },
                      {
                        label: 'component-configuration',
                        link: 'technologies/test-tools/cypress/api/generators/component-configuration',
                      },
                      {
                        label: 'migrate-to-cypress-11',
                        link: 'technologies/test-tools/cypress/api/generators/migrate-to-cypress-11',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/test-tools/cypress/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/test-tools/cypress/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Jest',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/test-tools/jest/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/test-tools/jest/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'jest',
                        link: 'technologies/test-tools/jest/api/executors/jest',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/test-tools/jest/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/test-tools/jest/api/generators/configuration',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/test-tools/jest/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/test-tools/jest/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Playwright',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/test-tools/playwright/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/test-tools/playwright/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'playwright',
                        link: 'technologies/test-tools/playwright/api/executors/playwright',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'configuration',
                        link: 'technologies/test-tools/playwright/api/generators/configuration',
                      },
                      {
                        label: 'init',
                        link: 'technologies/test-tools/playwright/api/generators/init',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/test-tools/playwright/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/test-tools/playwright/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Storybook',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/test-tools/storybook/introduction',
              },
              {
                label: 'Guides',
                collapsed: true,
                items: [
                  {
                    label:
                      'Storybook best practices for making the most out of Nx',
                    link: 'technologies/test-tools/storybook/recipes/best-practices',
                  },
                  {
                    label: 'Storybook 9',
                    link: 'technologies/test-tools/storybook/recipes/storybook-9-setup',
                  },
                  {
                    label: 'Set up Storybook for React Projects',
                    link: 'technologies/test-tools/storybook/recipes/overview-react',
                  },
                  {
                    label: 'Set up Storybook for Angular Projects',
                    link: 'technologies/test-tools/storybook/recipes/overview-angular',
                  },
                  {
                    label: 'Set up Storybook for Vue Projects',
                    link: 'technologies/test-tools/storybook/recipes/overview-vue',
                  },
                  {
                    label: 'Configuring Storybook on Nx',
                    link: 'technologies/test-tools/storybook/recipes/configuring-storybook',
                  },
                  {
                    label: 'One main Storybook instance for all projects',
                    link: 'technologies/test-tools/storybook/recipes/one-storybook-for-all',
                  },
                  {
                    label: 'One Storybook instance per scope',
                    link: 'technologies/test-tools/storybook/recipes/one-storybook-per-scope',
                  },
                  {
                    label:
                      'One main Storybook instance using Storybook Composition',
                    link: 'technologies/test-tools/storybook/recipes/one-storybook-with-composition',
                  },
                  {
                    label: 'How to configure Webpack and Vite for Storybook',
                    link: 'technologies/test-tools/storybook/recipes/custom-builder-configs',
                  },
                  {
                    label: 'Setting up Storybook Interaction Tests with Nx',
                    link: 'technologies/test-tools/storybook/recipes/storybook-interaction-tests',
                  },
                  {
                    label: 'Upgrading Storybook using the Storybook CLI',
                    link: 'technologies/test-tools/storybook/recipes/upgrading-storybook',
                  },
                  {
                    label: 'Setting up Storybook Composition with Nx',
                    link: 'technologies/test-tools/storybook/recipes/storybook-composition-setup',
                  },
                  {
                    label: 'Angular: Set up Compodoc for Storybook on Nx',
                    link: 'technologies/test-tools/storybook/recipes/angular-storybook-compodoc',
                  },
                  {
                    label:
                      'Angular: Configuring styles and preprocessor options',
                    link: 'technologies/test-tools/storybook/recipes/angular-configuring-styles',
                  },
                ],
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'storybook',
                        link: 'technologies/test-tools/storybook/api/executors/storybook',
                      },
                      {
                        label: 'build',
                        link: 'technologies/test-tools/storybook/api/executors/build',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/test-tools/storybook/api/generators/init',
                      },
                      {
                        label: 'configuration',
                        link: 'technologies/test-tools/storybook/api/generators/configuration',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/test-tools/storybook/api/generators/convert-to-inferred',
                      },
                      {
                        label: 'migrate-8',
                        link: 'technologies/test-tools/storybook/api/generators/migrate-8',
                      },
                      {
                        label: 'migrate-9',
                        link: 'technologies/test-tools/storybook/api/generators/migrate-9',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/test-tools/storybook/api/migrations',
                  },
                ],
              },
            ],
          },
          {
            label: 'Detox',
            collapsed: true,
            items: [
              {
                label: 'Introduction',
                link: 'technologies/test-tools/detox/introduction',
              },
              {
                label: 'Guides',
                link: 'technologies/test-tools/detox/recipes',
              },
              {
                label: 'API',
                collapsed: true,
                items: [
                  {
                    label: 'executors',
                    collapsed: true,
                    items: [
                      {
                        label: 'build',
                        link: 'technologies/test-tools/detox/api/executors/build',
                      },
                      {
                        label: 'test',
                        link: 'technologies/test-tools/detox/api/executors/test',
                      },
                    ],
                  },
                  {
                    label: 'generators',
                    collapsed: true,
                    items: [
                      {
                        label: 'init',
                        link: 'technologies/test-tools/detox/api/generators/init',
                      },
                      {
                        label: 'application',
                        link: 'technologies/test-tools/detox/api/generators/application',
                      },
                      {
                        label: 'convert-to-inferred',
                        link: 'technologies/test-tools/detox/api/generators/convert-to-inferred',
                      },
                    ],
                  },
                  {
                    label: 'migrations',
                    link: 'technologies/test-tools/detox/api/migrations',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: 'Enterprise',
    collapsed: true,
    autogenerate: { directory: 'enterprise', collapsed: true },
  },
  {
    label: 'Reference',
    collapsed: false,
    autogenerate: { directory: 'references', collapsed: true },
    // items: [
    //   {
    //     label: 'Benchmarks',
    //     collapsed: true,
    //     items: [
    //       {
    //         label: 'Typescript Batch Mode Compilation',
    //         link: 'showcase/benchmarks/tsc-batch-mode',
    //       },
    //       {
    //         label: 'Large Repo and Caching',
    //         link: 'showcase/benchmarks/caching',
    //       },
    //       {
    //         label: 'Large Repo and Nx Agents',
    //         link: 'showcase/benchmarks/nx-agents',
    //       },
    //     ],
    //   },
    // ],
  },
  {
    label: 'Troubleshooting',
    collapsed: false,
    autogenerate: { directory: 'troubleshooting', collapsed: true },
  },
];
