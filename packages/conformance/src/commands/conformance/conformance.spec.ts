import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  createProjectGraphAsync: vi.fn(async () => ({ nodes: {}, dependencies: {} })),
  writeJsonFile: vi.fn(),
}));

vi.mock('@nx/devkit/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit/internal')>()),
  flushChanges: vi.fn(),
  handleErrors: async (_verbose: boolean, fn: () => Promise<number>) => fn(),
  readFileMapCache: vi.fn(() => ({ fileMap: { projectFileMap: {} } })),
  readNxJsonFromDisk: vi.fn(() => ({
    conformance: {
      outputPath: false,
      rules: [
        { rule: 'my-rule', projects: ['a'] },
        { rule: 'my-rule', projects: ['b'], status: 'evaluated' },
      ],
    },
  })),
}));

vi.mock('../../terminal-reporter', () => ({ terminalReporter: vi.fn() }));

vi.mock('../../resolve-rule', () => ({
  resolveRule: vi.fn(async ({ rule, projects, status }) => ({
    error: null,
    data: { ruleSpecifier: rule, projects, status },
  })),
}));

vi.mock('../../rules-runner', () => ({
  conformanceRulesRunner: vi.fn(async ({ loadedRules }) => ({
    ruleResults: loadedRules.map(({ status }) => {
      const resolvedStatus = status ?? 'enforced';
      return {
        severity: 'high',
        details: { violations: [{ message: 'violation', sourceProject: 'a' }] },
        ruleData: { name: 'my-rule' },
        resolvedStatus,
        runnerData: {
          status: resolvedStatus,
          countOfOriginalViolations: 1,
          countOfViolationsFilteredByProjects: 0,
        },
      };
    }),
  })),
}));

import { conformanceHandler } from './conformance';

describe('conformanceHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should keep the result of each configuration of a rule listed twice after fixes are applied', async () => {
    expect(await conformanceHandler({}, true)).toBe(1);
  });
});
