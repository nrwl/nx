jest.mock('./runner', () => ({ runAgentic: jest.fn() }));
jest.mock('./definitions', () => ({ getAgentDefinition: jest.fn() }));
jest.mock('./handoff', () => ({
  ...jest.requireActual('./handoff'),
  mkdirSafely: jest.fn(),
}));
jest.mock('./instruction-files', () => ({
  writeStepInstructionFiles: jest.fn(),
}));
jest.mock('../migrate-output', () => ({
  resetSgrAfterAgent: jest.fn(),
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
import { getAgentDefinition } from './definitions';
import { writeStepInstructionFiles } from './instruction-files';
import { runAgenticPromptStep } from './run-step';
import {
  DetectedInstalledAgent,
  EnabledResolvedAgentic,
  HandoffOutcome,
} from './types';

const mockRunAgentic = runAgentic as jest.Mock;
const mockGetDefinition = getAgentDefinition as jest.Mock;
const mockWriteInstructionFiles = writeStepInstructionFiles as jest.Mock;

const SYSTEM_PROMPT_FILE = '/ws/.nx/migrate-runs/20.0.0/@nx/test/m1.system.md';
const INSTRUCTIONS_POINTER =
  'Your instructions for this migration step are in the file .nx/migrate-runs/20.0.0/@nx/test/m1.instructions.md';

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
    // mockClear (not mockReset) — mockReset wipes the factory return
    // values set at jest.mock() time, so detectPackageManager etc. would
    // start returning undefined.
    const { logger } = jest.requireMock('../../../utils/logger') as {
      logger: { info: jest.Mock };
    };
    logger.info.mockClear();
    const { mkdirSafely } = jest.requireMock('./handoff') as {
      mkdirSafely: jest.Mock;
    };
    mkdirSafely.mockClear();
    mockWriteInstructionFiles.mockReset();
    mockWriteInstructionFiles.mockReturnValue({
      systemPromptFilePath: SYSTEM_PROMPT_FILE,
      instructionsPointer: INSTRUCTIONS_POINTER,
    });
    installDeps = jest.fn().mockResolvedValue(undefined);
  });

  it('writes both prompts to the run directory and invokes the agent with pointers at them', async () => {
    configureRun({ kind: 'success', summary: 'applied changes' });

    await runAgenticPromptStep({
      root: '/ws',
      migration: makeMigration(),
      agentic: makeAgentic(),
      runDir: '/ws/.nx/migrate-runs/20.0.0',
      installDepsIfChanged: installDeps,
    });

    const written = mockWriteInstructionFiles.mock.calls[0][0];
    expect(written.workspaceRoot).toBe('/ws');
    expect(written.runDir).toBe('/ws/.nx/migrate-runs/20.0.0');
    expect(written.migration).toMatchObject({
      package: '@nx/test',
      name: 'm1',
    });
    expect(written.systemPrompt).toContain('<handoff_contract>');
    expect(written.instructions).toContain('prompts/m1.md');

    const { invocationContext } = mockRunAgentic.mock.calls[0][0];
    expect(invocationContext.systemPromptFilePath).toBe(SYSTEM_PROMPT_FILE);
    expect(invocationContext.instructionsPointer).toBe(INSTRUCTIONS_POINTER);
    expect(invocationContext.systemPrompt).toBe(written.systemPrompt);
    // The inline forms both point at the file; only the full one repeats the
    // handoff contract the agent has to satisfy.
    expect(invocationContext.inlineSystemContext).toContain(SYSTEM_PROMPT_FILE);
    expect(invocationContext.inlineSystemContext).toContain(
      '<handoff_contract>'
    );
    expect(invocationContext.inlineSystemContextFallback).toContain(
      SYSTEM_PROMPT_FILE
    );
    expect(invocationContext.inlineSystemContextFallback).not.toContain(
      '<handoff_contract>'
    );
    expect(invocationContext.inlineSystemContextFallback.length).toBeLessThan(
      invocationContext.inlineSystemContext.length
    );
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
