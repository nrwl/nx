/**
 * Executors & Generators old url schemes to package schema viewer url schemes (added 2022-03-16)
 */
const schemaUrls = {
  '/workspace/library': '/packages/workspace/generators/library',
  '/workspace/npm-package': '/packages/workspace/generators/npm-package',
  '/workspace/move': '/packages/workspace/generators/move',
  '/workspace/remove': '/packages/workspace/generators/remove',
  '/workspace/run-commands-generator':
    '/packages/workspace/generators/run-commands',
  '/workspace/convert-to-nx-project-generator':
    '/packages/workspace/generators/convert-to-nx-project',

  '/workspace/run-commands-executor': '/packages/nx/executors/run-commands',
  '/workspace/run-script': '/packages/nx/executors/run-script',
  '/packages/workspace/executors/run-commands':
    '/packages/nx/executors/run-commands',
  '/packages/workspace/executors/run-script':
    '/packages/nx/executors/run-script',

  '/js/library': '/packages/js/generators/library',
  '/js/convert-to-swc': '/packages/js/generators/convert-to-swc',
  '/js/tsc': '/packages/js/executors/tsc',
  '/js/swc': '/packages/js/executors/swc',
  '/web/application': '/packages/web/generators/application',
  '/web/build': '/packages/web/executors/webpack',
  '/web/dev-server': '/packages/web/executors/dev-server',
  '/web/file-server': '/packages/web/executors/file-server',
  '/web/package': '/packages/web/executors/rollup',
  '/angular/application': '/packages/angular/generators/application',
  '/angular/downgrade-module': '/packages/angular/generators/downgrade-module',
  '/angular/karma': '/packages/angular/generators/karma',
  '/angular/karma-project': '/packages/angular/generators/karma-project',
  '/angular/library': '/packages/angular/generators/library',
  '/angular/library-secondary-entry-point':
    '/packages/angular/generators/library-secondary-entry-point',
  '/angular/mfe-host': '/packages/angular/generators/mf-host',
  '/angular/mfe-remote': '/packages/angular/generators/mf-remote',
  '/packages/angular/generators/mfe-host':
    '/packages/angular/generators/mf-host',
  '/packages/angular/generators/mfe-remote':
    '/packages/angular/generators/mf-remote',
  '/angular/move': '/packages/angular/generators/move',
  '/angular/ngrx': '/packages/angular/generators/ngrx',
  '/angular/scam': '/packages/angular/generators/scam',
  '/angular/scam-directive': '/packages/angular/generators/scam-directive',
  '/angular/scam-pipe': '/packages/angular/generators/scam-pipe',
  '/angular/setup-mfe': '/packages/angular/generators/setup-mf',
  '/packages/angular/generators/setup-mfe':
    '/packages/angular/generators/setup-mf',
  '/angular/setup-tailwind': '/packages/angular/generators/setup-tailwind',
  '/angular/stories': '/packages/angular/generators/stories',
  '/angular/storybook-configuration':
    '/packages/angular/generators/storybook-configuration',
  '/angular/upgrade-module': '/packages/angular/generators/upgrade-module',
  '/angular/web-worker': '/packages/angular/generators/web-worker',
  '/angular/delegate-build': '/packages/angular/executors/delegate-build',
  '/angular/ng-packagr-lite': '/packages/angular/executors/ng-packagr-lite',
  '/angular/package': '/packages/angular/executors/package',
  '/angular/webpack-browser': '/packages/angular/executors/webpack-browser',
  '/angular/webpack-server': '/packages/angular/executors/dev-server',
  '/packages/angular/executors/webpack-server':
    '/packages/angular/executors/dev-server',
  '/angular/webpack-dev-server': '/packages/angular/executors/dev-server',
  '/packages/angular/executors/webpack-dev-server':
    '/packages/angular/executors/dev-server',
  '/react/application': '/packages/react/generators/application',
  '/react/component': '/packages/react/generators/component',
  '/react/component-cypress-spec':
    '/packages/react/generators/component-cypress-spec',
  '/react/component-story': '/packages/react/generators/component-story',
  '/react/library': '/packages/react/generators/library',
  '/react/redux': '/packages/react/generators/redux',
  '/react/stories': '/packages/react/generators/stories',
  '/react/storybook-configuration':
    '/packages/react/generators/storybook-configuration',
  '/react/hook': '/packages/react/generators/hook',
  '/jest/jest': '/packages/jest/executors/jest',
  '/cypress/cypress': '/packages/cypress/executors/cypress',
  '/cypress/cypress-project': '/packages/cypress/generators/cypress-project',
  '/storybook/configuration': '/packages/storybook/generators/configuration',
  '/storybook/cypress-project':
    '/packages/storybook/generators/cypress-project',
  '/storybook/migrate-defaults-5-to-6':
    '/packages/storybook/generators/migrate-defaults-5-to-6',
  '/storybook/migrate-stories-to-6-2':
    '/packages/storybook/generators/migrate-stories-to-6-2',
  '/storybook/executors-build': '/packages/storybook/executors/build',
  '/storybook/executors-storybook': '/packages/storybook/executors/storybook',
  '/storybook/extra-topics-for-angular-projects':
    '/storybook/overview-angular#more-documentation',
  '/linter/eslint': '/packages/eslint/executors/lint',
  '/linter/workspace-rule': '/packages/eslint/generators/workspace-rule',
  '/node/application': '/packages/node/generators/application',
  '/node/library': '/packages/node/generators/library',
  '/node/webpack': '/packages/node/executors/webpack',
  '/node/node': '/packages/node/executors/node',
  '/express/application': '/packages/express/generators/application',
  '/nest/application': '/packages/nest/generators/application',
  '/nest/class': '/packages/nest/generators/class',
  '/nest/controller': '/packages/nest/generators/controller',
  '/nest/decorator': '/packages/nest/generators/decorator',
  '/nest/filter': '/packages/nest/generators/filter',
  '/nest/gateway': '/packages/nest/generators/gateway',
  '/nest/guard': '/packages/nest/generators/guard',
  '/nest/interceptor': '/packages/nest/generators/interceptor',
  '/nest/interface': '/packages/nest/generators/interface',
  '/nest/library': '/packages/nest/generators/library',
  '/nest/middleware': '/packages/nest/generators/middleware',
  '/nest/module': '/packages/nest/generators/module',
  '/nest/pipe': '/packages/nest/generators/pipe',
  '/nest/provider': '/packages/nest/generators/provider',
  '/nest/resolver': '/packages/nest/generators/resolver',
  '/nest/resource': '/packages/nest/generators/resource',
  '/nest/service': '/packages/nest/generators/service',
  '/next/application': '/packages/next/generators/application',
  '/next/component': '/packages/next/generators/component',
  '/next/page': '/packages/next/generators/page',
  '/next/build': '/packages/next/executors/build',
  '/next/server': '/packages/next/executors/server',
  '/next/export': '/packages/next/executors/export',
  '/detox/application': '/packages/detox/generators/application',
  '/detox/build': '/packages/detox/executors/build',
  '/detox/test': '/packages/detox/executors/test',
  '/react-native/application': '/packages/react-native/generators/application',
  '/react-native/component': '/packages/react-native/generators/component',
  '/react-native/library': '/packages/react-native/generators/library',
  '/react-native/component-story':
    '/packages/react-native/generators/component-story',
  '/react-native/stories': '/packages/react-native/generators/stories',
  '/react-native/storybook-configuration':
    '/packages/react-native/generators/storybook-configuration',
  '/react-native/build-android':
    '/packages/react-native/executors/build-android',
  '/react-native/bundle': '/packages/react-native/executors/bundle',
  '/react-native/ensure-symlink':
    '/packages/react-native/executors/ensure-symlink',
  '/react-native/run-android': '/packages/react-native/executors/run-android',
  '/react-native/run-ios': '/packages/react-native/executors/run-ios',
  '/react-native/start': '/packages/react-native/executors/start',
  '/react-native/storybook': '/packages/react-native/executors/storybook',
  '/react-native/sync-deps': '/packages/react-native/executors/sync-deps',
  '/packages/cypress/generators/cypress-e2e-configuration':
    '/packages/cypress/generators/configuration',
  '/packages/cypress/generators/cypress-component-configuration':
    '/packages/cypress/generators/component-configuration',
  '/packages/esbuild/generators/esbuild-project':
    '/packages/esbuild/generators/configuration',
  '/packages/jest/generators/jest-project':
    '/packages/jest/generators/configuration',
  '/packages/nx-plugin/generators/executor':
    '/packages/plugin/generators/executor',
  '/packages/nx-plugin/generators/migration':
    '/packages/plugin/generators/migration',
  '/packages/nx-plugin/generators/plugin': '/packages/plugin/generators/plugin',
  '/packages/nx-plugin/generators/schematic':
    '/packages/plugin/generators/generator',
  '/packages/nx-plugin/generators/e2e': '/packages/plugin/executors/e2e',
  '/packages/rollup/generators/rollup-project':
    '/packages/rollup/generators/configuration',
  '/packages/webpack/generators/webpack-project':
    '/packages/webpack/generators/configuration',
  '/nx-plugin/executor': '/packages/plugin/generators/executor',
  '/nx-plugin/migration': '/packages/plugin/generators/migration',
  '/nx-plugin/plugin': '/packages/plugin/generators/plugin',
  '/nx-plugin/schematic': '/packages/plugin/generators/generator',
  '/nx-plugin/e2e': '/packages/plugin/executors/e2e',
};

/**
 * Guide specific rules (added 2022-01-04)
 */
const guideUrls = {
  '/core-concepts/configuration': '/reference/project-configuration',
  '/core-concepts/mental-model': '/using-nx/mental-model',
  '/core-concepts/updating-nx': '/using-nx/updating-nx',
  '/core-concepts/ci-overview': '/using-nx/ci-overview',
  '/getting-started/nx-cli': '/using-nx/nx-cli',
  '/getting-started/console': '/using-nx/console',
  '/core-extended/affected': '/using-nx/affected',
  '/core-extended/computation-caching': '/using-nx/caching',
  '/guides/nextjs': '/next/overview',
  '/using-nx/nx-devkit': '/extending-nx/nx-devkit',
  '/structure/project-graph-plugins': '/extending-nx/project-graph-plugins',
  '/guides/lerna-and-nx': 'https://lerna.js.org',
  '/migration/lerna-and-nx': 'https://lerna.js.org',
  '/cypress/v10-migration-guide': '/cypress/v11-migration-guide',
  '/cypress/generators/migrate-to-cypress-10':
    '/packages/cypress/generators/migrate-to-cypress-11',
};

/**
 * Diataxis restructure specific rules (added 2022-09-02)
 */
const diataxis = {
  '/getting-started/nx-setup': '/getting-started/intro',
  '/getting-started/nx-core': '/getting-started/core-tutorial',
  '/getting-started/nx-and-typescript': '/getting-started/intro',
  '/getting-started/nx-and-react': '/getting-started/intro',
  '/getting-started/nx-and-angular': '/getting-started/intro',
  '/configuration/packagejson': '/reference/project-configuration',
  '/configuration/projectjson': '/reference/project-configuration',
  '/using-nx/nx-cli': '/getting-started/intro',
  '/using-nx/console': '/getting-started/editor-setup',
  '/features/integrate-with-editors': '/getting-started/editor-setup',
  '/using-nx/mental-model': '/concepts/mental-model',
  '/using-nx/caching': '/concepts/how-caching-works',
  '/using-nx/dte': '/features/distribute-task-execution',
  '/using-nx/affected': '/concepts/affected',
  '/using-nx/ci-overview': '/recipes/ci/ci-setup',
  '/using-nx/updating-nx': '/features/automate-updating-dependencies',
  '/using-nx/nx-nodejs-typescript-version-matrix':
    '/workspace/nx-nodejs-typescript-version-matrix',
  '/extending-nx/nx-devkit': '/extending-nx/intro/getting-started',
  '/extending-nx/project-inference-plugins':
    '/recipes/advanced-plugins/project-inference-plugins',
  '/extending-nx/project-graph-plugins':
    '/recipes/advanced-plugins/project-graph-plugins',
  '/migration/lerna-and-nx': '/recipes/adopting-nx/lerna-and-nx',
  '/migration/adding-to-monorepo': '/recipes/adopting-nx/adding-to-monorepo',
  '/migration/migration-cra': '/recipes/adopting-nx/adding-to-existing-project',
  '/migration/migration-angular': '/recipes/adopting-nx/migration-angular',
  '/migration/migration-angularjs': '/recipes/adopting-nx/migration-angular',
  '/recipes/angular/migration/angularjs':
    '/recipes/adopting-nx/migration-angular',
  '/migration/preserving-git-histories':
    '/recipes/adopting-nx/preserving-git-histories',
  '/migration/manual': '/recipes/adopting-nx/manual',
  '/executors/using-builders': '/concepts/executors-and-configurations',
  '/executors/run-commands-builder': '/recipes/executors/run-commands-executor',
  '/executors/creating-custom-builders':
    '/recipes/executors/creating-custom-executors',
  '/generators/using-generators': '/features/use-code-generators',
  '/generators/workspace-generators':
    '/recipes/generators/workspace-generators',
  '/generators/composing-generators':
    '/recipes/generators/composing-generators',
  '/generators/generator-options': '/recipes/generators/generator-options',
  '/generators/creating-files': '/recipes/generators/creating-files',
  '/generators/modifying-files': '/recipes/generators/modifying-files',
  '/structure/applications-and-libraries':
    'more-concepts/applications-and-libraries',
  '/structure/creating-libraries': '/concepts/more-concepts/creating-libraries',
  '/structure/library-types': '/concepts/more-concepts/library-types',
  '/structure/grouping-libraries': '/concepts/more-concepts/grouping-libraries',
  '/structure/buildable-and-publishable-libraries':
    '/concepts/more-concepts/buildable-and-publishable-libraries',
  '/structure/monorepo-tags': '/features/enforce-module-boundaries',
  '/core-features/enforce-project-boundaries':
    '/features/enforce-module-boundaries',
  '/structure/dependency-graph': '/features/explore-graph',
  '/structure/project-graph-plugins':
    '/recipes/advanced-plugins/project-graph-plugins',
  '/ci/monorepo-ci-azure': '/recipes/ci/monorepo-ci-azure',
  '/ci/monorepo-ci-circle-ci': '/recipes/ci/monorepo-ci-circle-ci',
  '/ci/monorepo-ci-github-actions': '/recipes/ci/monorepo-ci-github-actions',
  '/ci/monorepo-ci-jenkins': '/recipes/ci/monorepo-ci-jenkins',
  '/ci/monorepo-ci-gitlab': '/recipes/ci/monorepo-ci-gitlab',
  '/ci/monorepo-ci-bitbucket-pipelines':
    '/recipes/ci/monorepo-ci-bitbucket-pipelines',
  '/ci/distributed-builds': '/nx-cloud/concepts/parallelization-distribution', // 👀
  '/ci/setup-incremental-builds-angular':
    '/recipes/other/setup-incremental-builds-angular',
  '/guides/turbo-and-nx': '/concepts/more-concepts/turbo-and-nx',
  '/guides/why-monorepos': '/concepts/more-concepts/why-monorepos',
  '/guides/adding-assets-react': '/recipes/other/adding-assets-react',
  '/guides/environment-variables': '/reference/environment-variables',
  '/guides/performance-profiling': '/recipes/other/performance-profiling',
  '/guides/eslint': '/recipes/other/eslint',
  '/guides/customize-webpack': '/recipes/webpack/webpack-config-setup',
  '/guides/nx-daemon': '/concepts/more-concepts/nx-daemon',
  '/guides/js-and-ts': '/recipes/other/js-and-ts',
  '/guides/browser-support': '/recipes/other/browser-support',
  '/guides/react-native': '/recipes/other/react-native',
  '/guides/deploy-nextjs-to-vercel': '/recipes/other/deploy-nextjs-to-vercel',
  '/guides/using-tailwind-css-in-react':
    '/recipes/other/using-tailwind-css-in-react',
  '/guides/react-18': '/recipes/other/react-18',
  '/guides/using-tailwind-css-with-angular-projects':
    '/recipes/other/using-tailwind-css-with-angular-projects',
  '/guides/misc-ngrx': '/recipes/other/misc-ngrx',
  '/guides/misc-data-persistence': '/recipes/other/misc-data-persistence',
  '/guides/nx-devkit-angular-devkit':
    '/concepts/more-concepts/nx-devkit-angular-devkit',
  '/module-federation/faster-builds':
    '/recipes/module-federation/faster-builds',
  '/module-federation/micro-frontend-architecture':
    '/concepts/more-concepts/micro-frontend-architecture',
  '/module-federation/dynamic-module-federation-with-angular':
    '/recipes/module-federation/dynamic-module-federation-with-angular',
  '/examples/nx-examples': '/recipes/other/nx-examples',
  '/examples/react-nx': '/recipes/other/react-nx',
  '/examples/apollo-react': '/recipes/other/apollo-react',
  '/examples/caching': '/recipes/other/caching',
  '/examples/dte': '/recipes/other/dte',
  '/recipe/workspace-generators': '/recipes/generators/local-generators',
  '/recipes/other/customize-webpack': '/recipes/webpack/webpack-config-setup',
};

/**
 * API overview packages
 */
const overviewUrls = {
  '/workspace/nrwl-workspace-overview': '/packages/workspace',
  '/js/overview': '/packages/js',
  '/web/overview': '/packages/web',
  '/angular/overview': '/packages/angular',
  '/react/overview': '/packages/react',
  '/jest/overview': '/packages/jest',
  '/cypress/overview': '/packages/cypress',
  '/linter/overview': '/packages/eslint',
  '/node/overview': '/packages/node',
  '/express/overview': '/packages/express',
  '/nest/overview': '/packages/nest',
  '/next/overview': '/packages/next',
  '/detox/overview': '/packages/detox',
  '/react-native/overview': '/packages/react-native',
  '/nx-plugin/overview': '/packages/plugin',
};

/**
 * API removing CLI and putting the content into Nx
 */
const cliUrls = {
  '/cli/create-nx-workspace': '/nx/create-nx-workspace',
  '/cli/generate': '/nx/generate',
  '/cli/run': '/nx/run',
  '/cli/daemon': '/nx/daemon',
  '/cli/dep-graph': '/nx/dep-graph',
  '/cli/run-many': '/nx/run-many',
  '/cli/affected': '/nx/affected',
  '/cli/format-check': '/nx/format-check',
  '/cli/format-write': '/nx/format-write',
  '/cli/migrate': '/nx/migrate',
  '/cli/report': '/nx/report',
  '/cli/list': '/nx/list',
  '/cli/connect-to-nx-cloud': '/nx/connect-to-nx-cloud',
  '/cli/reset': '/nx/reset',
};
/**
 * Recipes
 */
const recipesUrls = {
  '/recipe/adding-to-monorepo': '/recipes/adopting-nx/adding-to-monorepo',
  '/recipes/other/ban-dependencies-with-tags':
    '/recipes/enforce-module-boundaries/ban-dependencies-with-tags',
  '/recipes/other/tag-multiple-dimensions':
    '/recipes/enforce-module-boundaries/tag-multiple-dimensions',
  '/recipes/other/ban-external-imports':
    '/recipes/enforce-module-boundaries/ban-external-imports',
  '/recipes/other/tags-allow-list':
    '/recipes/enforce-module-boundaries/tags-allow-list',
  '/recipes/other/react-nx': '/showcase/example-repos/react-nx',
  '/recipes/other/apollo-react': '/showcase/example-repos/apollo-react',
  '/recipes/other/caching': '/showcase/example-repos/caching',
  '/recipes/other/dte': '/showcase/example-repos/dte',
  '/recipes/other/deploy-nextjs-to-vercel':
    '/recipes/deployment/deploy-nextjs-to-vercel',
  '/recipes/other/root-level-scripts':
    '/recipes/managing-repository/root-level-scripts',
  '/recipes/other/analyze-source-files':
    '/recipes/managing-repository/analyze-source-files',
  '/recipes/other/workspace-watching':
    '/recipes/managing-repository/workspace-watching',
  '/recipes/other/advanced-update':
    '/recipes/managing-repository/advanced-update',
  '/recipes/other/js-and-ts': '/recipes/managing-repository/js-and-ts',
  '/packages/cypress/documents/cypress-component-testing':
    '/recipes/cypress/cypress-component-testing',
  '/packages/cypress/documents/cypress-v11-migration':
    '/recipes/cypress/cypress-v11-migration',
  '/packages/next/documents/next-config-setup':
    '/recipes/next/next-config-setup',
  '/packages/vite/documents/set-up-vite-manually':
    '/recipes/vite/set-up-vite-manually',
  '/recipes/vite/set-up-vite-manually': '/recipes/vite/configure-vite',
  '/packages/webpack/documents/webpack-plugins':
    '/recipes/webpack/webpack-plugins',
  '/packages/webpack/documents/webpack-config-setup':
    '/recipes/webpack/webpack-config-setup',
  '/showcase/example-repos/add-nuxt': '/nx-api/nuxt',
  '/showcase/example-repos/add-vue': '/nx-api/vue',
  '/recipes/react/react-18': '/nx-api/react',
  '/recipes/nx-console/console-shortcuts': '/getting-started/editor-setup',
  '/recipes/nx-console/console-project-pane': '/getting-started/editor-setup',
  '/recipes/nx-console/console-add-dependency-command':
    '/getting-started/editor-setup',
};

/**
 * Nx Cloud
 */
const nxCloudUrls = {
  '/nx-cloud/set-up/add-nx-cloud': '/ci/features/remote-cache',
  '/nx-cloud/set-up/set-up-caching': '/ci/features/remote-cache',
  '/nx-cloud/set-up/set-up-dte': '/ci/features/distribute-task-execution',
  '/nx-cloud/private-cloud/standalone': '/ci/private-cloud/ami-setup',
  '/nx-cloud/private-cloud/kubernetes-setup':
    '/nx-cloud/private-cloud/get-started',
  '/recipes/ci': '/ci/recipes',
  '/recipes/ci/ci-setup': '/ci/recipes/set-up',
  '/nx-cloud/recipes/set-up/ci-setup': '/ci/recipes/set-up',
  '/recipes/ci/monorepo-ci-azure': '/ci/recipes/set-up/monorepo-ci-azure',
  '/recipes/ci/monorepo-ci-circle-ci':
    '/nx-cloud/recipes/set-up/monorepo-ci-circle-ci',
  '/recipes/ci/monorepo-ci-github-action':
    '/nx-cloud/recipes/set-up/monorepo-ci-github-action',
  '/recipes/ci/monorepo-ci-jenkins':
    '/nx-cloud/recipes/set-up/monorepo-ci-jenkins',
  '/recipes/ci/monorepo-ci-gitlab':
    '/nx-cloud/recipes/set-up/monorepo-ci-gitlab',
  '/recipes/ci/monorepo-ci-bitbucket-pipelines':
    '/nx-cloud/recipes/set-up/monorepo-ci-bitbucket-pipelines',
  '/recipes/ci/ci-deployment': '/ci/recipes/other/ci-deployment',
  '/nx-cloud/intro/what-is-nx-cloud': '/ci/intro/ci-with-nx',
  '/nx-cloud/set-up': '/ci/recipes/set-up',
  '/nx-cloud/set-up/record-commands': '/ci/recipes/other/record-commands',
  '/nx-cloud/set-up/github':
    '/nx-cloud/recipes/source-control-integration/github',
  '/nx-cloud/set-up/bitbucket-cloud':
    '/nx-cloud/recipes/source-control-integration/bitbucket-cloud',
  '/nx-cloud/set-up/gitlab':
    '/nx-cloud/recipes/source-control-integration/gitlab',
  '/core-features/remote-cache': '/ci/features/remote-cache',
  '/core-features/distribute-task-execution':
    '/nx-cloud/features/distribute-task-execution',
  '/concepts/affected': '/ci/features/affected',
  '/nx-cloud/private-cloud': '/ci/recipes/enterprise/on-premise',
  '/nx-cloud/private-cloud/get-started':
    '/ci/recipes/enterprise/on-premise/on-premise',
  '/ci/features/on-premise': '/ci/recipes/enterprise/on-premise/on-premise',
  '/nx-cloud/private-cloud/auth-single-admin':
    '/nx-cloud/recipes/enterprise/on-premise/auth-single-admin',
  '/nx-cloud/private-cloud/auth-github':
    '/nx-cloud/recipes/enterprise/on-premise/auth-github',
  '/nx-cloud/private-cloud/ami-setup':
    '/ci/recipes/enterprise/on-premise/ami-setup',
  '/nx-cloud/private-cloud/auth-gitlab':
    '/nx-cloud/recipes/enterprise/on-premise/auth-gitlab',
  '/nx-cloud/private-cloud/auth-bitbucket':
    '/nx-cloud/recipes/enterprise/on-premise/auth-bitbucket',
  '/nx-cloud/private-cloud/auth-saml':
    '/ci/recipes/enterprise/on-premise/auth-saml',
  '/nx-cloud/private-cloud/auth-saml-managed':
    '/nx-cloud/recipes/enterprise/on-premise/auth-saml-managed',
  '/nx-cloud/private-cloud/advanced-config':
    '/nx-cloud/recipes/enterprise/on-premise/advanced-config',
  '/ci/recipes/on-premise': '/ci/recipes/enterprise/on-premise',
  '/ci/recipes/on-premise/auth-single-admin':
    '/ci/recipes/enterprise/on-premise/auth-single-admin',
  '/ci/recipes/on-premise/auth-github':
    '/ci/recipes/enterprise/on-premise/auth-github',
  '/ci/recipes/on-premise/ami-setup':
    '/ci/recipes/enterprise/on-premise/ami-setup',
  '/ci/recipes/on-premise/auth-gitlab':
    '/ci/recipes/enterprise/on-premise/auth-gitlab',
  '/ci/recipes/on-premise/auth-bitbucket':
    '/ci/recipes/enterprise/on-premise/auth-bitbucket',
  '/ci/recipes/on-premise/auth-saml':
    '/ci/recipes/enterprise/on-premise/auth-saml',
  '/ci/recipes/on-premise/auth-saml-managed':
    '/ci/recipes/enterprise/on-premise/auth-saml-managed',
  '/ci/recipes/on-premise/advanced-config':
    '/ci/recipes/enterprise/on-premise/advanced-config',
  '/concepts/dte': '/ci/concepts/parallelization-distribution',
  '/nx-cloud/concepts/dte': '/ci/concepts/parallelization-distribution',
  '/nx-cloud/intro/nx-cloud-workflows': '/ci/features/nx-cloud-workflows',
  '/nx-cloud/account': '/ci/recipes/security',
  '/nx-cloud/account/google-auth': '/ci/recipes/security/google-auth',
  '/nx-cloud/account/access-tokens': '/ci/recipes/security/access-tokens',
  '/nx-cloud/account/scenarios': '/ci/concepts/cache-security',
  '/nx-cloud/concepts/scenarios': '/ci/concepts/cache-security',
  '/nx-cloud/account/encryption': '/ci/recipes/security/encryption',
  '/nx-cloud/concepts/encryption': '/ci/recipes/security/encryption',
  '/nx-cloud/features/nx-cloud-workflows':
    '/ci/features/distribute-task-execution',
  '/ci/features/nx-agents': '/ci/features/distribute-task-execution',
  '/ci': '/ci/intro/ci-with-nx',
  '/concepts/more-concepts/illustrated-dte':
    '/ci/concepts/parallelization-distribution',
  '/nx-cloud/:path*': '/ci/:path*',
  '/core-features/:path*': '/features/:path*',
  '/ci/recipes/set-up/connect-to-cloud': '/ci/intro/connect-to-cloud',
};

/**
 * Tutorial Updates (updated 2023-01-13)
 */
const tutorialBaseUrls = {
  '/(l|latest)/(a|angular)/tutorial/1-code-generation':
    '/angular-tutorial/1-code-generation',
  '/(l|latest)/(a|node)/tutorial/1-code-generation':
    '/getting-started/tutorials',
  '/(l|latest)/(r|react)/tutorial/1-code-generation':
    '/react-tutorial/1-code-generation',
};
const oldReactTutorialPaths = [
  '/react-tutorial/01-create-application',
  '/react-tutorial/02-add-e2e-test',
  '/react-tutorial/03-display-todos',
  '/react-tutorial/04-connect-to-api',
  '/react-tutorial/05-add-node-app',
  '/react-tutorial/06-proxy',
  '/react-tutorial/07-share-code',
  '/react-tutorial/08-create-libs',
  '/react-tutorial/09-dep-graph',
  '/react-tutorial/10-computation-caching',
  '/react-tutorial/11-test-affected-projects',
  '/react-tutorial/12-summary',
];
const reactRedirectDestination = '/react-tutorial/1-code-generation';
const reactTutorialRedirects = oldReactTutorialPaths.reduce((acc, path) => {
  acc[path] = reactRedirectDestination;
  return acc;
}, {});
const oldNodeTutorialPaths = [
  '/node-tutorial/01-create-application',
  '/node-tutorial/02-display-todos',
  '/node-tutorial/03-share-code',
  '/node-tutorial/04-create-libs',
  '/node-tutorial/05-dep-graph',
  '/node-tutorial/06-computation-caching',
  '/node-tutorial/07-test-affected-projects',
  '/node-tutorial/4-workspace-optimization',
  '/node-tutorial/08-summary',
];

const extraNodeRedirects = {
  '/getting-started/node-tutorial': '/getting-started/tutorials',
  '/node-tutorial/1-code-generation': '/getting-started/tutorials',
  '/node-tutorial/2-project-graph': '/getting-started/tutorials',
  '/node-tutorial/3-task-running': '/getting-started/tutorials',
  '/node-tutorial/4-task-pipelines': '/getting-started/tutorials',
  '/node-tutorial/5-docker-target': '/getting-started/tutorials',
  '/node-tutorial/6-summary': '/getting-started/tutorials',
  '/getting-started/tutorials/node-server-tutorial':
    '/getting-started/tutorials',
};
const nodeRedirectDestination = '/getting-started/tutorials';
const nodeTutorialRedirects = oldNodeTutorialPaths.reduce((acc, path) => {
  acc[path] = nodeRedirectDestination;
  return acc;
}, {});

const tutorialRedirects = Object.assign(
  tutorialBaseUrls,
  reactTutorialRedirects,
  nodeTutorialRedirects,
  extraNodeRedirects
);

const oldAngularTutorialPaths = [
  '/angular-tutorial/01-create-application',
  '/angular-tutorial/02-add-e2e-test',
  '/angular-tutorial/03-display-todos',
  '/angular-tutorial/04-connect-to-api',
  '/angular-tutorial/05-add-node-app',
  '/angular-tutorial/06-proxy',
  '/angular-tutorial/07-share-code',
  '/angular-tutorial/08-create-libs',
  '/angular-tutorial/09-dep-graph',
  '/angular-tutorial/10-computation-caching',
  '/angular-tutorial/11-test-affected-projects',
  '/angular-tutorial/12-summary',
];

const angularRedirectDestination = '/angular-tutorial/1-code-generation';
for (const path of oldAngularTutorialPaths) {
  tutorialRedirects[path] = angularRedirectDestination;
}

/**
 * New single-page standalone tutorials
 */
const standaloneTutorialRedirects = {
  '/showcase/example-repos/react-nx':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial': '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial/1-code-generation':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial/2-project-graph':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial/3-task-running':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial/4-task-pipelines':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-tutorial/5-summary':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/react-standalone-tutorial':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/react-standalone-tutorial/1-code-generation':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/react-standalone-tutorial/2-project-graph':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/react-standalone-tutorial/3-task-running':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/react-standalone-tutorial/4-task-pipelines':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/react-standalone-tutorial/5-summary':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/angular-standalone-tutorial':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/angular-standalone-tutorial/1-code-generation':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/angular-standalone-tutorial/2-project-graph':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/angular-standalone-tutorial/3-task-running':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/angular-standalone-tutorial/4-task-pipelines':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/angular-standalone-tutorial/5-summary':
    '/getting-started/tutorials/angular-standalone-tutorial',
};

const packagesIndexes = {
  '/nx': '/packages/nx',
  '/workspace': '/packages/workspace',
  '/devkit': '/packages/devkit',
  '/nx-plugin': '/packages/plugin',
  '/angular': '/packages/angular',
  '/cypress': '/packages/cypress',
  '/detox': '/packages/detox',
  '/esbuild': '/packages/esbuild',
  '/eslint-plugin-nx': '/packages/eslint-plugin-nx',
  '/expo': '/packages/expo',
  '/express': '/packages/express',
  '/jest': '/packages/jest',
  '/js': '/packages/js',
  '/linter': '/packages/eslint',
  '/nest': '/packages/nest',
  '/next': '/packages/next',
  '/node': '/packages/node',
  '/react': '/packages/react',
  '/react-native': '/packages/react',
  '/rollup': '/packages/rollup',
  '/storybook': '/packages/storybook',
  '/vite': '/packages/vite',
  '/web': '/packages/web',
  '/webpack': '/packages/webpack',
};

const packagesDocuments = {
  '/nx/create-nx-workspace': '/packages/nx/documents/create-nx-workspace',
  '/nx/init': '/packages/nx/documents/init',
  '/nx/generate': '/packages/nx/documents/generate',
  '/nx/run': '/packages/nx/documents/run',
  '/nx/daemon': '/packages/nx/documents/daemon',
  '/nx/dep-graph': '/packages/nx/documents/dep-graph',
  '/nx/run-many': '/packages/nx/documents/run-many',
  '/nx/affected': '/packages/nx/documents/affected',
  '/nx/format-check': '/packages/nx/documents/format-check',
  '/nx/format-write': '/packages/nx/documents/format-write',
  '/nx/migrate': '/packages/nx/documents/migrate',
  '/nx/report': '/packages/nx/documents/report',
  '/nx/list': '/packages/nx/documents/list',
  '/nx/workspace-generator': '/packages/nx/documents/workspace-generator',
  '/nx/connect-to-nx-cloud': '/packages/nx/documents/connect-to-nx-cloud',
  '/nx/reset': '/packages/nx/documents/reset',
  '/nx/repair': '/packages/nx/documents/repair',
  '/nx/exec': '/packages/nx/documents/exec',
  '/nx/watch': '/packages/nx/documents/watch',
  '/workspace/nx-nodejs-typescript-version-matrix':
    '/packages/workspace/documents/nx-nodejs-typescript-version-matrix',
  '/devkit/index': '/packages/devkit/documents/nx_devkit',
  '/packages/devkit/documents/nrwl_devkit':
    '/packages/devkit/documents/nx_devkit',
  '/devkit/ngcli_adapter': '/packages/devkit/documents/ngcli_adapter',
  '/angular-nx-version-matrix':
    '/packages/angular/documents/angular-nx-version-matrix',
  '/cypress/cypress-component-testing':
    '/packages/cypress/documents/cypress-component-testing',
  '/cypress/v11-migration-guide':
    '/packages/cypress/documents/v11-migration-guide',
  '/storybook/overview-react': '/packages/storybook/documents/overview-react',
  '/packages/storybook/documents/overview-react':
    '/recipes/storybook/overview-react',
  '/storybook/overview-angular':
    '/packages/storybook/documents/overview-angular',
  '/packages/storybook/documents/overview-angular':
    '/recipes/storybook/overview-angular',
  '/packages/storybook/documents/configuring-storybook':
    '/recipes/storybook/configuring-storybook',
  '/packages/storybook/documents/custom-builder-configs':
    '/recipes/storybook/custom-builder-configs',
  '/packages/storybook/documents/storybook-interaction-tests':
    '/recipes/storybook/storybook-interaction-tests',
  '/storybook/best-practices': '/packages/storybook/documents/best-practices',
  '/storybook/storybook-composition-setup':
    '/packages/storybook/documents/storybook-composition-setup',
  '/packages/storybook/documents/storybook-composition-setup':
    '/recipes/storybook/storybook-composition-setup',
  '/storybook/angular-storybook-compodoc':
    '/packages/storybook/documents/angular-storybook-compodoc',
  '/packages/storybook/documents/angular-storybook-compodoc':
    '/recipes/storybook/angular-storybook-compodoc',
  '/storybook/angular-storybook-targets':
    '/deprecated/storybook/angular-storybook-targets',
  '/packages/storybook/documents/angular-storybook-targets':
    '/deprecated/storybook/angular-storybook-targets',
  '/storybook/angular-configuring-styles':
    '/packages/storybook/documents/angular-configuring-styles',
  '/packages/storybook/documents/angular-configuring-styles':
    '/recipes/storybook/angular-configuring-styles',
  '/storybook/angular-browser-target':
    '/deprecated/storybook/angular-project-build-config',
  '/deprecated/storybook/angular-browser-target':
    '/deprecated/storybook/angular-project-build-config',
  '/storybook/migrate-webpack-final-angular':
    '/deprecated/storybook/migrate-webpack-final-angular',
  '/storybook/upgrade-storybook-v6-angular':
    '/deprecated/storybook/upgrade-storybook-v6-angular',
  '/storybook/migrate-webpack-final-react':
    '/deprecated/storybook/migrate-webpack-final-react',
  '/storybook/upgrade-storybook-v6-react':
    '/deprecated/storybook/upgrade-storybook-v6-react',
  '/packages/storybook/documents/angular-browser-target':
    '/deprecated/storybook/angular-project-build-config',
  '/packages/storybook/documents/migrate-webpack-final-angular':
    '/deprecated/storybook/migrate-webpack-final-angular',
  '/packages/storybook/documents/upgrade-storybook-v6-angular':
    '/deprecated/storybook/upgrade-storybook-v6-angular',
  '/packages/storybook/documents/migrate-webpack-final-react':
    '/deprecated/storybook/migrate-webpack-final-react',
  '/packages/storybook/documents/upgrade-storybook-v6-react':
    '/deprecated/storybook/upgrade-storybook-v6-react',
  '/packages/storybook/documents/migrate-storybook-7':
    '/packages/storybook/generators/migrate-7',
  '/linter/eslint-plugin-nx': '/packages/eslint/documents/eslint-plugin-nx',
  '/packages/add-nx-to-monorepo': '/packages/nx/documents/init',
  '/packages/cra-to-nx': '/packages/nx/documents/init',
  '/packages/make-angular-cli-faster': '/packages/nx/documents/init',
  '/packages/eslint-plugin-nx': '/packages/eslint-plugin',
  '/packages/eslint-plugin-nx/documents/enforce-module-boundaries':
    '/packages/eslint-plugin/documents/enforce-module-boundaries',
  '/packages/eslint-plugin-nx/documents/overview':
    '/packages/eslint-plugin/documents/overview',
  '/packages/node/executors/webpack': '/packages/webpack/executors/webpack',
  '/packages/web/executors/webpack': '/packages/webpack/executors/webpack',
  '/packages/web/executors/dev-server':
    '/packages/webpack/executors/dev-server',
  '/packages/web/executors/rollup': '/packages/rollup/executors/rollup',
};

/**
 * Concept documents Updates (updated 2023-10-18)
 */
const conceptUrls = {
  '/concepts/more-concepts/global-nx':
    '/getting-started/installation#installing-nx-globally',
  '/getting-started/package-based-repo-tutorial':
    '/getting-started/tutorials/npm-workspaces-tutorial',
  '/getting-started/tutorials/package-based-repo-tutorial':
    '/getting-started/tutorials/npm-workspaces-tutorial',
  '/getting-started/integrated-repo-tutorial':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/tutorials/integrated-repo-tutorial':
    '/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/react-standalone-tutorial':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/getting-started/angular-standalone-tutorial':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/concepts/more-concepts/micro-frontend-architecture':
    '/concepts/module-federation/micro-frontend-architecture',
  '/concepts/more-concepts/faster-builds-with-module-federation':
    '/concepts/module-federation/faster-builds-with-module-federation',
  '/concepts/more-concepts/nx-and-angular':
    '/nx-api/angular/documents/nx-and-angular',
  '/concepts/more-concepts/nx-devkit-angular-devkit':
    '/nx-api/angular/documents/nx-devkit-angular-devkit',
  '/concepts/more-concepts/incremental-builds':
    '/concepts/more-concepts/buildable-and-publishable-libraries',
};

const nested5minuteTutorialUrls = {
  '/tutorials/package-based-repo-tutorial':
    '/getting-started/tutorials/npm-workspaces-tutorial',
  '/tutorials/integrated-repo-tutorial':
    '/getting-started/tutorials/integrated-repo-tutorial',
  '/tutorials/react-standalone-tutorial':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/tutorials/angular-standalone-tutorial':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/tutorials/node-server-tutorial': '/getting-started/tutorials',
  '/angular-tutorial': '/getting-started/tutorials/angular-monorepo-tutorial',
  '/angular-tutorial/1-code-generation':
    '/getting-started/tutorials/angular-monorepo-tutorial',
  '/getting-started/angular-monorepo-tutorial':
    '/getting-started/tutorials/angular-monorepo-tutorial',
  '/angular-tutorial/2-project-graph':
    '/getting-started/tutorials/angular-monorepo-tutorial',
  '/angular-tutorial/3-task-running':
    '/getting-started/tutorials/angular-monorepo-tutorial',
  '/angular-tutorial/4-workspace-optimization':
    '/getting-started/tutorials/angular-monorepo-tutorial',
  '/angular-tutorial/5-summary':
    '/getting-started/tutorials/angular-monorepo-tutorial',
};

const pluginUrls = {
  '/plugin-features/create-your-own-plugin':
    '/extending-nx/tutorials/create-plugin',
  '/recipes/advanced-plugins': '/extending-nx/recipes',
  '/recipes/advanced-plugins/create-preset':
    '/extending-nx/recipes/create-preset',
  '/recipes/advanced-plugins/migration-generators':
    '/extending-nx/recipes/migration-generators',
  '/recipes/advanced-plugins/project-graph-plugins':
    '/extending-nx/recipes/project-graph-plugins',
  // Removed inference doc when updating for v2 API
  '/extending-nx/recipes/project-inference-plugins':
    '/extending-nx/recipes/project-graph-plugins',
  '/recipes/advanced-plugins/project-inference-plugins':
    '/extending-nx/recipes/project-graph-plugins',
  '/recipes/advanced-plugins/share-your-plugin':
    '/extending-nx/tutorials/maintain-published-plugin',
  '/recipes/executors/compose-executors':
    '/extending-nx/recipes/compose-executors',
  '/recipes/executors/creating-custom-executors':
    '/extending-nx/recipes/local-executors',
  '/recipes/generators': '/extending-nx/recipes',
  '/recipes/generators/composing-generators':
    '/extending-nx/recipes/composing-generators',
  '/recipes/generators/creating-files': '/extending-nx/recipes/creating-files',
  '/recipes/generators/generator-options':
    '/extending-nx/recipes/generator-options',
  '/recipes/generators/local-generators':
    '/extending-nx/recipes/local-generators',
  '/recipes/generators/modifying-files':
    '/extending-nx/recipes/modifying-files',
  '/extending-nx/registry': '/plugin-registry',
};

const referenceUrls = {
  '/reference/changelog': '/changelog',
};

const missingAndCatchAllRedirects = {
  // missing
  '/docs': '/getting-started/intro',
  // catch all
  '/(l|latest|p|previous)/(a|angular|r|react|n|node)/:path*': '/:path*',
  '/(l|latest|p|previous)/:path*': '/:path*',
  '/(a|angular|r|react|n|node)/:path*': '/:path*',
  // Storybook
  '/(l|latest)/(r|react)/storybook/overview': '/storybook/overview-react',
  '/(l|latest)/(a|angular)/storybook/overview': '/storybook/overview-angular',
  '/(l|latest)/(a|angular|r|react)/storybook/executors':
    '/storybook/executors-storybook',
  // Nx Console
  '/nx-console': '/using-nx/console',
  '/packages/:path*': '/nx-api/:path*',
};

const movePluginFeaturesToCore = {
  '/plugin-features/use-task-executors':
    '/concepts/executors-and-configurations',
  '/features/plugin-features/use-task-executors':
    '/concepts/executors-and-configurations',
  '/plugin-features/use-code-generators': '/features/generate-code',
  '/features/plugin-features/use-code-generators': '/features/generate-code',
};

const makeMoreConceptsSubmenu = {
  '/more-concepts': '/concepts/more-concepts',
  '/more-concepts/:path*': '/concepts/more-concepts/:path*',
};

const pluginsToExtendNx = {
  '/plugins': '/extending-nx/intro/getting-started',
  '/plugins/:path*': '/extending-nx/:path*',
};

// (meeroslav) 2023-07-20
const latestRecipesRefactoring = {
  // removed
  '/recipes/getting-started/set-up-a-new-workspace':
    '/getting-started/installation',
  '/recipes/other/misc-ngrx': '/packages/angular/generators/ngrx', // 486 views
  '/recipes/other/misc-data-persistence': '/packages/angular/generators/ngrx', // 200 views
  '/recipes/other/standalone-ngrx-apis': '/packages/angular/generators/ngrx', //47 views -> can be freely removed
  '/recipes/other/export-project-graph': '/recipes/features/explore-graph', // 20 views -> contents moved to explore-graph
  '/recipes/executors/use-executor-configurations':
    '/concepts/executors-and-configurations',
  // ci
  '/recipes/other/azure-last-successful-commit':
    '/recipes/ci/azure-last-successful-commit',
  // angular
  '/recipes/adopting-nx/migration-angular':
    '/recipes/angular/migration/angular',
  '/recipes/adopting-nx-angular/angular-integrated':
    '/recipes/angular/migration/angular',
  '/recipes/adopting-nx-angular/angular-manual':
    '/recipes/angular/migration/angular',
  '/recipes/angular/migration/angular-manual':
    '/recipes/angular/migration/angular',
  '/recipes/adopting-nx-angular/angular-multiple':
    '/recipes/angular/migration/angular-multiple',
  '/recipes/adopting-nx/migration-angularjs':
    '/recipes/angular/migration/angularjs',
  '/recipes/environment-variables/use-environment-variables-in-angular':
    '/recipes/angular/use-environment-variables-in-angular',
  '/recipes/other/using-tailwind-css-with-angular-projects':
    '/recipes/angular/using-tailwind-css-with-angular-projects',
  '/recipes/module-federation/dynamic-module-federation-with-angular':
    '/recipes/angular/dynamic-module-federation-with-angular',
  '/recipes/other/setup-incremental-builds-angular':
    '/recipes/angular/setup-incremental-builds-angular',
  // react
  '/recipes/adopting-nx/migration-cra':
    '/recipes/adopting-nx/adding-to-existing-project',
  '/recipes/react/migration-cra':
    '/recipes/adopting-nx/adding-to-existing-project',
  '/recipes/other/react-18': '/recipes/react/react-18',
  '/recipes/other/react-native': '/recipes/react/react-native',
  '/recipes/other/remix': '/recipes/react/remix',
  '/recipes/environment-variables/use-environment-variables-in-react':
    '/recipes/react/use-environment-variables-in-react',
  '/recipes/other/using-tailwind-css-in-react':
    '/recipes/react/using-tailwind-css-in-react',
  '/recipes/deployment/deploy-nextjs-to-vercel':
    '/recipes/react/deploy-nextjs-to-vercel',
  '/recipes/module-federation/module-federation-with-ssr':
    '/recipes/react/module-federation-with-ssr',
  '/recipes/other/adding-assets-react': '/recipes/react/adding-assets',
  // node
  '/recipes/deployment/node-server-fly-io': '/recipes/node/node-server-fly-io',
  '/recipes/deployment/node-serverless-functions-netlify':
    '/recipes/node/node-serverless-functions-netlify',
  '/recipes/deployment/node-aws-lambda': '/recipes/node/node-aws-lambda',
  // examples
  '/recipes/module-federation/nx-examples': '/showcase/example-repos/mfe',
  '/recipes/database/nestjs-prisma': '/showcase/example-repos/nestjs-prisma',
  '/recipes/database/mongo-fastify': '/showcase/example-repos/mongo-fastify',
  '/recipes/database/redis-fastify': '/showcase/example-repos/redis-fastify',
  '/recipes/database/postgres-fastify':
    '/showcase/example-repos/postgres-fastify',
  '/recipes/database/serverless-fastify-planetscale':
    '/showcase/example-repos/serverless-fastify-planetscale',
  '/recipes/example-repos/:path*': '/showcase/example-repos/:path*',
  // tips and tricks
  '/recipes/environment-variables/define-environment-variables':
    '/recipes/tips-n-tricks/define-environment-variables',
  '/recipes/other/eslint': '/recipes/tips-n-tricks/eslint',
  '/recipes/other/browser-support': '/recipes/tips-n-tricks/browser-support',
  '/recipes/other/include-assets-in-build':
    '/recipes/tips-n-tricks/include-assets-in-build',
  '/recipes/other/include-all-packagejson':
    '/recipes/tips-n-tricks/include-all-packagejson',
  '/recipes/other/identify-dependencies-between-folders':
    '/recipes/tips-n-tricks/identify-dependencies-between-folders',
  '/recipes/managing-repository/root-level-scripts':
    '/recipes/tips-n-tricks/root-level-scripts',
  '/recipes/managing-repository/analyze-source-files':
    '/recipes/tips-n-tricks/analyze-source-files',
  '/recipes/managing-repository/workspace-watching':
    '/recipes/tips-n-tricks/workspace-watching',
  '/recipes/managing-repository/standalone-to-integrated':
    '/recipes/tips-n-tricks/standalone-to-integrated',
  '/recipes/managing-repository/js-and-ts': '/recipes/tips-n-tricks/js-and-ts',
  '/recipes/managing-repository/advanced-update':
    '/recipes/tips-n-tricks/advanced-update',
  '/recipes/executors/run-commands-executor':
    '/recipes/tips-n-tricks/run-commands-executor',
  // ci
  '/recipes/ci/azure-last-successful-commit': '/recipes/ci/monorepo-ci-azure',
  // nx concepts
  '/recipes/module-federation/faster-builds':
    '/concepts/more-concepts/faster-builds-with-module-federation',

  '/reference/commands': '/packages/nx',
};

const coreFeatureAndConceptsRefactoring = {
  '/features/share-your-cache': '/ci/features/remote-cache',
  '/concepts/more-concepts/customizing-inputs':
    '/recipes/running-tasks/configure-inputs',
  '/recipes/tips-n-tricks/root-level-scripts':
    '/recipes/running-tasks/root-level-scripts',
  '/recipes/tips-n-tricks/run-commands-executor':
    '/recipes/running-tasks/run-commands-executor',
  '/recipes/tips-n-tricks/workspace-watching':
    '/recipes/running-tasks/workspace-watching',
  '/recipes/tips-n-tricks/reduce-repetitive-configuration':
    '/recipes/running-tasks/reduce-repetitive-configuration',
  '/concepts/more-concepts/global-nx':
    '/getting-started/installation#installing-nx-globally',
  '/concepts/more-concepts/nx-and-the-wrapper':
    '/getting-started/installation#selfmanaged-nx-installation',
  '/recipes/running-tasks/customizing-inputs':
    '/recipes/running-tasks/configure-inputs',
};

/*
 * For AI Chat to make sure old URLs are not broken (added 2023-09-14)
 */
const aiChat = {
  '/ai': '/ai-chat',
};

// rename nx/linter to eslint
const eslintRename = {
  '/nx-api/linter': '/nx-api/eslint',
  '/nx-api/linter/documents': '/nx-api/eslint/documents',
  '/nx-api/linter/documents/overview': '/nx-api/eslint/documents/overview',
  '/nx-api/linter/executors': '/nx-api/eslint/executors',
  '/nx-api/linter/executors/eslint': '/nx-api/eslint/executors/lint',
  '/nx-api/linter/generators': '/nx-api/eslint/generators',
  '/nx-api/linter/generators/convert-to-flat-config':
    '/nx-api/eslint/generators/convert-to-flat-config',
  '/nx-api/linter/generators/workspace-rule':
    '/nx-api/eslint/generators/workspace-rule',
  '/nx-api/linter/generators/workspace-rules-project':
    '/nx-api/eslint/generators/workspace-rules-project',
  '/packages/linter': '/packages/eslint',
};

// move troubleshooting out of recipes
const troubleshootingOutOfRecipes = {
  '/recipes/troubleshooting': '/troubleshooting',
  '/recipes/troubleshooting/:path*': '/troubleshooting/:path*',
  '/ci/recipes/troubleshooting/:path*': '/ci/troubleshooting/:path*',
  '/recipes/other/resolve-circular-dependencies':
    '/troubleshooting/resolve-circular-dependencies',
  '/recipes/ci/troubleshoot-nx-install-issues':
    '/troubleshooting/troubleshoot-nx-install-issues',
  '/recipes/other/troubleshoot-cache-misses':
    '/troubleshooting/troubleshoot-cache-misses',
  '/recipes/other/unknown-local-cache': '/troubleshooting/unknown-local-cache',
  '/recipes/other/performance-profiling':
    '/troubleshooting/performance-profiling',
};

/**
 * Removed deprecated URLs
 */
const removedDeprecatedUrls = {
  '/nx-api/nx/documents/affected-dep-graph': '/deprecated/affected-graph', // nx affected:graph was removed in Nx 19
  '/cli/affected-dep-graph': '/deprecated/affected-graph',
  '/nx/affected-dep-graph': '/deprecated/affected-graph',
  '/nx-api/nx/documents/print-affected': '/deprecated/print-affected', // nx affected:graph was removed in Nx 19
  '/cli/affected-apps': '/deprecated/print-affected',
  '/cli/affected-libs': '/deprecated/print-affected',
  '/cli/print-affected': '/deprecated/print-affected',
  '/packages/nx/documents/print-affected': '/deprecated/print-affected',
  '/nx/affected-apps': '/deprecated/print-affected',
  '/nx/affected-libs': '/deprecated/print-affected',
  '/nx/print-affected': '/deprecated/print-affected',
  '/packages/nx/documents/affected-apps': '/deprecated/print-affected',
  '/packages/nx/documents/affected-libs': '/deprecated/print-affected',
  '/deprecated/default-collection': '/features/generate-code', // 46 views: has not worked since Nx 17 and has very little views
  '/deprecated/workspace-lint': '/nx-api/nx/documents/report', // 168 views: workspace-lint hasn't worked since Nx 15 and users should use `nx report` to check versions and other info
  '/deprecated/storybook/angular-storybook-targets':
    '/recipes/storybook/overview-angular', // 49 views
  '/deprecated/storybook/angular-project-build-config':
    '/recipes/storybook/overview-angular', // 126 views: outdated since Nx 14
  '/deprecated/storybook/migrate-webpack-final-angular':
    '/recipes/storybook/overview-angular', // 50 views: For Nx < 12.7
  '/deprecated/storybook/upgrade-storybook-v6-angular':
    '/recipes/storybook/overview-angular', // 44 views: outdated since Nx 14
  '/deprecated/storybook/migrate-webpack-final-react':
    '/recipes/storybook/overview-react', // 417 views: mostly people searching "React Storybook" is matching this outdated page that was for Nx 12.7
  '/deprecated/storybook/upgrade-storybook-v6-react':
    '/recipes/storybook/overview-react', // 80 views
};

const decisionsSection = {
  '/concepts/more-concepts/why-monorepos': '/concepts/decisions/why-monorepos',
  '/concepts/more-concepts/dependency-management':
    '/concepts/decisions/dependency-management',
  '/concepts/more-concepts/code-sharing': '/concepts/decisions/code-ownership',
  '/concepts/more-concepts/applications-and-libraries':
    '/concepts/decisions/project-size',
  '/concepts/more-concepts/creating-libraries':
    '/concepts/decisions/project-size',
  '/concepts/more-concepts/library-types':
    '/concepts/decisions/project-dependency-rules',
  '/concepts/more-concepts/grouping-libraries':
    '/concepts/decisions/folder-structure',
  '/concepts/more-concepts/turbo-and-nx': '/concepts/turbo-and-nx',
  '/concepts/more-concepts/nx-daemon': '/concepts/nx-daemon',
  '/concepts/more-concepts/buildable-and-publishable-libraries':
    '/concepts/buildable-and-publishable-libraries',
};
// Blog post redirects
const blogPosts = {
  '/blog/2024-05-07-nx-19-release': '/blog/2024-05-08-nx-19-release',
  '/blog/2024-05-08-nx-19-release': '/blog/nx-19-release',
  '/blog/2024-04-19-manage-your-gradle':
    '/blog/manage-your-gradle-project-using-nx',
  '/blog/2024-03-21-reliable-ci':
    '/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness',
  '/blog/2024-03-20-why-speed-matters': '/blog/monorepos-why-speed-matters',
  '/blog/2024-02-15-launch-week-recap': '/blog/launch-nx-week-recap',
  '/blog/2024-02-09-versioning-and-releasing-packages':
    '/blog/versioning-and-releasing-packages-in-a-monorepo',
  '/blog/2024-02-07-fast-effortless-ci': '/blog/fast-effortless-ci',
  '/blog/2024-02-06-nuxt-js-support-in-nx':
    '/blog/introducing-nx-nuxt-enhanced-nuxt-js-support-in-nx',
  '/blog/2024-02-05-nx-18-project-crystal':
    '/blog/what-if-nx-plugins-were-more-like-vscode-extensions',
  '/blog/2023-12-28-highlights-2023': '/blog/nx-highlights-of-2023',
  '/blog/2023-12-20-nx-17-2-release': '/blog/nx-17-2-release',
  '/blog/2023-11-22-unit-testing-expo':
    '/blog/unit-testing-expo-apps-with-jest',
  '/blog/2023-11-21-ai-assistant': '/blog/nx-docs-ai-assistant',
  '/blog/2023-11-08-state-management':
    '/blog/state-management-nx-react-native-expo-apps-with-tanstack-query-and-redux',
  '/blog/2023-10-20-nx-17-release': '/blog/nx-17-release',
  '/blog/2023-10-13-nx-conf-2023-recap': '/blog/nx-conf-2023-recap',
  '/blog/2023-09-25-nx-raises': '/blog/nx-raises-16m-series-a',
  '/blog/2023-08-15-qwikify-your-dev': '/blog/qwikify-your-development-with-nx',
  '/blog/2023-06-29-nx-console-gets-lit': '/blog/nx-console-gets-lit',
  '/blog/2023-04-19-nx-cloud-3':
    '/blog/nx-cloud-3-0-faster-more-efficient-modernized',
};

/**
 * Public export API
 */
module.exports = {
  cliUrls,
  diataxis,
  guideUrls,
  overviewUrls,
  recipesUrls,
  nxCloudUrls,
  schemaUrls,
  tutorialRedirects,
  standaloneTutorialRedirects,
  packagesIndexes,
  packagesDocuments,
  conceptUrls,
  nested5minuteTutorialUrls,
  pluginUrls,
  referenceUrls,
  missingAndCatchAllRedirects,
  movePluginFeaturesToCore,
  makeMoreConceptsSubmenu,
  pluginsToExtendNx,
  latestRecipesRefactoring,
  coreFeatureRefactoring: coreFeatureAndConceptsRefactoring,
  aiChat,
  eslintRename,
  removedDeprecatedUrls,
  troubleshootingOutOfRecipes,
  blogPosts,
  decisionsSection,
};
