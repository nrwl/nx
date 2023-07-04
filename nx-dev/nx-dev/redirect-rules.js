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
  '/workspace/workspace-generator':
    '/packages/workspace/generators/workspace-generator',
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
  '/angular/convert-tslint-to-eslint':
    '/packages/angular/generators/convert-tslint-to-eslint',
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
  '/angular/webpack-server': '/packages/angular/executors/webpack-dev-server',
  '/packages/angular/executors/webpack-server':
    '/packages/angular/executors/webpack-dev-server',
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
  '/linter/eslint': '/packages/linter/executors/eslint',
  '/linter/lint': '/packages/linter/executors/lint',
  '/linter/workspace-rule': '/packages/linter/generators/workspace-rule',
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
  '/nest/convert-tslint-to-eslint':
    '/packages/nest/generators/convert-tslint-to-eslint',
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
  '/packages/nx-plugin/generators/executor':
    '/packages/plugin/generators/executor',
  '/packages/nx-plugin/generators/migration':
    '/packages/plugin/generators/migration',
  '/packages/nx-plugin/generators/plugin': '/packages/plugin/generators/plugin',
  '/packages/nx-plugin/generators/schematic':
    '/packages/plugin/generators/generator',
  '/packages/nx-plugin/generators/e2e': '/packages/plugin/executors/e2e',
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
  '/guides/lerna-and-nx': '/migration/lerna-and-nx',
  '/cypress/v10-migration-guide': '/cypress/v11-migration-guide',
  '/cypress/generators/migrate-to-cypress-10':
    '/cypress/generators/migrate-to-cypress-11',
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
  '/using-nx/console': '/core-features/integrate-with-editors',
  '/using-nx/mental-model': '/concepts/mental-model',
  '/using-nx/caching': '/concepts/how-caching-works',
  '/using-nx/dte': '/core-features/distribute-task-execution',
  '/using-nx/affected': '/concepts/affected',
  '/using-nx/ci-overview': '/recipes/ci/ci-setup',
  '/using-nx/updating-nx': '/core-features/automate-updating-dependencies',
  '/using-nx/nx-nodejs-typescript-version-matrix':
    '/workspace/nx-nodejs-typescript-version-matrix',
  '/extending-nx/nx-devkit': '/plugins/intro/getting-started',
  '/extending-nx/project-inference-plugins':
    '/recipes/advanced-plugins/project-inference-plugins',
  '/extending-nx/project-graph-plugins':
    '/recipes/advanced-plugins/project-graph-plugins',
  '/migration/lerna-and-nx': '/recipes/adopting-nx/lerna-and-nx',
  '/migration/adding-to-monorepo': '/recipes/adopting-nx/adding-to-monorepo',
  '/migration/migration-cra': '/recipes/adopting-nx/migration-cra',
  '/migration/migration-angular': '/recipes/adopting-nx/migration-angular',
  '/migration/migration-angularjs': '/recipes/adopting-nx/migration-angularjs',
  '/migration/preserving-git-histories':
    '/recipes/adopting-nx/preserving-git-histories',
  '/migration/manual': '/recipes/adopting-nx/manual',
  '/executors/using-builders': '/plugin-features/use-task-executors',
  '/executors/run-commands-builder': '/recipes/executors/run-commands-executor',
  '/executors/creating-custom-builders':
    '/recipes/executors/creating-custom-executors',
  '/generators/using-generators': '/plugin-features/use-code-generators',
  '/generators/workspace-generators':
    '/recipes/generators/workspace-generators',
  '/generators/composing-generators':
    '/recipes/generators/composing-generators',
  '/generators/generator-options': '/recipes/generators/generator-options',
  '/generators/creating-files': '/recipes/generators/creating-files',
  '/generators/modifying-files': '/recipes/generators/modifying-files',
  '/structure/applications-and-libraries':
    'more-concepts/applications-and-libraries',
  '/structure/creating-libraries': '/more-concepts/creating-libraries',
  '/structure/library-types': '/more-concepts/library-types',
  '/structure/grouping-libraries': '/more-concepts/grouping-libraries',
  '/structure/buildable-and-publishable-libraries':
    '/more-concepts/buildable-and-publishable-libraries',
  '/structure/monorepo-tags': '/core-features/enforce-project-boundaries',
  '/structure/dependency-graph': '/core-features/explore-graph',
  '/structure/project-graph-plugins':
    '/recipes/advanced-plugins/project-graph-plugins',
  '/ci/monorepo-ci-azure': '/recipes/ci/monorepo-ci-azure',
  '/ci/monorepo-ci-circle-ci': '/recipes/ci/monorepo-ci-circle-ci',
  '/ci/monorepo-ci-github-actions': '/recipes/ci/monorepo-ci-github-actions',
  '/ci/monorepo-ci-jenkins': '/recipes/ci/monorepo-ci-jenkins',
  '/ci/monorepo-ci-gitlab': '/recipes/ci/monorepo-ci-gitlab',
  '/ci/monorepo-ci-bitbucket-pipelines':
    '/recipes/ci/monorepo-ci-bitbucket-pipelines',
  '/ci/distributed-builds': '/concepts/dte', // 👀
  '/ci/incremental-builds': '/more-concepts/incremental-builds',
  '/ci/setup-incremental-builds-angular':
    '/recipes/other/setup-incremental-builds-angular',
  '/guides/turbo-and-nx': '/more-concepts/turbo-and-nx',
  '/guides/why-monorepos': '/more-concepts/why-monorepos',
  '/guides/adding-assets-react': '/recipes/other/adding-assets-react',
  '/guides/environment-variables': '/reference/environment-variables',
  '/guides/monorepo-nx-enterprise': '/more-concepts/monorepo-nx-enterprise',
  '/guides/performance-profiling': '/recipes/other/performance-profiling',
  '/guides/eslint': '/recipes/other/eslint',
  '/guides/customize-webpack':
    '/packages/webpack/documents/webpack-config-setup',
  '/guides/nx-daemon': '/more-concepts/nx-daemon',
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
  '/guides/nx-devkit-angular-devkit': '/more-concepts/nx-devkit-angular-devkit',
  '/module-federation/faster-builds':
    '/recipes/module-federation/faster-builds',
  '/module-federation/micro-frontend-architecture':
    '/more-concepts/micro-frontend-architecture',
  '/module-federation/dynamic-module-federation-with-angular':
    '/recipes/module-federation/dynamic-module-federation-with-angular',
  '/examples/nx-examples': '/recipes/other/nx-examples',
  '/examples/react-nx': '/recipes/other/react-nx',
  '/examples/apollo-react': '/recipes/other/apollo-react',
  '/examples/caching': '/recipes/other/caching',
  '/examples/dte': '/recipes/other/dte',
  '/recipe/workspace-generators': '/recipes/generators/local-generators',
  '/recipes/other/customize-webpack':
    '/packages/webpack/documents/webpack-config-setup',
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
  '/linter/overview': '/packages/linter',
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
  '/cli/affected-dep-graph': '/nx/affected-dep-graph',
  '/cli/affected-apps': '/packages/nx/documents/print-affected',
  '/cli/affected-libs': '/packages/nx/documents/print-affected',
  '/cli/print-affected': '/packages/nx/documents/print-affected',
  '/cli/format-check': '/nx/format-check',
  '/cli/format-write': '/nx/format-write',
  '/cli/migrate': '/nx/migrate',
  '/cli/report': '/nx/report',
  '/cli/list': '/nx/list',
  '/cli/workspace-lint': '/nx/workspace-lint',
  '/cli/workspace-generator': '/nx/workspace-generator',
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
  '/recipes/other/react-nx': '/recipes/example-repos/react-nx',
  '/recipes/other/apollo-react': '/recipes/example-repos/apollo-react',
  '/recipes/other/caching': '/recipes/example-repos/caching',
  '/recipes/other/dte': '/recipes/example-repos/dte',
  '/recipes/other/deploy-nextjs-to-vercel':
    '/recipes/deployment/deploy-nextjs-to-vercel',
};

/**
 * Nx Cloud
 */
const nxCloudUrls = {
  '/nx-cloud/set-up/add-nx-cloud': '/core-features/share-your-cache',
  '/nx-cloud/set-up/set-up-caching': '/core-features/share-your-cache',
  '/nx-cloud/set-up/set-up-dte': '/core-features/distribute-task-execution',
};

/**
 * Tutorial Updates (updated 2023-01-13)
 */
const tutorialBaseUrls = {
  '/(l|latest)/(a|angular)/tutorial/1-code-generation':
    '/angular-tutorial/1-code-generation',
  '/(l|latest)/(a|node)/tutorial/1-code-generation':
    '/getting-started/tutorials/node-server-tutorial',
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
  '/getting-started/node-tutorial': '/getting-started/node-server-tutorial',
  '/node-tutorial/1-code-generation': '/node-server-tutorial/1-code-generation',
  '/node-tutorial/2-project-graph': '/node-server-tutorial/2-project-graph',
  '/node-tutorial/3-task-running': '/node-server-tutorial/3-task-running',
  '/node-tutorial/4-task-pipelines': '/node-server-tutorial/4-task-pipelines',
  '/node-tutorial/5-docker-target': '/node-server-tutorial/5-docker-target',
  '/node-tutorial/6-summary': '/node-server-tutorial/6-summary',
};
const nodeRedirectDestination =
  '/getting-started/tutorials/node-server-tutorial';
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
  '/shared/react-standalone-tutorial/1-code-generation':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/shared/react-standalone-tutorial/2-project-graph':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/shared/react-standalone-tutorial/3-task-running':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/shared/react-standalone-tutorial/4-task-pipelines':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/shared/react-standalone-tutorial/5-summary':
    '/getting-started/tutorials/react-standalone-tutorial',
  'shared/angular-standalone-tutorial/1-code-generation':
    '/getting-started/tutorials/angular-standalone-tutorial',
  'shared/angular-standalone-tutorial/2-project-graph':
    '/getting-started/tutorials/angular-standalone-tutorial',
  'shared/angular-standalone-tutorial/3-task-running':
    '/getting-started/tutorials/angular-standalone-tutorial',
  'shared/angular-standalone-tutorial/4-task-pipelines':
    '/getting-started/tutorials/angular-standalone-tutorial',
  'shared/angular-standalone-tutorial/5-summary':
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
  '/linter': '/packages/linter',
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
  '/nx/affected-dep-graph': '/packages/nx/documents/affected-dep-graph',
  '/nx/affected-apps': '/packages/nx/documents/print-affected',
  '/nx/affected-libs': '/packages/nx/documents/print-affected',
  '/nx/print-affected': '/packages/nx/documents/print-affected',
  '/packages/nx/documents/affected-apps':
    '/packages/nx/documents/print-affected',
  '/packages/nx/documents/affected-libs':
    '/packages/nx/documents/print-affected',
  '/nx/format-check': '/packages/nx/documents/format-check',
  '/nx/format-write': '/packages/nx/documents/format-write',
  '/nx/migrate': '/packages/nx/documents/migrate',
  '/nx/report': '/packages/nx/documents/report',
  '/nx/list': '/packages/nx/documents/list',
  '/nx/workspace-lint': '/packages/nx/documents/workspace-lint',
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
  '/storybook/overview-angular':
    '/packages/storybook/documents/overview-angular',
  '/storybook/best-practices': '/packages/storybook/documents/best-practices',
  '/storybook/storybook-composition-setup':
    '/packages/storybook/documents/storybook-composition-setup',
  '/storybook/angular-storybook-compodoc':
    '/packages/storybook/documents/angular-storybook-compodoc',
  '/storybook/angular-storybook-targets':
    '/deprecated/storybook/angular-storybook-targets',
  '/packages/storybook/documents/angular-storybook-targets':
    '/deprecated/storybook/angular-storybook-targets',
  '/storybook/angular-configuring-styles':
    '/packages/storybook/documents/angular-configuring-styles',
  '/storybook/angular-browser-target':
    '/deprecated/storybook/angular-browser-target',
  '/storybook/migrate-webpack-final-angular':
    '/deprecated/storybook/migrate-webpack-final-angular',
  '/storybook/upgrade-storybook-v6-angular':
    '/deprecated/storybook/upgrade-storybook-v6-angular',
  '/storybook/migrate-webpack-final-react':
    '/deprecated/storybook/migrate-webpack-final-react',
  '/storybook/upgrade-storybook-v6-react':
    '/deprecated/storybook/upgrade-storybook-v6-react',
  '/packages/storybook/documents/angular-browser-target':
    '/deprecated/storybook/angular-browser-target',
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
  '/linter/eslint-plugin-nx': '/packages/linter/documents/eslint-plugin-nx',
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
 * Concept documents Updates (updated 2023-03-31)
 */
const conceptUrls = {
  '/more-concepts/global-nx':
    '/getting-started/installation#installing-nx-globally',
  '/getting-started/package-based-repo-tutorial':
    '/getting-started/tutorials/package-based-repo-tutorial',
  '/getting-started/integrated-repo-tutorial':
    '/getting-started/tutorials/integrated-repo-tutorial',
  '/getting-started/react-standalone-tutorial':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/getting-started/angular-standalone-tutorial':
    '/getting-started/tutorials/angular-standalone-tutorial',
};

const nested5minuteTutorialUrls = {
  '/tutorials/package-based-repo-tutorial':
    '/getting-started/tutorials/package-based-repo-tutorial',
  '/tutorials/integrated-repo-tutorial':
    '/getting-started/tutorials/integrated-repo-tutorial',
  '/tutorials/react-standalone-tutorial':
    '/getting-started/tutorials/react-standalone-tutorial',
  '/tutorials/angular-standalone-tutorial':
    '/getting-started/tutorials/angular-standalone-tutorial',
  '/tutorials/node-server-tutorial':
    '/getting-started/tutorials/node-server-tutorial',
};

const pluginUrls = {
  '/plugin-features/create-your-own-plugin': '/plugins/tutorials/create-plugin',
  '/recipes/advanced-plugins': '/plugins/recipes',
  '/recipes/advanced-plugins/create-preset': '/plugins/recipes/create-preset',
  '/recipes/advanced-plugins/migration-generators':
    '/plugins/recipes/migration-generators',
  '/recipes/advanced-plugins/project-graph-plugins':
    '/plugins/recipes/project-graph-plugins',
  '/recipes/advanced-plugins/project-inference-plugins':
    '/plugins/recipes/project-inference-plugins',
  '/recipes/advanced-plugins/share-your-plugin':
    '/plugins/tutorials/maintain-published-plugin',
  '/recipes/executors/compose-executors': '/plugins/recipes/compose-executors',
  '/recipes/executors/creating-custom-executors':
    '/plugins/recipes/local-executors',
  '/recipes/generators': '/plugins/recipes',
  '/recipes/generators/composing-generators':
    '/plugins/recipes/composing-generators',
  '/recipes/generators/creating-files': '/plugins/recipes/creating-files',
  '/recipes/generators/generator-options': '/plugins/recipes/generator-options',
  '/recipes/generators/local-generators': '/plugins/recipes/local-generators',
  '/recipes/generators/modifying-files': '/plugins/recipes/modifying-files',
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
};
