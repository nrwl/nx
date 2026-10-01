import { formatUltracacheSummary } from './report';
import type { UltracacheReport } from '../native';

const resolution = {
  requestedCommit: 'abc123',
  fetchedAt: 0,
  tasks: 3,
};

describe('formatUltracacheSummary', () => {
  it('counts used tasks and groups fallbacks by reason', () => {
    const result: UltracacheReport = {
      used: ['a:build', 'b:build'],
      diagnostics: [
        { reason: 'disabled', taskId: 'c:e2e' },
        { reason: 'autofix-disabled', taskId: 'h:deploy' },
        { reason: 'missing', taskId: 'd:test' },
        { reason: 'missing', taskId: 'e:test' },
        { reason: 'invalid-glob', taskId: 'f:lint', glob: 'libs/./x.ts' },
        { reason: 'escapes-workspace', taskId: 'g:build', glob: '../x/**' },
      ],
      resolution,
    };
    const summary = formatUltracacheSummary(result, 'cached');
    expect(summary.line).toBe(
      'Ultracache: 2 tasks hashed from their configuration, 6 tasks fell back (2 missing, 1 autofix-disabled, 1 disabled, 1 escapes-workspace, 1 invalid-glob)'
    );
    expect(summary.bodyLines).toEqual([
      'configuration: cached',
      'commit abc123, 3 tasks in configuration',
      'c:e2e: ultracache.mode is off',
      'h:deploy: ultracache.mode is not on',
      'd:test: no Ultracache configuration for this task',
      'e:test: no Ultracache configuration for this task',
      'f:lint: configuration glob "libs/./x.ts" is not a valid files glob',
      'g:build: configuration glob "../x/**" escapes the workspace',
    ]);
  });

  it('says none were used when the configuration could not be read', () => {
    expect(
      formatUltracacheSummary(
        {
          used: [],
          diagnostics: [{ reason: 'unreadable-set', message: 'bad' }],
          resolution,
        },
        'cached'
      ).line
    ).toBe('Ultracache: none used (unreadable configuration: bad)');
  });
});
