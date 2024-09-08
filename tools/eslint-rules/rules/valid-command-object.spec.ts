import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './valid-command-object';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

ruleTester.run(RULE_NAME, rule, {
  valid: [
    // Not a command object file, so should not report
    `module.exports = {
      description: 'My command',
    }`,
    // Not a command object file, so should not report
    `module.exports = {
      describe: 'My command',
    }`,
    {
      // Already has a . at the end of the description
      code: `module.exports = {
        description: 'My command.',
      }`,
      filename: 'some/path/command-object.ts',
    },
    {
      // Already has a . at the end of the description
      code: `module.exports = {
        describe: 'My command.',
      }`,
      filename: 'another/command-object.ts',
    },
    {
      // Boolean property, so should not report
      code: `module.exports = {
        describe: false,
      };`,
      filename: 'command-object.ts',
    },
  ],
  invalid: [
    // With "describe" and single quotes
    {
      filename: 'some/path/command-object.ts',
      code: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          describe:
            'Ensure that all touched projects have an applicable version plan created for them',
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
      errors: [
        {
          messageId: 'validCommandDescription',
          line: 4,
          column: 11,
        },
      ],
      output: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          describe:
            'Ensure that all touched projects have an applicable version plan created for them.',
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
    },
    // With "description" and backticks
    {
      filename: 'some/path/command-object.ts',
      code: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          description: \`Ensure that all touched projects have an applicable version plan created for them\`,
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
      errors: [
        {
          messageId: 'validCommandDescription',
          line: 4,
          column: 11,
        },
      ],
      output: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          description: \`Ensure that all touched projects have an applicable version plan created for them.\`,
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
    },
    // With "description" and double quotes
    {
      filename: 'some/path/command-object.ts',
      code: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          description: "Ensure that all touched projects have an applicable version plan created for them",
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
      errors: [
        {
          messageId: 'validCommandDescription',
          line: 4,
          column: 11,
        },
      ],
      output: `
        const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
          command: 'plan:check',
          description: "Ensure that all touched projects have an applicable version plan created for them.",
          builder: (yargs) => withAffectedOptions(yargs),
          handler: async (args) => {
            const release = await import('./plan-check');
            const result = await release.releasePlanCheckCLIHandler(args);
            process.exit(result);
          },
        };
      `,
    },
  ],
});
