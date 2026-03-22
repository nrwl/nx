import type { StarlightUserConfig } from '@astrojs/starlight/types';
import {
  getTechnologyKBItems,
  getTechnologyAPIItems,
} from './src/plugins/utils/plugin-mappings';
import { resolveNxDevUrl } from './src/utils/resolve-nx-dev-url';

type SidebarItems = NonNullable<StarlightUserConfig['sidebar']>;

/**
 * Tab configuration for the sidebar. Each tab directly owns its sidebar groups,
 * making the tab ↔ content relationship explicit and impossible to drift.
 */
export interface SidebarTab {
  id: string;
  label: string;
  icon?: string;
  groups: SidebarItems;
}

const learnGroups: SidebarItems = [
  {
    label: 'Getting started',
    collapsed: false,
    items: [
      { label: 'Intro to Nx', link: 'getting-started/intro' },
      { label: 'Installation', link: 'getting-started/installation' },
      {
        label: 'Start a new project',
        link: 'getting-started/start-new-project',
      },
      {
        label: 'Add to existing project',
        link: 'getting-started/start-with-existing-project',
      },
      { label: 'AI integrations', link: 'getting-started/ai-setup' },
      { label: 'Editor setup', link: 'getting-started/editor-setup' },
      {
        label: 'Tutorials',
        collapsed: false,
        items: [
          {
            label: 'React monorepo',
            link: 'getting-started/tutorials/react-monorepo-tutorial',
          },
          {
            label: 'Angular monorepo',
            link: 'getting-started/tutorials/angular-monorepo-tutorial',
          },
          {
            label: 'TypeScript monorepo',
            link: 'getting-started/tutorials/typescript-packages-tutorial',
          },
          {
            label: 'Gradle monorepo',
            link: 'getting-started/tutorials/gradle-tutorial',
          },
          {
            label: 'Setting up CI',
            link: 'getting-started/tutorials/self-healing-ci-tutorial',
          },
        ],
      },
    ],
  },

  {
    label: 'How Nx works',
    collapsed: false,
    items: [
      { label: 'Mental model', link: 'concepts/mental-model' },
      { label: 'How caching works', link: 'concepts/how-caching-works' },
      {
        label: 'Task pipeline configuration',
        link: 'concepts/task-pipeline-configuration',
      },
      {
        label: 'Types of configuration',
        link: 'concepts/types-of-configuration',
      },
      {
        label: 'Executors and configurations',
        link: 'concepts/executors-and-configurations',
      },
      { label: 'Nx plugins', link: 'concepts/nx-plugins' },
      { label: 'Inferred tasks', link: 'concepts/inferred-tasks' },
      {
        label: 'Building blocks of fast CI',
        link: 'concepts/ci-concepts/building-blocks-fast-ci',
      },
      {
        label: 'Parallelization and distribution',
        link: 'concepts/ci-concepts/parallelization-distribution',
      },
      { label: 'Nx Daemon', link: 'concepts/nx-daemon' },
      {
        label: 'Synthetic monorepos',
        link: 'concepts/synthetic-monorepos',
      },
    ],
  },
  {
    label: 'Platform features',
    collapsed: false,
    items: [
      { label: 'Run tasks', link: 'features/run-tasks' },
      {
        label: 'Cache task results',
        link: 'features/cache-task-results',
      },
      { label: 'Enhance your LLM', link: 'features/enhance-ai' },
      {
        label: 'Code organization',
        collapsed: true,
        items: [
          { label: 'Explore graph', link: 'features/explore-graph' },
          { label: 'Generate code', link: 'features/generate-code' },
          { label: 'Sync generators', link: 'concepts/sync-generators' },
          {
            label: 'Enforce module boundaries',
            collapsed: true,
            items: [
              {
                label: 'Overview',
                link: 'features/enforce-module-boundaries',
              },
              {
                label: 'Ban dependencies with tags',
                link: 'guides/enforce-module-boundaries/ban-dependencies-with-tags',
              },
              {
                label: 'Ban external imports',
                link: 'guides/enforce-module-boundaries/ban-external-imports',
              },
              {
                label: 'Tag multiple dimensions',
                link: 'guides/enforce-module-boundaries/tag-multiple-dimensions',
              },
              {
                label: 'Tags allow list',
                link: 'guides/enforce-module-boundaries/tags-allow-list',
              },
            ],
          },
        ],
      },
      {
        label: 'Orchestration & CI',
        collapsed: true,
        items: [
          {
            label: 'Overview',
            link: 'features/ci-features',
          },
          { label: 'Affected', link: 'features/ci-features/affected' },
          {
            label: 'Remote cache (Nx Replay)',
            link: 'features/ci-features/remote-cache',
          },
          {
            label: 'Self-healing CI',
            link: 'features/ci-features/self-healing-ci',
          },
          { label: 'Flaky tasks', link: 'features/ci-features/flaky-tasks' },
          {
            label: 'Distribute task execution (Nx Agents)',
            link: 'features/ci-features/distribute-task-execution',
          },
          {
            label: 'Split E2E tasks',
            link: 'features/ci-features/split-e2e-tasks',
          },
          {
            label: 'Dynamically allocate agents',
            link: 'features/ci-features/dynamic-agents',
          },
          {
            label: 'CI resource usage',
            link: 'guides/nx-cloud/ci-resource-usage',
          },
          {
            label: 'Optimize your TTG',
            link: 'guides/nx-cloud/optimize-your-ttg',
          },
          {
            label: 'Record commands',
            link: 'guides/nx-cloud/record-commands',
          },
          {
            label: 'GitHub integration',
            link: 'features/ci-features/github-integration',
          },
          {
            label: 'Sandboxing',
            link: 'features/ci-features/sandboxing',
            badge: 'New',
          },
          {
            label: 'CIPE affected project graph',
            link: 'guides/nx-cloud/cipe-affected-project-graph',
          },
          { label: 'Encryption', link: 'guides/nx-cloud/encryption' },
          { label: 'Google auth', link: 'guides/nx-cloud/google-auth' },
        ],
      },
      {
        label: 'Release & publishing',
        collapsed: true,
        items: [
          { label: 'Nx Release overview', link: 'features/manage-releases' },
          {
            label: 'Publish in CI/CD',
            link: 'guides/nx-release/publish-in-ci-cd',
          },
          {
            label: 'Automatic versioning with conventional commits',
            link: 'guides/nx-release/automatically-version-with-conventional-commits',
          },
          {
            label: 'Customize conventional commit types',
            link: 'guides/nx-release/customize-conventional-commit-types',
          },
          {
            label: 'Configure changelog format',
            link: 'guides/nx-release/configure-changelog-format',
          },
          {
            label: 'Configure custom registries',
            link: 'guides/nx-release/configure-custom-registries',
          },
          {
            label: 'Configure version prefix',
            link: 'guides/nx-release/configuration-version-prefix',
          },
          {
            label: 'File-based versioning (version plans)',
            link: 'guides/nx-release/file-based-versioning-version-plans',
          },
          {
            label: 'Release groups',
            link: 'guides/nx-release/release-groups',
          },
          {
            label: 'Release projects independently',
            link: 'guides/nx-release/release-projects-independently',
          },
          {
            label: 'Build before versioning',
            link: 'guides/nx-release/build-before-versioning',
          },
          {
            label: 'Update dependents',
            link: 'guides/nx-release/update-dependents',
          },
          {
            label: 'Updating version references',
            link: 'guides/nx-release/updating-version-references',
          },
          {
            label: 'Update local registry setup',
            link: 'guides/nx-release/update-local-registry-setup',
          },
          {
            label: 'Programmatic API',
            link: 'guides/nx-release/programmatic-api',
          },
        ],
      },
      {
        label: 'Maintenance',
        collapsed: true,
        items: [
          {
            label: 'Nx Console migration assistance',
            link: 'guides/nx-console/console-migrate-ui',
          },
          {
            label: 'Advanced update process',
            link: 'guides/tips-n-tricks/advanced-update',
          },
          {
            label: 'Automate importing projects',
            link: 'guides/adopting-nx/import-project',
          },
          {
            label: 'Manual migrations',
            link: 'guides/adopting-nx/manual',
          },
          {
            label: 'Preserving Git histories',
            link: 'guides/adopting-nx/preserving-git-histories',
          },
          {
            label: 'Nx vs Turborepo',
            link: 'guides/adopting-nx/nx-vs-turborepo',
          },
          {
            label: 'Migrating from Turborepo',
            link: 'guides/adopting-nx/from-turborepo',
          },
        ],
      },
      {
        label: 'Enterprise',
        collapsed: true,
        items: [
          { label: 'Conformance', link: 'enterprise/conformance' },
          {
            label: 'Configure conformance rules in Nx Cloud',
            link: 'enterprise/configure-conformance-rules-in-nx-cloud',
          },
          {
            label: 'Publish conformance rules to Nx Cloud',
            link: 'enterprise/publish-conformance-rules-to-nx-cloud',
          },
          { label: 'Owners', link: 'enterprise/owners' },
          { label: 'Polygraph', link: 'enterprise/polygraph' },
          { label: 'Custom workflows', link: 'enterprise/custom-workflows' },
          {
            label: 'Metadata only workspace',
            link: 'enterprise/metadata-only-workspace',
          },
          { label: 'Activate license', link: 'enterprise/activate-license' },
          {
            label: 'Single tenant',
            collapsed: true,
            items: [
              {
                label: 'Overview',
                link: 'enterprise/single-tenant/overview',
              },
              {
                label: 'Auth GitHub',
                link: 'enterprise/single-tenant/auth-github',
              },
              {
                label: 'Auth GitLab',
                link: 'enterprise/single-tenant/auth-gitlab',
              },
              {
                label: 'Auth Bitbucket',
                link: 'enterprise/single-tenant/auth-bitbucket',
              },
              {
                label: 'Auth Bitbucket Data Center',
                link: 'enterprise/single-tenant/auth-bitbucket-data-center',
              },
              {
                label: 'Custom GitHub app',
                link: 'enterprise/single-tenant/custom-github-app',
              },
              {
                label: 'Okta SAML',
                link: 'enterprise/single-tenant/okta-saml',
              },
              {
                label: 'Azure SAML',
                link: 'enterprise/single-tenant/azure-saml',
              },
            ],
          },
          {
            label: 'Conformance reference',
            collapsed: true,
            items: [
              {
                label: 'Overview',
                link: 'reference/conformance/overview',
              },
              {
                label: 'Create conformance rule',
                link: 'reference/conformance/create-conformance-rule',
              },
              {
                label: 'Test conformance rule',
                link: 'reference/conformance/test-conformance-rule',
              },
              {
                label: 'Generators',
                link: 'reference/conformance/generators',
              },
              {
                label: 'Executors',
                link: 'reference/conformance/executors',
              },
            ],
          },
          {
            label: 'Enterprise release notes',
            link: 'reference/nx-cloud/release-notes',
          },
        ],
      },
    ],
  },
];

const technologiesGroups: SidebarItems = [
  {
    label: 'Technologies & tools',
    collapsed: true,
    items: [
      {
        label: 'Frameworks & libraries',
        collapsed: false,
        items: [
          {
            label: 'TypeScript',
            link: 'technologies/typescript/introduction',
          },
          { label: 'Angular', link: 'technologies/angular/introduction' },
          {
            label: 'Angular Rspack',
            link: 'technologies/angular/angular-rspack/introduction',
          },
          {
            label: 'Angular Rsbuild',
            link: 'technologies/angular/angular-rsbuild/introduction',
          },
          { label: 'React', link: 'technologies/react/introduction' },
          {
            label: 'Next.js',
            link: 'technologies/react/next/introduction',
          },
          {
            label: 'Remix',
            link: 'technologies/react/remix/introduction',
          },
          {
            label: 'React Native',
            link: 'technologies/react/react-native/introduction',
          },
          { label: 'Expo', link: 'technologies/react/expo/introduction' },
          { label: 'Vue', link: 'technologies/vue/introduction' },
          { label: 'Nuxt', link: 'technologies/vue/nuxt/introduction' },
          { label: 'Node.js', link: 'technologies/node/introduction' },
          {
            label: 'Express',
            link: 'technologies/node/express/introduction',
          },
          { label: 'Nest', link: 'technologies/node/nest/introduction' },
          { label: 'Java', link: 'technologies/java/introduction' },
          {
            label: 'Gradle',
            link: 'technologies/java/gradle/introduction',
          },
          {
            label: 'Maven',
            link: 'technologies/java/maven/introduction',
          },
          { label: '.NET', link: 'technologies/dotnet/introduction' },
          {
            label: 'Module Federation',
            link: 'technologies/module-federation/introduction',
          },
          { label: 'ESLint', link: 'technologies/eslint/introduction' },
        ],
      },
      {
        label: 'Build tools',
        collapsed: false,
        items: [
          {
            label: 'Webpack',
            link: 'technologies/build-tools/webpack/introduction',
          },
          {
            label: 'Vite',
            link: 'technologies/build-tools/vite/introduction',
          },
          {
            label: 'Rollup',
            link: 'technologies/build-tools/rollup/introduction',
          },
          {
            label: 'ESBuild',
            link: 'technologies/build-tools/esbuild/introduction',
          },
          {
            label: 'Rspack',
            link: 'technologies/build-tools/rspack/introduction',
          },
          {
            label: 'Rsbuild',
            link: 'technologies/build-tools/rsbuild/introduction',
          },
        ],
      },
      {
        label: 'Test tools',
        collapsed: false,
        items: [
          {
            label: 'Cypress',
            link: 'technologies/test-tools/cypress/introduction',
          },
          {
            label: 'Vitest',
            link: 'technologies/test-tools/vitest/introduction',
          },
          {
            label: 'Jest',
            link: 'technologies/test-tools/jest/introduction',
          },
          {
            label: 'Playwright',
            link: 'technologies/test-tools/playwright/introduction',
          },
          {
            label: 'Storybook',
            link: 'technologies/test-tools/storybook/introduction',
          },
          {
            label: 'Detox',
            link: 'technologies/test-tools/detox/introduction',
          },
        ],
      },
      {
        label: 'Plugin registry',
        link: 'plugin-registry',
      },
    ],
  },
];

const knowledgeBaseGroups: SidebarItems = [
  {
    label: 'Knowledge base',
    collapsed: true,
    items: [
      {
        label: 'Troubleshooting',
        collapsed: true,
        items: [
          {
            label: 'CI execution failed',
            link: 'troubleshooting/ci-execution-failed',
          },
          {
            label: 'Unknown local cache error',
            link: 'troubleshooting/unknown-local-cache',
          },
          {
            label: 'Troubleshoot convert to inferred',
            link: 'troubleshooting/troubleshoot-convert-to-inferred',
          },
          {
            label: 'Profiling performance',
            link: 'troubleshooting/performance-profiling',
          },
          {
            label: 'Troubleshoot Nx Console issues',
            link: 'troubleshooting/console-troubleshooting',
          },
          {
            label: 'Troubleshoot cache misses',
            link: 'troubleshooting/troubleshoot-cache-misses',
          },
          {
            label: 'Troubleshoot Nx installations',
            link: 'troubleshooting/troubleshoot-nx-install-issues',
          },
          {
            label: 'Resolve circular dependencies',
            link: 'troubleshooting/resolve-circular-dependencies',
          },
        ],
      },
      {
        label: 'Recipes',
        collapsed: true,
        items: [
          {
            label: 'Include all package.json files',
            link: 'guides/tips-n-tricks/include-all-packagejson',
          },
          {
            label: 'Disable graph links from source analysis',
            link: 'guides/tips-n-tricks/analyze-source-files',
          },
          {
            label: 'Using Yarn PnP with Nx',
            link: 'guides/tips-n-tricks/yarn-pnp',
          },
          {
            label: 'Identify dependencies between folders',
            link: 'guides/tips-n-tricks/identify-dependencies-between-folders',
          },
          {
            label: 'Feature-based testing',
            link: 'guides/tips-n-tricks/feature-based-testing',
          },
          {
            label: 'Configuring browser support',
            link: 'guides/tips-n-tricks/browser-support',
          },
          {
            label: 'Define environment variables',
            link: 'guides/tips-n-tricks/define-environment-variables',
          },
          {
            label: 'Including assets in your build',
            link: 'guides/tips-n-tricks/include-assets-in-build',
          },
          {
            label: 'Keep Nx versions in sync',
            link: 'guides/tips-n-tricks/keep-nx-versions-in-sync',
          },
          {
            label: 'Standalone to monorepo',
            link: 'guides/tips-n-tricks/standalone-to-monorepo',
          },
        ],
      },
      {
        label: 'Creating releases',
        collapsed: true,
        items: [
          {
            label: 'Release NPM packages',
            link: 'guides/nx-release/release-npm-packages',
          },
          {
            label: 'Release Rust crates',
            link: 'guides/nx-release/publish-rust-crates',
          },
          {
            label: 'Release Docker images',
            link: 'guides/nx-release/release-docker-images',
          },
          {
            label: 'Automate GitHub releases',
            link: 'guides/nx-release/automate-github-releases',
          },
          {
            label: 'Automate GitLab releases',
            link: 'guides/nx-release/automate-gitlab-releases',
          },
        ],
      },
      {
        label: 'Nx Console',
        collapsed: true,
        items: [
          {
            label: 'Telemetry',
            link: 'guides/nx-console/console-telemetry',
          },
          {
            label: 'Run command',
            link: 'guides/nx-console/console-run-command',
          },
          {
            label: 'Nx Cloud integration',
            link: 'guides/nx-console/console-nx-cloud',
          },
          {
            label: 'Generate command',
            link: 'guides/nx-console/console-generate-command',
          },
          {
            label: 'Project details view',
            link: 'guides/nx-console/console-project-details',
          },
          {
            label: 'Troubleshooting',
            link: 'guides/nx-console/console-troubleshooting',
          },
        ],
      },
      {
        label: 'Installation',
        collapsed: true,
        items: [
          {
            label: 'Install Nx in non-JavaScript repo',
            link: 'guides/installation/install-non-javascript',
          },
          {
            label: 'Update global installation',
            link: 'guides/installation/update-global-installation',
          },
        ],
      },
      {
        label: 'Organizational decisions',
        collapsed: true,
        items: [
          {
            label: 'Why monorepos',
            link: 'concepts/decisions/why-monorepos',
          },
          {
            label: 'Monorepo or polyrepo',
            link: 'concepts/decisions/overview',
          },
          {
            label: 'Dependency management',
            link: 'concepts/decisions/dependency-management',
          },
          {
            label: 'Folder structure',
            link: 'concepts/decisions/folder-structure',
          },
          {
            label: 'Project size',
            link: 'concepts/decisions/project-size',
          },
          {
            label: 'Code ownership',
            link: 'concepts/decisions/code-ownership',
          },
          {
            label: 'Project dependency rules',
            link: 'concepts/decisions/project-dependency-rules',
          },
        ],
      },
      {
        label: 'Extending Nx',
        collapsed: true,
        items: [
          { label: 'Intro', link: 'extending-nx/intro' },
          { label: 'Local generators', link: 'extending-nx/local-generators' },
          {
            label: 'Composing generators',
            link: 'extending-nx/composing-generators',
          },
          {
            label: 'Creating files',
            link: 'extending-nx/creating-files',
          },
          {
            label: 'Modifying files',
            link: 'extending-nx/modifying-files',
          },
          {
            label: 'Migration generators',
            link: 'extending-nx/migration-generators',
          },
          {
            label: 'Create sync generator',
            link: 'extending-nx/create-sync-generator',
          },
          { label: 'Local executors', link: 'extending-nx/local-executors' },
          {
            label: 'Compose executors',
            link: 'extending-nx/compose-executors',
          },
          {
            label: 'Task running lifecycle',
            link: 'extending-nx/task-running-lifecycle',
          },
          {
            label: 'Project graph plugins',
            link: 'extending-nx/project-graph-plugins',
          },
          {
            label: 'CreateNodes compatibility',
            link: 'extending-nx/createnodes-compatibility',
          },
          {
            label: 'Organization-specific plugin',
            link: 'extending-nx/organization-specific-plugin',
          },
          {
            label: 'Tooling plugin',
            link: 'extending-nx/tooling-plugin',
          },
          {
            label: 'Custom plugin preset',
            link: 'extending-nx/create-preset',
          },
          {
            label: 'Creating an install package',
            link: 'extending-nx/create-install-package',
          },
          {
            label: 'Publish your plugin',
            link: 'extending-nx/publish-plugin',
          },
        ],
      },
      {
        label: 'Continuous integration',
        collapsed: true,
        items: [
          { label: 'Setup CI', link: 'guides/nx-cloud/setup-ci' },
          { label: 'Access tokens', link: 'guides/nx-cloud/access-tokens' },
          {
            label: 'Personal access tokens',
            link: 'guides/nx-cloud/personal-access-tokens',
          },
          { label: 'Manual DTE', link: 'guides/nx-cloud/manual-dte' },
          {
            label: 'Source control integration',
            link: 'guides/nx-cloud/source-control-integration',
          },
          {
            label: 'Set up CI with Bun',
            link: 'guides/nx-cloud/use-bun',
          },
          {
            label: 'Configure Node version',
            link: 'guides/nx-cloud/configure-node-version',
          },
          {
            label: 'GitHub app permissions',
            link: 'guides/nx-cloud/source-control-integration/github-app-permissions',
          },
          {
            label: 'Configuring the cloud runner',
            link: 'reference/nx-cloud/config',
          },
          {
            label: 'Custom images',
            link: 'reference/nx-cloud/custom-images',
          },
          {
            label: 'Assignment rules',
            link: 'reference/nx-cloud/assignment-rules',
          },
          {
            label: 'Custom steps',
            link: 'reference/nx-cloud/custom-steps',
          },
          {
            label: 'Launch templates',
            link: 'reference/nx-cloud/launch-templates',
          },
          {
            label: 'Reduce waste in CI',
            link: 'concepts/ci-concepts/reduce-waste',
          },
          {
            label: 'Cache security',
            link: 'concepts/ci-concepts/cache-security',
          },
          {
            label: 'Heartbeat and manual shutdown handling',
            link: 'concepts/ci-concepts/heartbeat-and-manual-shutdown-handling',
          },
        ],
      },
      {
        label: 'Tasks & caching',
        collapsed: true,
        items: [
          {
            label: 'Configure inputs',
            link: 'guides/tasks--caching/configure-inputs',
          },
          {
            label: 'Configure outputs',
            link: 'guides/tasks--caching/configure-outputs',
          },
          {
            label: 'Defining task pipeline',
            link: 'guides/tasks--caching/defining-task-pipeline',
          },
          {
            label: 'Run tasks in parallel',
            link: 'guides/tasks--caching/run-tasks-in-parallel',
          },
          {
            label: 'Pass args to commands',
            link: 'guides/tasks--caching/pass-args-to-commands',
          },
          {
            label: 'Run commands executor',
            link: 'guides/tasks--caching/run-commands-executor',
          },
          {
            label: 'Reduce repetitive configuration',
            link: 'guides/tasks--caching/reduce-repetitive-configuration',
          },
          {
            label: 'Root level scripts',
            link: 'guides/tasks--caching/root-level-scripts',
          },
          {
            label: 'Convert to inferred',
            link: 'guides/tasks--caching/convert-to-inferred',
          },
          {
            label: 'Change cache location',
            link: 'guides/tasks--caching/change-cache-location',
          },
          {
            label: 'Self-hosted caching',
            link: 'guides/tasks--caching/self-hosted-caching',
          },
          {
            label: 'Skipping cache',
            link: 'guides/tasks--caching/skipping-cache',
          },
          {
            label: 'Workspace watching',
            link: 'guides/tasks--caching/workspace-watching',
          },
          { label: 'Terminal UI', link: 'guides/tasks--caching/terminal-ui' },
        ],
      },
      {
        label: 'Benchmarks',
        collapsed: true,
        items: [
          {
            label: 'Nx Agents at scale',
            link: 'reference/benchmarks/nx-agents',
          },
          {
            label: 'Large Next.js apps with caching',
            link: 'reference/benchmarks/caching',
          },
          {
            label: 'TSC batch mode',
            link: 'reference/benchmarks/tsc-batch-mode',
          },
        ],
      },
      {
        label: 'TypeScript',
        collapsed: true,
        items: [
          {
            label: 'Maintain TypeScript monorepos',
            link: 'features/maintain-typescript-monorepos',
          },
          ...getTechnologyKBItems('typescript'),
          {
            label: 'Buildable and publishable libraries',
            link: 'concepts/buildable-and-publishable-libraries',
          },
          {
            label: 'TypeScript project linking',
            link: 'concepts/typescript-project-linking',
          },
        ],
      },
      {
        label: 'Angular',
        collapsed: true,
        items: [
          ...getTechnologyKBItems('angular'),
          ...getTechnologyKBItems('angular-rspack', 'angular'),
        ],
      },
      {
        label: 'React',
        collapsed: true,
        items: [
          ...getTechnologyKBItems('react'),
          ...getTechnologyKBItems('next', 'react'),
        ],
      },
      {
        label: 'Vue',
        collapsed: true,
        items: [...getTechnologyKBItems('nuxt', 'vue')],
      },
      {
        label: 'Node',
        collapsed: true,
        items: [...getTechnologyKBItems('node')],
      },
      {
        label: '.NET',
        collapsed: true,
        items: [...getTechnologyKBItems('dotnet')],
      },
      {
        label: 'Module Federation',
        collapsed: true,
        items: [...getTechnologyKBItems('module-federation')],
      },
      {
        label: 'ESLint',
        collapsed: true,
        items: [
          ...getTechnologyKBItems('eslint'),
          ...getTechnologyKBItems('eslint-plugin', 'eslint'),
        ],
      },
      {
        label: 'Vite',
        collapsed: true,
        items: [...getTechnologyKBItems('vite', 'build-tools')],
      },
      {
        label: 'Webpack',
        collapsed: true,
        items: [...getTechnologyKBItems('webpack', 'build-tools')],
      },
      {
        label: 'Cypress',
        collapsed: true,
        items: [...getTechnologyKBItems('cypress', 'test-tools')],
      },
      {
        label: 'Playwright',
        collapsed: true,
        items: [...getTechnologyKBItems('playwright', 'test-tools')],
      },
      {
        label: 'Storybook',
        collapsed: true,
        items: [...getTechnologyKBItems('storybook', 'test-tools')],
      },
      {
        label: 'Vitest',
        collapsed: true,
        items: [...getTechnologyKBItems('vitest', 'test-tools')],
      },
    ],
  },
];

const referenceGroups: SidebarItems = [
  {
    label: 'Reference',
    collapsed: true,
    items: [
      { label: 'nx.json', link: 'reference/nx-json' },
      {
        label: 'Project configuration',
        link: 'reference/project-configuration',
      },
      { label: 'Inputs', link: 'reference/inputs' },
      {
        label: 'Environment variables',
        link: 'reference/environment-variables',
      },
      { label: 'nxignore', link: 'reference/nxignore' },
      { label: 'Glossary', link: 'reference/glossary' },
      { label: 'Releases', link: 'reference/releases' },
      { label: 'Nx MCP', link: 'reference/nx-mcp' },
      { label: 'Nx Console settings', link: 'reference/nx-console-settings' },
      { label: 'Nx Cloud CLI', link: 'reference/nx-cloud-cli' },
      { label: 'Telemetry', link: 'reference/telemetry' },
      {
        label: 'TypeScript',
        collapsed: true,
        items: [...getTechnologyAPIItems('js')],
      },
      {
        label: 'Angular',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('angular', undefined, 'Angular'),
          ...getTechnologyAPIItems(
            'angular-rspack',
            'angular',
            'Angular Rspack'
          ),
          ...getTechnologyAPIItems(
            'angular-rsbuild',
            'angular',
            'Angular Rsbuild'
          ),
          ...getTechnologyAPIItems(
            'angular-rspack-compiler',
            'angular',
            'Angular Rspack Compiler'
          ),
        ],
      },
      {
        label: 'React',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('react', undefined, 'React'),
          ...getTechnologyAPIItems('next', 'react', 'Next.js'),
          ...getTechnologyAPIItems('remix', 'react', 'Remix'),
          ...getTechnologyAPIItems('react-native', 'react', 'React Native'),
          ...getTechnologyAPIItems('expo', 'react', 'Expo'),
        ],
      },
      {
        label: 'Vue',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('vue', undefined, 'Vue'),
          ...getTechnologyAPIItems('nuxt', 'vue', 'Nuxt'),
        ],
      },
      {
        label: 'Node',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('node', undefined, 'Node'),
          ...getTechnologyAPIItems('express', 'node', 'Express'),
          ...getTechnologyAPIItems('nest', 'node', 'Nest'),
        ],
      },
      {
        label: 'Java',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('gradle', 'java', 'Gradle'),
          ...getTechnologyAPIItems('maven', 'java', 'Maven'),
        ],
      },
      {
        label: '.NET',
        collapsed: true,
        items: [...getTechnologyAPIItems('dotnet')],
      },
      {
        label: 'Module Federation',
        collapsed: true,
        items: [...getTechnologyAPIItems('module-federation')],
      },
      {
        label: 'ESLint',
        collapsed: true,
        items: [
          ...getTechnologyAPIItems('eslint', undefined, 'ESLint'),
          ...getTechnologyAPIItems('eslint-plugin', 'eslint', 'ESLint Plugin'),
        ],
      },
      {
        label: 'Webpack',
        collapsed: true,
        items: [...getTechnologyAPIItems('webpack', 'build-tools')],
      },
      {
        label: 'Vite',
        collapsed: true,
        items: [...getTechnologyAPIItems('vite', 'build-tools')],
      },
      {
        label: 'Rollup',
        collapsed: true,
        items: [...getTechnologyAPIItems('rollup', 'build-tools')],
      },
      {
        label: 'ESBuild',
        collapsed: true,
        items: [...getTechnologyAPIItems('esbuild', 'build-tools')],
      },
      {
        label: 'Rspack',
        collapsed: true,
        items: [...getTechnologyAPIItems('rspack', 'build-tools')],
      },
      {
        label: 'Rsbuild',
        collapsed: true,
        items: [...getTechnologyAPIItems('rsbuild', 'build-tools')],
      },
      {
        label: 'Cypress',
        collapsed: true,
        items: [...getTechnologyAPIItems('cypress', 'test-tools')],
      },
      {
        label: 'Jest',
        collapsed: true,
        items: [...getTechnologyAPIItems('jest', 'test-tools')],
      },
      {
        label: 'Playwright',
        collapsed: true,
        items: [...getTechnologyAPIItems('playwright', 'test-tools')],
      },
      {
        label: 'Storybook',
        collapsed: true,
        items: [...getTechnologyAPIItems('storybook', 'test-tools')],
      },
      {
        label: 'Detox',
        collapsed: true,
        items: [...getTechnologyAPIItems('detox', 'test-tools')],
      },
      {
        label: 'Vitest',
        collapsed: true,
        items: [...getTechnologyAPIItems('vitest', 'test-tools')],
      },
      {
        label: 'Nx Cloud credit pricing',
        link: 'reference/nx-cloud/credits-pricing',
      },
      {
        label: 'Remote cache plugins',
        link: 'reference/remote-cache-plugins',
      },
      {
        label: 'Changelog',
        link: `${resolveNxDevUrl()}/changelog`,
      },
      {
        label: 'Deprecations',
        link: 'reference/deprecated',
      },
    ],
  },
];

export const sidebarTabs: SidebarTab[] = [
  {
    id: 'tab-learn',
    label: 'Getting Started',
    icon: 'open-book',
    groups: learnGroups,
  },
  {
    id: 'tab-technologies',
    label: 'Technologies',
    icon: 'puzzle',
    groups: technologiesGroups,
  },
  {
    id: 'tab-knowledge-base',
    label: 'Knowledge Base',
    icon: 'information',
    groups: knowledgeBaseGroups,
  },
  {
    id: 'tab-reference',
    label: 'Reference',
    icon: 'document',
    groups: referenceGroups,
  },
];

export const sidebar: StarlightUserConfig['sidebar'] = sidebarTabs.flatMap(
  (tab) => tab.groups
);
