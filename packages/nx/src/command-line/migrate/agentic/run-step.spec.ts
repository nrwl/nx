jest.mock('./runner', () => ({ runAgentic: jest.fn() }));
jest.mock('./registry', () => ({ getAgentDefinition: jest.fn() }));
jest.mock('./handoff', () => ({
  ...jest.requireActual('./handoff'),
  mkdirSafely: jest.fn(),
}));
jest.mock('../migrate-output', () => ({
  resetTerminalAfterAgent: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn() },
}));
jest.mock('../../../utils/package-manager', () => ({
  detectPackageManager: jest.fn().mockReturnValue('npm'),
  getPackageManagerCommand: jest.fn().mockReturnValue({ exec: 'npx' }),
}));
jest.mock('../../../utils/child-process', () => ({
  getRunNxBaseCommand: jest.fn().mockReturnValue('npx nx'),
}));

import { runAgentic } from './runner';
import { getAgentDefinition } from './registry';
import { runAgenticPromptStep } from './run-step';
import {
  DetectedInstalledAgent,
  EnabledResolvedAgentic,
  HandoffOutcome,
} from './types';

const mockRunAgentic = runAgentic as jest.Mock;
const mockGetDefinition = getAgentDefinition as jest.Mock;

function makeAgentic(): EnabledResolvedAgentic {
  const detected: DetectedInstalledAgent = {
    id: 'claude-code',
    displayName: 'Claude Code',
    binary: '/usr/local/bin/claude',
    source: 'path',
  };
  return { kind: 'enabled', selectedAgent: detected };
}

function makeMigration() {
  return {
    package: '@nx/test',
    name: 'm1',
    version: '20.0.0',
    description: 'migrates stuff',
    prompt: 'prompts/m1.md',
  };
}

function configureRun(outcome: HandoffOutcome) {
  mockGetDefinition.mockReturnValue({
    id: 'claude-code',
    displayName: 'Claude Code',
    binaryNames: ['claude'],
    wellKnownPaths: () => [],
    buildInteractive: () => ({ args: [], cwd: '/ws' }),
  });
  mockRunAgentic.mockResolvedValue(outcome);
}

describe('runAgenticPromptStep', () => {
  let installDeps: jest.Mock;

  beforeEach(() => {
    mockRunAgentic.mockReset();
    mockGetDefinition.mockReset();
    // Clear mocks that are created at jest.mock(...) factory time so
    // assertions about call counts / call args don't see leakage from
    // earlier tests in the file. `mockReset` would wipe the factory
    // return value (`detectPackageManager` etc. would start returning
    // undefined), so use `mockClear` to wipe only the call history.
    const { logger } = jest.requireMock('../../../utils/logger') as {
      logger: { info: jest.Mock };
    };
    logger.info.mockClear();
    const { mkdirSafely } = jest.requireMock('./handoff') as {
      mkdirSafely: jest.Mock;
    };
    mkdirSafely.mockClear();
    installDeps = jest.fn().mockResolvedValue(undefined);
  });

  it('returns the agent summary and calls installDeps on success', async () => {
    configureRun({ kind: 'success', summary: 'applied changes' });

    const result = await runAgenticPromptStep({
      root: '/ws',
      migration: makeMigration(),
      agentic: makeAgentic(),
      runDir: '/ws/.nx/migrate-runs/20.0.0',
      installDepsIfChanged: installDeps,
    });

    expect(result).toEqual({ summary: 'applied changes', ambiguous: false });
    expect(installDeps).toHaveBeenCalledTimes(1);
  });

  it('returns ambiguous=true with a placeholder summary on ambiguous-continue, and still installs deps', async () => {
    configureRun({ kind: 'ambiguous-continue' });

    const result = await runAgenticPromptStep({
      root: '/ws',
      migration: makeMigration(),
      agentic: makeAgentic(),
      runDir: '/ws/.nx/migrate-runs/20.0.0',
      installDepsIfChanged: installDeps,
    });

    expect(result.ambiguous).toBe(true);
    expect(result.summary).toContain('marked complete by user');
    expect(installDeps).toHaveBeenCalledTimes(1);
  });

  it('throws on failed without installing deps (no successful change to act on)', async () => {
    configureRun({ kind: 'failed', summary: 'agent reported failure' });

    await expect(
      runAgenticPromptStep({
        root: '/ws',
        migration: makeMigration(),
        agentic: makeAgentic(),
        runDir: '/ws/.nx/migrate-runs/20.0.0',
        installDepsIfChanged: installDeps,
      })
    ).rejects.toThrow('@nx/test: m1 failed');
    expect(installDeps).not.toHaveBeenCalled();
  });

  it('throws "aborted by user" on ambiguous-abort without installing deps', async () => {
    configureRun({ kind: 'ambiguous-abort' });

    await expect(
      runAgenticPromptStep({
        root: '/ws',
        migration: makeMigration(),
        agentic: makeAgentic(),
        runDir: '/ws/.nx/migrate-runs/20.0.0',
        installDepsIfChanged: installDeps,
      })
    ).rejects.toThrow('aborted by user');
    expect(installDeps).not.toHaveBeenCalled();
  });

  it('uses "Validation failed" labeling in generic-validation mode failures', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    configureRun({ kind: 'failed', summary: 'tests failed' });

    await expect(
      runAgenticPromptStep({
        root: '/ws',
        migration: makeMigration(),
        agentic: makeAgentic(),
        runDir: '/ws/.nx/migrate-runs/20.0.0',
        installDepsIfChanged: installDeps,
        mode: 'generic-validation',
        implContext: {
          logs: '',
          changes: [],
          agentContext: [],
          hasDiffContext: true,
        },
      })
    ).rejects.toThrow();
    const messages = (logger.info as jest.Mock).mock.calls
      .map((c) => String(c[0]))
      .join('\n');
    expect(messages).toContain('Validation failed: tests failed');
  });

  it('throws an internal error when generic-validation mode runs without impl context', async () => {
    configureRun({ kind: 'success', summary: 'ok' });

    await expect(
      runAgenticPromptStep({
        root: '/ws',
        migration: makeMigration(),
        agentic: makeAgentic(),
        runDir: '/ws/.nx/migrate-runs/20.0.0',
        installDepsIfChanged: installDeps,
        mode: 'generic-validation',
      })
    ).rejects.toThrow('generic-validation mode requires impl context');
    expect(mockRunAgentic).not.toHaveBeenCalled();
  });
});
