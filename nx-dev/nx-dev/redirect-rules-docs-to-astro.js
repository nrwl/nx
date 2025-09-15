// TODO: Review and update redirect targets as needed
const docsToAstroRedirects = {
  // ========== CI ==========
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
  '/ci/features/explain-with-ai': '/docs/features/ci-features/explain-with-ai',
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
  '/ci/concepts/nx-cloud-ai': '/docs/concepts/ci-concepts/ai-features',
  '/ci/recipes/security/google-auth': '/docs/guides/nx-cloud/google-auth',
  '/ci/recipes/security/access-tokens': '/docs/guides/nx-cloud/access-tokens',
  '/ci/recipes/security/personal-access-tokens':
    '/docs/guides/nx-cloud/personal-access-tokens',
  '/ci/recipes/security/encryption': '/docs/guides/nx-cloud/encryption',
  '/ci/recipes/source-control-integration':
    '/docs/guides/nx-cloud/source-control-integration',
  '/ci/recipes/source-control-integration/github':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/source-control-integration/bitbucket':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/source-control-integration/gitlab':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/source-control-integration/azure-devops':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/enterprise': '/docs/enterprise',
  '/ci/recipes/enterprise/single-tenant/overview':
    '/docs/enterprise/single-tenant/overview',
  '/ci/recipes/enterprise/single-tenant/auth-github':
    '/docs/enterprise/single-tenant/auth-github',
  '/ci/recipes/enterprise/single-tenant/auth-gitlab':
    '/docs/enterprise/single-tenant/auth-gitlab',
  '/ci/recipes/enterprise/single-tenant/auth-bitbucket':
    '/docs/enterprise/single-tenant/auth-bitbucket',
  '/ci/recipes/enterprise/single-tenant/auth-bitbucket-data-center':
    '/docs/enterprise/single-tenant/auth-bitbucket-data-center',
  '/ci/recipes/enterprise/single-tenant/auth-saml':
    '/docs/enterprise/single-tenant/auth-saml',
  '/ci/recipes/enterprise/single-tenant/custom-github-app':
    '/docs/enterprise/single-tenant/custom-github-app',
  '/ci/recipes/enterprise/conformance':
    '/docs/enterprise/powerpack/conformance',
  '/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud':
    '/docs/enterprise/powerpack/configure-conformance-rules-in-nx-cloud',
  '/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud':
    '/docs/enterprise/powerpack/publish-conformance-rules-to-nx-cloud',
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
  '/ci/troubleshooting': '/docs/troubleshooting', // combined index listing
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

  // ========== CONCEPTS ==========
  '/concepts': '/docs/concepts',
  '/concepts/mental-model': '/docs/concepts/mental-model',
  '/concepts/how-caching-works': '/docs/concepts/how-caching-works',
  '/concepts/task-pipeline-configuration':
    '/docs/concepts/task-pipeline-configuration',
  '/concepts/nx-plugins': '/docs/concepts/nx-plugins',
  '/concepts/inferred-tasks': '/docs/concepts/inferred-tasks',
  '/concepts/types-of-configuration': '/docs/concepts/types-of-configuration',
  '/concepts/executors-and-configurations':
    '/docs/concepts/executors-and-configurations',
  '/concepts/common-tasks': '/docs/concepts/common-tasks',
  '/concepts/sync-generators': '/docs/concepts/sync-generators',
  '/concepts/typescript-project-linking':
    '/docs/concepts/typescript-project-linking',
  '/concepts/buildable-and-publishable-libraries':
    '/docs/concepts/buildable-and-publishable-libraries',
  '/concepts/decisions': '/docs/concepts/decisions',
  '/concepts/decisions/overview': '/docs/concepts/decisions/overview',
  '/concepts/decisions/why-monorepos': '/docs/concepts/decisions/why-monorepos',
  '/concepts/decisions/dependency-management':
    '/docs/concepts/decisions/dependency-management',
  '/concepts/decisions/code-ownership':
    '/docs/concepts/decisions/code-ownership',
  '/concepts/decisions/project-size': '/docs/concepts/decisions/project-size',
  '/concepts/decisions/project-dependency-rules':
    '/docs/concepts/decisions/project-dependency-rules',
  '/concepts/decisions/folder-structure':
    '/docs/concepts/decisions/folder-structure',
  '/concepts/nx-daemon': '/docs/concepts/nx-daemon',

  // ========== EXTENDING-NX ==========
  '/extending-nx': '/docs/extending-nx',
  '/extending-nx/intro': '/docs/extending-nx/intro',
  '/extending-nx/intro/getting-started': '/docs/extending-nx/intro', // Mapped to intro page
  '/extending-nx/api/nx-devkit/overview': '/docs/extending-nx', // Mapped to index
  '/extending-nx/api/plugin/overview': '/docs/extending-nx', // Mapped to index
  '/extending-nx/tutorials': '/docs/extending-nx', // Mapped to index
  '/extending-nx/tutorials/organization-specific-plugin':
    '/docs/extending-nx/organization-specific-plugin',
  '/extending-nx/tutorials/tooling-plugin': '/docs/extending-nx/tooling-plugin',
  '/extending-nx/recipes': '/docs/extending-nx', // No recipes index, map to main extending-nx
  '/extending-nx/recipes/local-generators':
    '/docs/extending-nx/local-generators',
  '/extending-nx/recipes/composing-generators':
    '/docs/extending-nx/composing-generators',
  '/extending-nx/recipes/generator-options': '/docs/extending-nx', // No direct match, map to index
  '/extending-nx/recipes/creating-files': '/docs/extending-nx/creating-files',
  '/extending-nx/recipes/modifying-files': '/docs/extending-nx/modifying-files',
  '/extending-nx/recipes/create-sync-generator':
    '/docs/extending-nx/create-sync-generator',
  '/extending-nx/recipes/migration-generators':
    '/docs/extending-nx/migration-generators',
  '/extending-nx/recipes/local-executors': '/docs/extending-nx/local-executors',
  '/extending-nx/recipes/compose-executors':
    '/docs/extending-nx/compose-executors',
  '/extending-nx/recipes/create-preset': '/docs/extending-nx/create-preset',
  '/extending-nx/recipes/create-install-package':
    '/docs/extending-nx/create-install-package',
  '/extending-nx/recipes/project-graph-plugins':
    '/docs/extending-nx/project-graph-plugins',
  '/extending-nx/recipes/publish-plugin': '/docs/extending-nx/publish-plugin',
  '/extending-nx/recipes/task-running-lifecycle':
    '/docs/extending-nx/task-running-lifecycle',
  '/extending-nx/api': '/docs/extending-nx', // No API section, map to index
  '/extending-nx/api/nx-devkit': '/docs/extending-nx', // No devkit section, map to index
  '/extending-nx/api/nx-devkit/ngcli-adapter': '/docs/extending-nx', // No ngcli-adapter, map to index
  '/extending-nx/api/plugin': '/docs/extending-nx', // No plugin API, map to index

  // ========== FEATURES ==========
  '/features': '/docs/features',
  '/features/run-tasks': '/docs/features/run-tasks',
  '/features/cache-task-results': '/docs/features/cache-task-results',
  '/features/enhance-AI': '/docs/features/enhance-ai',
  '/features/explore-graph': '/docs/features/explore-graph',
  '/features/generate-code': '/docs/features/generate-code',
  '/features/automate-updating-dependencies':
    '/docs/features/automate-updating-dependencies',
  '/features/enforce-module-boundaries':
    '/docs/features/enforce-module-boundaries',
  '/features/manage-releases': '/docs/features/manage-releases',
  '/features/ci-features': '/docs/features/ci-features',
  '/features/maintain-ts-monorepos':
    '/docs/features/maintain-typescript-monorepos',

  // ========== GETTING-STARTED ==========
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
  // Fallback
  '/getting-started/:path*': '/docs/getting-started/intro',

  // ========== NX-ENTERPRISE ==========
  '/nx-enterprise': '/docs/enterprise',
  '/nx-enterprise/activate-powerpack': '/docs/enterprise/activate-powerpack',
  '/nx-enterprise/powerpack/licenses-and-trials':
    '/docs/enterprise/powerpack/licenses-and-trials',
  '/nx-enterprise/powerpack/conformance':
    '/docs/enterprise/powerpack/conformance',
  '/nx-enterprise/powerpack/owners': '/docs/enterprise/powerpack/owners',

  '/nx-enterprise/powerpack': '/docs/enterprise/powerpack',

  // ========== PLUGIN-REGISTRY ==========
  '/plugin-registry': '/docs/plugin-registry',

  // ========= RECIPES -> GUIDES =========
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
  '/recipes/adopting-nx/adding-to-monorepo':
    '/docs/guides/adopting-nx/adding-to-monorepo',
  '/recipes/adopting-nx/from-turborepo':
    '/docs/guides/adopting-nx/from-turborepo',
  '/recipes/adopting-nx/adding-to-existing-project':
    '/docs/guides/adopting-nx/adding-to-existing-project',
  '/recipes/adopting-nx/import-project':
    '/docs/guides/adopting-nx/import-project',
  '/recipes/adopting-nx/preserving-git-histories':
    '/docs/guides/adopting-nx/preserving-git-histories',
  '/recipes/adopting-nx/manual': '/docs/guides/adopting-nx/manual',
  '/recipes/nx-release/release-npm-packages':
    '/docs/guides/nx-release/release-npm-packages',
  '/recipes/nx-release/release-docker-images':
    '/docs/guides/nx-release/release-docker-images',
  '/recipes/nx-release/publish-rust-crates':
    '/docs/guides/nx-release/publish-rust-crates',
  '/recipes/nx-release/release-projects-independently':
    '/docs/guides/nx-release/release-projects-independently',
  '/recipes/nx-release/updating-version-references':
    '/docs/guides/nx-release/updating-version-references',
  '/recipes/nx-release/automatically-version-with-conventional-commits':
    '/docs/guides/nx-release/automatically-version-with-conventional-commits',
  '/recipes/nx-release/customize-conventional-commit-types':
    '/docs/guides/nx-release/customize-conventional-commit-types',
  '/recipes/nx-release/file-based-versioning-version-plans':
    '/docs/guides/nx-release/file-based-versioning-version-plans',
  '/recipes/nx-release/configure-custom-registries':
    '/docs/guides/nx-release/configure-custom-registries',
  '/recipes/nx-release/publish-in-ci-cd':
    '/docs/guides/nx-release/publish-in-ci-cd',
  '/recipes/nx-release/automate-github-releases':
    '/docs/guides/nx-release/automate-github-releases',
  '/recipes/nx-release/automate-gitlab-releases':
    '/docs/guides/nx-release/automate-gitlab-releases',
  '/recipes/nx-release/update-local-registry-setup':
    '/docs/guides/nx-release/update-local-registry-setup',
  '/recipes/nx-release/configure-changelog-format':
    '/docs/guides/nx-release/configure-changelog-format',
  '/recipes/nx-release/build-before-versioning':
    '/docs/guides/nx-release/build-before-versioning',
  '/recipes/nx-release/configuration-version-prefix':
    '/docs/guides/nx-release/configuration-version-prefix',
  '/recipes/nx-console/console-telemetry':
    '/docs/guides/nx-console/console-telemetry',
  '/recipes/nx-console/console-project-details':
    '/docs/guides/nx-console/console-project-details',
  '/recipes/nx-console/console-generate-command':
    '/docs/guides/nx-console/console-generate-command',
  '/recipes/nx-console/console-run-command':
    '/docs/guides/nx-console/console-run-command',
  '/recipes/nx-console/console-nx-cloud':
    '/docs/guides/nx-console/console-nx-cloud',
  '/recipes/nx-console/console-migrate-ui':
    '/docs/guides/nx-console/console-migrate-ui',
  '/recipes/nx-console/console-troubleshooting':
    '/docs/guides/nx-console/console-troubleshooting',
  '/recipes/enforce-module-boundaries':
    '/docs/features/enforce-module-boundaries',
  '/recipes/enforce-module-boundaries/ban-dependencies-with-tags':
    '/docs/guides/enforce-module-boundaries/ban-dependencies-with-tags',
  '/recipes/enforce-module-boundaries/tag-multiple-dimensions':
    '/docs/guides/enforce-module-boundaries/tag-multiple-dimensions',
  '/recipes/enforce-module-boundaries/ban-external-imports':
    '/docs/guides/enforce-module-boundaries/ban-external-imports',
  '/recipes/enforce-module-boundaries/tags-allow-list':
    '/docs/guides/enforce-module-boundaries/tags-allow-list',
  '/recipes/tips-n-tricks/standalone-to-monorepo':
    '/docs/guides/tips-n-tricks/standalone-to-monorepo',
  '/recipes/tips-n-tricks/keep-nx-versions-in-sync':
    '/docs/guides/tips-n-tricks/keep-nx-versions-in-sync',
  '/recipes/tips-n-tricks/define-environment-variables':
    '/docs/guides/tips-n-tricks/define-environment-variables',
  '/recipes/tips-n-tricks/browser-support':
    '/docs/guides/tips-n-tricks/browser-support',
  '/recipes/tips-n-tricks/include-assets-in-build':
    '/docs/guides/tips-n-tricks/include-assets-in-build',
  '/recipes/tips-n-tricks/include-all-packagejson':
    '/docs/guides/tips-n-tricks/include-all-packagejson',
  '/recipes/tips-n-tricks/identify-dependencies-between-folders':
    '/docs/guides/tips-n-tricks/identify-dependencies-between-folders',
  '/recipes/tips-n-tricks/analyze-source-files':
    '/docs/guides/tips-n-tricks/analyze-source-files',
  '/recipes/tips-n-tricks/advanced-update':
    '/docs/guides/tips-n-tricks/advanced-update',
  '/recipes/tips-n-tricks/yarn-pnp': '/docs/guides/tips-n-tricks/yarn-pnp',
  '/recipes/adopting-nx': '/docs/guides/adopting-nx',
  '/recipes/nx-release': '/docs/guides/nx-release',
  '/recipes/nx-console': '/docs/guides/nx-console',

  // ========== REFERENCE ==========
  '/reference': '/docs/reference',
  '/reference/nx-commands': '/docs/reference/nx-commands',
  '/reference/nx-json': '/docs/reference/nx-json',
  '/reference/project-configuration': '/docs/reference/project-configuration',
  '/reference/inputs': '/docs/reference/inputs',
  '/reference/nxignore': '/docs/reference/nxignore',
  '/reference/environment-variables': '/docs/reference/environment-variables',
  '/reference/glossary': '/docs/reference/glossary',
  '/reference/releases': '/docs/reference/releases',
  '/reference/core-api/owners': '/docs/reference/powerpack/owners',
  '/reference/core-api/owners/overview':
    '/docs/reference/powerpack/owners/overview',
  '/reference/core-api/conformance': '/docs/reference/powerpack/conformance',
  '/reference/core-api/conformance/overview':
    '/docs/reference/powerpack/conformance/overview',
  '/reference/core-api/conformance/create-conformance-rule':
    '/docs/reference/powerpack/conformance/create-conformance-rule',
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
  '/reference/core-api/nx/documents/daemon': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/affected': '/docs/reference/nx-commands',
  '/reference/core-api/workspace/documents/overview':
    '/docs/reference/powerpack/conformance/overview',
  '/reference/core-api/conformance/documents/overview':
    '/docs/reference/powerpack/conformance/overview',
  '/reference/core-api/conformance/documents/create-conformance-rule':
    '/docs/reference/powerpack/conformance/create-conformance-rule',
  '/reference/core-api/conformance/executors':
    '/docs/reference/powerpack/conformance/executors',
  '/reference/core-api/owners/generators':
    '/docs/reference/powerpack/owners/generators',
  '/reference/core-api/shared-fs-cache/generators':
    '/docs/reference/remote-cache-plugins/shared-fs-cache/generators',
  '/reference/core-api': '/docs/reference',
  '/reference/core-api/nx': '/reference/nx',
  '/reference/core-api/workspace': '/reference/workspace',
  '/reference/core-api/plugin': '/reference/plugin',
  '/reference/core-api/web': '/reference/web',
  '/reference/core-api/create-nx-workspace':
    '/docs/reference/create-nx-workspace',
  '/reference/core-api/devkit/documents': '/docs/reference/devkit',
  '/reference/core-api/devkit': '/docs/reference/devkit',
  '/reference/core-api/devkit/documents/ngcli_adapter':
    '/docs/reference/devkit/ngcli_adapter',
  '/reference/core-api/devkit/documents/AggregateCreateNodesError':
    '/docs/reference/devkit/AggregateCreateNodesError',
  '/reference/core-api/devkit/documents/AsyncIteratorExecutor':
    '/docs/reference/devkit/AsyncIteratorExecutor',
  '/reference/core-api/devkit/documents/ChangeType':
    '/docs/reference/devkit/ChangeType',
  '/reference/core-api/devkit/documents/CreateDependencies':
    '/docs/reference/devkit/CreateDependencies',
  '/reference/core-api/devkit/documents/CreateDependenciesContext':
    '/docs/reference/devkit/CreateDependenciesContext',
  '/reference/core-api/devkit/documents/CreateMetadata':
    '/docs/reference/devkit/CreateMetadata',
  '/reference/core-api/devkit/documents/CreateMetadataContext':
    '/docs/reference/devkit/CreateMetadataContext',
  '/reference/core-api/devkit/documents/CreateNodes':
    '/docs/reference/devkit/CreateNodes',
  '/reference/core-api/devkit/documents/CreateNodesContext':
    '/docs/reference/devkit/CreateNodesContext',
  '/reference/core-api/devkit/documents/CreateNodesContextV2':
    '/docs/reference/devkit/CreateNodesContextV2',
  '/reference/core-api/devkit/documents/CreateNodesFunction':
    '/docs/reference/devkit/CreateNodesFunction',
  '/reference/core-api/devkit/documents/CreateNodesFunctionV2':
    '/docs/reference/devkit/CreateNodesFunctionV2',
  '/reference/core-api/devkit/documents/CreateNodesResult':
    '/docs/reference/devkit/CreateNodesResult',
  '/reference/core-api/devkit/documents/CreateNodesResultV2':
    '/docs/reference/devkit/CreateNodesResultV2',
  '/reference/core-api/devkit/documents/CreateNodesV2':
    '/docs/reference/devkit/CreateNodesV2',
  '/reference/core-api/devkit/documents/CustomHasher':
    '/docs/reference/devkit/CustomHasher',
  '/reference/core-api/devkit/documents/DefaultTasksRunnerOptions':
    '/docs/reference/devkit/DefaultTasksRunnerOptions',
  '/reference/core-api/devkit/documents/DependencyType':
    '/docs/reference/devkit/DependencyType',
  '/reference/core-api/devkit/documents/DynamicDependency':
    '/docs/reference/devkit/DynamicDependency',
  '/reference/core-api/devkit/documents/Executor':
    '/docs/reference/devkit/Executor',
  '/reference/core-api/devkit/documents/ExecutorContext':
    '/docs/reference/devkit/ExecutorContext',
  '/reference/core-api/devkit/documents/ExecutorsJson':
    '/docs/reference/devkit/ExecutorsJson',
  '/reference/core-api/devkit/documents/ExpandedPluginConfiguration':
    '/docs/reference/devkit/ExpandedPluginConfiguration',
  '/reference/core-api/devkit/documents/FileChange':
    '/docs/reference/devkit/FileChange',
  '/reference/core-api/devkit/documents/FileData':
    '/docs/reference/devkit/FileData',
  '/reference/core-api/devkit/documents/FileMap':
    '/docs/reference/devkit/FileMap',
  '/reference/core-api/devkit/documents/Generator':
    '/docs/reference/devkit/Generator',
  '/reference/core-api/devkit/documents/GeneratorCallback':
    '/docs/reference/devkit/GeneratorCallback',
  '/reference/core-api/devkit/documents/GeneratorsJson':
    '/docs/reference/devkit/GeneratorsJson',
  '/reference/core-api/devkit/documents/GraphJson':
    '/docs/reference/devkit/GraphJson',
  '/reference/core-api/devkit/documents/Hash': '/docs/reference/devkit/Hash',
  '/reference/core-api/devkit/documents/Hasher':
    '/docs/reference/devkit/Hasher',
  '/reference/core-api/devkit/documents/HasherContext':
    '/docs/reference/devkit/HasherContext',
  '/reference/core-api/devkit/documents/ImplicitDependency':
    '/docs/reference/devkit/ImplicitDependency',
  '/reference/core-api/devkit/documents/ImplicitDependencyEntry':
    '/docs/reference/devkit/ImplicitDependencyEntry',
  '/reference/core-api/devkit/documents/ImplicitJsonSubsetDependency':
    '/docs/reference/devkit/ImplicitJsonSubsetDependency',
  '/reference/core-api/devkit/documents/JsonParseOptions':
    '/docs/reference/devkit/JsonParseOptions',
  '/reference/core-api/devkit/documents/JsonSerializeOptions':
    '/docs/reference/devkit/JsonSerializeOptions',
  '/reference/core-api/devkit/documents/MigrationsJson':
    '/docs/reference/devkit/MigrationsJson',
  '/reference/core-api/devkit/documents/NX_VERSION':
    '/docs/reference/devkit/NX_VERSION',
  '/reference/core-api/devkit/documents/NxAffectedConfig':
    '/docs/reference/devkit/NxAffectedConfig',
  '/reference/core-api/devkit/documents/NxJsonConfiguration':
    '/docs/reference/devkit/NxJsonConfiguration',
  '/reference/core-api/devkit/documents/NxPlugin':
    '/docs/reference/devkit/NxPlugin',
  '/reference/core-api/devkit/documents/NxPluginV2':
    '/docs/reference/devkit/NxPluginV2',
  '/reference/core-api/devkit/documents/OverwriteStrategy':
    '/docs/reference/devkit/OverwriteStrategy',
  '/reference/core-api/devkit/documents/PackageManager':
    '/docs/reference/devkit/PackageManager',
  '/reference/core-api/devkit/documents/PluginConfiguration':
    '/docs/reference/devkit/PluginConfiguration',
  '/reference/core-api/devkit/documents/PostTasksExecution':
    '/docs/reference/devkit/PostTasksExecution',
  '/reference/core-api/devkit/documents/PostTasksExecutionContext':
    '/docs/reference/devkit/PostTasksExecutionContext',
  '/reference/core-api/devkit/documents/PreTasksExecution':
    '/docs/reference/devkit/PreTasksExecution',
  '/reference/core-api/devkit/documents/PreTasksExecutionContext':
    '/docs/reference/devkit/PreTasksExecutionContext',
  '/reference/core-api/devkit/documents/ProjectConfiguration':
    '/docs/reference/devkit/ProjectConfiguration',
  '/reference/core-api/devkit/documents/ProjectFileMap':
    '/docs/reference/devkit/ProjectFileMap',
  '/reference/core-api/devkit/documents/ProjectGraph':
    '/docs/reference/devkit/ProjectGraph',
  '/reference/core-api/devkit/documents/ProjectGraphDependency':
    '/docs/reference/devkit/ProjectGraphDependency',
  '/reference/core-api/devkit/documents/ProjectGraphExternalNode':
    '/docs/reference/devkit/ProjectGraphExternalNode',
  '/reference/core-api/devkit/documents/ProjectGraphProjectNode':
    '/docs/reference/devkit/ProjectGraphProjectNode',
  '/reference/core-api/devkit/documents/ProjectType':
    '/docs/reference/devkit/ProjectType',
  '/reference/core-api/devkit/documents/ProjectsConfigurations':
    '/docs/reference/devkit/ProjectsConfigurations',
  '/reference/core-api/devkit/documents/ProjectsMetadata':
    '/docs/reference/devkit/ProjectsMetadata',
  '/reference/core-api/devkit/documents/PromiseExecutor':
    '/docs/reference/devkit/PromiseExecutor',
  '/reference/core-api/devkit/documents/README': '/docs/reference/devkit',
  '/reference/core-api/devkit/documents/RawProjectGraphDependency':
    '/docs/reference/devkit/RawProjectGraphDependency',
  '/reference/core-api/devkit/documents/RemoteCache':
    '/docs/reference/devkit/RemoteCache',
  '/reference/core-api/devkit/documents/StaleProjectGraphCacheError':
    '/docs/reference/devkit/StaleProjectGraphCacheError',
  '/reference/core-api/devkit/documents/StaticDependency':
    '/docs/reference/devkit/StaticDependency',
  '/reference/core-api/devkit/documents/StringChange':
    '/docs/reference/devkit/StringChange',
  '/reference/core-api/devkit/documents/StringDeletion':
    '/docs/reference/devkit/StringDeletion',
  '/reference/core-api/devkit/documents/StringInsertion':
    '/docs/reference/devkit/StringInsertion',
  '/reference/core-api/devkit/documents/Target':
    '/docs/reference/devkit/Target',
  '/reference/core-api/devkit/documents/TargetConfiguration':
    '/docs/reference/devkit/TargetConfiguration',
  '/reference/core-api/devkit/documents/TargetDefaults':
    '/docs/reference/devkit/TargetDefaults',
  '/reference/core-api/devkit/documents/TargetDependencyConfig':
    '/docs/reference/devkit/TargetDependencyConfig',
  '/reference/core-api/devkit/documents/Task': '/docs/reference/devkit/Task',
  '/reference/core-api/devkit/documents/TaskGraph':
    '/docs/reference/devkit/TaskGraph',
  '/reference/core-api/devkit/documents/TaskGraphExecutor':
    '/docs/reference/devkit/TaskGraphExecutor',
  '/reference/core-api/devkit/documents/TaskHasher':
    '/docs/reference/devkit/TaskHasher',
  '/reference/core-api/devkit/documents/TaskResult':
    '/docs/reference/devkit/TaskResult',
  '/reference/core-api/devkit/documents/TaskResults':
    '/docs/reference/devkit/TaskResults',
  '/reference/core-api/devkit/documents/ToJSOptions':
    '/docs/reference/devkit/ToJSOptions',
  '/reference/core-api/devkit/documents/Tree': '/docs/reference/devkit/Tree',
  '/reference/core-api/devkit/documents/Workspace':
    '/docs/reference/devkit/Workspace',
  '/reference/core-api/devkit/documents/WorkspaceJsonConfiguration':
    '/docs/reference/devkit/WorkspaceJsonConfiguration',
  '/reference/core-api/devkit/documents/addDependenciesToPackageJson':
    '/docs/reference/devkit/addDependenciesToPackageJson',
  '/reference/core-api/devkit/documents/addProjectConfiguration':
    '/docs/reference/devkit/addProjectConfiguration',
  '/reference/core-api/devkit/documents/applyChangesToString':
    '/docs/reference/devkit/applyChangesToString',
  '/reference/core-api/devkit/documents/cacheDir':
    '/docs/reference/devkit/cacheDir',
  '/reference/core-api/devkit/documents/convertNxExecutor':
    '/docs/reference/devkit/convertNxExecutor',
  '/reference/core-api/devkit/documents/convertNxGenerator':
    '/docs/reference/devkit/convertNxGenerator',
  '/reference/core-api/devkit/documents/createNodesFromFiles':
    '/docs/reference/devkit/createNodesFromFiles',
  '/reference/core-api/devkit/documents/createProjectFileMapUsingProjectGraph':
    '/docs/reference/devkit/createProjectFileMapUsingProjectGraph',
  '/reference/core-api/devkit/documents/createProjectGraphAsync':
    '/docs/reference/devkit/createProjectGraphAsync',
  '/reference/core-api/devkit/documents/defaultTasksRunner':
    '/docs/reference/devkit/defaultTasksRunner',
  '/reference/core-api/devkit/documents/detectPackageManager':
    '/docs/reference/devkit/detectPackageManager',
  '/reference/core-api/devkit/documents/ensurePackage':
    '/docs/reference/devkit/ensurePackage',
  '/reference/core-api/devkit/documents/extractLayoutDirectory':
    '/docs/reference/devkit/extractLayoutDirectory',
  '/reference/core-api/devkit/documents/formatFiles':
    '/docs/reference/devkit/formatFiles',
  '/reference/core-api/devkit/documents/generateFiles':
    '/docs/reference/devkit/generateFiles',
  '/reference/core-api/devkit/documents/getOutputsForTargetAndConfiguration':
    '/docs/reference/devkit/getOutputsForTargetAndConfiguration',
  '/reference/core-api/devkit/documents/getPackageManagerCommand':
    '/docs/reference/devkit/getPackageManagerCommand',
  '/reference/core-api/devkit/documents/getPackageManagerVersion':
    '/docs/reference/devkit/getPackageManagerVersion',
  '/reference/core-api/devkit/documents/getProjects':
    '/docs/reference/devkit/getProjects',
  '/reference/core-api/devkit/documents/getWorkspaceLayout':
    '/docs/reference/devkit/getWorkspaceLayout',
  '/reference/core-api/devkit/documents/glob': '/docs/reference/devkit/glob',
  '/reference/core-api/devkit/documents/globAsync':
    '/docs/reference/devkit/globAsync',
  '/reference/core-api/devkit/documents/hashArray':
    '/docs/reference/devkit/hashArray',
  '/reference/core-api/devkit/documents/installPackagesTask':
    '/docs/reference/devkit/installPackagesTask',
  '/reference/core-api/devkit/documents/isDaemonEnabled':
    '/docs/reference/devkit/isDaemonEnabled',
  '/reference/core-api/devkit/documents/isWorkspacesEnabled':
    '/docs/reference/devkit/isWorkspacesEnabled',
  '/reference/core-api/devkit/documents/joinPathFragments':
    '/docs/reference/devkit/joinPathFragments',
  '/reference/core-api/devkit/documents/logger':
    '/docs/reference/devkit/logger',
  '/reference/core-api/devkit/documents/moveFilesToNewDirectory':
    '/docs/reference/devkit/moveFilesToNewDirectory',
  '/reference/core-api/devkit/documents/names': '/docs/reference/devkit/names',
  '/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost':
    '/docs/reference/devkit/ngcli_adapter/NxScopedHost',
  '/reference/core-api/devkit/documents/ngcli_adapter/README':
    '/docs/reference/devkit/ngcli_adapter',
  '/reference/core-api/devkit/documents/ngcli_adapter/mockSchematicsForTesting':
    '/docs/reference/devkit/ngcli_adapter/mockSchematicsForTesting',
  '/reference/core-api/devkit/documents/ngcli_adapter/wrapAngularDevkitSchematic':
    '/docs/reference/devkit/ngcli_adapter/wrapAngularDevkitSchematic',
  '/reference/core-api/devkit/documents/normalizePath':
    '/docs/reference/devkit/normalizePath',
  '/reference/core-api/devkit/documents/offsetFromRoot':
    '/docs/reference/devkit/offsetFromRoot',
  '/reference/core-api/devkit/documents/output':
    '/docs/reference/devkit/output',
  '/reference/core-api/devkit/documents/parseJson':
    '/docs/reference/devkit/parseJson',
  '/reference/core-api/devkit/documents/parseTargetString':
    '/docs/reference/devkit/parseTargetString',
  '/reference/core-api/devkit/documents/readCachedProjectGraph':
    '/docs/reference/devkit/readCachedProjectGraph',
  '/reference/core-api/devkit/documents/readJson':
    '/docs/reference/devkit/readJson',
  '/reference/core-api/devkit/documents/readJsonFile':
    '/docs/reference/devkit/readJsonFile',
  '/reference/core-api/devkit/documents/readNxJson':
    '/docs/reference/devkit/readNxJson',
  '/reference/core-api/devkit/documents/readProjectConfiguration':
    '/docs/reference/devkit/readProjectConfiguration',
  '/reference/core-api/devkit/documents/readProjectsConfigurationFromProjectGraph':
    '/docs/reference/devkit/readProjectsConfigurationFromProjectGraph',
  '/reference/core-api/devkit/documents/readTargetOptions':
    '/docs/reference/devkit/readTargetOptions',
  '/reference/core-api/devkit/documents/removeDependenciesFromPackageJson':
    '/docs/reference/devkit/removeDependenciesFromPackageJson',
  '/reference/core-api/devkit/documents/removeProjectConfiguration':
    '/docs/reference/devkit/removeProjectConfiguration',
  '/reference/core-api/devkit/documents/reverse':
    '/docs/reference/devkit/reverse',
  '/reference/core-api/devkit/documents/runExecutor':
    '/docs/reference/devkit/runExecutor',
  '/reference/core-api/devkit/documents/runTasksInSerial':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/serializeJson':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/stripIndents':
    '/docs/reference/benchmarks/caching',
  '/reference/core-api/devkit/documents/stripJsonComments':
    '/docs/reference/devkit/stripJsonComments',
  '/reference/core-api/devkit/documents/targetToTargetString':
    '/docs/reference/devkit/targetToTargetString',
  '/reference/core-api/devkit/documents/toJS': '/docs/reference/devkit/toJS',
  '/reference/core-api/devkit/documents/updateJson':
    '/docs/reference/devkit/updateJson',
  '/reference/core-api/devkit/documents/updateNxJson':
    '/docs/reference/devkit/updateNxJson',
  '/reference/core-api/devkit/documents/updateProjectConfiguration':
    '/docs/reference/devkit/updateProjectConfiguration',
  '/reference/core-api/devkit/documents/updateTsConfigsToJs':
    '/docs/reference/devkit/updateTsConfigsToJs',
  '/reference/core-api/devkit/documents/validateDependency':
    '/docs/reference/devkit/validateDependency',
  '/reference/core-api/devkit/documents/visitNotIgnoredFiles':
    '/docs/reference/devkit/visitNotIgnoredFiles',
  '/reference/core-api/devkit/documents/workspaceLayout':
    '/docs/reference/devkit/workspaceLayout',
  '/reference/core-api/devkit/documents/workspaceRoot':
    '/docs/reference/devkit/workspaceRoot',
  '/reference/core-api/devkit/documents/writeJson':
    '/docs/reference/devkit/writeJson',
  '/reference/core-api/devkit/documents/writeJsonFile':
    '/docs/reference/devkit/writeJsonFile',
  '/reference/core-api/devkit/executors': '/docs/reference/devkit', // missing (but this was an empty page anyway
  '/reference/core-api/devkit/generators': '/docs/reference/devkit', // missing (but this was an empty page anyway
  '/reference/core-api/devkit/migrations': '/docs/reference/devkit', // missing (but this was an empty page anyway
  '/reference/core-api/nx/documents': '/docs/reference/nx-commands', // these were just list of CLI commands
  '/reference/core-api/nx/documents/create-nx-workspace':
    'https://canary.nx.dev/docs/reference/create-nx-workspace',
  '/reference/core-api/nx/documents/init': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/generate': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/run': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/dep-graph': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/run-many': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/format-check':
    '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/format-write':
    '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/migrate': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/report': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/list': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/connect-to-nx-cloud':
    '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/reset': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/repair': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/sync': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/sync-check': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/import': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/exec': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/watch': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/show': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/view-logs': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/release': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/add': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/mcp': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/login': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/logout': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/fix-ci': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/record': '/docs/reference/nx-commands',
  '/reference/core-api/nx/documents/start-ci-run':
    '/docs/reference/nx-commands',
  '/reference/core-api/nx/executors': '/reference/nx/executors',
  '/reference/core-api/nx/executors/noop': '/reference/nx/executors',
  '/reference/core-api/nx/executors/run-commands': '/reference/nx/executors',
  '/reference/core-api/nx/executors/run-script': '/reference/nx/executors',
  '/reference/core-api/nx/generators': '/reference/nx/generators',
  '/reference/core-api/nx/generators/connect-to-nx-cloud':
    '/reference/nx/generators',
  '/reference/core-api/nx/migrations': '/reference/nx/migrations',
  '/reference/core-api/plugin/executors': '/reference/plugin/executors',
  '/reference/core-api/plugin/generators': '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/plugin':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/create-package':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/e2e-project':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/migration':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/generator':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/executor':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/plugin-lint-checks':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/generators/preset':
    '/reference/plugin/generators',
  '/reference/core-api/plugin/migrations': '/reference/plugin/migrations',
  '/reference/core-api/web/executors': '/reference/web/executors',
  '/reference/core-api/web/executors/file-server': '/reference/web/executors',
  '/reference/core-api/web/generators': '/reference/web/generators',
  '/reference/core-api/web/generators/init': '/reference/web/generators',
  '/reference/core-api/web/generators/application': '/reference/web/generators',
  '/reference/core-api/web/generators/static-config':
    '/reference/web/generators',
  '/reference/core-api/web/migrations': '/reference/web/migrations',
  '/reference/core-api/workspace/documents': '/reference/workspace',
  '/reference/core-api/workspace/documents/nx-nodejs-typescript-version-matrix':
    '/docs/reference/nodejs-typescript-compatibility',
  '/reference/core-api/workspace/executors': '/reference/workspace/executors',
  '/reference/core-api/workspace/executors/counter':
    '/reference/workspace/executors',
  '/reference/core-api/workspace/generators': '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/preset':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/move':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/remove':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/convert-to-monorepo':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/new':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/run-commands':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/fix-configuration':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/npm-package':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/ci-workflow':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/generators/infer-targets':
    '/reference/workspace/generators',
  '/reference/core-api/workspace/migrations': '/reference/workspace/migrations',
  '/reference/core-api/azure-cache/executors':
    '/docs/reference/remote-cache-plugins/azure-cache/overview', // this was empty
  '/reference/core-api/azure-cache/generators':
    '/docs/reference/remote-cache-plugins/azure-cache/overview', // this was empty
  '/reference/core-api/azure-cache/migrations':
    '/docs/reference/remote-cache-plugins/azure-cache/overview', // this was empty
  '/reference/core-api/conformance/documents':
    '/docs/reference/powerpack/conformance/overview',
  '/reference/core-api/conformance/generators':
    '/docs/reference/powerpack/conformance/generators',
  '/reference/core-api/conformance/generators/create-rule':
    '/docs/reference/powerpack/conformance/generators',
  '/reference/core-api/conformance/generators/preset':
    '/docs/reference/powerpack/conformance/generators',
  '/reference/core-api/conformance/migrations':
    '/docs/reference/powerpack/conformance/overview',
  '/reference/core-api/owners/executors':
    '/docs/reference/powerpack/owners/overview', // this was empty
  '/reference/core-api/owners/generators/init':
    '/docs/reference/powerpack/owners/generators',
  '/reference/core-api/owners/generators/sync-codeowners-file':
    '/docs/reference/powerpack/owners/generators',
  '/reference/core-api/owners/migrations':
    '/docs/reference/powerpack/owners/overview',
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

  // ========== SHOWCASE ==========
  '/showcase/benchmarks/tsc-batch-mode':
    '/docs/reference/benchmarks/tsc-batch-mode',
  '/showcase/benchmarks/caching': '/docs/reference/benchmarks/caching',
  '/showcase/benchmarks/nx-agents': '/docs/reference/benchmarks/nx-agents',
  '/showcase/benchmarks': '/docs/reference/benchmarks',

  // ========== TECHNOLOGIES ==========
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
  '/technologies/test-tools/storybook':
    '/docs/technologies/test-tools/storybook',
  '/technologies/test-tools/storybook/introduction':
    '/docs/technologies/test-tools/storybook/introduction',
  '/technologies/test-tools/detox': '/docs/technologies/test-tools/detox',
  '/technologies/test-tools/detox/introduction':
    '/docs/technologies/test-tools/detox/introduction',
  '/technologies/typescript/recipes/switch-to-workspaces-project-references':
    '/docs/technologies/typescript/guides/switch-to-workspaces-project-references',
  '/technologies/typescript/recipes/enable-tsc-batch-mode':
    '/docs/technologies/typescript/guides/enable-tsc-batch-mode',
  '/technologies/typescript/recipes/define-secondary-entrypoints':
    '/docs/technologies/typescript/guides/define-secondary-entrypoints',
  '/technologies/typescript/recipes/compile-multiple-formats':
    '/docs/technologies/typescript/guides/compile-multiple-formats',
  '/technologies/typescript/recipes/js-and-ts':
    '/docs/technologies/typescript/guides/js-and-ts',
  '/technologies/angular/recipes/use-environment-variables-in-angular':
    '/docs/technologies/angular/guides/use-environment-variables-in-angular',
  '/technologies/angular/recipes/using-tailwind-css-with-angular-projects':
    '/docs/technologies/angular/guides/using-tailwind-css-with-angular-projects',
  '/technologies/angular/recipes/module-federation-with-ssr':
    '/docs/technologies/angular/guides/module-federation-with-ssr',
  '/technologies/angular/recipes/dynamic-module-federation-with-angular':
    '/docs/technologies/angular/guides/dynamic-module-federation-with-angular',
  '/technologies/angular/recipes/setup-incremental-builds-angular':
    '/docs/technologies/angular/guides/setup-incremental-builds-angular',
  '/technologies/angular/recipes/nx-and-angular':
    '/docs/technologies/angular/guides/nx-and-angular',
  '/technologies/angular/recipes/nx-devkit-angular-devkit':
    '/docs/technologies/angular/guides/nx-devkit-angular-devkit',
  '/technologies/angular/recipes/angular-nx-version-matrix':
    '/docs/technologies/angular/guides/angular-nx-version-matrix',
  '/technologies/angular/angular-rspack/recipes':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/technologies/angular/angular-rspack/recipes/getting-started':
    '/docs/technologies/angular/angular-rspack/guides/getting-started',
  '/technologies/angular/angular-rspack/recipes/migrate-from-webpack':
    '/docs/technologies/angular/angular-rspack/guides/migrate-from-webpack',
  '/technologies/angular/angular-rspack/recipes/handling-configurations':
    '/docs/technologies/angular/angular-rspack/guides/handling-configurations',
  '/technologies/angular/angular-rspack/recipes/internationalization':
    '/docs/technologies/angular/angular-rspack/guides/internationalization',
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
  '/technologies/react/recipes/react-native':
    '/docs/technologies/react/guides/react-native',
  '/technologies/react/recipes/remix': '/docs/technologies/react/guides/remix',
  '/technologies/react/recipes/react-router':
    '/docs/technologies/react/guides/react-router',
  '/technologies/react/recipes/use-environment-variables-in-react':
    '/docs/technologies/react/guides/use-environment-variables-in-react',
  '/technologies/react/recipes/using-tailwind-css-in-react':
    '/docs/technologies/react/guides/using-tailwind-css-in-react',
  '/technologies/react/recipes/adding-assets-react':
    '/docs/technologies/react/guides/adding-assets-react',
  '/technologies/react/recipes/module-federation-with-ssr':
    '/docs/technologies/react/guides/module-federation-with-ssr',
  '/technologies/react/recipes/deploy-nextjs-to-vercel':
    '/docs/technologies/react/guides/deploy-nextjs-to-vercel',
  '/technologies/react/recipes/react-compiler':
    '/docs/technologies/react/guides/react-compiler',
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
  '/technologies/node/recipes/node-server-fly-io':
    '/docs/technologies/node/guides/node-server-fly-io',
  '/technologies/node/recipes/node-serverless-functions-netlify':
    '/docs/technologies/node/guides/node-serverless-functions-netlify',
  '/technologies/node/recipes/node-aws-lambda':
    '/docs/technologies/node/guides/node-aws-lambda',
  '/technologies/node/recipes/application-proxies':
    '/docs/technologies/node/guides/application-proxies',
  '/technologies/node/recipes/wait-for-tasks':
    '/docs/technologies/node/guides/wait-for-tasks',
  '/technologies/node/express/api': '/docs/technologies/node/express',
  '/technologies/node/nest/api': '/docs/technologies/node/nest',
  '/technologies/java/introduction':
    '/docs/technologies/angular/angular-rspack/introduction',
  '/technologies/module-federation/recipes/create-a-host':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/technologies/module-federation/recipes/create-a-remote':
    '/docs/technologies/module-federation/guides/create-a-remote',
  '/technologies/module-federation/recipes/federate-a-module':
    '/docs/technologies/module-federation/guides/federate-a-module',
  '/technologies/module-federation/recipes/nx-module-federation-plugin':
    '/docs/technologies/module-federation/guides/create-a-host',
  '/technologies/module-federation/recipes/nx-module-federation-dev-server-plugin':
    '/docs/technologies/module-federation/guides/nx-module-federation-dev-server-plugin',
  '/technologies/eslint/recipes/eslint':
    '/docs/technologies/eslint/guides/eslint',
  '/technologies/eslint/recipes/flat-config':
    '/docs/technologies/eslint/guides/flat-config',
  '/technologies/eslint/eslint-plugin/recipes':
    '/docs/technologies/eslint/eslint-plugin/guides',
  '/technologies/eslint/eslint-plugin/recipes/enforce-module-boundaries':
    '/docs/technologies/eslint/eslint-plugin/guides/enforce-module-boundaries',
  '/technologies/eslint/eslint-plugin/recipes/dependency-checks':
    '/docs/technologies/eslint/eslint-plugin/guides/dependency-checks',
  '/technologies/eslint/eslint-plugin/api':
    '/docs/technologies/eslint/eslint-plugin',
  '/technologies/build-tools/docker':
    '/docs/technologies/build-tools/docker/introduction',
  '/technologies/build-tools/webpack/recipes':
    '/docs/technologies/build-tools/webpack/guides',
  '/technologies/build-tools/webpack/recipes/webpack-config-setup':
    '/docs/technologies/build-tools/webpack/guides/webpack-config-setup',
  '/technologies/build-tools/webpack/recipes/webpack-plugins':
    '/docs/technologies/build-tools/webpack/guides/webpack-plugins',
  '/technologies/build-tools/webpack/api':
    '/docs/technologies/build-tools/webpack',
  '/technologies/build-tools/vite/recipes':
    '/docs/technologies/build-tools/vite/guides',
  '/technologies/build-tools/vite/recipes/configure-vite':
    '/docs/technologies/build-tools/vite/guides/configure-vite',
  '/technologies/build-tools/vite/api':
    '/docs/technologies/build-tools/vite/guides/configure-vite',
  '/technologies/build-tools/rollup/recipes':
    '/docs/technologies/build-tools/rollup/introduction', // this was empty
  '/technologies/build-tools/rollup/api':
    '/docs/technologies/build-tools/rollup/introduction', // this was empty
  '/technologies/build-tools/esbuild/recipes':
    '/docs/technologies/build-tools/esbuild/introduction', // this was empty
  '/technologies/build-tools/esbuild/api':
    '/docs/technologies/build-tools/esbuild/introduction', // this was empty
  '/technologies/build-tools/rspack/recipes':
    '/docs/technologies/build-tools/rspack/introduction', // this was empty
  '/technologies/build-tools/rspack/api':
    '/docs/technologies/build-tools/rspack/introduction', //this was empty
  '/technologies/build-tools/rsbuild/recipes':
    '/docs/technologies/build-tools/rsbuild/introduction', // this was empty
  '/technologies/build-tools/rsbuild/api':
    '/docs/technologies/build-tools/rsbuild/introduction', //this was empty
  '/technologies/test-tools/cypress/recipes':
    '/docs/technologies/test-tools/cypress/guides/cypress-component-testing',
  '/technologies/test-tools/cypress/recipes/cypress-component-testing':
    '/docs/technologies/test-tools/cypress/guides/cypress-component-testing',
  '/technologies/test-tools/cypress/recipes/cypress-setup-node-events':
    '/docs/technologies/test-tools/cypress/guides/cypress-setup-node-events',
  '/technologies/test-tools/cypress/recipes/cypress-v11-migration':
    '/docs/technologies/test-tools/cypress/guides/cypress-v11-migration',
  '/technologies/test-tools/cypress/api':
    '/docs/technologies/test-tools/cypress',
  '/technologies/test-tools/jest/recipes':
    '/docs/technologies/test-tools/jest/introduction', // this was empty
  '/technologies/test-tools/jest/api': '/docs/technologies/test-tools/jest',
  '/technologies/test-tools/playwright/recipes':
    '/docs/technologies/test-tools/playwright/introduction', // this was empty
  '/technologies/test-tools/playwright/api':
    '/docs/technologies/test-tools/playwright',
  '/technologies/test-tools/storybook/recipes':
    '/docs/technologies/test-tools/storybook/guides',
  '/technologies/test-tools/storybook/recipes/best-practices':
    '/docs/technologies/test-tools/storybook/guides/best-practices',
  '/technologies/test-tools/storybook/recipes/storybook-9-setup':
    '/docs/technologies/test-tools/storybook/guides/storybook-9-setup',
  '/technologies/test-tools/storybook/recipes/overview-react':
    '/docs/technologies/test-tools/storybook/guides/overview-react',
  '/technologies/test-tools/storybook/recipes/overview-angular':
    '/docs/technologies/test-tools/storybook/guides/overview-angular',
  '/technologies/test-tools/storybook/recipes/overview-vue':
    '/docs/technologies/test-tools/storybook/guides/overview-vue',
  '/technologies/test-tools/storybook/recipes/configuring-storybook':
    '/docs/technologies/test-tools/storybook/guides/configuring-storybook',
  '/technologies/test-tools/storybook/recipes/one-storybook-for-all':
    '/docs/technologies/test-tools/storybook/guides/one-storybook-for-all',
  '/technologies/test-tools/storybook/recipes/one-storybook-per-scope':
    '/docs/technologies/test-tools/storybook/guides/one-storybook-per-scope',
  '/technologies/test-tools/storybook/recipes/one-storybook-with-composition':
    '/docs/technologies/test-tools/storybook/guides/one-storybook-with-composition',
  '/technologies/test-tools/storybook/recipes/custom-builder-configs':
    '/docs/technologies/test-tools/storybook/guides/custom-builder-configs',
  '/technologies/test-tools/storybook/recipes/storybook-interaction-tests':
    '/docs/technologies/test-tools/storybook/guides/storybook-interaction-tests',
  '/technologies/test-tools/storybook/recipes/upgrading-storybook':
    '/docs/technologies/test-tools/storybook/guides/upgrading-storybook',
  '/technologies/test-tools/storybook/recipes/storybook-composition-setup':
    '/docs/technologies/test-tools/storybook/guides/storybook-composition-setup',
  '/technologies/test-tools/storybook/recipes/angular-storybook-compodoc':
    '/docs/technologies/test-tools/storybook/guides/angular-storybook-compodoc',
  '/technologies/test-tools/storybook/recipes/angular-configuring-styles':
    '/docs/technologies/test-tools/storybook/guides/angular-configuring-styles',
  '/technologies/test-tools/storybook/api':
    '/docs/technologies/test-tools/storybook/guides/angular-configuring-styles',
  '/technologies/test-tools/detox/recipes':
    '/docs/technologies/test-tools/detox/introduction',
  '/technologies/test-tools/detox/api': '/docs/technologies/test-tools/detox',
  '/technologies/test-tools/cypress/api/executors':
    '/docs/technologies/test-tools/cypress/executors',
  '/technologies/test-tools/cypress/api/executors/cypress':
    '/docs/technologies/test-tools/cypress/executors',
  '/technologies/test-tools/cypress/api/generators':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/generators/init':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/generators/configuration':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/generators/component-configuration':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/generators/migrate-to-cypress-11':
    '/docs/technologies/test-tools/cypress/generators',
  '/technologies/test-tools/cypress/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/cypress/api/migrations':
    '/docs/technologies/test-tools/cypress/migrations',
  '/technologies/test-tools/detox/api/executors':
    '/docs/technologies/test-tools/detox/executors',
  '/technologies/test-tools/detox/api/executors/build':
    '/docs/technologies/test-tools/detox/executors',
  '/technologies/test-tools/detox/api/executors/test':
    '/docs/technologies/test-tools/detox/executors',
  '/technologies/test-tools/detox/api/generators':
    '/docs/technologies/test-tools/detox/generators',
  '/technologies/test-tools/detox/api/generators/init':
    '/docs/technologies/test-tools/detox/generators',
  '/technologies/test-tools/detox/api/generators/application':
    '/docs/technologies/test-tools/detox/generators',
  '/technologies/test-tools/detox/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/detox/api/migrations':
    '/docs/technologies/test-tools/detox/migrations',
  '/technologies/build-tools/esbuild/api/executors':
    '/docs/technologies/build-tools/esbuild/executors',
  '/technologies/build-tools/esbuild/api/executors/esbuild':
    '/docs/technologies/build-tools/esbuild/executors',
  '/technologies/build-tools/esbuild/api/generators':
    '/docs/technologies/build-tools/esbuild/generators',
  '/technologies/build-tools/esbuild/api/generators/init':
    '/docs/technologies/build-tools/esbuild/generators',
  '/technologies/build-tools/esbuild/api/generators/configuration':
    '/docs/technologies/build-tools/esbuild/generators',
  '/technologies/build-tools/esbuild/api/migrations':
    '/docs/technologies/build-tools/esbuild', // this was empty
  '/technologies/eslint/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/eslint/eslint-plugin/api/executors':
    '/docs/technologies/eslint/eslint-plugin', // this was empty
  '/technologies/eslint/eslint-plugin/api/generators':
    '/docs/technologies/eslint/eslint-plugin', // this was empty
  '/technologies/eslint/eslint-plugin/api/migrations':
    '/docs/technologies/eslint/eslint-plugin/migrations',
  '/technologies/react/expo/api/executors':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/update':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/build':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/build-list':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/run':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/start':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/sync-deps':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/ensure-symlink':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/prebuild':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/install':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/export':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/submit':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/executors/serve':
    '/docs/technologies/react/expo/executors',
  '/technologies/react/expo/api/generators':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/generators/init':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/generators/application':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/generators/library':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/generators/component':
    '/docs/technologies/react/expo/generators',
  '/technologies/react/expo/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/expo/api/migrations':
    '/docs/technologies/react/expo/migrations',
  '/technologies/node/express/api/executors': '/docs/technologies/node/express', // this was empty
  '/technologies/node/express/api/generators':
    '/docs/technologies/node/express/generators',
  '/technologies/node/express/api/generators/init':
    '/docs/technologies/node/express/generators',
  '/technologies/node/express/api/generators/application':
    '/docs/technologies/node/express/generators',
  '/technologies/node/express/api/migrations':
    '/docs/technologies/node/express', // this was empty
  '/technologies/java/api/executors/gradle':
    '/docs/technologies/java/executors',
  '/technologies/test-tools/jest/api/executors':
    '/docs/technologies/test-tools/jest/executors',
  '/technologies/test-tools/jest/api/executors/jest':
    '/docs/technologies/test-tools/jest/executors',
  '/technologies/test-tools/jest/api/generators':
    '/docs/technologies/test-tools/jest/generators',
  '/technologies/test-tools/jest/api/generators/init':
    '/docs/technologies/test-tools/jest/generators',
  '/technologies/test-tools/jest/api/generators/configuration':
    '/docs/technologies/test-tools/jest/generators',
  '/technologies/test-tools/jest/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/jest/api/migrations':
    '/docs/technologies/test-tools/jest/migrations',
  '/technologies/typescript/api/executors/node':
    '/docs/technologies/typescript/executors',
  '/technologies/node/nest/api/executors': '/docs/technologies/node/nest', // this was empty
  '/technologies/node/nest/api/generators':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/application':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/init':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/library':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/class':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/controller':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/decorator':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/filter':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/gateway':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/guard':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/interceptor':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/interface':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/middleware':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/module':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/pipe':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/provider':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/resolver':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/resource':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/generators/service':
    '/docs/technologies/node/nest/generators',
  '/technologies/node/nest/api/migrations':
    '/docs/technologies/node/nest/migrations',
  '/technologies/react/next/api/executors':
    '/docs/technologies/react/next/executors',
  '/technologies/react/next/api/executors/build':
    '/docs/technologies/react/next/executors',
  '/technologies/react/next/api/executors/server':
    '/docs/technologies/react/next/executors',
  '/technologies/react/next/api/generators':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/init':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/application':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/page':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/component':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/library':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/custom-server':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/cypress-component-configuration':
    '/docs/technologies/react/next/generators',
  '/technologies/react/next/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/next/api/migrations':
    '/docs/technologies/react/next/migrations',
  '/technologies/vue/nuxt/api/executors': '/docs/technologies/vue/nuxt', // this was empty
  '/technologies/vue/nuxt/api/generators':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/vue/nuxt/api/generators/init':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/vue/nuxt/api/generators/application':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/vue/nuxt/api/generators/storybook-configuration':
    '/docs/technologies/vue/nuxt/generators',
  '/technologies/vue/nuxt/api/migrations':
    '/docs/technologies/vue/nuxt/migrations',
  '/technologies/test-tools/playwright/api/executors':
    '/docs/technologies/test-tools/playwright/executors',
  '/technologies/test-tools/playwright/api/executors/playwright':
    '/docs/technologies/test-tools/playwright/executors',
  '/technologies/test-tools/playwright/api/generators':
    '/docs/technologies/test-tools/playwright/generators',
  '/technologies/test-tools/playwright/api/generators/configuration':
    '/docs/technologies/test-tools/playwright/generators',
  '/technologies/test-tools/playwright/api/generators/init':
    '/docs/technologies/test-tools/playwright/generators',
  '/technologies/test-tools/playwright/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/playwright/api/migrations':
    '/docs/technologies/test-tools/playwright/migrations',
  '/technologies/react/react-native/api/executors':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/run-android':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/run-ios':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/bundle':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/build-android':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/build-ios':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/start':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/sync-deps':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/ensure-symlink':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/storybook':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/pod-install':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/executors/upgrade':
    '/docs/technologies/react/react-native/executors',
  '/technologies/react/react-native/api/generators':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/init':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/application':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/library':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/component':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/web-configuration':
    '/docs/technologies/react/react-native/generators',
  '/technologies/react/react-native/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/react-native/api/migrations':
    '/docs/technologies/react/react-native/migrations',
  '/technologies/react/remix/api/executors':
    '/docs/technologies/react/remix/executors',
  '/technologies/react/remix/api/executors/serve':
    '/docs/technologies/react/remix/executors',
  '/technologies/react/remix/api/executors/build':
    '/docs/technologies/react/remix/executors',
  '/technologies/react/remix/api/generators':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/preset':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/setup':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/application':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/cypress-component-configuration':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/library':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/init':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/route':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/resource-route':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/action':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/loader':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/style':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/setup-tailwind':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/storybook-configuration':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/meta':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/error-boundary':
    '/docs/technologies/react/remix/generators',
  '/technologies/react/remix/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/react/remix/api/migrations':
    '/docs/technologies/react/remix/migrations',
  '/technologies/build-tools/rollup/api/executors':
    '/docs/technologies/build-tools/rollup/executors',
  '/technologies/build-tools/rollup/api/executors/rollup':
    '/docs/technologies/build-tools/rollup/executors',
  '/technologies/build-tools/rollup/api/generators':
    '/docs/technologies/build-tools/rollup/generators',
  '/technologies/build-tools/rollup/api/generators/init':
    '/docs/technologies/build-tools/rollup/generators',
  '/technologies/build-tools/rollup/api/generators/configuration':
    '/docs/technologies/build-tools/rollup/generators',
  '/technologies/build-tools/rollup/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/rollup/api/migrations':
    '/docs/technologies/build-tools/rollup/migrations',
  '/technologies/build-tools/rsbuild/api/executors':
    '/docs/technologies/build-tools/rsbuild', // this was empty
  '/technologies/build-tools/rsbuild/api/generators':
    '/docs/technologies/build-tools/rsbuild/generators',
  '/technologies/build-tools/rsbuild/api/generators/init':
    '/docs/technologies/build-tools/rsbuild/generators',
  '/technologies/build-tools/rsbuild/api/generators/configuration':
    '/docs/technologies/build-tools/rsbuild/generators',
  '/technologies/build-tools/rsbuild/api/migrations':
    '/docs/technologies/build-tools/rsbuild', // this was empty
  '/technologies/build-tools/rspack/api/executors':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/rspack':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/dev-server':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/ssr-dev-server':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/module-federation-dev-server':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/module-federation-ssr-dev-server':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/executors/module-federation-static-server':
    '/docs/technologies/build-tools/rspack/executors',
  '/technologies/build-tools/rspack/api/generators':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/configuration':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/init':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/preset':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/application':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/convert-webpack':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/convert-config-to-rspack-plugin':
    '/docs/technologies/build-tools/rspack/generators',
  '/technologies/build-tools/rspack/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/rspack/api/migrations':
    '/docs/technologies/build-tools/rspack/migrations',
  '/technologies/test-tools/storybook/api/executors':
    '/docs/technologies/test-tools/storybook/executors',
  '/technologies/test-tools/storybook/api/executors/storybook':
    '/docs/technologies/test-tools/storybook/executors',
  '/technologies/test-tools/storybook/api/executors/build':
    '/docs/technologies/test-tools/storybook/executors',
  '/technologies/test-tools/storybook/api/generators':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/generators/init':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/generators/configuration':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/test-tools/storybook/api/generators/migrate-8':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/generators/migrate-9':
    '/docs/technologies/test-tools/storybook/generators',
  '/technologies/test-tools/storybook/api/migrations':
    '/docs/technologies/test-tools/storybook/migrations',
  '/technologies/build-tools/vite/api/executors':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/executors/dev-server':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/executors/build':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/executors/test':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/executors/preview-server':
    '/docs/technologies/build-tools/vite/executors',
  '/technologies/build-tools/vite/api/generators':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/generators/init':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/generators/configuration':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/generators/setup-paths-plugin':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
  '/technologies/build-tools/vite/api/generators/vitest':
    '/docs/technologies/build-tools/vite/generators',
  '/technologies/build-tools/vite/api/migrations':
    '/docs/technologies/build-tools/vite/migrations',
  '/technologies/build-tools/webpack/api/executors':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/build-tools/webpack/api/executors/webpack':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/build-tools/webpack/api/executors/dev-server':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/build-tools/webpack/api/executors/ssr-dev-server':
    '/docs/technologies/build-tools/webpack/executors',
  '/technologies/build-tools/webpack/api/generators':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/build-tools/webpack/api/generators/init':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/build-tools/webpack/api/generators/configuration':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/build-tools/webpack/api/generators/convert-config-to-webpack-plugin':
    '/docs/technologies/build-tools/webpack/generators',
  '/technologies/build-tools/webpack/api/generators/convert-to-inferred':
    '/docs/guides/tasks--caching/convert-to-inferred',
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
  '/technologies/angular/api/executors/delegate-build':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/ng-packagr-lite':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/package':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/browser-esbuild':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/module-federation-dev-server':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/module-federation-dev-ssr':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/application':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/extract-i18n':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/webpack-browser':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/dev-server':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/executors/webpack-server':
    '/docs/technologies/angular/executors',
  '/technologies/angular/api/generators':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/add-linting':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/application':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/component':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/component-story':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/component-test':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/convert-to-application-executor':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/convert-to-rspack':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/directive':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/federate-module':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/init':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/library':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/library-secondary-entry-point':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/remote':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/move':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/convert-to-with-mf':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/host':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/ng-add':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/ngrx':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/ngrx-feature-store':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/ngrx-root-store':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/pipe':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/scam-to-standalone':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/scam':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/scam-directive':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/scam-pipe':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/setup-mf':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/setup-ssr':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/setup-tailwind':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/stories':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/storybook-configuration':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/cypress-component-configuration':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/generators/web-worker':
    '/docs/technologies/angular/generators',
  '/technologies/angular/api/migrations':
    '/docs/technologies/angular/migrations',
  '/technologies/eslint/api/executors': '/docs/technologies/eslint/executors',
  '/technologies/eslint/api/executors/lint':
    '/docs/technologies/eslint/executors',
  '/technologies/eslint/api/generators': '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/generators/init':
    '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/generators/workspace-rules-project':
    '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/generators/workspace-rule':
    '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/generators/convert-to-flat-config':
    '/docs/technologies/eslint/generators',
  '/technologies/eslint/api/migrations': '/docs/technologies/eslint/migrations',
  '/technologies/java/api/executors': '/docs/technologies/java/executors',
  '/technologies/java/api/generators': '/docs/technologies/java/generators',
  '/technologies/java/api/generators/init':
    '/docs/technologies/java/generators',
  '/technologies/java/api/generators/ci-workflow':
    '/docs/technologies/java/generators',
  '/technologies/java/api/migrations': '/docs/technologies/java/migrations',
  '/technologies/typescript/api/executors':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/copy-workspace-modules':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/tsc':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/swc':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/prune-lockfile':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/release-publish':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/executors/verdaccio':
    '/docs/technologies/typescript/executors',
  '/technologies/typescript/api/generators':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/library':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/init':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/convert-to-swc':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/release-version':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/setup-verdaccio':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/setup-build':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/typescript-sync':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/generators/setup-prettier':
    '/docs/technologies/typescript/generators',
  '/technologies/typescript/api/migrations':
    '/docs/technologies/typescript/migrations',
  '/technologies/module-federation/api/executors':
    '/docs/technologies/module-federation', // this was empty
  '/technologies/module-federation/api/generators':
    '/docs/technologies/module-federation', // this was empty
  '/technologies/module-federation/api/migrations':
    '/docs/technologies/module-federation/migrations',
  '/technologies/node/api/executors': '/docs/technologies/node',
  '/technologies/node/api/generators': '/docs/technologies/node/generators',
  '/technologies/node/api/generators/init':
    '/docs/technologies/node/generators',
  '/technologies/node/api/generators/application':
    '/docs/technologies/node/generators',
  '/technologies/node/api/generators/library':
    '/docs/technologies/node/generators',
  '/technologies/node/api/generators/setup-docker':
    '/docs/technologies/node/generators',
  '/technologies/node/api/migrations': '/docs/technologies/node/migrations',
  '/technologies/react/api/executors': '/docs/technologies/react/executors',
  '/technologies/react/api/executors/module-federation-dev-server':
    '/docs/technologies/react/executors',
  '/technologies/react/api/executors/module-federation-ssr-dev-server':
    '/docs/technologies/react/executors',
  '/technologies/react/api/executors/module-federation-static-server':
    '/docs/technologies/react/executors',
  '/technologies/react/api/generators': '/docs/technologies/react/generators',
  '/technologies/react/api/generators/init':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/application':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/library':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/component':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/redux':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/storybook-configuration':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/component-story':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/stories':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/hook':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/host':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/remote':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/cypress-component-configuration':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/component-test':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/setup-tailwind':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/setup-ssr':
    '/docs/technologies/react/generators',
  '/technologies/react/api/generators/federate-module':
    '/docs/technologies/react/generators',
  '/technologies/react/api/migrations': '/docs/technologies/react/migrations',
  '/technologies/vue/api/executors': '/docs/technologies/vue',
  '/technologies/vue/api/generators': '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/init': '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/application':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/library':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/component':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/setup-tailwind':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/storybook-configuration':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/generators/stories':
    '/docs/technologies/vue/generators',
  '/technologies/vue/api/migrations': '/docs/technologies/vue/migrations',

  // ========== TROUBLESHOOTING ==========
  '/troubleshooting': '/docs/troubleshooting',
  '/troubleshooting/resolve-circular-dependencies':
    '/docs/troubleshooting/resolve-circular-dependencies',
  '/troubleshooting/troubleshoot-nx-install-issues':
    '/docs/troubleshooting/troubleshoot-nx-install-issues',
  '/troubleshooting/troubleshoot-cache-misses':
    '/docs/troubleshooting/troubleshoot-cache-misses',
  '/troubleshooting/unknown-local-cache':
    '/docs/troubleshooting/unknown-local-cache',
  '/troubleshooting/performance-profiling':
    '/docs/troubleshooting/performance-profiling',
  '/troubleshooting/convert-to-inferred':
    '/docs/troubleshooting/troubleshoot-convert-to-inferred',

  // ================= CI ================
  '/ci': '/docs/getting-started/nx-cloud',
  '/ci/recipes': '/docs/guides/nx-cloud',
  '/ci/recipes/improving-ttg': '/docs/guides/nx-cloud/optimize-your-ttg',
  '/ci/recipes/set-up': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/monorepo-ci-azure': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/monorepo-ci-circle-ci': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/monorepo-ci-jenkins': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/monorepo-ci-gitlab': '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines':
    '/docs/guides/nx-cloud/setup-ci',
  '/ci/recipes/security': '/docs/guides/nx-cloud', // this was just a listing page
  '/ci/recipes/dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/github-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/circle-ci-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/azure-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/bitbucket-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/gitlab-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/dte/jenkins-dte': '/docs/guides/nx-cloud/manual-dte',
  '/ci/recipes/other': '/docs/guides/nx-cloud/setup-ci',

  // ============= SEE-ALSO =============
  '/see-also': '/docs/getting-started/intro', //  missing (but it wasn't really used i.e. ~0.01% of all traffic)
  '/see-also/sitemap': '/docs/getting-started/intro', // missing (but it wasn't really used i.e. ~0.01% of all traffic)

  // ============= SHOWCASE =============
  // We removed these outdated showcase pages, but some have moved to reference (e.g. benchmarks)
  '/showcase': '/docs/getting-started/intro',
  '/showcase/example-repos': '/docs/getting-started/intro',
  '/showcase/example-repos/add-express': '/docs/getting-started/intro',
  '/showcase/example-repos/add-lit': '/docs/getting-started/intro',
  '/showcase/example-repos/add-solid': '/docs/getting-started/intro',
  '/showcase/example-repos/add-qwik': '/docs/getting-started/intro',
  '/showcase/example-repos/add-rust': '/docs/getting-started/intro',
  '/showcase/example-repos/add-dotnet': '/docs/getting-started/intro',
  '/showcase/example-repos/add-astro': '/docs/getting-started/intro',
  '/showcase/example-repos/add-svelte': '/docs/getting-started/intro',
  '/showcase/example-repos/add-fastify': '/docs/getting-started/intro',
  '/showcase/example-repos/apollo-react': '/docs/getting-started/intro',
  '/showcase/example-repos/nestjs-prisma': '/docs/getting-started/intro',
  '/showcase/example-repos/mongo-fastify': '/docs/getting-started/intro',
  '/showcase/example-repos/redis-fastify': '/docs/getting-started/intro',
  '/showcase/example-repos/postgres-fastify': '/docs/getting-started/intro',
  '/showcase/example-repos/serverless-fastify-planetscale':
    '/docs/getting-started/intro',
  '/showcase/example-repos/mfe': '/docs/getting-started/intro',

  // ============ DEPRECATED ============
  // "/deprecated": "/docs/deprecated",
  // "/deprecated/affected-graph": "/docs/deprecated/affected-graph",
  // "/deprecated/print-affected": "/docs/deprecated/print-affected",
  // "/deprecated/workspace-json": "/docs/deprecated/workspace-json",
  // "/deprecated/as-provided-vs-derived": "/docs/deprecated/as-provided-vs-derived",
  // "/deprecated/workspace-generators": "/docs/deprecated/workspace-generators",
  // "/deprecated/legacy-cache": "/docs/deprecated/legacy-cache",
  // "/deprecated/custom-tasks-runner": "/docs/deprecated/custom-tasks-runner",
  // "/deprecated/workspace-executors": "/docs/deprecated/workspace-executors",
  // "/deprecated/runtime-cache-inputs": "/docs/deprecated/runtime-cache-inputs",
  // "/deprecated/cacheable-operations": "/docs/deprecated/cacheable-operations",
  // "/deprecated/npm-scope": "/docs/deprecated/npm-scope",
  // "/deprecated/global-implicit-dependencies": "/docs/deprecated/global-implicit-dependencies",
  // "/deprecated/angular-schematics-builders": "/docs/deprecated/angular-schematics-builders",
  // "/deprecated/v1-nx-plugin-api": "/docs/deprecated/v1-nx-plugin-api",
  // "/deprecated/rescope": "/docs/deprecated/rescope",
  // "/deprecated/integrated-vs-package-based": "/docs/deprecated/integrated-vs-package-based",
};

module.exports = docsToAstroRedirects;
