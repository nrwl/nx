// Consolidated redirect rules for docs to Astro migration
// Wildcards reduce individual redirects by using pattern matching
// Original: 1073 entries, Consolidated: 710 entries
const docsToAstroRedirects = {
  // ========== EXCEPTIONS (must be before wildcards) ==========
  // convert-to-inferred routes all go to the same destination
  '/technologies/test-tools/cypress/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/detox/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/eslint/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/expo/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/jest/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/next/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/playwright/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/react-native/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/remix/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/rollup/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/rspack/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/storybook/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/vite/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/webpack/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',

  // ========== WILDCARD PATTERNS ==========
  // These wildcards replace many individual redirect rules

  // devkit/documents exceptions (must be before wildcard)
  '/reference/core-api/devkit/documents/README': '/docs/reference/devkit',
  '/reference/core-api/devkit/documents/ngcli_adapter/README':
    '/docs/reference/devkit/ngcli_adapter',
  '/reference/core-api/devkit/documents/runTasksInSerial':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/serializeJson':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/stripIndents':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/:slug*':
    '/docs/reference/devkit/:slug*',
  '/reference/core-api/nx/documents/:slug*': '/docs/reference/nx-commands',
  '/technologies/react/expo/api/executors/:slug*':
    '/docs/technologies/react/expo/executors',
  '/technologies/angular/api/executors/:slug*':
    '/docs/technologies/angular/executors',
  '/technologies/react/react-native/api/executors/:slug*':
    '/docs/technologies/react/react-native/executors',
  '/technologies/typescript/api/executors/:slug*':
    '/docs/technologies/typescript/executors',
  '/technologies/build-tools/rspack/api/executors/:slug*':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/vite/api/executors/:slug*':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/webpack/api/executors/:slug*':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/react/api/executors/:slug*':
    '/docs/technologies/react/executors',
  '/technologies/test-tools/detox/api/executors/:slug*':
    '/docs/technologies/test-tools/detox/executors',
  '/technologies/react/next/api/executors/:slug*':
    '/docs/technologies/react/next/executors',
  '/technologies/react/remix/api/executors/:slug*':
    '/docs/technologies/react/remix/executors',
  '/technologies/test-tools/storybook/api/executors/:slug*':
    '/docs/technologies/test-tools/storybook/executors',
  '/technologies/test-tools/cypress/api/executors/:slug*':
    '/docs/technologies/test-tools/cypress/executors',
  '/technologies/test-tools/jest/api/executors/:slug*':
    '/docs/technologies/test-tools/jest/executors',
  '/technologies/test-tools/playwright/api/executors/:slug*':
    '/docs/technologies/test-tools/playwright/executors',
  '/technologies/build-tools/rollup/api/executors/:slug*':
    '/docs/technologies/build-tools/rollup/executors',
  '/technologies/eslint/api/executors/:slug*':
    '/docs/technologies/eslint/executors',
  '/technologies/angular/api/generators/:slug*':
    '/docs/technologies/angular/generators',
  '/technologies/node/nest/api/generators/:slug*':
    '/docs/technologies/node/nest/generators',
  '/technologies/react/api/generators/:slug*':
    '/docs/technologies/react/generators',
  '/technologies/typescript/api/generators/:slug*':
    '/docs/technologies/typescript/generators',
  '/technologies/vue/api/generators/:slug*':
    '/docs/technologies/vue/generators',
  '/technologies/node/api/generators/:slug*':
    '/docs/technologies/node/generators',
  '/technologies/vue/nuxt/api/generators/:slug*':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/build-tools/esbuild/api/generators/:slug*':
    '/docs/technologies/build-tools/esbuild/generators',
  '/technologies/node/express/api/generators/:slug*':
    '/docs/technologies/node/express/generators',
  '/technologies/build-tools/rsbuild/api/generators/:slug*':
    '/docs/technologies/build-tools/rsbuild/generators',
  '/technologies/java/api/generators/:slug*':
    '/docs/technologies/java/generators',
  '/technologies/react/remix/api/generators/:slug*':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/next/api/generators/:slug*':
    '/docs/technologies/react/next/generators',
  '/technologies/build-tools/rspack/api/generators/:slug*':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/react/react-native/api/generators/:slug*':
    '/docs/technologies/react/react-native/generators',
  '/technologies/test-tools/cypress/api/generators/:slug*':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/eslint/api/generators/:slug*':
    '/docs/technologies/eslint/generators',
  '/technologies/react/expo/api/generators/:slug*':
    '/docs/technologies/react/expo/generators',
  '/technologies/test-tools/storybook/api/generators/:slug*':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/build-tools/vite/api/generators/:slug*':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/webpack/api/generators/:slug*':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/test-tools/detox/api/generators/:slug*':
    '/docs/technologies/test-tools/detox/generators',
  '/technologies/test-tools/jest/api/generators/:slug*':
    '/docs/technologies/test-tools/jest/generators',
  '/technologies/test-tools/playwright/api/generators/:slug*':
    '/docs/technologies/test-tools/playwright/generators',
  '/technologies/build-tools/rollup/api/generators/:slug*':
    '/docs/technologies/build-tools/rollup/generators',
  '/getting-started/:path*': '/docs/getting-started/intro',

  // ========== SPECIFIC REDIRECTS ==========
  // Individual redirects that don't fit wildcard patterns
  '/ci/getting-started': '/docs/getting-started/nx-cloud',
  '/ci/getting-started/intro': '/docs/getting-started/nx-cloud',
  '/ci/features': '/docs/features/ci-features',
  '/ci/features/self-healing-ci': '/docs/features/ci-features/self-healing-ci',
  '/ci/features/remote-cache': '/docs/features/ci-features/remote-cache',
  '/ci/features/distribute-task-execution':
    '/docs/features/ci-features/distribute-task-execution',
  '/ci/features/affected': '/docs/features/ci-features/affected',
  '/ci/features/dynamic-agents': '/docs/features/ci-features/dynamic-agents',
  '/ci/features/split-e2e-tasks': '/docs/features/ci-features/split-e2e-tasks',
  '/ci/features/flaky-tasks': '/docs/features/ci-features/flaky-tasks',
  '/ci/features/explain-with-ai': '/docs/features/ci-features/self-healing-ci',
  '/ci/features/github-integration':
    '/docs/features/ci-features/github-integration',
  '/ci/concepts': '/docs/concepts/ci-concepts',
  '/ci/concepts/building-blocks-fast-ci':
    '/docs/concepts/ci-concepts/building-blocks-fast-ci',
  '/ci/concepts/reduce-waste': '/docs/concepts/ci-concepts/reduce-waste',
  '/ci/concepts/parallelization-distribution':
    '/docs/concepts/ci-concepts/parallelization-distribution',
  '/ci/concepts/cache-security': '/docs/concepts/ci-concepts/cache-security',
  '/ci/concepts/heartbeat':
    '/docs/concepts/ci-concepts/heartbeat-and-manual-shutdown-handling',
  '/ci/recipes/security/google-auth': '/docs/guides/nx-cloud/google-auth',
  '/ci/recipes/security/access-tokens': '/docs/guides/nx-cloud/access-tokens',
  '/ci/recipes/security/personal-access-tokens':
    '/docs/guides/nx-cloud/personal-access-tokens',
  '/ci/recipes/security/encryption': '/docs/guides/nx-cloud/encryption',
  '/ci/recipes/source-control-integration':
    '/docs/guides/nx-cloud/source-control-integration',
  '/ci/recipes/source-control-integration/:path*':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/enterprise': '/docs/enterprise',
  '/ci/recipes/enterprise/single-tenant/auth-saml':
    '/docs/enterprise/single-tenant',
  '/ci/recipes/enterprise/single-tenant/:path*':
    '/docs/enterprise/single-tenant/:path*',
  '/ci/recipes/enterprise/conformance': '/docs/enterprise/conformance',
  '/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud':
    '/docs/enterprise/configure-conformance-rules-in-nx-cloud',
  '/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud':
    '/docs/enterprise/publish-conformance-rules-to-nx-cloud',
  '/ci/recipes/enterprise/polygraph': '/docs/enterprise/polygraph',
  '/ci/recipes/enterprise/metadata-only-workspace':
    '/docs/enterprise/metadata-only-workspace',
  '/ci/recipes/enterprise/custom-workflows':
    '/docs/enterprise/custom-workflows',
  '/ci/recipes/other/record-commands': '/docs/guides/nx-cloud/record-commands',
  '/ci/recipes/other/ci-deployment': '/docs/guides/ci-deployment',
  '/ci/recipes/other/cipe-affected-project-graph':
    '/docs/guides/nx-cloud/cipe-affected-project-graph',
  '/ci/reference': '/docs/reference',
  '/ci/reference/config': '/docs/reference/nx-cloud/config',
  '/ci/reference/nx-cloud-cli': '/docs/reference/nx-cloud-cli',
  '/ci/reference/launch-templates': '/docs/reference/nx-cloud/launch-templates',
  '/ci/troubleshooting': '/docs/troubleshooting',
  '/ci/troubleshooting/ci-execution-failed':
    '/docs/troubleshooting/ci-execution-failed',
  '/ci/recipes/enterprise/single-tenant':
    '/docs/enterprise/single-tenant/overview',
  '/ci/reference/assignment-rules': '/docs/reference/nx-cloud/assignment-rules',
  '/ci/reference/custom-steps': '/docs/reference/nx-cloud/custom-steps',
  '/ci/reference/custom-images': '/docs/reference/nx-cloud/custom-images',
  '/ci/reference/env-vars': '/docs/reference/environment-variables',
  '/ci/reference/credits-pricing': '/docs/reference/nx-cloud/credits-pricing',
  '/ci/reference/release-notes': '/docs/reference/nx-cloud/release-notes',
  '/concepts': '/docs/concepts',
  '/concepts/:path*': '/docs/concepts/:path*',
  // /extending-nx exceptions (don't follow simple prepend pattern)
  '/extending-nx/intro/getting-started': '/docs/extending-nx/intro',
  '/extending-nx/api/nx-devkit/overview': '/docs/extending-nx',
  '/extending-nx/api/plugin/overview': '/docs/extending-nx',
  '/extending-nx/tutorials': '/docs/extending-nx',
  '/extending-nx/tutorials/organization-specific-plugin':
    '/docs/extending-nx/organization-specific-plugin',
  '/extending-nx/tutorials/tooling-plugin': '/docs/extending-nx/tooling-plugin',
  '/extending-nx/recipes': '/docs/extending-nx',
  '/extending-nx/recipes/generator-options': '/docs/extending-nx',
  '/extending-nx/api': '/docs/extending-nx',
  '/extending-nx/api/nx-devkit': '/docs/extending-nx',
  '/extending-nx/api/nx-devkit/ngcli-adapter': '/docs/extending-nx',
  '/extending-nx/api/plugin': '/docs/extending-nx',
  // /extending-nx wildcard (covers simple /docs prepend cases)
  '/extending-nx': '/docs/extending-nx',
  '/extending-nx/:path*': '/docs/extending-nx/:path*',
  // /features exceptions (non-standard mappings)
  '/features/enhance-AI': '/docs/features/enhance-ai',
  '/features/maintain-ts-monorepos':
    '/docs/features/maintain-typescript-monorepos',
  // /features wildcard
  '/features': '/docs/features',
  '/features/:path*': '/docs/features/:path*',
  '/getting-started': '/docs/getting-started/intro',
  '/getting-started/intro': '/docs/getting-started/intro',
  '/getting-started/installation': '/docs/getting-started/installation',
  '/getting-started/start-new-project':
    '/docs/getting-started/start-new-project',
  '/getting-started/editor-setup': '/docs/getting-started/editor-setup',
  '/getting-started/tutorials': '/docs/getting-started/tutorials',
  '/getting-started/adding-to-existing':
    '/docs/getting-started/start-with-existing-project',
  '/getting-started/ai-integration': '/docs/getting-started/ai-setup',
  '/getting-started/tutorials/typescript-packages-tutorial':
    '/docs/getting-started/tutorials/typescript-packages-tutorial',
  '/getting-started/tutorials/react-monorepo-tutorial':
    '/docs/getting-started/tutorials/react-monorepo-tutorial',
  '/getting-started/tutorials/angular-monorepo-tutorial':
    '/docs/getting-started/tutorials/angular-monorepo-tutorial',
  '/getting-started/tutorials/gradle-tutorial':
    '/docs/getting-started/tutorials/gradle-tutorial',
  '/nx-enterprise': '/docs/enterprise',
  '/nx-enterprise/activate-powerpack': '/docs/enterprise/activate-license',
  '/nx-enterprise/activate-license': '/docs/enterprise/activate-license',
  '/nx-enterprise/powerpack/licenses-and-trials': '/docs/enterprise',
  '/nx-enterprise/powerpack/conformance': '/docs/enterprise/conformance',
  '/nx-enterprise/powerpack/owners': '/docs/enterprise/owners',
  '/nx-enterprise/conformance': '/docs/enterprise/conformance',
  '/nx-enterprise/owners': '/docs/enterprise/owners',
  '/nx-enterprise/powerpack': '/docs/enterprise',
  '/plugin-registry': '/docs/plugin-registry',
  '/recipes': '/docs/guides',
  '/recipes/running-tasks': '/docs/guides/tasks--caching',
  '/recipes/tips-n-tricks': '/docs/guides/tips-n-tricks',
  '/recipes/installation': '/docs/getting-started/installation',
  '/recipes/installation/install-non-javascript':
    '/docs/guides/installation/install-non-javascript',
  '/recipes/installation/update-global-installation':
    '/docs/guides/installation/update-global-installation',
  '/recipes/running-tasks/configure-inputs':
    '/docs/guides/tasks--caching/configure-inputs',
  '/recipes/running-tasks/configure-outputs':
    '/docs/guides/tasks--caching/configure-outputs',
  '/recipes/running-tasks/defining-task-pipeline':
    '/docs/guides/tasks--caching/defining-task-pipeline',
  '/recipes/running-tasks/terminal-ui':
    '/docs/guides/tasks--caching/terminal-ui',
  '/recipes/running-tasks/run-commands-executor':
    '/docs/guides/tasks--caching/run-commands-executor',
  '/recipes/running-tasks/pass-args-to-commands':
    '/docs/guides/tasks--caching/pass-args-to-commands',
  '/recipes/running-tasks/run-tasks-in-parallel':
    '/docs/guides/tasks--caching/run-tasks-in-parallel',
  '/recipes/running-tasks/root-level-scripts':
    '/docs/guides/tasks--caching/root-level-scripts',
  '/recipes/running-tasks/workspace-watching':
    '/docs/guides/tasks--caching/workspace-watching',
  '/recipes/running-tasks/reduce-repetitive-configuration':
    '/docs/guides/tasks--caching/reduce-repetitive-configuration',
  '/recipes/running-tasks/change-cache-location':
    '/docs/guides/tasks--caching/change-cache-location',
  '/recipes/running-tasks/skipping-cache':
    '/docs/guides/tasks--caching/skipping-cache',
  '/recipes/running-tasks/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/recipes/running-tasks/self-hosted-caching':
    '/docs/guides/tasks--caching/self-hosted-caching',
  '/recipes/adopting-nx/:path*': '/docs/guides/adopting-nx/:path*',
  '/recipes/nx-release/:path*': '/docs/guides/nx-release/:path*',
  '/recipes/nx-console/:path*': '/docs/guides/nx-console/:path*',
  '/recipes/enforce-module-boundaries':
    '/docs/features/enforce-module-boundaries',
  '/recipes/enforce-module-boundaries/:path*':
    '/docs/guides/enforce-module-boundaries/:path*',
  '/recipes/tips-n-tricks/:path*': '/docs/guides/tips-n-tricks/:path*',
  '/recipes/adopting-nx': '/docs/guides/adopting-nx',
  '/recipes/nx-release': '/docs/guides/nx-release',
  '/recipes/nx-console': '/docs/guides/nx-console',
  '/reference': '/docs/reference',
  '/reference/nx-commands': '/docs/reference/nx-commands',
  '/reference/nx-json': '/docs/reference/nx-json',
  '/reference/project-configuration': '/docs/reference/project-configuration',
  '/reference/inputs': '/docs/reference/inputs',
  '/reference/nxignore': '/docs/reference/nxignore',
  '/reference/environment-variables': '/docs/reference/environment-variables',
  '/reference/glossary': '/docs/reference/glossary',
  '/reference/releases': '/docs/reference/releases',
  '/reference/core-api/owners': '/docs/reference/owners',
  '/reference/core-api/owners/overview': '/docs/reference/owners/overview',
  '/reference/core-api/conformance': '/docs/reference/conformance',
  '/reference/core-api/conformance/overview':
    '/docs/reference/conformance/overview',
  '/reference/core-api/conformance/create-conformance-rule':
    '/docs/reference/conformance/create-conformance-rule',
  '/reference/core-api/azure-cache':
    '/docs/reference/remote-cache-plugins/azure-cache',
  '/reference/core-api/azure-cache/overview':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',
  '/reference/core-api/gcs-cache':
    '/docs/reference/remote-cache-plugins/gcs-cache',
  '/reference/core-api/gcs-cache/overview':
    '/docs/reference/remote-cache-plugins/gcs-cache/overview',
  '/reference/core-api/s3-cache':
    '/docs/reference/remote-cache-plugins/s3-cache',
  '/reference/core-api/s3-cache/overview':
    '/docs/reference/remote-cache-plugins/s3-cache/overview',
  '/reference/core-api/shared-fs-cache':
    '/docs/reference/remote-cache-plugins/shared-fs-cache',
  '/reference/core-api/shared-fs-cache/overview':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/overview',
  '/reference/core-api/devkit/documents/Migration':
    '/docs/reference/devkit/migration',
  '/reference/core-api/workspace/documents/overview':
    '/docs/reference/conformance/overview',
  '/reference/core-api/conformance/documents/overview':
    '/docs/reference/conformance/overview',
  '/reference/core-api/conformance/documents/create-conformance-rule':
    '/docs/reference/conformance/create-conformance-rule',
  '/reference/core-api/conformance/executors':
    '/docs/reference/conformance/executors',
  '/reference/core-api/owners/generators': '/docs/reference/owners/generators',
  '/reference/core-api/owners/generators/:path*':
    '/docs/reference/owners/generators',
  '/reference/core-api/shared-fs-cache/generators':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/generators',
  '/reference/core-api': '/docs/reference',
  '/reference/core-api/nx': '/docs/reference/nx',
  '/reference/core-api/workspace': '/docs/reference/workspace',
  '/reference/core-api/plugin': '/docs/reference/plugin',
  '/reference/core-api/web': '/docs/reference/web',
  '/reference/core-api/create-nx-workspace':
    '/docs/reference/create-nx-workspace',
  '/reference/core-api/devkit/documents': '/docs/reference/devkit',
  '/reference/core-api/devkit': '/docs/reference/devkit',
  '/reference/core-api/devkit/executors': '/docs/reference/devkit',
  '/reference/core-api/devkit/generators': '/docs/reference/devkit',
  '/reference/core-api/devkit/migrations': '/docs/reference/devkit',
  '/reference/core-api/nx/documents': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/create-nx-workspace':
    'https://canary.nx.dev/docs/reference/create-nx-workspace',
  '/reference/core-api/nx/executors': '/docs/reference/nx/executors',
  '/reference/core-api/nx/executors/:path*': '/docs/reference/nx/executors',
  '/reference/core-api/nx/generators': '/docs/reference/nx/generators',
  '/reference/core-api/nx/generators/connect-to-nx-cloud':
    '/docs/reference/nx/generators',
  '/reference/core-api/nx/migrations': '/docs/reference/nx/migrations',
  '/reference/core-api/plugin/executors': '/reference/plugin/executors',
  '/reference/core-api/plugin/generators': '/docs/reference/plugin/generators',
  '/reference/core-api/plugin/generators/:path*':
    '/docs/reference/plugin/generators',
  '/reference/core-api/plugin/migrations': '/reference/plugin/migrations',
  '/reference/core-api/web/executors': '/docs/reference/web/executors',
  '/reference/core-api/web/executors/file-server':
    '/docs/reference/web/executors',
  '/reference/core-api/web/generators': '/docs/reference/web/generators',
  '/reference/core-api/web/generators/:path*': '/docs/reference/web/generators',
  '/reference/core-api/web/migrations': '/reference/web/migrations',
  '/reference/core-api/workspace/documents': '/docs/reference/workspace',
  '/reference/core-api/workspace/documents/nx-nodejs-typescript-version-matrix':
    '/docs/reference/nodejs-typescript-compatibility',
  '/reference/core-api/workspace/executors': '/reference/workspace/executors',
  '/reference/core-api/workspace/executors/counter':
    '/reference/workspace/executors',
  '/reference/core-api/workspace/generators':
    '/docs/reference/workspace/generators',
  '/reference/core-api/workspace/generators/:path*':
    '/docs/reference/workspace/generators',
  '/reference/core-api/workspace/migrations':
    '/docs/reference/workspace/migrations',
  '/reference/core-api/azure-cache/executors':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',
  '/reference/core-api/azure-cache/generators':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',
  '/reference/core-api/azure-cache/migrations':
    '/docs/reference/remote-cache-plugins/azure-cache/overview',
  '/reference/core-api/conformance/documents':
    '/docs/reference/conformance/overview',
  '/reference/core-api/conformance/generators':
    '/docs/reference/conformance/generators',
  '/reference/core-api/conformance/generators/:path*':
    '/docs/reference/conformance/generators',
  '/reference/core-api/conformance/migrations':
    '/docs/reference/conformance/overview',
  '/reference/core-api/owners/executors': '/docs/reference/owners/overview',
  '/reference/core-api/owners/migrations': '/docs/reference/owners/overview',
  '/reference/core-api/gcs-cache/executors':
    '/docs/reference/remote-cache-plugins/gcs-cache',
  '/reference/core-api/gcs-cache/generators':
    '/docs/reference/remote-cache-plugins/gcs-cache',
  '/reference/core-api/gcs-cache/migrations':
    '/docs/reference/remote-cache-plugins/gcs-cache',
  '/reference/core-api/s3-cache/executors':
    '/docs/reference/remote-cache-plugins/s3-cache',
  '/reference/core-api/s3-cache/generators':
    '/docs/reference/remote-cache-plugins/s3-cache',
  '/reference/core-api/s3-cache/migrations':
    '/docs/reference/remote-cache-plugins/s3-cache',
  '/reference/core-api/shared-fs-cache/executors':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/overview',
  '/reference/core-api/shared-fs-cache/generators/init':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/generators',
  '/reference/core-api/shared-fs-cache/migrations':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/overview',
  // /showcase exceptions (benchmarks go to /docs/reference/benchmarks)
  '/showcase/benchmarks/tsc-batch-mode':
    '/docs/reference/benchmarks/tsc-batch-mode',
  '/showcase/benchmarks/caching': '/docs/reference/benchmarks/caching',
  '/showcase/benchmarks/nx-agents': '/docs/reference/benchmarks/nx-agents',
  '/showcase/benchmarks': '/docs/reference/benchmarks',
  '/technologies': '/docs/technologies',
  '/technologies/typescript': '/docs/technologies/typescript',
  '/technologies/typescript/introduction':
    '/docs/technologies/typescript/introduction',
  '/technologies/angular': '/docs/technologies/angular',
  '/technologies/angular/introduction':
    '/docs/technologies/angular/introduction',
  '/technologies/angular/migration': '/docs/technologies/angular/migration',
  '/technologies/angular/migration/angular':
    '/docs/technologies/angular/migration/angular',
  '/technologies/angular/migration/angular-multiple':
    '/docs/technologies/angular/migration/angular-multiple',
  '/technologies/angular/angular-rspack':
    '/docs/technologies/angular/angular-rspack',
  '/technologies/angular/angular-rspack/introduction':
    '/docs/technologies/angular/angular-rspack/introduction',
  '/technologies/angular/angular-rsbuild':
    '/docs/technologies/angular/angular-rsbuild',
  '/technologies/react': '/docs/technologies/react',
  '/technologies/react/introduction': '/docs/technologies/react/introduction',
  '/technologies/react/next': '/docs/technologies/react/next',
  '/technologies/react/next/introduction':
    '/docs/technologies/react/next/introduction',
  '/technologies/react/remix': '/docs/technologies/react/remix',
  '/technologies/react/remix/introduction':
    '/docs/technologies/react/remix/introduction',
  '/technologies/react/react-native': '/docs/technologies/react/react-native',
  '/technologies/react/react-native/introduction':
    '/docs/technologies/react/react-native/introduction',
  '/technologies/react/expo': '/docs/technologies/react/expo',
  '/technologies/react/expo/introduction':
    '/docs/technologies/react/expo/introduction',
  '/technologies/vue': '/docs/technologies/vue',
  '/technologies/vue/introduction': '/docs/technologies/vue/introduction',
  '/technologies/vue/nuxt': '/docs/technologies/vue/nuxt',
  '/technologies/vue/nuxt/introduction':
    '/docs/technologies/vue/nuxt/introduction',
  '/technologies/node': '/docs/technologies/node',
  '/technologies/node/introduction': '/docs/technologies/node/introduction',
  '/technologies/node/express': '/docs/technologies/node/express',
  '/technologies/node/express/introduction':
    '/docs/technologies/node/express/introduction',
  '/technologies/node/nest': '/docs/technologies/node/nest',
  '/technologies/node/nest/introduction':
    '/docs/technologies/node/nest/introduction',
  '/technologies/module-federation': '/docs/technologies/module-federation',
  '/technologies/module-federation/introduction':
    '/docs/technologies/module-federation/introduction',
  '/technologies/module-federation/concepts':
    '/docs/technologies/module-federation/concepts',
  '/technologies/module-federation/concepts/module-federation-and-nx':
    '/docs/technologies/module-federation/concepts/module-federation-and-nx',
  '/technologies/module-federation/concepts/nx-module-federation-technical-overview':
    '/docs/technologies/module-federation/concepts/nx-module-federation-technical-overview',
  '/technologies/module-federation/concepts/faster-builds-with-module-federation':
    '/docs/technologies/module-federation/concepts/faster-builds-with-module-federation',
  '/technologies/module-federation/concepts/micro-frontend-architecture':
    '/docs/technologies/module-federation/concepts/micro-frontend-architecture',
  '/technologies/module-federation/concepts/manage-library-versions-with-module-federation':
    '/docs/technologies/module-federation/concepts/manage-library-versions-with-module-federation',
  '/technologies/eslint': '/docs/technologies/eslint',
  '/technologies/eslint/introduction': '/docs/technologies/eslint/introduction',
  '/technologies/eslint/eslint-plugin':
    '/docs/technologies/eslint/eslint-plugin',
  '/technologies/build-tools': '/docs/technologies/build-tools',
  '/technologies/build-tools/docker/introduction':
    '/docs/technologies/build-tools/docker/introduction',
  '/technologies/build-tools/webpack': '/docs/technologies/build-tools/webpack',
  '/technologies/build-tools/webpack/introduction':
    '/docs/technologies/build-tools/webpack/introduction',
  '/technologies/build-tools/vite': '/docs/technologies/build-tools/vite',
  '/technologies/build-tools/vite/introduction':
    '/docs/technologies/build-tools/vite/introduction',
  '/technologies/build-tools/rollup': '/docs/technologies/build-tools/rollup',
  '/technologies/build-tools/rollup/introduction':
    '/docs/technologies/build-tools/rollup/introduction',
  '/technologies/build-tools/esbuild': '/docs/technologies/build-tools/esbuild',
  '/technologies/build-tools/esbuild/introduction':
    '/docs/technologies/build-tools/esbuild/introduction',
  '/technologies/build-tools/rspack': '/docs/technologies/build-tools/rspack',
  '/technologies/build-tools/rspack/introduction':
    '/docs/technologies/build-tools/rspack/introduction',
  '/technologies/build-tools/rsbuild': '/docs/technologies/build-tools/rsbuild',
  '/technologies/build-tools/rsbuild/introduction':
    '/docs/technologies/build-tools/rsbuild/introduction',
  '/technologies/test-tools': '/docs/technologies/test-tools',
  '/technologies/test-tools/cypress': '/docs/technologies/test-tools/cypress',
  '/technologies/test-tools/cypress/introduction':
    '/docs/technologies/test-tools/cypress/introduction',
  '/technologies/test-tools/jest': '/docs/technologies/test-tools/jest',
  '/technologies/test-tools/jest/introduction':
    '/docs/technologies/test-tools/jest/introduction',
  '/technologies/test-tools/playwright':
    '/docs/technologies/test-tools/playwright',
  '/technologies/test-tools/playwright/introduction':
    '/docs/technologies/test-tools/playwright/introduction',
  '/technologies/test-tools/playwright/recipes/merge-atomized-outputs':
    '/docs/technologies/test-tools/playwright/guides/merge-atomized-outputs',
  '/technologies/test-tools/storybook':
    '/docs/technologies/test-tools/storybook',
  '/technologies/test-tools/storybook/introduction':
    '/docs/technologies/test-tools/storybook/introduction',
  '/technologies/test-tools/detox': '/docs/technologies/test-tools/detox',
  '/technologies/test-tools/detox/introduction':
    '/docs/technologies/test-tools/detox/introduction',
  '/technologies/typescript/recipes/:path*':
    '/docs/technologies/typescript/guides/:path*',
  '/technologies/angular/recipes/:path*':
    '/docs/technologies/angular/guides/:path*',
  '/technologies/angular/angular-rspack/recipes':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/technologies/angular/angular-rspack/recipes/:path*':
    '/docs/technologies/angular/angular-rspack/guides/:path*',
  '/technologies/angular/angular-rspack/api':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/technologies/angular/angular-rspack/api/create-config':
    '/docs/technologies/angular/angular-rspack/create-config',
  '/technologies/angular/angular-rspack/api/create-server':
    '/docs/technologies/angular/angular-rspack/create-server',
  '/technologies/angular/angular-rsbuild/api':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/technologies/angular/angular-rsbuild/api/create-config':
    '/docs/technologies/angular/angular-rsbuild/create-config',
  '/technologies/angular/angular-rsbuild/api/create-server':
    '/docs/technologies/angular/angular-rsbuild/create-server',
  '/technologies/react/recipes/:path*':
    '/docs/technologies/react/guides/:path*',
  '/technologies/react/next/recipes': '/docs/technologies/react/next/guides',
  '/technologies/react/next/recipes/next-config-setup':
    '/docs/technologies/react/next/guides/next-config-setup',
  '/technologies/react/next/api': '/docs/technologies/react/next',
  '/technologies/react/remix/recipes': '/docs/technologies/react/remix',
  '/technologies/react/remix/api': '/docs/technologies/react/remix',
  '/technologies/react/react-native/recipes':
    '/docs/technologies/react/react-native',
  '/technologies/react/react-native/api':
    '/docs/technologies/react/react-native',
  '/technologies/react/expo/recipes': '/docs/technologies/react/expo',
  '/technologies/react/expo/api': '/docs/technologies/react/expo',
  '/technologies/vue/nuxt/recipes': '/docs/technologies/vue/nuxt/guides',
  '/technologies/vue/nuxt/recipes/deploy-nuxt-to-vercel':
    '/docs/technologies/vue/nuxt/guides/deploy-nuxt-to-vercel',
  '/technologies/vue/nuxt/api': '/docs/technologies/vue/nuxt',
  '/technologies/node/recipes/:path*': '/docs/technologies/node/guides/:path*',
  '/technologies/node/express/api': '/docs/technologies/node/express',
  '/technologies/node/nest/api': '/docs/technologies/node/nest',
  '/technologies/java/introduction': '/docs/technologies/java/introduction',
  // exception: nx-module-federation-plugin renamed to create-a-host
  '/technologies/module-federation/recipes/nx-module-federation-plugin':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/technologies/module-federation/recipes/:path*':
    '/docs/technologies/module-federation/guides/:path*',
  '/technologies/eslint/recipes/:path*':
    '/docs/technologies/eslint/guides/:path*',
  '/technologies/eslint/eslint-plugin/recipes':
    '/docs/technologies/eslint/eslint-plugin/guides',
  '/technologies/eslint/eslint-plugin/recipes/:path*':
    '/docs/technologies/eslint/eslint-plugin/guides/:path*',
  '/technologies/eslint/eslint-plugin/api':
    '/docs/technologies/eslint/eslint-plugin',
  '/technologies/build-tools/docker':
    '/docs/technologies/build-tools/docker/introduction',
  '/technologies/build-tools/webpack/recipes':
    '/docs/technologies/build-tools/webpack/guides',
  '/technologies/build-tools/webpack/recipes/:path*':
    '/docs/technologies/build-tools/webpack/guides/:path*',
  '/technologies/build-tools/webpack/api':
    '/docs/technologies/build-tools/webpack',
  '/technologies/build-tools/vite/recipes':
    '/docs/technologies/build-tools/vite/guides',
  '/technologies/build-tools/vite/recipes/configure-vite':
    '/docs/technologies/build-tools/vite/guides/configure-vite',
  '/technologies/build-tools/vite/api':
    '/docs/technologies/build-tools/vite/guides/configure-vite',
  '/technologies/build-tools/rollup/recipes':
    '/docs/technologies/build-tools/rollup/introduction',
  '/technologies/build-tools/rollup/api':
    '/docs/technologies/build-tools/rollup/introduction',
  '/technologies/build-tools/esbuild/recipes':
    '/docs/technologies/build-tools/esbuild/introduction',
  '/technologies/build-tools/esbuild/api':
    '/docs/technologies/build-tools/esbuild/introduction',
  '/technologies/build-tools/rspack/recipes':
    '/docs/technologies/build-tools/rspack/introduction',
  '/technologies/build-tools/rspack/api':
    '/docs/technologies/build-tools/rspack/introduction',
  '/technologies/build-tools/rsbuild/recipes':
    '/docs/technologies/build-tools/rsbuild/introduction',
  '/technologies/build-tools/rsbuild/api':
    '/docs/technologies/build-tools/rsbuild/introduction',
  '/technologies/test-tools/cypress/recipes':
    '/docs/technologies/test-tools/cypress/guides/cypress-component-testing',
  '/technologies/test-tools/cypress/recipes/:path*':
    '/docs/technologies/test-tools/cypress/guides/:path*',
  '/technologies/test-tools/cypress/api':
    '/docs/technologies/test-tools/cypress',
  '/technologies/test-tools/jest/recipes':
    '/docs/technologies/test-tools/jest/introduction',
  '/technologies/test-tools/jest/api': '/docs/technologies/test-tools/jest',
  '/technologies/test-tools/playwright/recipes':
    '/docs/technologies/test-tools/playwright/introduction',
  '/technologies/test-tools/playwright/api':
    '/docs/technologies/test-tools/playwright',
  '/technologies/test-tools/storybook/recipes':
    '/docs/technologies/test-tools/storybook/guides',
  // exception: storybook-9-setup renamed to upgrading-storybook
  '/technologies/test-tools/storybook/recipes/storybook-9-setup':
    '/docs/technologies/test-tools/storybook/guides/upgrading-storybook',
  '/technologies/test-tools/storybook/recipes/:path*':
    '/docs/technologies/test-tools/storybook/guides/:path*',
  '/technologies/test-tools/storybook/api':
    '/docs/technologies/test-tools/storybook/guides/angular-configuring-styles',
  '/technologies/test-tools/detox/recipes':
    '/docs/technologies/test-tools/detox/introduction',
  '/technologies/test-tools/detox/api': '/docs/technologies/test-tools/detox',
  '/technologies/test-tools/cypress/api/executors':
    '/docs/technologies/test-tools/cypress/executors',
  '/technologies/test-tools/cypress/api/generators':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/migrations':
    '/docs/technologies/test-tools/cypress/migrations',
  '/technologies/test-tools/detox/api/executors':
    '/docs/technologies/test-tools/detox/executors',
  '/technologies/test-tools/detox/api/generators':
    '/docs/technologies/test-tools/detox/generators',
  '/technologies/test-tools/detox/api/migrations':
    '/docs/technologies/test-tools/detox/migrations',
  '/technologies/build-tools/esbuild/api/executors':
    '/docs/technologies/build-tools/esbuild/executors',
  '/technologies/build-tools/esbuild/api/executors/esbuild':
    '/docs/technologies/build-tools/esbuild/executors',
  '/technologies/build-tools/esbuild/api/generators':
    '/docs/technologies/build-tools/esbuild/generators',
  '/technologies/build-tools/esbuild/api/migrations':
    '/docs/technologies/build-tools/esbuild',
  '/technologies/eslint/eslint-plugin/api/executors':
    '/docs/technologies/eslint/eslint-plugin',
  '/technologies/eslint/eslint-plugin/api/generators':
    '/docs/technologies/eslint/eslint-plugin',
  '/technologies/eslint/eslint-plugin/api/migrations':
    '/docs/technologies/eslint/eslint-plugin/migrations',
  '/technologies/react/expo/api/executors':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/generators':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/migrations':
    '/docs/technologies/react/expo/migrations',
  '/technologies/node/express/api/executors': '/docs/technologies/node/express',
  '/technologies/node/express/api/generators':
    '/docs/technologies/node/express/generators',
  '/technologies/node/express/api/migrations':
    '/docs/technologies/node/express',
  '/technologies/java/api/executors/gradle':
    '/docs/technologies/java/executors',
  '/technologies/test-tools/jest/api/executors':
    '/docs/technologies/test-tools/jest/executors',
  '/technologies/test-tools/jest/api/generators':
    '/docs/technologies/test-tools/jest/generators',
  '/technologies/test-tools/jest/api/migrations':
    '/docs/technologies/test-tools/jest/migrations',
  '/technologies/node/nest/api/executors': '/docs/technologies/node/nest',
  '/technologies/node/nest/api/generators':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/migrations':
    '/docs/technologies/node/nest/migrations',
  '/technologies/react/next/api/executors':
    '/docs/technologies/react/next/executors',
  '/technologies/react/next/api/generators':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/migrations':
    '/docs/technologies/react/next/migrations',
  '/technologies/vue/nuxt/api/executors': '/docs/technologies/vue/nuxt',
  '/technologies/vue/nuxt/api/generators':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/vue/nuxt/api/migrations':
    '/docs/technologies/vue/nuxt/migrations',
  '/technologies/test-tools/playwright/api/executors':
    '/docs/technologies/test-tools/playwright/executors',
  '/technologies/test-tools/playwright/api/generators':
    '/docs/technologies/test-tools/playwright/generators',
  '/technologies/test-tools/playwright/api/migrations':
    '/docs/technologies/test-tools/playwright/migrations',
  '/technologies/react/react-native/api/executors':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/generators':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/migrations':
    '/docs/technologies/react/react-native/migrations',
  '/technologies/react/remix/api/executors':
    '/docs/technologies/react/remix/executors',
  '/technologies/react/remix/api/generators':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/migrations':
    '/docs/technologies/react/remix/migrations',
  '/technologies/build-tools/rollup/api/executors':
    '/docs/technologies/build-tools/rollup/executors',
  '/technologies/build-tools/rollup/api/generators':
    '/docs/technologies/build-tools/rollup/generators',
  '/technologies/build-tools/rollup/api/migrations':
    '/docs/technologies/build-tools/rollup/migrations',
  '/technologies/build-tools/rsbuild/api/executors':
    '/docs/technologies/build-tools/rsbuild',
  '/technologies/build-tools/rsbuild/api/generators':
    '/docs/technologies/build-tools/rsbuild/generators',
  '/technologies/build-tools/rsbuild/api/migrations':
    '/docs/technologies/build-tools/rsbuild',
  '/technologies/build-tools/rspack/api/executors':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/generators':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/migrations':
    '/docs/technologies/build-tools/rspack/migrations',
  '/technologies/test-tools/storybook/api/executors':
    '/docs/technologies/test-tools/storybook/executors',
  '/technologies/test-tools/storybook/api/generators':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/migrations':
    '/docs/technologies/test-tools/storybook/migrations',
  '/technologies/build-tools/vite/api/executors':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/generators':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/migrations':
    '/docs/technologies/build-tools/vite/migrations',
  '/technologies/build-tools/webpack/api/executors':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/build-tools/webpack/api/generators':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/build-tools/webpack/api/migrations':
    '/docs/technologies/build-tools/webpack/migrations',
  '/technologies/typescript/recipes':
    '/docs/technologies/typescript/guides/compile-multiple-formats',
  '/technologies/typescript/api':
    '/docs/technologies/typescript/guides/compile-multiple-formats',
  '/technologies/angular/recipes':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/technologies/angular/api':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/technologies/react/recipes':
    '/docs/technologies/react/guides/adding-assets-react',
  '/technologies/react/api':
    '/docs/technologies/react/guides/adding-assets-react',
  '/technologies/vue/api': '/docs/technologies/vue',
  '/technologies/node/recipes':
    '/docs/technologies/node/guides/application-proxies',
  '/technologies/node/api':
    '/docs/technologies/node/guides/application-proxies',
  '/technologies/java':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/technologies/java/api':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/technologies/module-federation/recipes':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/technologies/module-federation/api':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/technologies/eslint/recipes': '/docs/technologies/eslint/guides/eslint',
  '/technologies/eslint/api': '/docs/technologies/eslint/guides/eslint',
  '/technologies/angular/api/executors': '/docs/technologies/angular/executors',
  '/technologies/angular/api/generators':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/migrations':
    '/docs/technologies/angular/migrations',
  '/technologies/eslint/api/executors': '/docs/technologies/eslint/executors',
  '/technologies/eslint/api/generators': '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/migrations': '/docs/technologies/eslint/migrations',
  '/technologies/java/api/executors': '/docs/technologies/java/executors',
  '/technologies/java/api/generators': '/docs/technologies/java/generators',
  '/technologies/java/api/migrations': '/docs/technologies/java/migrations',
  '/technologies/typescript/api/executors':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/generators':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/migrations':
    '/docs/technologies/typescript/migrations',
  '/technologies/module-federation/api/executors':
    '/docs/technologies/module-federation',
  '/technologies/module-federation/api/generators':
    '/docs/technologies/module-federation',
  '/technologies/module-federation/api/migrations':
    '/docs/technologies/module-federation/migrations',
  '/technologies/node/api/executors': '/docs/technologies/node',
  '/technologies/node/api/generators': '/docs/technologies/node/generators',
  '/technologies/node/api/migrations': '/docs/technologies/node/migrations',
  '/technologies/react/api/executors': '/docs/technologies/react/executors',
  '/technologies/react/api/generators': '/docs/technologies/react/generators',
  '/technologies/react/api/migrations': '/docs/technologies/react/migrations',
  '/technologies/vue/api/executors': '/docs/technologies/vue',
  '/technologies/vue/api/generators': '/docs/technologies/vue/generators',
  '/technologies/vue/api/migrations': '/docs/technologies/vue/migrations',
  // /troubleshooting exception (name changed)
  '/troubleshooting/convert-to-inferred':
    '/docs/troubleshooting/troubleshoot-convert-to-inferred',
  // /troubleshooting wildcard
  '/troubleshooting': '/docs/troubleshooting',
  '/troubleshooting/:path*': '/docs/troubleshooting/:path*',
  '/ci': '/docs/getting-started/nx-cloud',
  '/ci/recipes': '/docs/guides/nx-cloud',
  '/ci/recipes/improving-ttg': '/docs/guides/nx-cloud/optimize-your-ttg',
  '/ci/recipes/set-up': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/:path*': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/security': '/docs/guides/nx-cloud',
  '/ci/recipes/dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/:path*': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/other': '/docs/guides/nx-cloud/setup-ci',
  '/see-also': '/docs/getting-started/intro',
  '/see-also/sitemap': '/docs/getting-started/intro',
  // /showcase wildcard (all example-repos go to intro)
  '/showcase': '/docs/getting-started/intro',
  '/showcase/example-repos/:path*': '/docs/getting-started/intro',
  '/reference/workspace': '/docs/reference/workspace',
  '/reference/workspace/generators': '/docs/reference/workspace/generators',
  '/reference/workspace/migrations': '/docs/reference/workspace/migrations',
  '/reference/nx': '/docs/reference/nx',
  '/reference/nx/executors': '/docs/reference/nx/executors',
  '/reference/nx/generators': '/docs/reference/nx/generators',
  '/reference/nx/migrations': '/docs/reference/nx/migrations',
  '/reference/plugin': '/docs/reference/plugin',
  '/reference/plugin/generators': '/docs/reference/plugin/generators',
  '/reference/web': '/docs/reference/web',
  '/reference/web/executors': '/docs/reference/web/executors',
  '/reference/web/generators': '/docs/reference/web/generators',
  '/ci/intro': '/docs/getting-started/nx-cloud',
  '/features/self-healing-ci': '/docs/features/ci-features/self-healing-ci',
};

module.exports = docsToAstroRedirects;
