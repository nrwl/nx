import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './require-windows-hide';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

ruleTester.run(RULE_NAME, rule, {
  valid: [
    // spawn with windowsHide: true
    `import { spawn } from 'child_process';
     spawn('echo', ['hello'], { stdio: 'inherit', windowsHide: true });`,
    // fork with windowsHide: true
    `import { fork } from 'child_process';
     fork('script.js', { stdio: 'inherit', windowsHide: true });`,
    // execSync with windowsHide: true
    `import { execSync } from 'child_process';
     execSync('echo hello', { windowsHide: true });`,
    // spawnSync with windowsHide: true
    `import { spawnSync } from 'child_process';
     spawnSync('echo', ['hello'], { windowsHide: true });`,
    // Not a spawn function, should not report
    `someOtherFunction({ stdio: 'inherit' });`,
    // Test file should be ignored
    {
      code: `import { spawn } from 'child_process';
             spawn('echo', ['hello'], { stdio: 'inherit' });`,
      filename: 'some-file.spec.ts',
    },
  ],
  invalid: [
    // spawn missing windowsHide
    {
      code: `import { spawn } from 'child_process';
             spawn('echo', ['hello'], { stdio: 'inherit' });`,
      errors: [{ messageId: 'missingWindowsHide' }],
    },
    // spawn with windowsHide: false
    {
      code: `import { spawn } from 'child_process';
             spawn('echo', ['hello'], { stdio: 'inherit', windowsHide: false });`,
      errors: [{ messageId: 'windowsHideMustBeTrue' }],
    },
    // fork missing windowsHide
    {
      code: `import { fork } from 'child_process';
             fork('script.js', { stdio: ['inherit', 'pipe', 'pipe', 'ipc'] });`,
      errors: [{ messageId: 'missingWindowsHide' }],
    },
    // execSync missing windowsHide
    {
      code: `import { execSync } from 'child_process';
             execSync('echo hello', { encoding: 'utf-8' });`,
      errors: [{ messageId: 'missingWindowsHide' }],
    },
    // Member expression: child_process.spawn
    {
      code: `import * as cp from 'child_process';
             cp.spawn('echo', ['hello'], { stdio: 'inherit' });`,
      errors: [{ messageId: 'missingWindowsHide' }],
    },
  ],
});
