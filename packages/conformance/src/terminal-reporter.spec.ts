import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalReporter } from './terminal-reporter';
import type {
  ConformanceRule,
  ConformanceRuleResultWithRuleAndRunnerData,
  ConformanceViolation,
} from './types';

// Omit properties that are not relevant for the terminal reporter tests to keep test data clean
type TestRuleResult = Omit<
  ConformanceRuleResultWithRuleAndRunnerData,
  'resolvedStatus' | 'runnerData' | 'ruleData'
> & {
  ruleData: Omit<
    ConformanceRule<unknown>,
    'implementation' | 'fixGenerator'
  > & {
    reporter?: string;
  };
  resolvedStatus: ConformanceRuleResultWithRuleAndRunnerData['resolvedStatus'];
  runnerData: Omit<
    ConformanceRuleResultWithRuleAndRunnerData['runnerData'],
    'status' | 'scheduledStatus' | 'scheduledStatusDate'
  > & {
    status: ConformanceRuleResultWithRuleAndRunnerData['runnerData']['status'];
    scheduledStatus: ConformanceRuleResultWithRuleAndRunnerData['runnerData']['scheduledStatus'];
    scheduledStatusDate: ConformanceRuleResultWithRuleAndRunnerData['runnerData']['scheduledStatusDate'];
    executionTimeMs: number;
  };
};

// Mock console.log to capture output for visual testing
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

beforeEach(() => {
  consoleOutput = [];
  console.log = vi.fn((...args) => {
    consoleOutput.push(args.join(' '));
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('terminal-reporter', () => {
  describe('single rule result', () => {
    it('should handle mixed violations with all combinations', () => {
      const violations: ConformanceViolation[] = [
        // Project + file violations (will be grouped by project)
        {
          message: 'Missing proper imports',
          file: 'libs/shared-utils/src/helpers.ts',
          sourceProject: 'shared-utils',
        },
        {
          message: 'Missing proper imports',
          file: 'libs/shared-utils/src/constants.ts',
          sourceProject: 'shared-utils',
        },
        {
          message: 'Invalid export pattern',
          file: 'apps/web-app/src/main.ts',
          sourceProject: 'web-app',
        },
        // Project-only violations (grouped by project, no files shown)
        {
          message: 'Missing required target',
          sourceProject: 'api-server',
        },
        // File-only violations (ungrouped, shown individually)
        {
          message: 'Workflow configuration issue',
          file: '.github/workflows/ci.yml',
        },
        {
          message: 'Missing license header',
          file: 'README.md',
        },
        // Standalone message violations (ungrouped, no file or project)
        {
          message: 'Workspace configuration issue',
          workspaceViolation: true,
        },
      ];

      const result = {
        severity: 'medium',
        details: { violations },
        ruleSpecifier: 'comprehensive-standards',
        ruleData: {
          name: 'comprehensive-standards',
          category: 'maintainability',
          description: 'Comprehensive standards across the workspace',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 7,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  comprehensive-standards - maintainability | medium severity | status: enforced
         │
         🌐  Workspace
         │    ▲ Workspace configuration issue
         │
         ◼  shared-utils
         │    ▲ Missing proper imports
         │    - libs/shared-utils/src/helpers.ts
         │    - libs/shared-utils/src/constants.ts
         │
         ◼  web-app
         │    ▲ Invalid export pattern
         │    - apps/web-app/src/main.ts
         │
         ◼  api-server
         │    ▲ Missing required target
         │
         │
         -  .github/workflows/ci.yml
         │    ▲ Workflow configuration issue
         │
         -  README.md
         └    ▲ Missing license header"
      `);
    });

    it('should handle project-only violations', () => {
      const violations: ConformanceViolation[] = [
        {
          message: 'Missing required configuration',
          sourceProject: 'api-lib',
        },
        {
          message: 'Invalid project structure',
          sourceProject: 'ui-lib',
        },
        {
          message: 'Missing required configuration',
          sourceProject: 'utils-lib',
        },
      ];

      const result = {
        severity: 'high',
        details: { violations },
        ruleSpecifier: 'project-config-rule',
        ruleData: {
          name: 'project-config-rule',
          category: 'reliability',
          description: 'Project configuration requirements',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 3,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  project-config-rule - reliability | high severity | status: enforced
         │
         ◼  api-lib
         │    ✘ Missing required configuration
         │
         ◼  ui-lib
         │    ✘ Invalid project structure
         │
         ◼  utils-lib
         │    ✘ Missing required configuration
         └"
      `);
    });

    it('should handle file-only violations', () => {
      const violations: ConformanceViolation[] = [
        {
          message: 'File naming convention violation',
          file: 'libs/my-lib/src/BadFileName.ts',
        },
        {
          message: 'Missing file header',
          file: 'apps/my-app/src/component.tsx',
        },
        {
          message: 'Workflow issue',
          file: '.github/workflows/deploy.yml',
        },
      ];

      const result = {
        severity: 'low',
        details: { violations },
        ruleSpecifier: 'file-standards',
        ruleData: {
          name: 'file-standards',
          category: 'consistency',
          description: 'File naming and content standards',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 3,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  file-standards - consistency | low severity | status: enforced
         │
         -  libs/my-lib/src/BadFileName.ts
         │    ● File naming convention violation
         │
         -  apps/my-app/src/component.tsx
         │    ● Missing file header
         │
         -  .github/workflows/deploy.yml
         └    ● Workflow issue"
      `);
    });

    it('should handle project+file violations grouped by project and message', () => {
      const violations: ConformanceViolation[] = [
        {
          message: 'Missing imports',
          file: 'libs/shared/src/utils.ts',
          sourceProject: 'shared',
        },
        {
          message: 'Missing imports',
          file: 'libs/shared/src/helpers.ts',
          sourceProject: 'shared',
        },
        {
          message: 'Wrong export style',
          file: 'libs/shared/src/index.ts',
          sourceProject: 'shared',
        },
        {
          message: 'Missing imports',
          file: 'apps/web/src/main.ts',
          sourceProject: 'web',
        },
      ];

      const result = {
        severity: 'medium',
        details: { violations },
        ruleSpecifier: 'import-export-standards',
        ruleData: {
          name: 'import-export-standards',
          category: 'maintainability',
          description: 'Import and export standards',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 4,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  import-export-standards - maintainability | medium severity | status: enforced
         │
         ◼  shared
         │    ▲ Missing imports
         │    - libs/shared/src/utils.ts
         │    - libs/shared/src/helpers.ts
         │
         │    ▲ Wrong export style
         │    - libs/shared/src/index.ts
         │
         ◼  web
         │    ▲ Missing imports
         └    - apps/web/src/main.ts"
      `);
    });

    it('should handle standalone message violations', () => {
      const violations: ConformanceViolation[] = [
        {
          message: 'Workspace configuration is invalid',
          workspaceViolation: true,
        },
        {
          message: 'Missing required global settings',
          workspaceViolation: true,
        },
      ];

      const result = {
        severity: 'high',
        details: { violations },
        ruleSpecifier: 'workspace-config',
        ruleData: {
          name: 'workspace-config',
          category: 'reliability',
          description: 'Workspace configuration requirements',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 2,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  workspace-config - reliability | high severity | status: enforced
         │
         🌐  Workspace
         │    ✘ Workspace configuration is invalid
         │
         🌐  Workspace
         └    ✘ Missing required global settings"
      `);
    });

    it('should handle empty violations', () => {
      const result = {
        severity: 'low',
        details: { violations: [] as ConformanceViolation[] },
        ruleSpecifier: 'no-issues-rule',
        ruleData: {
          name: 'no-issues-rule',
          category: 'maintainability',
          description: 'A rule with no violations',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 0,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  no-issues-rule - maintainability | low severity | status: enforced
         └  No violations found."
      `);
    });

    it('should handle workspace violations with distinct styling', () => {
      const violations: ConformanceViolation[] = [
        {
          message: 'Missing workspace configuration file',
          workspaceViolation: true,
        },
        {
          message: 'Invalid global settings detected',
          workspaceViolation: true,
        },
      ];

      const result = {
        severity: 'high',
        details: { violations },
        ruleSpecifier: 'workspace-config',
        ruleData: {
          name: 'workspace-config',
          category: 'reliability',
          description: 'Workspace configuration requirements',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 2,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  workspace-config - reliability | high severity | status: enforced
         │
         🌐  Workspace
         │    ✘ Missing workspace configuration file
         │
         🌐  Workspace
         └    ✘ Invalid global settings detected"
      `);
    });

    it('should handle mixed violations with workspace, project, and file violations', () => {
      const violations: ConformanceViolation[] = [
        // Workspace violations (should appear first)
        {
          message: 'Workspace missing required configuration',
          workspaceViolation: true,
        },
        // Project + file violations (grouped by project)
        {
          message: 'Missing proper imports',
          file: 'libs/shared-utils/src/helpers.ts',
          sourceProject: 'shared-utils',
        },
        {
          message: 'Invalid export pattern',
          file: 'apps/web-app/src/main.ts',
          sourceProject: 'web-app',
        },
        // Project-only violations
        {
          message: 'Missing required target',
          sourceProject: 'api-server',
        },
        // File-only violations (ungrouped)
        {
          message: 'Configuration issue',
          file: '.github/workflows/ci.yml',
        },
        // Another workspace violation
        {
          message: 'Global dependency issue',
          workspaceViolation: true,
        },
      ];

      const result = {
        severity: 'medium',
        details: { violations },
        ruleSpecifier: 'comprehensive-standards',
        ruleData: {
          name: 'comprehensive-standards',
          category: 'maintainability',
          description: 'Comprehensive standards across the workspace',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 6,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 0,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  comprehensive-standards - maintainability | medium severity | status: enforced
         │
         🌐  Workspace
         │    ▲ Workspace missing required configuration
         │
         🌐  Workspace
         │    ▲ Global dependency issue
         │
         ◼  shared-utils
         │    ▲ Missing proper imports
         │    - libs/shared-utils/src/helpers.ts
         │
         ◼  web-app
         │    ▲ Invalid export pattern
         │    - apps/web-app/src/main.ts
         │
         ◼  api-server
         │    ▲ Missing required target
         │
         │
         -  .github/workflows/ci.yml
         └    ▲ Configuration issue"
      `);
    });
  });

  describe('multiple rule results', () => {
    it('should handle real world data from nx cloud conformance rules', () => {
      const ruleResults: TestRuleResult[] = [
        {
          severity: 'high',
          details: {
            violations: [
              {
                sourceProject: 'linux-arm-gnueabihf',
                message: 'This is an example of a conformance rule violation',
              },
            ],
          },
          ruleSpecifier: 'nx-cloud:nx-cloud--example-failing-conformance-rule',
          ruleData: {
            name: 'nx-cloud:nx-cloud--example-failing-conformance-rule',
            category: 'consistency',
            description:
              'An example failing conformance rule generated by Nx Cloud',
            reporter: 'project-reporter',
          },
          resolvedStatus: 'evaluated',
          runnerData: {
            status: 'evaluated',
            scheduledStatus: null,
            scheduledStatusDate: null,
            fixGeneratorStatus: 'no-fix-generator',
            countOfOriginalViolations: 1,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects: 0,
            executionTimeMs: 0,
          },
        },
        {
          severity: 'high',
          details: {
            violations: [],
          },
          ruleSpecifier:
            '@nx/workspace-plugin/conformance-rules/blog-description',
          ruleData: {
            name: 'blog-description',
            category: 'consistency',
            description:
              'Ensures that markdown documentation files have a description in their frontmatter',
            reporter: 'project-files-reporter',
          },
          resolvedStatus: 'enforced',
          runnerData: {
            status: 'enforced',
            scheduledStatus: null,
            scheduledStatusDate: null,
            fixGeneratorStatus: 'no-fix-generator',
            countOfOriginalViolations: 0,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects: 0,
            executionTimeMs: 0,
          },
        },
        {
          severity: 'low',
          details: {
            violations: [],
          },
          ruleSpecifier:
            '@nx/workspace-plugin/conformance-rules/blog-cover-image',
          ruleData: {
            name: 'blog-cover-image',
            category: 'consistency',
            description:
              'Ensures that blog posts have a cover_image defined in avif or jpg format with appropriate fallbacks',
            reporter: 'project-files-reporter',
          },
          resolvedStatus: 'enforced',
          runnerData: {
            status: 'enforced',
            scheduledStatus: null,
            scheduledStatusDate: null,
            fixGeneratorStatus: 'no-fix-generator',
            countOfOriginalViolations: 0,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects: 0,
            executionTimeMs: 0,
          },
        },
        {
          severity: 'medium',
          details: {
            violations: [],
          },
          ruleSpecifier:
            '@nx/workspace-plugin/conformance-rules/project-package-json',
          ruleData: {
            name: 'project-package-json',
            category: 'consistency',
            description:
              'Ensures consistency across our project package.json files within the Nx repo',
            reporter: 'project-files-reporter',
          },
          resolvedStatus: 'enforced',
          runnerData: {
            status: 'enforced',
            scheduledStatus: null,
            scheduledStatusDate: null,
            fixGeneratorStatus: 'no-fix-generator',
            countOfOriginalViolations: 38,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects: 38,
            executionTimeMs: 0,
          },
        },
        {
          severity: 'high',
          details: {
            violations: [],
          },
          ruleSpecifier:
            '@nx/workspace-plugin/conformance-rules/migration-groups',
          ruleData: {
            name: 'migration-groups',
            category: 'consistency',
            description:
              'Ensures that packageJsonUpdates in migrations.json have all packages included from groups. e.g. @typescript-eslint/* packages must be in sync',
            reporter: 'project-files-reporter',
          },
          resolvedStatus: 'enforced',
          runnerData: {
            status: 'enforced',
            scheduledStatus: null,
            scheduledStatusDate: null,
            fixGeneratorStatus: 'no-fix-generator',
            countOfOriginalViolations: 0,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects: 0,
            executionTimeMs: 0,
          },
        },
      ];

      terminalReporter({ ruleResults });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  nx-cloud:nx-cloud--example-failing-conformance-rule - consistency | high severity | status: evaluated
         │
         ◼  linux-arm-gnueabihf
         │    ✘ This is an example of a conformance rule violation
         └

         ┌  blog-description - consistency | high severity | status: enforced
         └  No violations found.

         ┌  blog-cover-image - consistency | low severity | status: enforced
         └  No violations found.

         ┌  project-package-json - consistency | medium severity | status: enforced
         └  No violations found.

         ┌  migration-groups - consistency | high severity | status: enforced
         └  No violations found."
      `);
    });
  });

  describe('execution time', () => {
    it('should handle execution time for no violations', () => {
      const result = {
        severity: 'low',
        details: { violations: [] as ConformanceViolation[] },
        ruleSpecifier: 'no-issues-rule',
        ruleData: {
          name: 'no-issues-rule',
          category: 'maintainability',
          description: 'A rule with no violations',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 0,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 123,
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  no-issues-rule - maintainability | low severity | status: enforced (123ms)
         └  No violations found."
      `);
    });

    it('should handle execution time for violations', () => {
      const result = {
        severity: 'low',
        details: {
          violations: [
            { message: 'Violation', sourceProject: 'project' },
          ] as ConformanceViolation[],
        },
        ruleSpecifier: 'violation-rule',
        ruleData: {
          name: 'violation-rule',
          category: 'maintainability',
          description: 'A rule with violations',
        },
        resolvedStatus: 'enforced',
        runnerData: {
          status: 'enforced',
          scheduledStatus: null,
          scheduledStatusDate: null,
          fixGeneratorStatus: 'no-fix-generator',
          countOfOriginalViolations: 0,
          countOfViolationsFixedByGenerator: 0,
          countOfViolationsFilteredByProjects: 0,
          executionTimeMs: 1500, // more than 1000ms, should be in seconds
        },
      } as const;

      terminalReporter({ ruleResults: [result] });

      const output = stripVTControlCharacters(consoleOutput.join('\n'));
      expect(output).toMatchInlineSnapshot(`
        " ┌  violation-rule - maintainability | low severity | status: enforced (1.50s)
         │
         ◼  project
         │    ● Violation
         └"
      `);
    });
  });
});
