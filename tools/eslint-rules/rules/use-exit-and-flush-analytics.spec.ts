import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './use-exit-and-flush-analytics';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

ruleTester.run(RULE_NAME, rule, {
  valid: [
    // File outside packages/nx/src/ should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/other/src/index.ts',
    },
    // Spec file should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/command-line/run/run.spec.ts',
    },
    // analytics.ts (the implementation itself) should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/analytics/analytics.ts',
    },
    // analytics-processor.ts should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/analytics/analytics-processor.ts',
    },
    // fork.ts should not report
    {
      code: `process.exit(1);`,
      filename: 'packages/nx/src/tasks-runner/fork.ts',
    },
    // run-batch.ts should not report
    {
      code: `process.exit(1);`,
      filename: 'packages/nx/src/tasks-runner/batch/run-batch.ts',
    },
    // plugin-worker.ts should not report
    {
      code: `process.exit(1);`,
      filename:
        'packages/nx/src/project-graph/plugins/isolation/plugin-worker.ts',
    },
    // daemon server should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/daemon/server/main.ts',
    },
    // run-migration-process.js should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/command-line/migrate/run-migration-process.js',
    },
    // running-tasks.ts should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/executors/run-commands/running-tasks.ts',
    },
    // run-script.impl.ts should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/executors/run-script/run-script.impl.ts',
    },
    // assert-supported-platform.ts should not report
    {
      code: `process.exit(1);`,
      filename: 'packages/nx/src/native/assert-supported-platform.ts',
    },
    // nxw.ts should not report
    {
      code: `process.exit(0);`,
      filename:
        'packages/nx/src/command-line/init/implementation/dot-nx/nxw.ts',
    },
    // git-utils.index-filter.ts should not report
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/utils/git-utils.index-filter.ts',
    },
    // Using exitAndFlushAnalytics is valid
    {
      code: `exitAndFlushAnalytics(0);`,
      filename: 'packages/nx/src/command-line/run/command-object.ts',
    },
    // Just accessing process.exit without calling it should not report
    {
      code: `const fn = process.exit;`,
      filename: 'packages/nx/src/command-line/run/command-object.ts',
    },
  ],
  invalid: [
    // process.exit(0) in a command-object file within packages/nx/src/
    {
      code: `process.exit(0);`,
      filename: 'packages/nx/src/command-line/run/command-object.ts',
      errors: [{ messageId: 'useExitAndFlushAnalytics' }],
    },
    // process.exit(1) in a task-runner file within packages/nx/src/
    {
      code: `process.exit(1);`,
      filename: 'packages/nx/src/tasks-runner/run-command.ts',
      errors: [{ messageId: 'useExitAndFlushAnalytics' }],
    },
    // process.exit() with no arguments
    {
      code: `process.exit();`,
      filename: 'packages/nx/src/command-line/nx-commands.ts',
      errors: [{ messageId: 'useExitAndFlushAnalytics' }],
    },
    // process.exit in handler callback
    {
      code: `
        const cmd = {
          handler: async (args) => {
            process.exit(0);
          },
        };
      `,
      filename: 'packages/nx/src/command-line/init/init.ts',
      errors: [{ messageId: 'useExitAndFlushAnalytics' }],
    },
  ],
});
