import type { StarlightUserConfig } from '@astrojs/starlight/types';

export const sidebar: StarlightUserConfig['sidebar'] = [
  // GETTING STARTED - Focus: immediate value, essential setup
  {
    label: 'Getting Started',
    collapsed: false,
    items: [
      { label: 'Intro to Nx', link: 'getting-started/intro' },
      { label: 'Installation', link: 'getting-started/installation' },
      { label: 'Editor Setup', link: 'getting-started/editor-setup' },
      { label: 'AI Integrations', link: 'getting-started/ai-setup' },
      {
        label: 'Start a New Project',
        link: 'getting-started/start-new-project',
      },
      {
        label: 'Add to Existing Project',
        link: 'getting-started/start-with-existing-project',
      },
      {
        label: 'Tutorials',
        collapsed: true,
        items: [
          {
            label: 'Angular Monorepo',
            link: 'getting-started/tutorials/angular-monorepo-tutorial',
          },
          {
            label: 'Gradle Monorepo',
            link: 'getting-started/tutorials/gradle-tutorial',
          },
          {
            label: 'React Monorepo',
            link: 'getting-started/tutorials/react-monorepo-tutorial',
          },
          {
            label: 'TypeScript Monorepo',
            link: 'getting-started/tutorials/typescript-packages-tutorial',
          },
        ],
      },
    ],
  },

  // HOW NX WORKS - Focus: Deep understanding, mental models, no terminal needed
  {
    label: 'How Nx Works',
    collapsed: true,
    items: [
      // Core concepts
      { label: 'Mental Model', link: 'concepts/mental-model' },
      { label: 'How Caching Works', link: 'concepts/how-caching-works' },
      { label: 'Inferred Tasks', link: 'concepts/inferred-tasks' },
      {
        label: 'Task Pipeline Configuration',
        link: 'concepts/task-pipeline-configuration',
      },
      {
        label: 'Executors and Configurations',
        link: 'concepts/executors-and-configurations',
      },
      { label: 'Nx Plugins', link: 'concepts/nx-plugins' },
      { label: 'Sync Generators', link: 'concepts/sync-generators' },
      { label: 'Common Tasks', link: 'concepts/common-tasks' },
      {
        label: 'Types of Configuration',
        link: 'concepts/types-of-configuration',
      },
      { label: 'Nx Daemon', link: 'concepts/nx-daemon' },
      // CI Concepts (flattened - no nested group)
      {
        label: 'Building Blocks of Fast CI',
        link: 'concepts/ci-concepts/building-blocks-fast-ci',
      },
      {
        label: 'Parallelization and Distribution',
        link: 'concepts/ci-concepts/parallelization-distribution',
      },
    ],
  },

  // 3. PLATFORM - Focus: Power features that apply to everyone, agnostic to a given framework/tool
  {
    label: 'Platform Features',
    collapsed: true,
    items: [
      { label: 'Run Tasks', link: 'features/run-tasks' },
      { label: 'Explore Graph', link: 'features/explore-graph' },
      { label: 'Generate Code', link: 'features/generate-code' },
      {
        label: 'Enforce Module Boundaries',
        link: 'features/enforce-module-boundaries',
      },
      { label: 'Manage Releases', link: 'features/manage-releases' },
      { label: 'Enhance AI', link: 'features/enhance-ai' },
      {
        label: 'CI & Orchestration',
        collapsed: true,
        items: [
          { label: 'Affected', link: 'features/ci-features/affected' },
          {
            label: 'Remote Cache',
            link: 'features/ci-features/remote-cache',
          },
          {
            label: 'Distribute Task Execution',
            link: 'features/ci-features/distribute-task-execution',
          },
          {
            label: 'Dynamic Agents',
            link: 'features/ci-features/dynamic-agents',
          },
          {
            label: 'Split E2E Tasks',
            link: 'features/ci-features/split-e2e-tasks',
          },
          { label: 'Flaky Tasks', link: 'features/ci-features/flaky-tasks' },
          {
            label: 'Self-Healing CI',
            link: 'features/ci-features/self-healing-ci',
          },
          {
            label: 'GitHub Integration',
            link: 'features/ci-features/github-integration',
          },
        ],
      },
      {
        label: 'Adopting Nx',
        collapsed: true,
        items: [
          {
            label: 'Adding to Existing Project',
            link: 'guides/adopting-nx/adding-to-existing-project',
          },
          {
            label: 'Adding to Monorepo',
            link: 'guides/adopting-nx/adding-to-monorepo',
          },
          {
            label: 'Import Project',
            link: 'guides/adopting-nx/import-project',
          },
          {
            label: 'Manual Setup',
            link: 'guides/adopting-nx/manual',
          },
          {
            label: 'From Turborepo',
            link: 'guides/adopting-nx/from-turborepo',
          },
          {
            label: 'Preserving Git Histories',
            link: 'guides/adopting-nx/preserving-git-histories',
          },
        ],
      },
      {
        label: 'Module Boundaries',
        collapsed: true,
        items: [
          {
            label: 'Ban Dependencies with Tags',
            link: 'guides/enforce-module-boundaries/ban-dependencies-with-tags',
          },
          {
            label: 'Ban External Imports',
            link: 'guides/enforce-module-boundaries/ban-external-imports',
          },
          {
            label: 'Tag Multiple Dimensions',
            link: 'guides/enforce-module-boundaries/tag-multiple-dimensions',
          },
          {
            label: 'Tags Allow List',
            link: 'guides/enforce-module-boundaries/tags-allow-list',
          },
        ],
      },
      {
        label: 'Nx Release',
        collapsed: true,
        items: [
          // TODO: only keeep nx release things, and move anything specific to a technology to KB space
          {
            label: 'Publish in CI/CD',
            link: 'guides/nx-release/publish-in-ci-cd',
          },
          {
            label: 'Automatic Versioning with Conventional Commits',
            link: 'guides/nx-release/automatically-version-with-conventional-commits',
          },
          {
            label: 'Customize Conventional Commit Types',
            link: 'guides/nx-release/customize-conventional-commit-types',
          },
          {
            label: 'Configure Changelog Format',
            link: 'guides/nx-release/configure-changelog-format',
          },
          {
            label: 'Configure Custom Registries',
            link: 'guides/nx-release/configure-custom-registries',
          },
          {
            label: 'Configure Version Prefix',
            link: 'guides/nx-release/configuration-version-prefix',
          },
          {
            label: 'File-Based Versioning (Version Plans)',
            link: 'guides/nx-release/file-based-versioning-version-plans',
          },
          {
            label: 'Release Groups',
            link: 'guides/nx-release/release-groups',
          },
          {
            label: 'Release Projects Independently',
            link: 'guides/nx-release/release-projects-independently',
          },
          {
            label: 'Build Before Versioning',
            link: 'guides/nx-release/build-before-versioning',
          },
          {
            label: 'Update Dependents',
            link: 'guides/nx-release/update-dependents',
          },
          {
            label: 'Updating Version References',
            link: 'guides/nx-release/updating-version-references',
          },
          {
            label: 'Update Local Registry Setup',
            link: 'guides/nx-release/update-local-registry-setup',
          },
          {
            label: 'Programmatic API',
            link: 'guides/nx-release/programmatic-api',
          },
        ],
      },
      {
        label: 'Nx Cloud',
        collapsed: true,
        items: [
          { label: 'Setup CI', link: 'guides/nx-cloud/setup-ci' },
          { label: 'Access Tokens', link: 'guides/nx-cloud/access-tokens' },
          {
            label: 'Personal Access Tokens',
            link: 'guides/nx-cloud/personal-access-tokens',
          },
          {
            label: 'CI Resource Usage',
            link: 'guides/nx-cloud/ci-resource-usage',
          },
          {
            label: 'Optimize Your TTG',
            link: 'guides/nx-cloud/optimize-your-ttg',
          },
          {
            label: 'Record Commands',
            link: 'guides/nx-cloud/record-commands',
          },
          { label: 'Manual DTE', link: 'guides/nx-cloud/manual-dte' },
          {
            label: 'CIPE Affected Project Graph',
            link: 'guides/nx-cloud/cipe-affected-project-graph',
          },
          { label: 'Encryption', link: 'guides/nx-cloud/encryption' },
          { label: 'Google Auth', link: 'guides/nx-cloud/google-auth' },
          {
            label: 'Enable AI Features',
            link: 'guides/nx-cloud/enable-ai-features',
          },
          {
            label: 'Source Control Integration',
            link: 'guides/nx-cloud/source-control-integration',
          },
          {
            label: 'Configuring the Cloud Runner',
            link: 'reference/nx-cloud/config',
          },
          {
            label: 'Custom Images',
            link: 'reference/nx-cloud/custom-images',
          },
          {
            label: 'Assignment Rules',
            link: 'reference/nx-cloud/assignment-rules',
          },
          {
            label: 'Custom Steps',
            link: 'reference/nx-cloud/custom-steps',
          },
          {
            label: 'Launch Templates',
            link: 'reference/nx-cloud/launch-templates',
          },
        ],
      },
      {
        label: 'Enterprise',
        collapsed: true,
        items: [
          { label: 'Conformance', link: 'enterprise/conformance' },
          {
            label: 'Configure Conformance Rules in Nx Cloud',
            link: 'enterprise/configure-conformance-rules-in-nx-cloud',
          },
          {
            label: 'Publish Conformance Rules to Nx Cloud',
            link: 'enterprise/publish-conformance-rules-to-nx-cloud',
          },
          { label: 'Owners', link: 'enterprise/owners' },
          { label: 'Polygraph', link: 'enterprise/polygraph' },
          { label: 'Custom Workflows', link: 'enterprise/custom-workflows' },
          {
            label: 'Metadata Only Workspace',
            link: 'enterprise/metadata-only-workspace',
          },
          { label: 'Activate License', link: 'enterprise/activate-license' },
          {
            label: 'Single Tenant',
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
                label: 'Custom GitHub App',
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
            label: 'Conformance Reference',
            collapsed: true,
            items: [
              {
                label: 'Overview',
                link: 'reference/conformance/overview',
              },
              {
                label: 'Create Conformance Rule',
                link: 'reference/conformance/create-conformance-rule',
              },
              {
                label: 'Test Conformance Rule',
                link: 'reference/conformance/test-conformance-rule',
              },
              {
                label: 'Generators',
                link: 'reference/conformance/Generators',
              },
              {
                label: 'Executors',
                link: 'reference/conformance/Executors',
              },
            ],
          },
          {
            label: 'Enterprise Release Notes',
            link: 'reference/nx-cloud/release-notes',
          },
        ],
      },
    ],
  },

  // TECHNOLOGIES - Focus: Context-specific guides, hub pages only that branch off to KB or other areas
  {
    label: 'Technologies & Tools',
    collapsed: true,
    items: [
      { label: 'TypeScript', link: 'technologies/typescript/introduction' },
      { label: 'Angular', link: 'technologies/angular/introduction' },
      {
        label: 'Angular Rspack',
        link: 'technologies/angular/angular-rspack/introduction',
      },
      {
        label: 'Angular Rsbuild',
        link: 'technologies/angular/angular-rsbuild/create-config',
      },
      { label: 'React', link: 'technologies/react/introduction' },
      { label: 'Next.js', link: 'technologies/react/next/introduction' },
      { label: 'Remix', link: 'technologies/react/remix/introduction' },
      {
        label: 'React Native',
        link: 'technologies/react/react-native/introduction',
      },
      { label: 'Expo', link: 'technologies/react/expo/introduction' },
      { label: 'Vue', link: 'technologies/vue/introduction' },
      { label: 'Nuxt', link: 'technologies/vue/nuxt/introduction' },
      { label: 'Node.js', link: 'technologies/node/introduction' },
      { label: 'Express', link: 'technologies/node/express/introduction' },
      { label: 'Nest', link: 'technologies/node/nest/introduction' },
      { label: 'Java', link: 'technologies/java/introduction' },
      { label: 'Gradle', link: 'technologies/java/gradle/introduction' },
      { label: 'Maven', link: 'technologies/java/maven/introduction' },
      { label: '.NET', link: 'technologies/dotnet/introduction' },
      {
        label: 'Module Federation',
        link: 'technologies/module-federation/introduction',
      },
      { label: 'ESLint', link: 'technologies/eslint/introduction' },
      // Build Tools
      {
        label: 'Webpack',
        link: 'technologies/build-tools/webpack/introduction',
      },
      { label: 'Vite', link: 'technologies/build-tools/vite/introduction' },
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
      // Test Tools
      {
        label: 'Cypress',
        link: 'technologies/test-tools/cypress/introduction',
      },
      {
        label: 'Vitest',
        link: 'technologies/test-tools/vitest/introduction',
      },
      { label: 'Jest', link: 'technologies/test-tools/jest/introduction' },
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

  // KNOWLEDGE BASE - Focus: Specific solutions to specific problems
  {
    label: 'Knowledge Base',
    collapsed: true,
    items: [
      {
        label: 'Troubleshooting',
        collapsed: true,
        items: [
          {
            label: 'CI Execution Failed',
            link: 'troubleshooting/ci-execution-failed',
          },
          {
            label: 'Unknown Local Cache Error',
            link: 'troubleshooting/unknown-local-cache',
          },
          {
            label: 'Troubleshoot Convert to Inferred',
            link: 'troubleshooting/troubleshoot-convert-to-inferred',
          },
          {
            label: 'Profiling Performance',
            link: 'troubleshooting/performance-profiling',
          },
          {
            label: 'Troubleshoot Nx Console Issues',
            link: 'troubleshooting/console-troubleshooting',
          },
          {
            label: 'Troubleshoot Cache Misses',
            link: 'troubleshooting/troubleshoot-cache-misses',
          },
          {
            label: 'Troubleshoot Nx Installations',
            link: 'troubleshooting/troubleshoot-nx-install-issues',
          },
          {
            label: 'Resolve Circular Dependencies',
            link: 'troubleshooting/resolve-circular-dependencies',
          },
        ],
      },
      {
        // TODO: I don't like 'recipes' as a section title. bc too "catch all" maybe find a way to split things up and keep it obvious to know what is contained in the subgroups 🤔
        label: 'Recipes',
        collapsed: true,
        items: [
          {
            label: 'Include All package.json Files',
            link: 'guides/tips-n-tricks/include-all-packagejson',
          },
          {
            label: 'Disable Graph Links from Source Analysis',
            link: 'guides/tips-n-tricks/analyze-source-files',
          },
          {
            label: 'Using Yarn PnP with Nx',
            link: 'guides/tips-n-tricks/yarn-pnp',
          },
          {
            label: 'Identify Dependencies Between Folders',
            link: 'guides/tips-n-tricks/identify-dependencies-between-folders',
          },
          {
            label: 'Feature-Based Testing',
            link: 'guides/tips-n-tricks/feature-based-testing',
          },
          {
            label: 'Configuring Browser Support',
            link: 'guides/tips-n-tricks/browser-support',
          },
          {
            label: 'Advanced Update Process',
            link: 'guides/tips-n-tricks/advanced-update',
          },
          {
            label: 'Define Environment Variables',
            link: 'guides/tips-n-tricks/define-environment-variables',
          },
          {
            label: 'Including Assets in Your Build',
            link: 'guides/tips-n-tricks/include-assets-in-build',
          },
          {
            label: 'Keep Nx Versions in Sync',
            link: 'guides/tips-n-tricks/keep-nx-versions-in-sync',
          },
          {
            label: 'Standalone to Monorepo',
            link: 'guides/tips-n-tricks/standalone-to-monorepo',
          },
        ],
      },
      {
        label: 'Creating Releases',
        collapsed: true,
        items: [
          {
            label: 'Release NPM Packages',
            link: 'guides/nx-release/release-npm-packages',
          },
          {
            label: 'Release Rust Crates',
            link: 'guides/nx-release/publish-rust-crates',
          },
          {
            label: 'Release Docker Images',
            link: 'guides/nx-release/release-docker-images',
          },
          {
            label: 'Automate GitHub Releases',
            link: 'guides/nx-release/automate-github-releases',
          },
          {
            label: 'Automate GitLab Releases',
            link: 'guides/nx-release/automate-gitlab-releases',
          },
        ],
      },
      {
        // TODO: we can probs condense and split this section up
        label: 'Nx Console',
        collapsed: true,
        items: [
          {
            label: 'Telemetry',
            link: 'guides/nx-console/console-telemetry',
          },
          {
            label: 'Run Command',
            link: 'guides/nx-console/console-run-command',
          },
          {
            label: 'Nx Cloud Integration',
            link: 'guides/nx-console/console-nx-cloud',
          },
          {
            label: 'Generate Command',
            link: 'guides/nx-console/console-generate-command',
          },
          {
            label: 'Project Details View',
            link: 'guides/nx-console/console-project-details',
          },
          {
            label: 'Troubleshooting',
            link: 'guides/nx-console/console-troubleshooting',
          },
          {
            label: 'Migrate UI',
            link: 'guides/nx-console/console-migrate-ui',
          },
        ],
      },
      {
        // TODO: do we even need this? feels like it should be apart of the main setup in getting started or fully removed
        label: 'Installation',
        collapsed: true,
        items: [
          {
            label: 'Install Nx in Non-JavaScript Repo',
            link: 'guides/installation/install-non-javascript',
          },
          {
            label: 'Update Global Installation',
            link: 'guides/installation/update-global-installation',
          },
        ],
      },
      {
        label: 'Organization Decisions',
        collapsed: true,
        items: [
          {
            label: 'Monorepo or Polyrepo',
            link: 'concepts/decisions/overview',
          },
          {
            label: 'Why Monorepos',
            link: 'concepts/decisions/why-monorepos',
          },
          {
            label: 'Dependency Management',
            link: 'concepts/decisions/dependency-management',
          },
          {
            label: 'Code Ownership',
            link: 'concepts/decisions/code-ownership',
          },
          {
            label: 'Project Dependency Rules',
            link: 'concepts/decisions/project-dependency-rules',
          },
          {
            label: 'Folder Structure',
            link: 'concepts/decisions/folder-structure',
          },
          {
            label: 'Project Size',
            link: 'concepts/decisions/project-size',
          },
        ],
      },
      {
        label: 'TypeScript Monorepos',
        items: [
          {
            label: 'TypeScript Project Linking',
            link: 'concepts/typescript-project-linking',
          },
          {
            label: 'Maintain TypeScript Monorepos',
            link: 'features/maintain-typescript-monorepos',
          },
        ],
      },
      {
        label: 'Extending Nx',
        collapsed: true,
        items: [
          { label: 'Intro', link: 'extending-nx/intro' },
          { label: 'Local Generators', link: 'extending-nx/local-generators' },
          {
            label: 'Composing Generators',
            link: 'extending-nx/composing-generators',
          },
          {
            label: 'Creating Files',
            link: 'extending-nx/creating-files',
          },
          {
            label: 'Modifying Files',
            link: 'extending-nx/modifying-files',
          },
          {
            label: 'Migration Generators',
            link: 'extending-nx/migration-generators',
          },
          {
            label: 'Create Sync Generator',
            link: 'extending-nx/create-sync-generator',
          },
          { label: 'Local Executors', link: 'extending-nx/local-executors' },
          {
            label: 'Compose Executors',
            link: 'extending-nx/compose-executors',
          },
          {
            label: 'Task Running Lifecycle',
            link: 'extending-nx/task-running-lifecycle',
          },
          {
            label: 'Project Graph Plugins',
            link: 'extending-nx/project-graph-plugins',
          },
          {
            label: 'CreateNodes Compatibility',
            link: 'extending-nx/createnodes-compatibility',
          },
          {
            label: 'Organization-Specific Plugin',
            link: 'extending-nx/organization-specific-plugin',
          },
          {
            label: 'Tooling Plugin',
            link: 'extending-nx/tooling-plugin',
          },
          {
            label: 'Custom Plugin Preset',
            link: 'extending-nx/create-preset',
          },
          {
            label: 'Creating an Install Package',
            link: 'extending-nx/create-install-package',
          },
          {
            label: 'Publish Your Plugin',
            link: 'extending-nx/publish-plugin',
          },
        ],
      },
      {
        label: 'Reduce Waste in CI',
        link: 'concepts/ci-concepts/reduce-waste',
      },
      { label: 'Cache Security', link: 'concepts/ci-concepts/cache-security' },
      {
        label: 'Heartbeat and Manual Shutdown Handling',
        link: 'concepts/ci-concepts/heartbeat-and-manual-shutdown-handling',
      },
      {
        label: 'Buildable and Publishable Libraries',
        link: 'concepts/buildable-and-publishable-libraries',
      },

      // TODO: this section is werid and doesn't really explain what's going on. maybe a better way to structure the information esp that is which is more generic to Nx but specificly still a guide
      {
        label: 'Tasks & Caching',
        collapsed: true,
        items: [
          {
            label: 'Configure Inputs',
            link: 'guides/tasks--caching/configure-inputs',
          },
          {
            label: 'Configure Outputs',
            link: 'guides/tasks--caching/configure-outputs',
          },
          {
            label: 'Defining Task Pipeline',
            link: 'guides/tasks--caching/defining-task-pipeline',
          },
          {
            label: 'Run Tasks in Parallel',
            link: 'guides/tasks--caching/run-tasks-in-parallel',
          },
          {
            label: 'Pass Args to Commands',
            link: 'guides/tasks--caching/pass-args-to-commands',
          },
          {
            label: 'Run Commands Executor',
            link: 'guides/tasks--caching/run-commands-executor',
          },
          {
            label: 'Reduce Repetitive Configuration',
            link: 'guides/tasks--caching/reduce-repetitive-configuration',
          },
          {
            label: 'Root Level Scripts',
            link: 'guides/tasks--caching/root-level-scripts',
          },
          {
            label: 'Convert to Inferred',
            link: 'guides/tasks--caching/convert-to-inferred',
          },
          {
            label: 'Change Cache Location',
            link: 'guides/tasks--caching/change-cache-location',
          },
          {
            label: 'Self-Hosted Caching',
            link: 'guides/tasks--caching/self-hosted-caching',
          },
          {
            label: 'Skipping Cache',
            link: 'guides/tasks--caching/skipping-cache',
          },
          {
            label: 'Workspace Watching',
            link: 'guides/tasks--caching/workspace-watching',
          },
          { label: 'Terminal UI', link: 'guides/tasks--caching/terminal-ui' },
        ],
      },
    ],
  },
  // REFERENCE  - Focus: Exhaustive facts, no narrative
  {
    label: 'Reference',
    collapsed: true,
    items: [
      { label: 'nx.json', link: 'reference/nx-json' },
      {
        label: 'Project Configuration',
        link: 'reference/project-configuration',
      },
      { label: 'Inputs', link: 'reference/inputs' },
      {
        label: 'Environment Variables',
        link: 'reference/environment-variables',
      },
      { label: 'nxignore', link: 'reference/nxignore' },
      { label: 'Glossary', link: 'reference/glossary' },
      { label: 'Releases', link: 'reference/releases' },
      {
        label: 'Node/TypeScript Compatibility',
        link: 'reference/nodejs-typescript-compatibility',
      },
      { label: 'Nx MCP', link: 'reference/nx-mcp' },
      { label: 'Nx Console Settings', link: 'reference/nx-console-settings' },
      { label: 'Nx Cloud CLI', link: 'reference/nx-cloud-cli' },
      {
        label: 'Nx Cloud Credit Pricing',
        link: 'reference/nx-cloud/credits-pricing',
      },
      {
        label: 'Remote Cache Plugins',
        link: 'reference/remote-cache-plugins',
      },
      {
        label: 'Benchmarks',
        collapsed: true,
        items: [
          {
            label: 'Nx Agents at Scale',
            link: 'reference/benchmarks/nx-agents',
          },
          {
            label: 'Large Next.js Apps with Caching',
            link: 'reference/benchmarks/caching',
          },
          {
            label: 'TSC Batch Mode',
            link: 'reference/benchmarks/tsc-batch-mode',
          },
        ],
      },
      {
        label: 'Deprecated',
        collapsed: true,
        items: [
          {
            label: 'Workspace Generators',
            link: 'reference/deprecated/workspace-generators',
          },
          {
            label: 'affected:graph',
            link: 'reference/deprecated/affected-graph',
          },
          {
            label: 'workspace.json',
            link: 'reference/deprecated/workspace-json',
          },
          {
            label: 'Cacheable Operations',
            link: 'reference/deprecated/cacheable-operations',
          },
          {
            label: 'v1 Nx Plugin API',
            link: 'reference/deprecated/v1-nx-plugin-api',
          },
          {
            label: 'Legacy Cache',
            link: 'reference/deprecated/legacy-cache',
          },
          {
            label: 'Workspace Executors',
            link: 'reference/deprecated/workspace-executors',
          },
          {
            label: 'print-affected',
            link: 'reference/deprecated/print-affected',
          },
          {
            label: 'Custom Tasks Runner',
            link: 'reference/deprecated/custom-tasks-runner',
          },
          {
            label: 'NPM Scope',
            link: 'reference/deprecated/npm-scope',
          },
          {
            label: 'Rescoping @nrwl to @nx',
            link: 'reference/deprecated/rescope',
          },
          {
            label: 'Runtime Cache Inputs',
            link: 'reference/deprecated/runtime-cache-inputs',
          },
          {
            label: 'Global Implicit Dependencies',
            link: 'reference/deprecated/global-implicit-dependencies',
          },
          {
            label: 'As Provided vs Derived',
            link: 'reference/deprecated/as-provided-vs-derived',
          },
          {
            label: 'Integrated vs Package-Based',
            link: 'reference/deprecated/integrated-vs-package-based',
          },
          {
            label: 'Angular Schematics and Builders',
            link: 'reference/deprecated/angular-schematics-builders',
          },
        ],
      },
    ],
  },
];
