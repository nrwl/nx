/**
 * Import docs to Astro redirects (added 2025-08-21 for DOC-107)
 */
const docsToAstroRedirects = require('./redirect-rules-docs-to-astro.js');

/**
 * Executors & Generators old url schemes to package schema viewer url schemes (added 2022-03-16)
 * REMOVED: 130 routes from 2022 that chain 3+ hops deep. Original sources like
 * /workspace/library, /angular/application, /nest/class etc. pointed to /packages/X/...
 * which chains through /packages/:path* -> /nx-api/:path* -> /reference/core-api/... -> /docs/...
 */
const schemaUrls = {};

/**
 * Guide specific rules (added 2022-01-04)
 */
const guideUrls = {
  '/core-concepts/configuration': '/docs/reference/project-configuration',
  '/core-concepts/mental-model': '/docs/concepts/mental-model',
  '/core-concepts/updating-nx': '/docs/features/automate-updating-dependencies',
  '/core-concepts/ci-overview': '/docs/guides/nx-cloud/setup-ci',
  '/getting-started/nx-cli': '/docs/getting-started/intro',
  '/getting-started/console': '/docs/getting-started/editor-setup',
  '/core-extended/affected': '/docs/features/ci-features/affected',
  '/core-extended/computation-caching': '/docs/concepts/how-caching-works',
  '/guides/nextjs': '/packages/next',
  '/using-nx/nx-devkit': '/docs/extending-nx/intro',
  '/guides/lerna-and-nx': 'https://lerna.js.org',
  '/migration/lerna-and-nx': 'https://lerna.js.org',
  '/cypress/v10-migration-guide':
    '/packages/cypress/documents/v11-migration-guide',
  '/cypress/generators/migrate-to-cypress-10':
    '/packages/cypress/generators/migrate-to-cypress-11',
};

/**
 * Diataxis restructure specific rules (added 2022-09-02)
 */
const diataxis = {
  '/getting-started/nx-setup': '/docs/getting-started/intro',
  '/getting-started/nx-core': '/getting-started/core-tutorial',
  '/getting-started/nx-and-typescript': '/docs/getting-started/intro',
  '/getting-started/nx-and-react': '/docs/getting-started/intro',
  '/getting-started/nx-and-angular': '/docs/getting-started/intro',
  '/configuration/packagejson': '/docs/reference/project-configuration',
  '/configuration/projectjson': '/docs/reference/project-configuration',
  '/using-nx/nx-cli': '/docs/getting-started/intro',
  '/using-nx/console': '/docs/getting-started/editor-setup',
  '/features/integrate-with-editors': '/docs/getting-started/editor-setup',
  '/using-nx/mental-model': '/docs/concepts/mental-model',
  '/using-nx/caching': '/docs/concepts/how-caching-works',
  '/using-nx/dte': '/features/distribute-task-execution',
  '/using-nx/affected': '/docs/features/ci-features/affected',
  '/using-nx/ci-overview': '/docs/guides/nx-cloud/setup-ci',
  '/using-nx/updating-nx': '/docs/features/automate-updating-dependencies',
  '/using-nx/nx-nodejs-typescript-version-matrix':
    '/packages/workspace/documents/nx-nodejs-typescript-version-matrix',
  '/extending-nx/nx-devkit': '/docs/extending-nx/intro',
  '/extending-nx/project-inference-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/extending-nx/project-graph-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/migration/adding-to-monorepo':
    '/docs/guides/adopting-nx/adding-to-monorepo',
  '/migration/migration-cra':
    '/docs/guides/adopting-nx/adding-to-existing-project',
  '/migration/migration-angular': '/docs/technologies/angular',
  '/migration/migration-angularjs': '/docs/technologies/angular',
  '/recipes/angular/migration/angularjs': '/docs/technologies/angular',
  '/migration/preserving-git-histories':
    '/docs/guides/adopting-nx/preserving-git-histories',
  '/migration/manual': '/docs/guides/adopting-nx/manual',
  '/executors/using-builders': '/docs/concepts/executors-and-configurations',
  '/executors/run-commands-builder':
    '/docs/guides/tasks--caching/run-commands-executor',
  '/executors/creating-custom-builders': '/docs/extending-nx/local-executors',
  '/generators/using-generators': '/features/use-code-generators',
  '/generators/workspace-generators':
    '/recipes/generators/workspace-generators',
  '/generators/composing-generators': '/docs/extending-nx/composing-generators',
  '/generators/generator-options': '/docs/extending-nx',
  '/generators/creating-files': '/docs/extending-nx/creating-files',
  '/generators/modifying-files': '/docs/extending-nx/modifying-files',
  '/structure/applications-and-libraries':
    'more-concepts/applications-and-libraries',
  '/structure/creating-libraries': '/docs/concepts/decisions/project-size',
  '/structure/library-types':
    '/docs/concepts/decisions/project-dependency-rules',
  '/structure/grouping-libraries': '/docs/concepts/decisions/folder-structure',
  '/structure/buildable-and-publishable-libraries':
    '/docs/concepts/buildable-and-publishable-libraries',
  '/structure/monorepo-tags': '/docs/features/enforce-module-boundaries',
  '/core-features/enforce-project-boundaries':
    '/docs/features/enforce-module-boundaries',
  '/structure/dependency-graph': '/docs/features/explore-graph',
  '/structure/project-graph-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/ci/monorepo-ci-azure': '/docs/guides/nx-cloud/setup-ci',
  '/ci/monorepo-ci-circle-ci': '/nx-cloud/recipes/set-up/monorepo-ci-circle-ci',
  '/ci/monorepo-ci-github-actions': '/recipes/ci/monorepo-ci-github-actions',
  '/ci/monorepo-ci-jenkins': '/nx-cloud/recipes/set-up/monorepo-ci-jenkins',
  '/ci/monorepo-ci-gitlab': '/nx-cloud/recipes/set-up/monorepo-ci-gitlab',
  '/ci/monorepo-ci-bitbucket-pipelines':
    '/nx-cloud/recipes/set-up/monorepo-ci-bitbucket-pipelines',
  '/ci/distributed-builds': '/nx-cloud/concepts/parallelization-distribution', // 👀
  '/ci/setup-incremental-builds-angular':
    '/recipes/angular/setup-incremental-builds-angular',
  '/guides/turbo-and-nx': '/docs/guides/adopting-nx/from-turborepo',
  '/guides/why-monorepos': '/docs/concepts/decisions/why-monorepos',
  '/guides/adding-assets-react': '/recipes/react/adding-assets',
  '/guides/environment-variables': '/docs/reference/environment-variables',
  '/guides/performance-profiling':
    '/docs/troubleshooting/performance-profiling',
  '/guides/eslint': '/docs/technologies/eslint',
  '/guides/customize-webpack': '/recipes/webpack/webpack-config-setup',
  '/guides/nx-daemon': '/docs/concepts/nx-daemon',
  '/guides/js-and-ts': '/docs/technologies/typescript/guides/js-and-ts',
  '/guides/browser-support': '/docs/guides/tips-n-tricks/browser-support',
  '/guides/react-native': '/recipes/react/react-native',
  '/guides/deploy-nextjs-to-vercel': '/recipes/react/deploy-nextjs-to-vercel',
  '/guides/using-tailwind-css-in-react':
    '/recipes/react/using-tailwind-css-in-react',
  '/guides/react-18': '/nx-api/react',
  '/guides/using-tailwind-css-with-angular-projects':
    '/recipes/angular/using-tailwind-css-with-angular-projects',
  '/guides/misc-ngrx': '/packages/angular/generators/ngrx',
  '/guides/misc-data-persistence': '/packages/angular/generators/ngrx',
  '/guides/nx-devkit-angular-devkit':
    '/nx-api/angular/documents/nx-devkit-angular-devkit',
  '/module-federation/faster-builds':
    '/concepts/module-federation/faster-builds-with-module-federation',
  '/module-federation/micro-frontend-architecture':
    '/concepts/module-federation/micro-frontend-architecture',
  '/module-federation/dynamic-module-federation-with-angular':
    '/recipes/angular/dynamic-module-federation-with-angular',
  '/examples/nx-examples': '/recipes/other/nx-examples',
  '/examples/react-nx':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/examples/apollo-react': '/docs/getting-started/intro',
  '/examples/caching': '/showcase/example-repos/caching',
  '/examples/dte': '/showcase/example-repos/dte',
  '/recipe/workspace-generators': '/docs/extending-nx/local-generators',
  '/recipes/other/customize-webpack': '/recipes/webpack/webpack-config-setup',
};

/**
 * API overview packages
 */
// REMOVED: overviewUrls (15 routes from 2022) - destinations all chain through
// /packages/:path* -> /nx-api/:path* -> /technologies/... -> /docs/technologies/...
const overviewUrls = {};

/**
 * API removing CLI and putting the content into Nx
 */
const cliUrls = {
  // Exceptions: these don't follow the /cli/X -> /packages/nx/documents/X pattern
  '/cli/connect-to-nx-cloud': '/docs/features/ci-features',
  '/cli/affected-dep-graph': '/deprecated/affected-graph',
  '/cli/affected-apps': '/deprecated/print-affected',
  '/cli/affected-libs': '/deprecated/print-affected',
  '/cli/print-affected': '/deprecated/print-affected',
  // Wildcard: all other /cli/* routes
  '/cli/:path*': '/packages/nx/documents/:path*',
};
/**
 * Recipes
 */
const recipesUrls = {
  '/recipe/adding-to-monorepo': '/docs/guides/adopting-nx/adding-to-monorepo',
  '/recipes/other/ban-dependencies-with-tags':
    '/docs/guides/enforce-module-boundaries/ban-dependencies-with-tags',
  '/recipes/other/tag-multiple-dimensions':
    '/docs/guides/enforce-module-boundaries/tag-multiple-dimensions',
  '/recipes/other/ban-external-imports':
    '/docs/guides/enforce-module-boundaries/ban-external-imports',
  '/recipes/other/tags-allow-list':
    '/docs/guides/enforce-module-boundaries/tags-allow-list',
  '/recipes/other/react-nx':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/recipes/other/apollo-react': '/docs/getting-started/intro',
  '/recipes/other/caching': '/showcase/example-repos/caching',
  '/recipes/other/dte': '/showcase/example-repos/dte',
  '/recipes/other/deploy-nextjs-to-vercel':
    '/recipes/react/deploy-nextjs-to-vercel',
  '/recipes/other/root-level-scripts':
    '/docs/guides/tasks--caching/root-level-scripts',
  '/recipes/other/analyze-source-files':
    '/docs/guides/tips-n-tricks/analyze-source-files',
  '/recipes/other/workspace-watching':
    '/docs/guides/tasks--caching/workspace-watching',
  '/recipes/other/advanced-update':
    '/docs/guides/tips-n-tricks/advanced-update',
  '/recipes/other/js-and-ts': '/docs/technologies/typescript/guides/js-and-ts',
  '/packages/cypress/documents/cypress-component-testing':
    '/recipes/cypress/cypress-component-testing',
  '/packages/cypress/documents/cypress-v11-migration':
    '/recipes/cypress/cypress-v11-migration',
  '/packages/next/documents/next-config-setup':
    '/recipes/next/next-config-setup',
  '/packages/vite/documents/set-up-vite-manually':
    '/recipes/vite/configure-vite',
  '/recipes/vite/set-up-vite-manually': '/recipes/vite/configure-vite',
  '/packages/webpack/documents/webpack-plugins':
    '/recipes/webpack/webpack-plugins',
  '/packages/webpack/documents/webpack-config-setup':
    '/recipes/webpack/webpack-config-setup',
  '/showcase/example-repos/add-nuxt': '/nx-api/nuxt',
  '/showcase/example-repos/add-vue': '/nx-api/vue',
  '/recipes/react/react-18': '/nx-api/react',
  '/recipes/nx-console/console-shortcuts': '/docs/getting-started/editor-setup',
  '/recipes/nx-console/console-project-pane':
    '/docs/getting-started/editor-setup',
  '/recipes/nx-console/console-add-dependency-command':
    '/docs/getting-started/editor-setup',
  // This one was folded into a more holistic recipe around managing version reference updates
  '/recipes/nx-release/publish-custom-dist-directory':
    '/recipes/nx-release/updating-version-references#scenario-2-i-want-to-publish-from-a-custom-dist-directory-and-not-update-references-in-my-source-packagejson-files',
};

/**
 * Nx Cloud
 */
const nxCloudUrls = {
  '/nx-cloud/set-up/add-nx-cloud': '/docs/features/ci-features/remote-cache',
  '/nx-cloud/set-up/set-up-caching': '/docs/features/ci-features/remote-cache',
  '/nx-cloud/set-up/set-up-dte':
    '/docs/features/ci-features/distribute-task-execution',
  '/nx-cloud/private-cloud/standalone': '/ci/private-cloud/ami-setup',
  '/nx-cloud/private-cloud/kubernetes-setup':
    '/docs/enterprise/single-tenant/overview',
  '/recipes/ci': '/docs/guides/nx-cloud',
  '/recipes/ci/ci-setup': '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/recipes/set-up/ci-setup': '/docs/guides/nx-cloud/setup-ci',
  '/recipes/ci/monorepo-ci-azure': '/docs/guides/nx-cloud/setup-ci',
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
  '/recipes/ci/ci-deployment': '/docs/guides/ci-deployment',
  '/nx-cloud/intro/what-is-nx-cloud': '/docs/getting-started/nx-cloud',
  '/nx-cloud/set-up': '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/set-up/record-commands': '/docs/guides/nx-cloud/record-commands',
  '/nx-cloud/set-up/github': '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/recipes/source-control-integration/github':
    '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/set-up/bitbucket-cloud': '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/recipes/source-control-integration/bitbucket-cloud':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/source-control-integration/bitbucket-cloud':
    '/docs/guides/nx-cloud/setup-ci',
  '/nx-cloud/set-up/gitlab': '/docs/guides/nx-cloud/setup-ci',
  '/core-features/remote-cache': '/docs/features/ci-features/remote-cache',
  '/core-features/distribute-task-execution':
    '/docs/features/ci-features/distribute-task-execution',
  '/concepts/affected': '/docs/features/ci-features/affected',
  '/nx-cloud/private-cloud': '/docs/enterprise/single-tenant/overview',
  '/nx-cloud/private-cloud/get-started':
    '/docs/enterprise/single-tenant/overview',
  // On-premise / private cloud -> GitHub helm repo (wildcards)
  '/ci/features/on-premise': 'https://github.com/nrwl/nx-cloud-helm',
  '/nx-cloud/private-cloud/:path*': 'https://github.com/nrwl/nx-cloud-helm',
  '/ci/recipes/on-premise/:path*': 'https://github.com/nrwl/nx-cloud-helm',
  '/ci/recipes/enterprise/on-premise/:path*':
    'https://github.com/nrwl/nx-cloud-helm',
  '/concepts/dte': '/docs/concepts/ci-concepts/parallelization-distribution',
  '/nx-cloud/concepts/dte':
    '/docs/concepts/ci-concepts/parallelization-distribution',
  '/nx-cloud/intro/nx-cloud-workflows': '/ci/features/nx-cloud-workflows',
  '/nx-cloud/account': '/docs/guides/nx-cloud',
  '/nx-cloud/account/google-auth': '/docs/guides/nx-cloud/google-auth',
  '/nx-cloud/account/access-tokens': '/docs/guides/nx-cloud/access-tokens',
  '/nx-cloud/account/scenarios': '/docs/concepts/ci-concepts/cache-security',
  '/nx-cloud/concepts/scenarios': '/docs/concepts/ci-concepts/cache-security',
  '/nx-cloud/account/encryption': '/docs/guides/nx-cloud/encryption',
  '/nx-cloud/concepts/encryption': '/docs/guides/nx-cloud/encryption',
  '/nx-cloud/features/nx-cloud-workflows':
    '/docs/features/ci-features/distribute-task-execution',
  '/ci/features/nx-agents':
    '/docs/features/ci-features/distribute-task-execution',
  '/concepts/more-concepts/illustrated-dte':
    '/docs/concepts/ci-concepts/parallelization-distribution',
  '/core-features/:path*': '/features/:path*',
  '/ci/recipes/set-up/connect-to-cloud': '/docs/guides/nx-cloud/setup-ci',
  '/ci/intro/connect-to-cloud': '/docs/guides/nx-cloud/setup-ci',
  '/pricing/special-offer': 'https://forms.gle/FBzvsspz1o63fDAz6',
  '/powerpack/special-offer': 'https://forms.gle/mWjQo6Vrv5Kt6WYh9',
  '/ci/intro/why-nx-cloud': '/docs/getting-started/nx-cloud',
  '/ci/intro/ci-with-nx': '/docs/guides/nx-cloud/setup-ci',
  '/ci/intro/connect-to-nx-cloud': '/docs/guides/nx-cloud/setup-ci',
};

/**
 * Tutorial Updates — consolidated with wildcards
 */
const tutorialRedirects = {
  '/(l|latest)/(a|angular)/tutorial/1-code-generation':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/(l|latest)/(a|node)/tutorial/1-code-generation':
    '/docs/getting-started/tutorials',
  '/(l|latest)/(r|react)/tutorial/1-code-generation':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/tutorial': '/docs/getting-started/tutorials',
  '/tutorial/:path*': '/docs/getting-started/tutorials',
  '/getting-started/node-tutorial': '/docs/getting-started/tutorials',
  '/getting-started/tutorials/node-server-tutorial':
    '/docs/getting-started/tutorials',
  // Wildcard patterns (all sub-paths go to the same destination)
  '/react-tutorial/:path*':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/angular-tutorial/:path*':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/node-tutorial/:path*': '/docs/getting-started/tutorials',
  '/react-standalone-tutorial/:path*':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/angular-standalone-tutorial/:path*':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
};

/**
 * Standalone tutorial redirects (individual routes that don't fit wildcards)
 */
const standaloneTutorialRedirects = {
  '/showcase/example-repos/react-nx':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  // Bare paths (matched before wildcards above)
  '/react-tutorial': '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/react-standalone-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/angular-standalone-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
};

// REMOVED: packagesIndexes (23 routes) - destinations chain through
// /packages/:path* -> /nx-api/:path* -> /technologies/... -> /docs/technologies/...
const packagesIndexes = {};

// REMOVED: packagesDocuments (65 routes) - destinations chain through
// /packages/:path* -> /nx-api/:path* and /recipes/* -> /technologies/*/recipes/*
const packagesDocuments = {};

/**
 * Concept documents Updates (updated 2023-10-18)
 */
const conceptUrls = {
  '/concepts/more-concepts/global-nx':
    '/getting-started/installation#installing-nx-globally',
  '/getting-started/package-based-repo-tutorial':
    '/docs/getting-started/tutorials/typescript-packages-tutorial',
  '/getting-started/tutorials/package-based-repo-tutorial':
    '/docs/getting-started/tutorials/typescript-packages-tutorial',
  '/getting-started/integrated-repo-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/tutorials/integrated-repo-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/react-standalone-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/angular-standalone-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/concepts/more-concepts/micro-frontend-architecture':
    '/concepts/module-federation/micro-frontend-architecture',
  '/concepts/more-concepts/faster-builds-with-module-federation':
    '/concepts/module-federation/faster-builds-with-module-federation',
  '/concepts/more-concepts/nx-and-angular':
    '/nx-api/angular/documents/nx-and-angular',
  '/concepts/more-concepts/nx-devkit-angular-devkit':
    '/nx-api/angular/documents/nx-devkit-angular-devkit',
  '/concepts/more-concepts/incremental-builds':
    '/docs/concepts/buildable-and-publishable-libraries',
  '/concepts/turbo-and-nx': '/docs/guides/adopting-nx/from-turborepo',
};

const nested5minuteTutorialUrls = {
  '/tutorials/package-based-repo-tutorial':
    '/docs/getting-started/tutorials/typescript-packages-tutorial',
  '/getting-started/tutorials/npm-workspaces-tutorial':
    '/docs/getting-started/tutorials/typescript-packages-tutorial',
  '/tutorials/integrated-repo-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/tutorials/react-standalone-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/tutorials/react-standalone-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/tutorials/angular-standalone-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/getting-started/tutorials/angular-standalone-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/getting-started/tutorials/vue-standalone-tutorial':
    '/docs/getting-started/tutorials',
  '/tutorials/node-server-tutorial': '/docs/getting-started/tutorials',
  // Bare /angular-tutorial is needed since wildcard only matches sub-paths
  '/angular-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/getting-started/angular-monorepo-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
};

const pluginUrls = {
  '/plugin-features/create-your-own-plugin':
    '/docs/extending-nx/organization-specific-plugin',
  '/extending-nx/tutorials/create-plugin':
    '/docs/extending-nx/organization-specific-plugin',
  '/extending-nx/tutorials/publish-plugin': '/docs/extending-nx/tooling-plugin',
  '/recipes/advanced-plugins': '/docs/extending-nx',
  '/recipes/advanced-plugins/create-preset': '/docs/extending-nx/create-preset',
  '/recipes/advanced-plugins/migration-generators':
    '/docs/extending-nx/migration-generators',
  '/recipes/advanced-plugins/project-graph-plugins':
    '/docs/extending-nx/project-graph-plugins',
  // Removed inference doc when updating for v2 API
  '/extending-nx/recipes/project-inference-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/recipes/advanced-plugins/project-inference-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/recipes/advanced-plugins/share-your-plugin':
    '/extending-nx/tutorials/maintain-published-plugin',
  '/recipes/executors/compose-executors':
    '/docs/extending-nx/compose-executors',
  '/recipes/executors/creating-custom-executors':
    '/docs/extending-nx/local-executors',
  '/recipes/generators': '/docs/extending-nx',
  '/recipes/generators/composing-generators':
    '/docs/extending-nx/composing-generators',
  '/recipes/generators/creating-files': '/docs/extending-nx/creating-files',
  '/recipes/generators/generator-options': '/docs/extending-nx',
  '/recipes/generators/local-generators': '/docs/extending-nx/local-generators',
  '/recipes/generators/modifying-files': '/docs/extending-nx/modifying-files',
  '/extending-nx/registry': '/docs/plugin-registry',
};

const referenceUrls = {
  '/reference/changelog': '/changelog',
};

const missingAndCatchAllRedirects = {
  // catch all
  '/(l|latest|p|previous)/(a|angular|r|react|n|node)/:path*': '/:path*',
  '/(l|latest|p|previous)/:path*': '/:path*',
  '/(a|angular|n|node)/:path*': '/:path*',
  // Storybook
  '/(l|latest)/(r|react)/storybook/overview':
    '/docs/technologies/test-tools/storybook/guides/overview-react',
  '/(l|latest)/(a|angular)/storybook/overview':
    '/docs/technologies/test-tools/storybook/guides/overview-angular',
  '/(l|latest)/(a|angular|r|react)/storybook/executors':
    '/packages/storybook/executors/storybook',
  // Nx Console
  '/nx-console': '/docs/getting-started/editor-setup',
  '/packages/:path*': '/nx-api/:path*',
};

missingAndCatchAllRedirects['/docs'] = '/docs/getting-started/intro';

const marketing = {
  '/conf': 'https://monorepo.world',
};

const movePluginFeaturesToCore = {
  '/plugin-features/use-task-executors':
    '/docs/concepts/executors-and-configurations',
  '/features/plugin-features/use-task-executors':
    '/docs/concepts/executors-and-configurations',
  '/plugin-features/use-code-generators': '/docs/features/generate-code',
  '/features/plugin-features/use-code-generators':
    '/docs/features/generate-code',
};

const makeMoreConceptsSubmenu = {
  '/more-concepts': '/concepts/more-concepts',
  '/more-concepts/:path*': '/concepts/more-concepts/:path*',
};

const pluginsToExtendNx = {
  '/plugins': '/docs/extending-nx/intro',
  '/plugins/:path*': '/extending-nx/:path*',
};

// (meeroslav) 2023-07-20
const latestRecipesRefactoring = {
  // removed
  '/recipes/getting-started/set-up-a-new-workspace':
    '/docs/getting-started/installation',
  '/recipes/other/misc-ngrx': '/packages/angular/generators/ngrx', // 486 views
  '/recipes/other/misc-data-persistence': '/packages/angular/generators/ngrx', // 200 views
  '/recipes/other/standalone-ngrx-apis': '/packages/angular/generators/ngrx', //47 views -> can be freely removed
  '/recipes/other/export-project-graph': '/recipes/features/explore-graph', // 20 views -> contents moved to explore-graph
  '/recipes/executors/use-executor-configurations':
    '/docs/concepts/executors-and-configurations',
  // ci
  '/recipes/other/azure-last-successful-commit':
    '/docs/guides/nx-cloud/setup-ci',
  // angular
  '/recipes/adopting-nx/migration-angular': '/docs/technologies/angular',
  '/recipes/adopting-nx-angular/angular-integrated':
    '/docs/technologies/angular',
  '/recipes/adopting-nx-angular/angular-manual': '/docs/technologies/angular',
  '/recipes/angular/migration/angular-manual': '/docs/technologies/angular',
  '/recipes/adopting-nx-angular/angular-multiple':
    '/docs/technologies/angular/migration/angular-multiple',
  '/recipes/adopting-nx/migration-angularjs': '/docs/technologies/angular',
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
    '/docs/guides/adopting-nx/adding-to-existing-project',
  '/recipes/react/migration-cra':
    '/docs/guides/adopting-nx/adding-to-existing-project',
  '/recipes/other/react-18': '/nx-api/react',
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
  '/recipes/module-federation/nx-examples': '/docs/getting-started/intro',
  '/recipes/database/nestjs-prisma': '/docs/getting-started/intro',
  '/recipes/database/mongo-fastify': '/docs/getting-started/intro',
  '/recipes/database/redis-fastify': '/docs/getting-started/intro',
  '/recipes/database/postgres-fastify': '/docs/getting-started/intro',
  '/recipes/database/serverless-fastify-planetscale':
    '/docs/getting-started/intro',
  '/recipes/example-repos/:path*': '/showcase/example-repos/:path*',
  // tips and tricks
  '/recipes/environment-variables/define-environment-variables':
    '/docs/guides/tips-n-tricks/define-environment-variables',
  '/recipes/other/eslint': '/docs/technologies/eslint',
  '/recipes/other/browser-support':
    '/docs/guides/tips-n-tricks/browser-support',
  '/recipes/other/include-assets-in-build':
    '/docs/guides/tips-n-tricks/include-assets-in-build',
  '/recipes/other/include-all-packagejson':
    '/docs/guides/tips-n-tricks/include-all-packagejson',
  '/recipes/other/identify-dependencies-between-folders':
    '/docs/guides/tips-n-tricks/identify-dependencies-between-folders',
  '/recipes/managing-repository/root-level-scripts':
    '/docs/guides/tasks--caching/root-level-scripts',
  '/recipes/managing-repository/analyze-source-files':
    '/docs/guides/tips-n-tricks/analyze-source-files',
  '/recipes/managing-repository/workspace-watching':
    '/docs/guides/tasks--caching/workspace-watching',
  '/recipes/managing-repository/standalone-to-integrated':
    '/docs/guides/tips-n-tricks/standalone-to-monorepo',
  '/recipes/managing-repository/js-and-ts':
    '/docs/technologies/typescript/guides/js-and-ts',
  '/recipes/managing-repository/advanced-update':
    '/docs/guides/tips-n-tricks/advanced-update',
  '/recipes/executors/run-commands-executor':
    '/docs/guides/tasks--caching/run-commands-executor',
  // ci
  '/recipes/ci/azure-last-successful-commit': '/docs/guides/nx-cloud/setup-ci',
  // nx concepts
  '/recipes/module-federation/faster-builds':
    '/concepts/module-federation/faster-builds-with-module-federation',
  '/nx-api/js/documents/typescript-project-references':
    '/docs/concepts/typescript-project-linking',
  '/reference/commands': '/docs/reference/nx-commands',
};

const coreFeatureAndConceptsRefactoring = {
  '/features/share-your-cache': '/docs/features/ci-features/remote-cache',
  '/concepts/more-concepts/customizing-inputs':
    '/docs/guides/tasks--caching/configure-inputs',
  '/recipes/tips-n-tricks/root-level-scripts':
    '/docs/guides/tasks--caching/root-level-scripts',
  '/recipes/tips-n-tricks/run-commands-executor':
    '/docs/guides/tasks--caching/run-commands-executor',
  '/recipes/tips-n-tricks/workspace-watching':
    '/docs/guides/tasks--caching/workspace-watching',
  '/recipes/tips-n-tricks/reduce-repetitive-configuration':
    '/docs/guides/tasks--caching/reduce-repetitive-configuration',
  '/concepts/more-concepts/nx-and-the-wrapper':
    '/getting-started/installation#selfmanaged-nx-installation',
  '/recipes/running-tasks/customizing-inputs':
    '/docs/guides/tasks--caching/configure-inputs',
};

// rename nx/linter to eslint
const eslintRename = {
  '/nx-api/linter': '/nx-api/eslint',
  '/nx-api/linter/documents': '/nx-api/eslint/documents',
  '/nx-api/linter/documents/overview': '/docs/technologies/eslint/introduction',
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
  '/recipes/troubleshooting': '/docs/troubleshooting',
  '/recipes/troubleshooting/:path*': '/troubleshooting/:path*',
  '/ci/recipes/troubleshooting/:path*': '/ci/troubleshooting/:path*',
  '/recipes/other/resolve-circular-dependencies':
    '/docs/troubleshooting/resolve-circular-dependencies',
  '/recipes/ci/troubleshoot-nx-install-issues':
    '/docs/troubleshooting/troubleshoot-nx-install-issues',
  '/recipes/other/troubleshoot-cache-misses':
    '/docs/troubleshooting/troubleshoot-cache-misses',
  '/recipes/other/unknown-local-cache':
    '/docs/troubleshooting/unknown-local-cache',
  '/recipes/other/performance-profiling':
    '/docs/troubleshooting/performance-profiling',
};

/**
 * Removed deprecated URLs
 */
const removedDeprecatedUrls = {
  '/concepts/integrated-vs-package-based':
    '/deprecated/integrated-vs-package-based',
  '/recipes/tips-n-tricks/package-based-in-integrated':
    '/deprecated/integrated-vs-package-based',
  '/recipes/tips-n-tricks/integrated-in-package-based':
    '/deprecated/integrated-vs-package-based',
  '/recipes/tips-n-tricks/standalone-to-integrated':
    '/docs/guides/tips-n-tricks/standalone-to-monorepo',
  '/recipes/other/rescope': '/deprecated/rescope', // Removed in Nx 20
  '/nx-api/nx/documents/affected-dep-graph': '/deprecated/affected-graph', // nx affected:graph was removed in Nx 19
  '/nx/affected-dep-graph': '/deprecated/affected-graph',
  '/nx-api/nx/documents/print-affected': '/deprecated/print-affected', // nx affected:graph was removed in Nx 19
  '/packages/nx/documents/print-affected': '/deprecated/print-affected',
  '/nx/affected-apps': '/deprecated/print-affected',
  '/nx/affected-libs': '/deprecated/print-affected',
  '/nx/print-affected': '/deprecated/print-affected',
  '/packages/nx/documents/affected-apps': '/deprecated/print-affected',
  '/packages/nx/documents/affected-libs': '/deprecated/print-affected',
  '/deprecated/default-collection': '/docs/features/generate-code', // 46 views: has not worked since Nx 17 and has very little views
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
  '/deprecated/custom-task-runners': '/deprecated/legacy-cache',
};

const decisionsSection = {
  '/concepts/more-concepts/why-monorepos':
    '/docs/concepts/decisions/why-monorepos',
  '/concepts/more-concepts/dependency-management':
    '/docs/concepts/decisions/dependency-management',
  '/concepts/more-concepts/code-sharing':
    '/docs/concepts/decisions/code-ownership',
  '/concepts/more-concepts/applications-and-libraries':
    '/docs/concepts/decisions/project-size',
  '/concepts/more-concepts/creating-libraries':
    '/docs/concepts/decisions/project-size',
  '/concepts/more-concepts/library-types':
    '/docs/concepts/decisions/project-dependency-rules',
  '/concepts/more-concepts/grouping-libraries':
    '/docs/concepts/decisions/folder-structure',
  '/concepts/more-concepts/turbo-and-nx':
    '/docs/guides/adopting-nx/from-turborepo',
  '/concepts/more-concepts/nx-daemon': '/docs/concepts/nx-daemon',
  '/concepts/more-concepts/buildable-and-publishable-libraries':
    '/docs/concepts/buildable-and-publishable-libraries',
};
// Blog post redirects
const blogPosts = {
  '/blog/2024-05-07-nx-19-release': '/blog/nx-19-release',
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

const featurePagesUpdate = {
  '/ci/troubleshooting/explain-with-ai':
    '/docs/features/ci-features/self-healing-ci',
  '/ci/concepts/ai-features': '/docs/features/ci-features/self-healing-ci',
  '/ci/concepts/nx-cloud-ai': '/docs/features/ci-features/self-healing-ci',
  '/concepts/ci-concepts/ai-features':
    '/docs/features/ci-features/self-healing-ci',
};

const enterpriseNxSection = {
  '/features/powerpack': '/docs/enterprise',
  '/features/powerpack/conformance': '/docs/enterprise/conformance',
  '/features/powerpack/owners': '/docs/enterprise/owners',
  '/features/powerpack/custom-caching':
    '/docs/guides/tasks--caching/self-hosted-caching',
  '/recipes/installation/activate-powerpack':
    '/docs/enterprise/activate-license',
};

const manualDTEUpdate = {
  '/ci/recipes/enterprise/dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/github-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/circle-ci-dte':
    '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/azure-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/bitbucket-dte':
    '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/gitlab-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/enterprise/dte/jenkins-dte': '/docs/guides/nx-cloud/manual-dte',
  '/showcase/benchmarks/dte': '/docs/reference/benchmarks/nx-agents',
};

const powerpackRedirects = {
  '/powerpack/:path*': '/enterprise',
  '/nx-enterprise/powerpack/custom-caching':
    '/docs/guides/tasks--caching/self-hosted-caching',
  '/nx-enterprise/powerpack/free-licenses-and-trials': '/docs/enterprise',

  // Redirects for renamed powerpack packages
  '/nx-api/powerpack-owners': '/nx-api/owners',
  '/nx-api/powerpack-owners/documents/overview':
    '/docs/reference/owners/overview',

  '/nx-api/powerpack-conformance': '/nx-api/conformance',
  '/nx-api/powerpack-conformance/documents/overview':
    '/nx-api/conformance/documents/overview',
  '/nx-api/powerpack-conformance/documents/create-conformance-rule':
    '/nx-api/conformance/documents/create-conformance-rule',

  '/nx-api/powerpack-azure-cache': '/nx-api/azure-cache',
  '/nx-api/powerpack-azure-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',

  '/nx-api/powerpack-gcs-cache': '/nx-api/gcs-cache',
  '/nx-api/powerpack-gcs-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/gcs-cache/overview',

  '/nx-api/powerpack-s3-cache': '/nx-api/s3-cache',
  '/nx-api/powerpack-s3-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/s3-cache/overview',

  '/nx-api/powerpack-shared-fs-cache': '/nx-api/shared-fs-cache',
  '/nx-api/powerpack-shared-fs-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/overview',

  // Reference redirects from powerpack to new structure
  '/docs/reference/powerpack/conformance': '/docs/reference/conformance',
  '/docs/reference/powerpack/conformance/overview':
    '/docs/reference/conformance/overview',
  '/docs/reference/powerpack/conformance/create-conformance-rule':
    '/docs/reference/conformance/create-conformance-rule',
  '/docs/reference/powerpack/conformance/executors':
    '/docs/reference/conformance/executors',
  '/docs/reference/powerpack/conformance/generators':
    '/docs/reference/conformance/generators',
  '/docs/reference/powerpack/owners': '/docs/reference/owners',
  '/docs/reference/powerpack/owners/overview':
    '/docs/reference/owners/overview',
  '/docs/reference/powerpack/owners/generators':
    '/docs/reference/owners/generators',

  // Enterprise redirects from powerpack to new structure
  '/docs/enterprise/powerpack': '/docs/enterprise',
  '/docs/enterprise/powerpack/conformance': '/docs/enterprise/conformance',
  '/docs/enterprise/powerpack/owners': '/docs/enterprise/owners',
  '/docs/enterprise/powerpack/configure-conformance-rules-in-nx-cloud':
    '/docs/enterprise/configure-conformance-rules-in-nx-cloud',
  '/docs/enterprise/powerpack/publish-conformance-rules-to-nx-cloud':
    '/docs/enterprise/publish-conformance-rules-to-nx-cloud',
  '/docs/enterprise/powerpack/licenses-and-trials': '/docs/enterprise',
  '/docs/enterprise/activate-powerpack': '/docs/enterprise/activate-license',
};

const tmpTerminalUiRedirects = {
  // This will be a dedicated landing page in a follow up, redirect to the recipe for now
  '/terminal-ui': '/docs/guides/tasks--caching/terminal-ui',
};

const nxApiRedirects = {
  // Old index page lists official plugins, so redirect to plugin registry
  '/nx-api': '/docs/plugin-registry',
  // Reference
  '/nx-api/azure-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',
  '/nx-api/owners/documents/overview': '/docs/reference/owners/overview',
  '/nx-api/gcs-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/gcs-cache/overview',
  '/nx-api/s3-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/s3-cache/overview',
  '/nx-api/shared-fs-cache/documents/overview':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/overview',
  '/nx-api/devkit/:slug*': '/reference/core-api/devkit/:slug*',
  '/nx-api/nx/:slug*': '/reference/core-api/nx/:slug*',
  '/nx-api/workspace/:slug*': '/reference/core-api/workspace/:slug*',
  '/nx-api/plugin/documents/:slug*': '/reference/core-api/plugin',
  '/nx-api/plugin/:slug*': '/reference/core-api/plugin/:slug*',
  '/nx-api/web/documents/:slug*': '/reference/core-api/web',
  '/nx-api/web/:slug*': '/reference/core-api/web/:slug*',
  '/nx-api/web': '/docs/technologies/build-tools/web/introduction',
  '/nx-api/azure-cache/:slug*': '/reference/core-api/azure-cache/:slug*',
  '/nx-api/conformance/:slug*': '/reference/core-api/conformance/:slug*',
  '/nx-api/owners/:slug*': '/reference/core-api/owners/:slug*',
  '/nx-api/gcs-cache/:slug*': '/reference/core-api/gcs-cache/:slug*',
  '/nx-api/s3-cache/:slug*': '/reference/core-api/s3-cache/:slug*',
  '/nx-api/shared-fs-cache/:slug*':
    '/reference/core-api/shared-fs-cache/:slug*',
  // These don't exist and never provided any actual content so let's just redirect to core api
  '/nx-api/create-nx-plugin/:slug*': '/reference/core-api',
  '/nx-api/create-nx-workspace/migrations/:slug*': '/reference/core-api',
  '/nx-api/create-nx-workspace/generators/:slug*': '/reference/core-api',
  '/nx-api/create-nx-workspace/executors/:slug*': '/reference/core-api',
  '/nx-api/create-nx-workspace/documents': '/docs/reference',
  '/nx-api/create-nx-workspace/:slug*':
    '/reference/core-api/create-nx-workspace/:slug*',
  // Angular Rspack and Rsbuild -- these never had executors, generators, or migrations
  // We'll just redirect them to the API index, and make sure create-server and create-config exist
  '/nx-api/angular-rspack/documents/create-config':
    '/docs/technologies/angular/angular-rspack/create-config',
  '/nx-api/angular-rspack/documents/create-server':
    '/docs/technologies/angular/angular-rspack/create-server',
  '/nx-api/angular-rsbuild/documents/create-config':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/nx-api/angular-rsbuild/documents/create-server':
    '/docs/technologies/angular/angular-rsbuild/create-server',
  '/nx-api/angular-rspack/documents':
    '/docs/technologies/angular/angular-rspack/introduction',
  '/nx-api/angular-rsbuild/documents':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/nx-api/angular-rspack/executors':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/nx-api/angular-rsbuild/executors':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/nx-api/angular-rspack':
    '/docs/technologies/angular/angular-rspack/introduction',
  '/nx-api/angular-rsbuild':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/nx-api/angular-rspack/migrations':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/nx-api/angular-rsbuild/migrations':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/nx-api/angular-rspack/generators':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/nx-api/angular-rsbuild/generators':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  // Technologies
  '/nx-api/angular/documents/overview':
    '/docs/technologies/angular/introduction',
  '/nx-api/angular': '/docs/technologies/angular/introduction',
  '/nx-api/react/documents/overview': '/docs/technologies/react/introduction',
  '/nx-api/react': '/docs/technologies/react/introduction',
  '/nx-api/react-native/documents/overview':
    '/docs/technologies/react/react-native/introduction',
  '/nx-api/react-native': '/docs/technologies/react/react-native/introduction',
  '/nx-api/vue/documents': '/docs/technologies/vue/introduction',
  '/nx-api/vue/documents/overview': '/docs/technologies/vue/introduction',
  '/nx-api/vue': '/docs/technologies/vue/introduction',
  '/nx-api/next/documents/overview':
    '/docs/technologies/react/next/introduction',
  '/nx-api/next': '/docs/technologies/react/next/introduction',
  '/nx-api/remix/documents/overview':
    '/docs/technologies/react/remix/introduction',
  '/nx-api/remix': '/docs/technologies/react/remix/introduction',
  '/nx-api/nuxt/documents/overview': '/docs/technologies/vue/nuxt/introduction',
  '/nx-api/nuxt': '/docs/technologies/vue/nuxt/introduction',
  '/nx-api/expo/documents/overview':
    '/docs/technologies/react/expo/introduction',
  '/nx-api/expo': '/docs/technologies/react/expo/introduction',
  '/nx-api/nest/documents': '/docs/technologies/node/nest/introduction',
  '/nx-api/nest/documents/overview':
    '/docs/technologies/node/nest/introduction',
  '/nx-api/nest': '/docs/technologies/node/nest/introduction',
  '/nx-api/express/documents': '/docs/technologies/node/express/introduction',
  '/nx-api/express/documents/overview':
    '/docs/technologies/node/express/introduction',
  '/nx-api/express': '/docs/technologies/node/express/introduction',
  '/nx-api/node/documents/overview': '/docs/technologies/node/introduction',
  '/nx-api/node': '/docs/technologies/node/introduction',
  '/nx-api/webpack/documents/overview':
    '/docs/technologies/build-tools/webpack/introduction',
  '/nx-api/webpack': '/docs/technologies/build-tools/webpack/introduction',
  '/nx-api/vite/documents/overview':
    '/docs/technologies/build-tools/vite/introduction',
  '/nx-api/vite': '/docs/technologies/build-tools/vite/introduction',
  '/nx-api/rollup/documents/overview':
    '/docs/technologies/build-tools/rollup/introduction',
  '/nx-api/rollup': '/docs/technologies/build-tools/rollup/introduction',
  '/nx-api/esbuild/documents/overview':
    '/docs/technologies/build-tools/esbuild/introduction',
  '/nx-api/esbuild': '/docs/technologies/build-tools/esbuild/introduction',
  '/nx-api/rspack/documents/overview':
    '/docs/technologies/build-tools/rspack/introduction',
  '/nx-api/rspack': '/docs/technologies/build-tools/rspack/introduction',
  '/nx-api/rsbuild/documents/overview':
    '/docs/technologies/build-tools/rsbuild/introduction',
  '/nx-api/rsbuild': '/docs/technologies/build-tools/rsbuild/introduction',
  '/nx-api/cypress/documents/overview':
    '/docs/technologies/test-tools/cypress/introduction',
  '/nx-api/jest/documents/overview':
    '/docs/technologies/test-tools/jest/introduction',
  '/nx-api/playwright/documents/overview':
    '/docs/technologies/test-tools/playwright/introduction',
  '/nx-api/storybook/documents/overview':
    '/docs/technologies/test-tools/storybook/introduction',
  '/nx-api/storybook': '/docs/technologies/test-tools/storybook/introduction',
  '/nx-api/detox/documents/overview':
    '/docs/technologies/test-tools/detox/introduction',
  '/nx-api/detox': '/docs/technologies/test-tools/detox/introduction',
  '/nx-api/js/documents/overview': '/docs/technologies/typescript/introduction',
  '/nx-api/js': '/docs/technologies/typescript/introduction',
  '/nx-api/gradle/documents': '/docs/technologies/java/gradle/introduction',
  '/nx-api/gradle/documents/overview':
    '/docs/technologies/java/gradle/introduction',
  '/nx-api/gradle': '/docs/technologies/java/gradle/introduction',
  '/nx-api/eslint/documents/overview': '/docs/technologies/eslint/introduction',
  '/nx-api/eslint-plugin/documents/overview':
    '/docs/technologies/eslint/eslint-plugin',
  '/nx-api/module-federation/documents/overview':
    '/docs/technologies/module-federation/introduction',
  '/nx-api/module-federation':
    '/docs/technologies/module-federation/introduction',
  '/nx-api/vitest': '/docs/technologies/test-tools/vitest/introduction',
  '/nx-api/vitest/generators/configuration':
    '/docs/technologies/test-tools/vitest/guides',
  // Wildcard rules (must come after specific rules)
  '/nx-api/angular/documents/:slug*': '/technologies/angular/recipes/:slug*',
  '/nx-api/angular/:slug*': '/technologies/angular/api/:slug*',
  '/nx-api/react/documents/:slug*': '/technologies/react/recipes/:slug*',
  '/nx-api/react/:slug*': '/technologies/react/api/:slug*',
  '/nx-api/react-native/documents/:slug*':
    '/technologies/react/react-native/recipes/:slug*',
  '/nx-api/react-native/:slug*': '/technologies/react/react-native/api/:slug*',
  '/nx-api/vue/documents/:slug*': '/technologies/vue/recipes/:slug*',
  '/nx-api/vue/:slug*': '/technologies/vue/api/:slug*',
  '/nx-api/next/documents/:slug*': '/technologies/react/next/recipes/:slug*',
  '/nx-api/next/:slug*': '/technologies/react/next/api/:slug*',
  '/nx-api/remix/documents/:slug*': '/technologies/react/remix/recipes/:slug*',
  '/nx-api/remix/:slug*': '/technologies/react/remix/api/:slug*',
  '/nx-api/nuxt/documents/:slug*': '/technologies/vue/nuxt/recipes/:slug*',
  '/nx-api/nuxt/:slug*': '/technologies/vue/nuxt/api/:slug*',
  '/nx-api/expo/documents/:slug*': '/technologies/react/expo/recipes/:slug*',
  '/nx-api/expo/:slug*': '/technologies/react/expo/api/:slug*',
  '/nx-api/nest/documents/:slug*': '/technologies/nest/recipes/:slug*',
  '/nx-api/nest/:slug*': '/technologies/node/nest/api/:slug*',
  '/nx-api/express/documents/:slug*':
    '/technologies/node/express/recipes/:slug*',
  '/nx-api/express/:slug*': '/technologies/node/express/api/:slug*',
  '/nx-api/node/documents/:slug*': '/technologies/node/recipes/:slug*',
  '/nx-api/node/:slug*': '/technologies/node/api/:slug*',
  '/nx-api/webpack/documents/:slug*':
    '/technologies/build-tools/webpack/recipes/:slug*',
  '/nx-api/webpack/:slug*': '/technologies/build-tools/webpack/api/:slug*',
  '/nx-api/vite/documents/:slug*':
    '/technologies/build-tools/vite/recipes/:slug*',
  '/nx-api/vite/:slug*': '/technologies/build-tools/vite/api/:slug*',
  '/nx-api/rollup/documents/:slug*':
    '/technologies/build-tools/rollup/recipes/:slug*',
  '/nx-api/rollup/:slug*': '/technologies/build-tools/rollup/api/:slug*',
  '/nx-api/esbuild/documents/:slug*':
    '/technologies/build-tools/esbuild/recipes/:slug*',
  '/nx-api/esbuild/:slug*': '/technologies/build-tools/esbuild/api/:slug*',
  '/nx-api/rspack/documents/:slug*':
    '/technologies/build-tools/rspack/recipes/:slug*',
  '/nx-api/rspack/:slug*': '/technologies/build-tools/rspack/api/:slug*',
  '/nx-api/rsbuild/documents/:slug*':
    '/technologies/build-tools/rsbuild/recipes/:slug*',
  '/nx-api/rsbuild/:slug*': '/technologies/build-tools/rsbuild/api/:slug*',
  '/nx-api/cypress/documents/:slug*':
    '/technologies/test-tools/cypress/recipes/:slug*',
  '/nx-api/cypress/:slug*': '/technologies/test-tools/cypress/api/:slug*',
  '/nx-api/jest/documents/:slug*':
    '/technologies/test-tools/jest/recipes/:slug*',
  '/nx-api/jest/:slug*': '/technologies/test-tools/jest/api/:slug*',
  '/nx-api/playwright/documents/:slug*':
    '/technologies/test-tools/playwright/recipes/:slug*',
  '/nx-api/playwright/:slug*': '/technologies/test-tools/playwright/api/:slug*',
  '/nx-api/storybook/documents/:slug*':
    '/technologies/test-tools/storybook/recipes/:slug*',
  '/nx-api/storybook/:slug*': '/technologies/test-tools/storybook/api/:slug*',
  '/nx-api/detox/documents/:slug*':
    '/technologies/test-tools/detox/recipes/:slug*',
  '/nx-api/detox/:slug*': '/technologies/test-tools/detox/api/:slug*',
  '/nx-api/js/documents/:slug*': '/technologies/typescript/recipes/:slug*',
  '/nx-api/js/:slug*': '/technologies/typescript/api/:slug*',
  '/nx-api/gradle/documents/:slug*': '/technologies/java/recipes/:slug*',
  '/nx-api/gradle/:slug*': '/technologies/java/api/:slug*',
  '/nx-api/eslint/documents/:slug*': '/technologies/eslint/recipes/:slug*',
  '/nx-api/eslint/:slug*': '/technologies/eslint/api/:slug*',
  '/nx-api/eslint-plugin/documents/:slug*':
    '/technologies/eslint/eslint-plugin/recipes/:slug*',
  '/nx-api/eslint-plugin/:slug*':
    '/technologies/eslint/eslint-plugin/api/:slug*',
  '/nx-api/module-federation/documents/:slug*':
    '/technologies/module-federation/recipes/:slug*',
  '/nx-api/module-federation/:slug*':
    '/technologies/module-federation/api/:slug*',
};

const legacyPluginOverviewRedirects = {
  '/cypress/overview': '/docs/technologies/test-tools/cypress/introduction',
  '/detox/overview': '/docs/technologies/test-tools/detox/introduction',
  '/jest/overview': '/docs/technologies/test-tools/jest/introduction',
  '/expo/overview': '/docs/technologies/react/expo/introduction',
  '/express/overview': '/docs/technologies/node/express/introduction',
  '/nest/overview': '/docs/technologies/node/nest/introduction',
  '/next/overview': '/docs/technologies/react/next/introduction',
  '/js/overview': '/docs/technologies/typescript/introduction',
};

const deprecatedReferenceRedirects = {
  '/deprecated/global-implicit-dependencies':
    '/docs/reference/deprecated/global-implicit-dependencies',
  '/deprecated/affected-config': '/docs/reference/deprecated/affected-config',
  '/deprecated/custom-tasks-runner':
    '/docs/reference/deprecated/custom-tasks-runner',
  '/deprecated/legacy-cache': '/docs/reference/deprecated/legacy-cache',
};

const commandRedirects = {
  '/nx/affected': '/docs/reference/nx-commands#nx-affected',
};

const canonicalSiteRedirects = {
  '/blog/': '/blog',
  '/technologies/java/gradle/introduction':
    '/docs/technologies/java/gradle/introduction',
  '/technologies/java/maven/introduction':
    '/docs/technologies/java/maven/introduction',
};

// We got rid of `/recipes` URLs, so we need to redirect them to new /technologies or /reference URLs.
const nxRecipesRedirects = {
  // Recipes index pages
  '/recipes/module-federation':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/recipes/react': '/docs/technologies/react/guides/adding-assets-react',
  '/recipes/angular':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/recipes/node': '/docs/technologies/node/guides/application-proxies',
  '/recipes/storybook': '/docs/technologies/test-tools/storybook/guides',
  '/recipes/cypress':
    '/docs/technologies/test-tools/cypress/guides/cypress-component-testing',
  '/recipes/next': '/docs/technologies/react/next/guides',
  '/recipes/nuxt': '/docs/technologies/vue/nuxt/guides',
  '/recipes/vite': '/docs/technologies/build-tools/vite/guides',
  '/recipes/webpack': '/docs/technologies/build-tools/webpack/guides',
  // Recipes sub-pages
  '/recipes/module-federation/:slug*':
    '/technologies/module-federation/recipes/:slug*',
  '/recipes/react/:slug*': '/technologies/react/recipes/:slug*',
  '/recipes/node/:slug*': '/technologies/node/recipes/:slug*',
  '/recipes/storybook/:slug*':
    '/technologies/test-tools/storybook/recipes/:slug*',
  '/recipes/cypress/:slug*': '/technologies/test-tools/cypress/recipes/:slug*',
  '/recipes/next/:slug*': '/technologies/react/next/recipes/:slug*',
  '/recipes/nuxt/:slug*': '/technologies/vue/nuxt/recipes/:slug*',
  '/recipes/vite/:slug*': '/technologies/build-tools/vite/recipes/:slug*',
  '/recipes/webpack/:slug*': '/technologies/build-tools/webpack/recipes/:slug*',
  // Angular - has some special cases for angular-rspack
  '/recipes/angular/rspack':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/recipes/angular/rspack/introduction':
    '/docs/technologies/angular/angular-rspack/introduction',
  '/recipes/angular/rspack/:slug*':
    '/technologies/angular/angular-rspack/recipes/:slug*',
  '/recipes/angular/migration': '/docs/technologies/angular/migration',
  '/recipes/angular/migration/angular': '/docs/technologies/angular',
  '/recipes/angular/migration/angular-multiple':
    '/docs/technologies/angular/migration/angular-multiple',
  '/recipes/angular/:slug*': '/technologies/angular/recipes/:slug*',
  // Tips-n-tricks - keeping individual because destinations vary greatly
  '/recipes/tips-n-tricks/eslint': '/docs/technologies/eslint',
  '/recipes/tips-n-tricks/flat-config':
    '/docs/technologies/eslint/guides/flat-config',
  '/recipes/tips-n-tricks/switch-to-workspaces-project-references':
    '/docs/technologies/typescript/guides/switch-to-workspaces-project-references',
  '/recipes/tips-n-tricks/enable-tsc-batch-mode':
    '/docs/technologies/typescript/guides/enable-tsc-batch-mode',
  '/recipes/tips-n-tricks/define-secondary-entrypoints':
    '/docs/technologies/typescript/guides/define-secondary-entrypoints',
  '/recipes/tips-n-tricks/compile-multiple-formats':
    '/docs/technologies/typescript/guides/compile-multiple-formats',
  '/recipes/tips-n-tricks/js-and-ts':
    '/docs/technologies/typescript/guides/js-and-ts',
};

const nxModuleFederationConceptsRedirects = {
  '/concepts/module-federation/:slug*':
    '/technologies/module-federation/concepts/:slug*',
};
const contentDedupeRedirects = {};

const gettingStartedRedirects = {
  '/getting-started/why-nx': '/docs/getting-started/intro',
};

// Pricing page: 07/08/25
const pricingRedirects = {
  '/pricing': '/nx-cloud#plans',
};

// Removed CI tutorials: 07/21/25
const ciTutorialRedirects = {
  '/ci/intro/tutorials/circle': '/docs/guides/nx-cloud/setup-ci',
  '/ci/intro/tutorials/github-actions':
    '/ci/recipes/set-up/monorepo-ci-github-actions',
};

const dockerReleaseRedirect = {
  '/recipes/nx-release/get-started-with-nx-release':
    '/docs/guides/nx-release/release-npm-packages',
};

const removeEvolvingNx = {
  '/blog/evolving-nx': '/blog/introducing-nx-powerpack',
};

const pageCleanUp = {
  '/advent-of-code ': '/',
  '/launch-nx ': '/',
  '/ai': '/',
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
  eslintRename,
  removedDeprecatedUrls,
  troubleshootingOutOfRecipes,
  blogPosts,
  decisionsSection,
  featurePagesUpdate,
  marketing,
  enterpriseNxSection,
  manualDTEUpdate,
  powerpackRedirects,
  tmpTerminalUiRedirects,
  legacyPluginOverviewRedirects,
  deprecatedReferenceRedirects,
  commandRedirects,
  canonicalSiteRedirects,
  nxApiRedirects,
  nxRecipesRedirects,
  nxModuleFederationConceptsRedirects,
  gettingStartedRedirects,
  pricingRedirects,
  ciTutorialRedirects,
  dockerReleaseRedirect,
  contentDedupeRedirects,
  docsToAstroRedirects: docsToAstroRedirects,
  removeEvolvingNx,
  pageCleanUp,
};
