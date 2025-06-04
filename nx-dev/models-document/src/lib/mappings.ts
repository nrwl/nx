/*
 * We present a different grouping or naming for the API docs compared to their package names.
 * - pagePath - the path to the package's API docs page
 * - includeDocuments - whether to include documents, which should eventually be moved to guides
 *
 * This mapping is used in:
 * - scripts/documentation/generators/generate-manifests.ts (generate menus)
 * - nx-dev/data-access-documents/src/lib/documents.api.ts (generate page urls)
 * - nx-dev/nx-dev/pages/[...segments].tsx (generate page content)
 */
export const pkgToGeneratedApiDocs: Record<
  string,
  { pagePath: string; includeDocuments?: boolean }
> = {
  // ts/js
  js: {
    pagePath: '/technologies/typescript/api',
  },
  // angular
  angular: {
    pagePath: '/technologies/angular/api',
  },
  // react
  react: {
    pagePath: '/technologies/react/api',
  },
  'react-native': {
    pagePath: '/technologies/react/react-native/api',
  },
  expo: {
    pagePath: '/technologies/react/expo/api',
  },
  next: {
    pagePath: '/technologies/react/next/api',
  },
  remix: {
    pagePath: '/technologies/react/remix/api',
  },
  // vue
  vue: {
    pagePath: '/technologies/vue/api',
  },
  nuxt: {
    pagePath: '/technologies/vue/nuxt/api',
  },
  // node
  node: {
    pagePath: '/technologies/node/api',
  },
  express: {
    pagePath: '/technologies/node/express/api',
  },
  nest: {
    pagePath: '/technologies/node/nest/api',
  },
  // java
  gradle: {
    pagePath: '/technologies/java/api',
  },
  // build tools
  webpack: {
    pagePath: '/technologies/build-tools/webpack/api',
  },
  vite: {
    pagePath: '/technologies/build-tools/vite/api',
  },
  rollup: {
    pagePath: '/technologies/build-tools/rollup/api',
  },
  esbuild: {
    pagePath: '/technologies/build-tools/esbuild/api',
  },
  rspack: {
    pagePath: '/technologies/build-tools/rspack/api',
  },
  rsbuild: {
    pagePath: '/technologies/build-tools/rsbuild/api',
  },
  // test tools
  jest: {
    pagePath: '/technologies/test-tools/jest/api',
  },
  storybook: {
    pagePath: '/technologies/test-tools/storybook/api',
  },
  playwright: {
    pagePath: '/technologies/test-tools/playwright/api',
  },
  cypress: {
    pagePath: '/technologies/test-tools/cypress/api',
  },
  detox: {
    pagePath: '/technologies/test-tools/detox/api',
  },
  // misc
  'module-federation': {
    pagePath: '/technologies/module-federation/api',
  },
  eslint: {
    pagePath: '/technologies/eslint/api',
  },
  'eslint-plugin': {
    pagePath: '/technologies/eslint/eslint-plugin/api',
  },
  // core and misc
  // For now, things that are not in technologies are put here in references/core-api
  nx: {
    pagePath: '/reference/core-api/nx',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  workspace: {
    pagePath: '/reference/core-api/workspace',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  owners: {
    pagePath: '/reference/core-api/owners',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  conformance: {
    pagePath: '/reference/core-api/conformance',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'azure-cache': {
    pagePath: '/reference/core-api/azure-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'gcs-cache': {
    pagePath: '/reference/core-api/gcs-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  's3-cache': {
    pagePath: '/reference/core-api/s3-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'shared-fs-cache': {
    pagePath: '/reference/core-api/shared-fs-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  devkit: {
    pagePath: '/reference/core-api/devkit',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  plugin: {
    pagePath: '/reference/core-api/plugin',
  },
  web: {
    pagePath: '/reference/core-api/web',
  },
};
