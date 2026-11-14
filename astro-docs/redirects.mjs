// Keys are relative to the `/docs` base.
export const redirects = {
  '/features/ci-features/flaky-tasks': '/docs/kb/flaky-tasks',
  '/features/ci-features/split-e2e-tasks': '/docs/kb/split-e2e-tasks',
  '/features/ci-features/resource-usage': '/docs/kb/resource-usage',
  '/features/ci-features/github-integration': '/docs/kb/github-integration',
  '/features/ci-features/sandboxing': '/docs/kb/sandboxing',
  '/features/ci-features/dedicated-compute-cluster':
    '/docs/kb/dedicated-compute-cluster',
  '/features/ci-features/docker-layer-caching': '/docs/kb/docker-layer-caching',
  '/features/ci-features/docker-read-through-cache':
    '/docs/kb/docker-read-through-cache',
  '/features/ci-features/npm-read-through-cache':
    '/docs/kb/npm-read-through-cache',
  '/guides/nx-cloud/optimize-your-ttg': '/docs/kb/optimize-your-ttg',
  '/guides/nx-cloud/record-commands': '/docs/kb/record-commands',
  '/guides/nx-cloud/cipe-affected-project-graph':
    '/docs/kb/cipe-affected-project-graph',
  '/guides/nx-cloud/encryption': '/docs/kb/encryption',
  '/guides/nx-cloud/google-auth': '/docs/kb/google-auth',
  '/features/ci-features/dynamic-agents':
    '/docs/features/ci-features/distribute-task-execution#scale-workers-with-pr-size',
  '/getting-started/nx-cloud': '/docs/features/ci-features',
  '/getting-started/tutorials/react-monorepo-tutorial':
    '/docs/getting-started/tutorials/crafting-your-workspace',
  '/getting-started/tutorials/angular-monorepo-tutorial':
    '/docs/getting-started/tutorials/crafting-your-workspace',
  '/getting-started/tutorials/typescript-packages-tutorial':
    '/docs/getting-started/tutorials/crafting-your-workspace',
  '/concepts/ci-concepts/parallelization-distribution':
    '/docs/features/ci-features#building-blocks-of-fast-ci',
  '/platform-features/orchestration-ci': '/docs/features/ci-features',
  // Hidden sidebar hub pages removed with the Core features / CI features split.
  '/platform-features': '/docs/features/run-tasks',
  '/platform-features/code-organization': '/docs/features/explore-graph',
  '/platform-features/code-organization/enforce-module-boundaries':
    '/docs/features/enforce-module-boundaries',
  '/platform-features/continuous-integration-ci': '/docs/features/ci-features',
  '/platform-features/release-publishing': '/docs/features/manage-releases',
  '/platform-features/maintenance':
    '/docs/features/automate-updating-dependencies',
  '/platform-features/enterprise': '/docs/enterprise',
  '/platform-features/enterprise/single-tenant':
    '/docs/enterprise/single-tenant/overview',
  '/platform-features/enterprise/conformance-reference':
    '/docs/reference/conformance/overview',
  '/kb/setup-ci': '/docs/getting-started/setup-ci',
  // Executor reference pages removed in Nx 24 with their executors.
  '/technologies/test-tools/cypress/executors':
    '/docs/technologies/test-tools/cypress/introduction',
  '/technologies/test-tools/detox/executors':
    '/docs/technologies/test-tools/detox/introduction',
  '/technologies/test-tools/jest/executors':
    '/docs/technologies/test-tools/jest/introduction',
  '/technologies/test-tools/playwright/executors':
    '/docs/technologies/test-tools/playwright/introduction',
  '/technologies/test-tools/storybook/executors':
    '/docs/technologies/test-tools/storybook/introduction',
  '/technologies/test-tools/vitest/executors':
    '/docs/technologies/test-tools/vitest/introduction',
  '/technologies/eslint/executors': '/docs/technologies/eslint/introduction',
  '/technologies/react/next/executors':
    '/docs/technologies/react/next/introduction',
  '/technologies/build-tools/rollup/executors':
    '/docs/technologies/build-tools/rollup/introduction',
  '/technologies/build-tools/vite/executors':
    '/docs/technologies/build-tools/vite/introduction',
  '/concepts/inferred-tasks': '/docs/features/run-tasks#inferred-tasks',
  '/concepts/mental-model': '/docs/getting-started/how-nx-works',
  '/concepts/how-caching-works':
    '/docs/features/cache-task-results#how-caching-works',
  '/concepts/task-pipeline-configuration':
    '/docs/features/run-tasks#defining-a-task-pipeline',
  '/concepts/types-of-configuration': '/docs/reference/project-configuration',
  '/concepts/nx-plugins': '/docs/features/nx-plugins',
  '/concepts/ci-concepts/building-blocks-fast-ci':
    '/docs/features/ci-features#building-blocks-of-fast-ci',
  '/concepts/ci-concepts': '/docs/features/ci-features',
  '/concepts': '/docs/getting-started/how-nx-works',
  '/how-nx-works': '/docs/getting-started/how-nx-works',
  '/concepts/executors-and-configurations':
    '/docs/kb/executors-and-configurations',
  '/concepts/nx-daemon': '/docs/reference/nx-daemon',
  '/guides/tips-n-tricks/define-environment-variables':
    '/docs/reference/environment-variables#loading-environment-variables',
  '/technologies/angular/guides/use-environment-variables-in-angular':
    '/docs/reference/environment-variables#loading-environment-variables',
  '/technologies/react/guides/use-environment-variables-in-react':
    '/docs/reference/environment-variables#loading-environment-variables',
  '/knowledge-base/installation': '/docs/kb/installation-and-updates',
  '/kb/angular-micro-frontends': '/docs/kb/migrate-angular-module-federation',
  '/kb/angular-module-federation-with-ssr':
    '/docs/kb/migrate-angular-module-federation',
  '/kb/dynamic-module-federation-with-angular':
    '/docs/kb/migrate-angular-module-federation',
  '/kb/nx-module-federation-plugin':
    '/docs/kb/migrate-from-nx-module-federation',
  '/kb/faster-builds-with-module-federation':
    '/docs/technologies/module-federation/introduction',
  '/kb/create-server': '/docs/technologies/angular/angular-rspack/introduction',
  '/kb/overview-react': '/docs/kb/storybook-for-react',
  '/kb/project-graph-plugins': '/docs/kb/add-language-support',
  '/kb/intro': '/docs/kb/add-language-support',
  '/kb/tooling-plugin': '/docs/kb/add-language-support',
  '/guides/nx-cloud/source-control-integration/github':
    '/docs/kb/github-integration',
  '/concepts/decisions/overview': '/docs/kb/monorepo-vs-polyrepo',
  '/concepts/decisions/why-monorepos': '/docs/kb/what-is-a-monorepo',
  '/features/maintain-typescript-monorepos':
    '/docs/technologies/typescript/introduction',
  '/guides/nx-cloud/ci-resource-usage': '/docs/kb/resource-usage',
  '/guides/nx-cloud/enable-ai-features': '/docs/kb/enable-ai-features',
  '/reference/remote-cache-plugins':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/s3-cache':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/s3-cache/overview':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/gcs-cache':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/gcs-cache/overview':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/azure-cache':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/azure-cache/overview':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/shared-fs-cache':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/shared-fs-cache/overview':
    '/docs/reference/deprecated/self-hosted-cache-packages',
  '/reference/remote-cache-plugins/shared-fs-cache/generators':
    '/docs/reference/deprecated/self-hosted-cache-packages',
};
