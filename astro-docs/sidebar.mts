import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { getTechnologyAPIItems } from './src/plugins/utils/plugin-mappings';
import { resolveNxDevUrl } from './src/utils/resolve-nx-dev-url';

type SidebarItems = NonNullable<StarlightUserConfig['sidebar']>;

/**
 * Tab configuration for the sidebar. Each tab directly owns its sidebar groups,
 * making the tab ↔ content relationship explicit and impossible to drift.
 * A tab may instead be a direct `link` (renders as a nav link, not a panel).
 */
export interface SidebarTab {
  id: string;
  label: string;
  icon?: string;
  groups: SidebarItems;
  /** If set, the tab navigates straight to this slug instead of opening a panel. */
  link?: string;
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
      { label: 'CI setup', link: 'getting-started/setup-ci' },
      { label: 'Editor setup', link: 'getting-started/editor-setup' },
      {
        label: 'Tutorials',
        collapsed: false,
        items: [
          {
            label: 'Crafting your workspace',
            link: 'getting-started/tutorials/crafting-your-workspace',
          },
          {
            label: 'Managing dependencies',
            link: 'getting-started/tutorials/managing-dependencies',
          },
          {
            label: 'Configuring tasks',
            link: 'getting-started/tutorials/configuring-tasks',
          },
          {
            label: 'Running tasks',
            link: 'getting-started/tutorials/running-tasks',
          },
          {
            label: 'Caching tasks',
            link: 'getting-started/tutorials/caching',
          },
          {
            label: 'Understanding your workspace',
            link: 'getting-started/tutorials/understanding-your-workspace',
          },
          {
            label: 'Reducing boilerplate',
            link: 'getting-started/tutorials/reducing-configuration-boilerplate',
          },
          {
            label: 'Gradle monorepo',
            link: 'getting-started/tutorials/gradle-tutorial',
          },
        ],
      },
    ],
  },

  {
    label: 'How Nx works',
    collapsed: true,
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
    ],
  },
  {
    label: 'Platform features',
    collapsed: true,
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
            label: 'CIPE affected project graph',
            link: 'guides/nx-cloud/cipe-affected-project-graph',
          },
          { label: 'Encryption', link: 'guides/nx-cloud/encryption' },
          { label: 'Google auth', link: 'guides/nx-cloud/google-auth' },
          {
            label: 'Resource usage',
            link: 'features/ci-features/resource-usage',
          },
          {
            label: 'Dedicated compute cluster',
            link: 'features/ci-features/dedicated-compute-cluster',
          },
          {
            label: 'Sandboxing',
            link: 'features/ci-features/sandboxing',
          },
          {
            label: 'Docker layer caching',
            link: 'features/ci-features/docker-layer-caching',
          },
          {
            label: 'Docker read-through cache',
            link: 'features/ci-features/docker-read-through-cache',
          },
          {
            label: 'npm read-through cache',
            link: 'features/ci-features/npm-read-through-cache',
          },
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
            label: 'Automate updating dependencies',
            link: 'features/automate-updating-dependencies',
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
          { label: 'Custom workflows', link: 'enterprise/custom-workflows' },
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
          {
            label: 'Module Federation',
            link: 'technologies/module-federation/introduction',
          },
          { label: 'ESLint', link: 'technologies/eslint/introduction' },
        ],
      },
      {
        label: 'Node',
        collapsed: false,
        items: [
          { label: 'Node.js', link: 'technologies/node/introduction' },
          {
            label: 'Express',
            link: 'technologies/node/express/introduction',
          },
          { label: 'Nest', link: 'technologies/node/nest/introduction' },
        ],
      },
      {
        label: 'Java (JVM)',
        collapsed: false,
        items: [
          { label: 'Java', link: 'technologies/java/introduction' },
          {
            label: 'Gradle',
            link: 'technologies/java/gradle/introduction',
          },
          {
            label: 'Maven',
            link: 'technologies/java/maven/introduction',
          },
        ],
      },
      {
        label: '.NET',
        collapsed: false,
        items: [{ label: '.NET', link: 'technologies/dotnet/introduction' }],
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
          {
            label: 'Docker',
            link: 'technologies/build-tools/docker/introduction',
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
    id: 'tab-reference',
    label: 'Reference',
    icon: 'document',
    groups: referenceGroups,
  },
  {
    id: 'tab-templates',
    label: 'Templates',
    icon: 'rocket',
    link: 'templates',
    groups: [],
  },
];

export const sidebar: StarlightUserConfig['sidebar'] = sidebarTabs.flatMap(
  (tab) => tab.groups
);
