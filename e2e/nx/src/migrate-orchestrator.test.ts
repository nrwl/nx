import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  getStrippedEnvironmentVariables,
  listFiles,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
  waitUntil,
} from '@nx/e2e-utils';
import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// Mirrors getPackageManagerCommand().exec (nx/src/utils/package-manager.ts).
const PM_EXEC_PREFIX: Record<string, string> = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  bun: 'bun',
};

// CLAUDECODE is the seam nx's agent detection reads.
const AGENT_ENV = { CLAUDECODE: '1' };

// Only init is gated, so only init carries NX_MIGRATE_ORCHESTRATOR; dispensed
// commands re-run with AGENT_ENV alone. The other two keep init off the
// temp-installation path.
const INIT_ENV = {
  ...AGENT_ENV,
  NX_MIGRATE_ORCHESTRATOR: 'true',
  NX_MIGRATE_USE_LOCAL: 'true',
  NX_MIGRATE_SKIP_INSTALL: 'true',
};

const PKG = 'migrate-orch-package';

interface DispenseBlock {
  runId: string;
  step: string;
  action: string;
  payload: { command?: string; next?: string; instructions?: string };
}

interface RunStateFile {
  status: string;
  steps: {
    id: string;
    migrationId: string;
    status: string;
    attempt: number;
    pid?: number;
    gitRefBefore?: string;
  }[];
  commits: {
    kind: string;
    sha?: string;
    stepIds: string[];
    issueIds?: string[];
  }[];
  issues?: {
    id: string;
    summary: string;
    disposition: string;
    claimedByStepId?: string;
  }[];
}

function parseLastDispense(output: string): DispenseBlock {
  const re =
    /<nx_migrate_step run-id="([^"]*)" step="([^"]*)" action="([^"]*)">\n([\s\S]*?)\n<\/nx_migrate_step>/g;
  let match: RegExpExecArray | null;
  let last: DispenseBlock | null = null;
  while ((match = re.exec(output)) !== null) {
    last = {
      runId: match[1],
      step: match[2],
      action: match[3],
      payload: JSON.parse(match[4]),
    };
  }
  if (!last) {
    throw new Error(`No <nx_migrate_step> block found in output:\n${output}`);
  }
  return last;
}

function parseRunbookBlock(output: string): { runId: string; content: string } {
  const match = output.match(
    /<nx_migrate_runbook run-id="([^"]*)">\n([\s\S]*?)\n<\/nx_migrate_runbook>/
  );
  if (!match) {
    throw new Error(
      `No <nx_migrate_runbook> block found in output:\n${output}`
    );
  }
  return { runId: match[1], content: match[2] };
}

// Init responses are runbook-only: one step block, no dispensed work. Tags are
// matched with attributes because the runbook prose names them bare.
function expectRunbookOnlyResponse(output: string): void {
  expect(output.match(/<nx_migrate_step run-id=/g)).toHaveLength(1);
  expect(output).not.toContain('<nx_migrate_prompt migration=');
}

interface PromptBlock {
  migration: string;
  payload: {
    migrationId: string;
    kind?: string;
    prompt?: string;
    impl?: {
      logs: string;
      changes: { type: string; path: string }[];
      agentContext?: string[];
    };
  };
}

function parseLastPromptBlock(output: string): PromptBlock {
  const re =
    /<nx_migrate_prompt migration="([^"]*)">\n([\s\S]*?)\n<\/nx_migrate_prompt>/g;
  let match: RegExpExecArray | null;
  let last: PromptBlock | null = null;
  while ((match = re.exec(output)) !== null) {
    last = { migration: match[1], payload: JSON.parse(match[2]) };
  }
  if (!last) {
    throw new Error(`No <nx_migrate_prompt> block found in output:\n${output}`);
  }
  return last;
}

// Strips the `<pm exec>` prefix so the rest runs through runCLI. The shape
// check matters: anything before the prefix is not executable as-is on Windows.
function dispensedArgs(command: string): string {
  const tokens = command.split(' ');
  const execTokens = PM_EXEC_PREFIX[getSelectedPackageManager()].split(' ');
  const prefixMatches = execTokens.every((t, i) => tokens[i] === t);
  if (!prefixMatches || tokens[execTokens.length] !== 'nx') {
    throw new Error(`Unexpected dispensed command shape: ${command}`);
  }
  return tokens.slice(execTokens.length + 1).join(' ');
}

function runDispensed(command: string): string {
  return runCLI(dispensedArgs(command), { env: AGENT_ENV });
}

// A step whose generator may still run gets no `next`; the fake agent picks.
function stepActionCommand(runId: string, action: string): string {
  return `${
    PM_EXEC_PREFIX[getSelectedPackageManager()]
  } nx migrate --run-id=${runId} --step-action=${action}`;
}

function handoffPathFrom(block: DispenseBlock): string {
  const match = block.payload.instructions.match(/^Handoff file: (.+)$/m);
  if (!match) {
    throw new Error(
      `No handoff path in await-prompt instructions:\n${block.payload.instructions}`
    );
  }
  return match[1];
}

function writeHandoff(block: DispenseBlock, handoff: object | string): void {
  const handoffPath = handoffPathFrom(block);
  // The runbook promises the parent directory already exists when a step
  // names the path; creating it here would mask a regression of that promise.
  expect(existsSync(dirname(handoffPath))).toBe(true);
  writeFileSync(
    handoffPath,
    typeof handoff === 'string' ? handoff : JSON.stringify(handoff)
  );
}

// The fake agent; the cap turns an endless loop into a failure.
function driveToComplete(output: string, maxDispenses = 25): DispenseBlock {
  let block = parseLastDispense(output);
  let dispenses = 0;
  while (block.action !== 'complete') {
    if (++dispenses > maxDispenses) {
      throw new Error(
        `Fake agent did not complete after ${maxDispenses} dispenses; last action was '${block.action}'.`
      );
    }
    if (block.action === 'next-step') {
      runDispensed(block.payload.command);
    } else if (block.action === 'await-prompt') {
      // So the fold has something to commit.
      updateFile(`applied-${block.step}.txt`, 'applied by fake agent');
      writeHandoff(block, {
        status: 'success',
        summary: 'applied by fake agent',
      });
    } else {
      throw new Error(
        `Fake agent cannot handle dispense action '${block.action}':\n${JSON.stringify(
          block.payload
        )}`
      );
    }
    block = parseLastDispense(runDispensed(block.payload.next));
  }
  return block;
}

function readRunStateFile(runId: string): RunStateFile | null {
  try {
    return readJson<RunStateFile>(`.nx/migrate-runs/${runId}/run.json`);
  } catch {
    return null;
  }
}

function setupMigrationPackage(): void {
  updateFile(
    `./node_modules/${PKG}/package.json`,
    JSON.stringify({
      name: PKG,
      version: '1.0.0',
      'nx-migrations': './migrations.json',
    })
  );
  updateFile(
    `./node_modules/${PKG}/migrations.json`,
    JSON.stringify({
      generators: {
        'gen-mig': { version: '1.0.0', implementation: './gen-mig' },
        'gen-two': { version: '1.1.0', implementation: './gen-two' },
        'hybrid-mig': { version: '1.3.0', implementation: './hybrid-mig' },
        'waiver-mig': { version: '1.1.5', implementation: './waiver-mig' },
        'slow-mig': { version: '1.0.0', implementation: './slow-mig' },
      },
    })
  );
  // Logs and agent context must survive the park and re-emission.
  updateFile(
    `./node_modules/${PKG}/gen-mig.js`,
    `
      exports.default = function (host) {
        host.write('gen-file', 'gen-content');
        console.log('gen-mig log line');
        return { agentContext: ['gen-mig context note'] };
      };
      `
  );
  updateFile(
    `./node_modules/${PKG}/gen-two.js`,
    `
      exports.default = function (host) {
        host.write('gen-two-file', 'gen-two-content');
      };
      `
  );
  // Must reach the hybrid's prompt payload even with validation off.
  updateFile(
    `./node_modules/${PKG}/hybrid-mig.js`,
    `
      exports.default = function (host) {
        host.write('hybrid-file', 'hybrid-content');
        console.log('hybrid-mig log line');
        return { agentContext: ['hybrid-mig context note'] };
      };
      `
  );
  // Waives the AI step: the prompt half must not be handed back.
  updateFile(
    `./node_modules/${PKG}/waiver-mig.js`,
    `
      exports.default = function (host) {
        host.write('waiver-file', 'waiver-content');
        return { skipAgentic: true };
      };
      `
  );
  // Writes through fs so the change lands before the kill (tree writes flush
  // only after the generator returns). The marker survives `git clean -fd`
  // (node_modules is gitignored), so a retried attempt returns instead of
  // blocking.
  updateFile(
    `./node_modules/${PKG}/slow-mig.js`,
    `
      const { existsSync, writeFileSync } = require('fs');
      const { join } = require('path');
      exports.default = function (host) {
        writeFileSync(join(host.root, 'slow-file'), 'slow-content');
        const marker = join(host.root, 'node_modules', '.slow-mig-ran');
        if (!existsSync(marker)) {
          writeFileSync(marker, '1');
          const end = Date.now() + 600000;
          while (Date.now() < end) {}
        }
      };
      `
  );
}

function writePlan(migrations: Record<string, unknown>[]): void {
  updateFile('migrations.json', JSON.stringify({ migrations }));
}

const genMig = { package: PKG, name: 'gen-mig', version: '1.0.0' };
const genTwoMig = { package: PKG, name: 'gen-two', version: '1.1.0' };
const promptMig = {
  package: PKG,
  name: 'prompt-mig',
  version: '1.2.0',
  prompt: 'prompts/prompt-mig.md',
};
const promptTwoMig = {
  package: PKG,
  name: 'prompt-two',
  version: '1.5.0',
  prompt: 'prompts/prompt-two.md',
};
const promptThreeMig = {
  package: PKG,
  name: 'prompt-three',
  version: '1.6.0',
  prompt: 'prompts/prompt-three.md',
};
const hybridMig = {
  package: PKG,
  name: 'hybrid-mig',
  version: '1.3.0',
  implementation: './hybrid-mig',
  prompt: 'prompts/hybrid-mig.md',
};
// Below prompt-mig: the plan is sorted by version and the waiver runs first.
const waiverMig = {
  package: PKG,
  name: 'waiver-mig',
  version: '1.1.5',
  implementation: './waiver-mig',
  prompt: 'prompts/waiver-mig.md',
};
const slowMig = { package: PKG, name: 'slow-mig', version: '1.0.0' };

function runInit(extraArgs = ''): string {
  return runCLI(`migrate --run-migrations=migrations.json${extraArgs}`, {
    env: INIT_ENV,
  });
}

// Init is runbook-only; the first dispense comes from its reconcile `next`.
function reconcileAfterInit(initOutput: string): DispenseBlock {
  const init = parseLastDispense(initOutput);
  expect(init.action).toBe('initialized');
  return parseLastDispense(runDispensed(init.payload.next));
}

function commitCountFor(migrationName: string): number {
  const log = runCommand('git --no-pager log --oneline -n 30');
  return log
    .split('\n')
    .filter((l) => l.includes(`[nx migration] ${migrationName}`)).length;
}

async function killWorkerAndReconcile(initOutput: string): Promise<{
  runId: string;
  diedBlock: DispenseBlock;
  gitRefBefore: string;
}> {
  const dispense = reconcileAfterInit(initOutput);
  expect(dispense.action).toBe('next-step');

  const pmc = getPackageManagerCommand();
  // A handle for `finally`: the worker busy-loops for ten minutes. Env
  // mirrors runCommandAsync.
  const worker = spawn(
    `${pmc.runNxSilent} ${dispensedArgs(dispense.payload.command)}`,
    {
      cwd: tmpProjPath(),
      env: {
        CI: 'true',
        NX_DAEMON: 'true',
        NX_INTERNAL_USE_LEGACY_VERSIONING: 'false',
        ...getStrippedEnvironmentVariables(),
        ...AGENT_ENV,
        FORCE_COLOR: 'false',
      },
      shell: true,
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    }
  );
  const workerExited = new Promise<void>((resolve) =>
    worker.on('exit', () => resolve())
  );

  let pid: number;
  try {
    await waitUntil(
      () => {
        // The marker is written after slow-file; a kill before it leaves a
        // clean tree and a marker-less retry that blocks.
        if (!existsSync(join(tmpProjPath(), 'node_modules', '.slow-mig-ran'))) {
          return false;
        }
        const state = readRunStateFile(dispense.runId);
        const step = state?.steps.find(
          (s) => s.migrationId === `${PKG}:slow-mig`
        );
        if (step?.status === 'running' && step.pid) {
          pid = step.pid;
          return true;
        }
        return false;
      },
      { timeout: 120000, ms: 250 }
    );
    // Inside the hang threshold, still-running never counts toward
    // no-progress: a third identical response would otherwise escalate.
    for (let i = 0; i < 3; i++) {
      const running = parseLastDispense(runDispensed(dispense.payload.next));
      expect(running.action).toBe('still-running');
      expect(running.payload.instructions).toContain('is still running');
    }
    process.kill(pid, 'SIGKILL');
  } finally {
    try {
      if (process.platform === 'win32') {
        worker.kill('SIGKILL');
      } else {
        process.kill(-worker.pid, 'SIGKILL');
      }
    } catch {
      // Already exited.
    }
    await workerExited;
  }

  const state = readRunStateFile(dispense.runId);
  const step = state.steps.find((s) => s.migrationId === `${PKG}:slow-mig`);

  const diedBlock = parseLastDispense(runDispensed(dispense.payload.next));
  return { runId: dispense.runId, diedBlock, gitRefBefore: step.gitRefBefore };
}

describe('migrate orchestrator (dark launch)', () => {
  // A workspace per test: each run leaves run dirs and commits the next
  // test's assertions would see.
  beforeEach(() => {
    newProject({ packages: [] });
    setupMigrationPackage();
  });

  afterEach(() => cleanupProject());

  it('should return the runbook first and drive generator validation, a prompt, and a hybrid to completion', () => {
    // Unsorted on purpose: steps must be ordered by version.
    writePlan([hybridMig, genMig, promptMig]);

    const initOutput = runInit();
    expectRunbookOnlyResponse(initOutput);
    const runbook = parseRunbookBlock(initOutput);
    const init = parseLastDispense(initOutput);
    expect(init.action).toBe('initialized');
    expect(init.step).toBe('-');
    expect(init.runId).toBe(runbook.runId);
    // The initialized block points at the runbook "above": order matters.
    expect(initOutput.indexOf('<nx_migrate_runbook')).toBeLessThan(
      initOutput.indexOf('<nx_migrate_step')
    );
    const execPrefix = PM_EXEC_PREFIX[getSelectedPackageManager()];
    const reconcile = `${execPrefix} nx migrate --run-id=${init.runId}`;
    expect(init.payload.command).toBeUndefined();
    expect(init.payload.next).toBe(reconcile);
    expect(init.payload.instructions).toContain(
      `No migration step ran in this response.`
    );
    expect(existsSync(join(tmpProjPath(), 'gen-file'))).toBe(false);
    expect(
      readRunStateFile(init.runId).steps.every((s) => s.status === 'pending')
    ).toBe(true);
    // Byte-for-byte what was persisted, with the contract's anchors.
    expect(runbook.content).toContain(`# Nx migrate run ${init.runId}`);
    expect(runbook.content).toContain(reconcile);
    expect(runbook.content).toContain(
      `Never infer the run's progress from this conversation.`
    );
    const persisted = readFile(`.nx/migrate-runs/${init.runId}/RUNBOOK.md`);
    expect(runbook.content).toBe(persisted);

    const first = parseLastDispense(runDispensed(reconcile));
    expect(first.action).toBe('next-step');
    expect(first.payload.command).toBe(
      `${execPrefix} nx migrate --run-migration=${PKG}:gen-mig --run-id=${first.runId}`
    );
    expect(first.payload.next).toBe(reconcile);
    expect(first.payload.instructions).toContain(
      `Runbook: .nx/migrate-runs/${first.runId}/RUNBOOK.md`
    );

    const genWorkerOutput = runDispensed(first.payload.command);
    expect(readFile('gen-file')).toEqual('gen-content');
    const genPrompt = parseLastPromptBlock(genWorkerOutput);
    expect(genPrompt.migration).toBe(`${PKG}:gen-mig`);
    expect(genPrompt.payload.kind).toBe('generator-validation');
    expect(genPrompt.payload.impl.changes).toEqual([
      { type: 'CREATE', path: 'gen-file' },
    ]);
    expect(genPrompt.payload.impl.logs).toContain('gen-mig log line');
    expect(genPrompt.payload.impl.agentContext).toEqual([
      'gen-mig context note',
    ]);
    const validationOutput = runDispensed(reconcile);
    const validation = parseLastDispense(validationOutput);
    expect(validation.action).toBe('await-prompt');
    expect(validation.payload.instructions).toContain(
      `Migration ${PKG}:gen-mig ran its generator; its changes are awaiting your validation.`
    );
    // Reconcile re-emits the persisted payload for a restarted session.
    const reemitted = parseLastPromptBlock(validationOutput);
    expect(reemitted.payload.kind).toBe('generator-validation');
    expect(reemitted.payload.impl.changes).toEqual([
      { type: 'CREATE', path: 'gen-file' },
    ]);
    expect(reemitted.payload.impl.logs).toContain('gen-mig log line');
    expect(reemitted.payload.impl.agentContext).toEqual([
      'gen-mig context note',
    ]);
    // No commit yet: the migration lands as one commit at the fold.
    expect(commitCountFor('gen-mig')).toBe(0);
    writeHandoff(validation, {
      status: 'success',
      summary: 'validated by fake agent',
    });

    // A commit failure is only warned, so its absence is asserted first: on a
    // regression the received output names git's reason.
    const foldOutput = runDispensed(reconcile);
    expect(foldOutput).not.toContain('Could not create a commit');
    expect(foldOutput).not.toContain('No changes to commit');
    const second = parseLastDispense(foldOutput);
    expect(second.action).toBe('next-step');
    expect(second.payload.command).toContain(
      `--run-migration=${PKG}:prompt-mig`
    );
    expect(commitCountFor('gen-mig')).toBe(1);

    // Prompt-only: parks and offers skipped (nothing of it is in the tree).
    const promptWorkerOutput = runDispensed(second.payload.command);
    const promptBlock = parseLastPromptBlock(promptWorkerOutput);
    expect(promptBlock.migration).toBe(`${PKG}:prompt-mig`);
    expect(promptBlock.payload.prompt).toBe('prompts/prompt-mig.md');
    const prompt = parseLastDispense(runDispensed(reconcile));
    expect(prompt.action).toBe('await-prompt');
    expect(prompt.payload.instructions).toContain(
      `Migration ${PKG}:prompt-mig is a prompt-based migration awaiting your outcome.`
    );
    expect(prompt.payload.instructions).toContain('"outcome": "skipped"');

    // A restarted master re-enters through init: same-plan init resumes, and
    // the next reconcile restates the parked work.
    const resumeOutput = runInit();
    expectRunbookOnlyResponse(resumeOutput);
    const resumed = parseLastDispense(resumeOutput);
    expect(resumed.action).toBe('initialized');
    expect(resumed.runId).toBe(init.runId);
    expect(resumeOutput).toContain(`resuming run ${init.runId}`);
    expect(resumeOutput).toContain(
      'progress: 1 applied, 0 skipped, 2 remaining'
    );
    expect(parseRunbookBlock(resumeOutput).content).toBe(persisted);
    const reawaitOutput = runDispensed(resumed.payload.next);
    const reawait = parseLastDispense(reawaitOutput);
    expect(reawait.action).toBe('await-prompt');
    expect(parseLastPromptBlock(reawaitOutput).payload.prompt).toBe(
      'prompts/prompt-mig.md'
    );
    updateFile('applied-prompt.txt', 'applied by fake agent');
    writeHandoff(reawait, {
      status: 'success',
      summary: 'applied by fake agent',
    });

    // Hybrid: only the prompt half is handed back; its changes are applied,
    // so no skipped offer.
    const third = parseLastDispense(runDispensed(reconcile));
    expect(third.action).toBe('next-step');
    expect(third.payload.command).toContain(
      `--run-migration=${PKG}:hybrid-mig`
    );
    const hybridWorkerOutput = runDispensed(third.payload.command);
    expect(readFile('hybrid-file')).toEqual('hybrid-content');
    expect(parseLastPromptBlock(hybridWorkerOutput).payload.prompt).toBe(
      'prompts/hybrid-mig.md'
    );
    const hybridOutput = runDispensed(reconcile);
    const hybrid = parseLastDispense(hybridOutput);
    expect(hybrid.action).toBe('await-prompt');
    const hybridReemitted = parseLastPromptBlock(hybridOutput);
    expect(hybridReemitted.payload.prompt).toBe('prompts/hybrid-mig.md');
    expect(hybridReemitted.payload.impl.logs).toContain('hybrid-mig log line');
    expect(hybridReemitted.payload.impl.changes).toEqual([
      { type: 'CREATE', path: 'hybrid-file' },
    ]);
    expect(hybridReemitted.payload.impl.agentContext).toEqual([
      'hybrid-mig context note',
    ]);
    expect(hybrid.payload.instructions).toContain(
      `generator changes are already applied`
    );
    expect(hybrid.payload.instructions).not.toContain('"outcome": "skipped"');
    expect(commitCountFor('hybrid-mig')).toBe(0);
    updateFile('applied-hybrid.txt', 'applied by fake agent');
    writeHandoff(hybrid, {
      status: 'success',
      summary: 'applied by fake agent',
    });

    const complete = parseLastDispense(runDispensed(reconcile));
    expect(complete.action).toBe('complete');
    expect(complete.payload.instructions).toContain('applied: 3');

    const state = readRunStateFile(init.runId);
    expect(state.status).toBe('completed');
    expect(state.steps.map((s) => [s.migrationId, s.status])).toEqual([
      [`${PKG}:gen-mig`, 'succeeded'],
      [`${PKG}:prompt-mig`, 'succeeded'],
      [`${PKG}:hybrid-mig`, 'succeeded'],
    ]);
    // One commit per migration, hybrid included.
    for (const step of state.steps) {
      expect(
        state.commits.filter(
          (c) => c.kind === 'landed' && c.stepIds.includes(step.id)
        ).length
      ).toBe(1);
    }
    expect(commitCountFor('gen-mig')).toBe(1);
    expect(commitCountFor('prompt-mig')).toBe(1);
    expect(commitCountFor('hybrid-mig')).toBe(1);
  }, 600000);

  it('should complete a waived hybrid without agent work and fold a skipped prompt without a commit', () => {
    writePlan([waiverMig, promptMig]);

    const first = reconcileAfterInit(runInit());
    expect(first.action).toBe('next-step');
    expect(first.payload.command).toContain(
      `--run-migration=${PKG}:waiver-mig`
    );

    // skipAgentic: the worker completes the step; commit landed, no prompt.
    const waiverWorkerOutput = runDispensed(first.payload.command);
    expect(waiverWorkerOutput).not.toContain('<nx_migrate_prompt');
    const second = parseLastDispense(runDispensed(first.payload.next));
    expect(second.action).toBe('next-step');
    expect(second.payload.command).toContain(
      `--run-migration=${PKG}:prompt-mig`
    );
    const midState = readRunStateFile(first.runId);
    const waiverStep = midState.steps.find(
      (s) => s.migrationId === `${PKG}:waiver-mig`
    );
    expect(waiverStep.status).toBe('succeeded');
    expect(commitCountFor('waiver-mig')).toBe(1);

    // A skipped handoff folds the step as skipped with no commit.
    runDispensed(second.payload.command);
    const prompt = parseLastDispense(runDispensed(second.payload.next));
    expect(prompt.action).toBe('await-prompt');
    const revsBeforeFold = runCommand('git rev-list --count HEAD').trim();
    writeHandoff(prompt, {
      status: 'success',
      summary: 'not applicable to this workspace',
      outcome: 'skipped',
    });
    const complete = parseLastDispense(runDispensed(prompt.payload.next));
    expect(complete.action).toBe('complete');
    expect(complete.payload.instructions).toContain('applied: 1');
    expect(complete.payload.instructions).toContain('skipped: 1');
    expect(runCommand('git rev-list --count HEAD').trim()).toBe(revsBeforeFold);

    const state = readRunStateFile(first.runId);
    expect(state.status).toBe('completed');
    const promptStep = state.steps.find(
      (s) => s.migrationId === `${PKG}:prompt-mig`
    );
    expect(promptStep.status).toBe('skipped');
    expect(state.commits.every((c) => !c.stepIds.includes(promptStep.id))).toBe(
      true
    );
  }, 600000);

  it('should reject an unusable handoff file, park a failed one, and retry it', () => {
    writePlan([promptMig]);

    const first = reconcileAfterInit(runInit());
    runDispensed(first.payload.command);
    const prompt = parseLastDispense(runDispensed(first.payload.next));
    expect(prompt.action).toBe('await-prompt');
    expect(prompt.payload.instructions).not.toContain('was rejected');

    // Applied work is in the tree: a rejection must not fold, commit, or
    // advance.
    updateFile('applied-prompt.txt', 'applied by fake agent');
    const revsBeforeRejection = runCommand('git rev-list --count HEAD').trim();
    const commitsBeforeRejection = readRunStateFile(first.runId).commits.length;
    writeHandoff(prompt, 'not json {');
    const rejected = parseLastDispense(runDispensed(prompt.payload.next));
    expect(rejected.action).toBe('await-prompt');
    expect(rejected.payload.instructions).toContain(
      'The handoff file was rejected: it contained invalid JSON'
    );
    expect(rejected.payload.instructions).toContain(
      'Rewrite the handoff file, then run the "next" command.'
    );
    expect(runCommand('git rev-list --count HEAD').trim()).toBe(
      revsBeforeRejection
    );
    const rejectedState = readRunStateFile(first.runId);
    expect(rejectedState.commits.length).toBe(commitsBeforeRejection);
    const rejectedStep = rejectedState.steps.find(
      (s) => s.migrationId === `${PKG}:prompt-mig`
    );
    expect(rejectedStep.status).toBe('awaiting-prompt-outcome');
    expect(rejectedStep.attempt).toBe(1);

    // A failed handoff parks the step as failed with the retry decision.
    writeHandoff(rejected, {
      status: 'failed',
      summary: 'blocked by fake agent',
    });
    const retryBlock = parseLastDispense(runDispensed(rejected.payload.next));
    expect(retryBlock.action).toBe('retry-failed');
    // A failed outcome folds nothing: no commit until the step succeeds.
    expect(runCommand('git rev-list --count HEAD').trim()).toBe(
      revsBeforeRejection
    );
    expect(retryBlock.payload.instructions).toContain(
      `Migration ${PKG}:prompt-mig failed: blocked by fake agent`
    );
    const retryCommand = stepActionCommand(first.runId, 'retry');
    expect(retryBlock.payload.instructions).toContain(retryCommand);
    expect(retryBlock.payload.instructions).toContain(
      stepActionCommand(first.runId, 'skip')
    );
    // No generator half to re-run, so retry is the preselected `next`.
    expect(retryBlock.payload.next).toBe(retryCommand);
    const failedStep = readRunStateFile(first.runId).steps.find(
      (s) => s.migrationId === `${PKG}:prompt-mig`
    );
    expect(failedStep.status).toBe('failed');

    // Retry re-arms the step; the second attempt's success folds the applied
    // work into one commit.
    const retried = parseLastDispense(runDispensed(retryCommand));
    expect(retried.action).toBe('next-step');
    expect(retried.payload.command).toContain(
      `--run-migration=${PKG}:prompt-mig`
    );
    runDispensed(retried.payload.command);
    const secondAttempt = parseLastDispense(runDispensed(retried.payload.next));
    expect(secondAttempt.action).toBe('await-prompt');
    writeHandoff(secondAttempt, {
      status: 'success',
      summary: 'applied by fake agent',
    });
    const complete = parseLastDispense(
      runDispensed(secondAttempt.payload.next)
    );
    expect(complete.action).toBe('complete');
    const completedState = readRunStateFile(first.runId);
    expect(completedState.status).toBe('completed');
    const completedStep = completedState.steps.find(
      (s) => s.migrationId === `${PKG}:prompt-mig`
    );
    expect(completedStep.status).toBe('succeeded');
    expect(completedStep.attempt).toBe(2);
    expect(commitCountFor('prompt-mig')).toBe(1);
  }, 600000);

  it('should escalate repeated identical responses as no-progress and recover once the agent acts', () => {
    writePlan([promptMig, promptTwoMig]);

    const first = reconcileAfterInit(runInit());
    runDispensed(first.payload.command);

    // Nothing changes between reconciles: the third response escalates.
    const await1 = parseLastDispense(runDispensed(first.payload.next));
    expect(await1.action).toBe('await-prompt');
    const await2 = parseLastDispense(runDispensed(await1.payload.next));
    expect(await2.action).toBe('await-prompt');
    const escalatedOutput = runDispensed(await2.payload.next);
    const escalated = parseLastDispense(escalatedOutput);
    expect(escalated.action).toBe('no-progress');
    // The parked work is restated under the escalation, prompt block included.
    expect(parseLastPromptBlock(escalatedOutput).payload.prompt).toBe(
      'prompts/prompt-mig.md'
    );
    expect(escalated.payload.instructions).toContain(
      `No progress: this is response 3 in a row for migration ${PKG}:prompt-mig`
    );
    // The step's own work is kept below the escalation.
    expect(escalated.payload.instructions).toContain('Handoff file:');
    expect(escalated.payload.next).toBeDefined();

    // Acting resets the streak: the fold dispenses the next migration.
    writeHandoff(escalated, {
      status: 'success',
      summary: 'applied by fake agent',
    });
    const afterFoldOutput = runDispensed(escalated.payload.next);
    const afterFold = parseLastDispense(afterFoldOutput);
    expect(afterFold.action).toBe('next-step');
    expect(afterFold.payload.command).toContain(
      `--run-migration=${PKG}:prompt-two`
    );
    const complete = driveToComplete(afterFoldOutput);
    expect(complete.action).toBe('complete');
  }, 600000);

  it('should record reported issues, route them through a bounded digest, and carry unresolved ones to completion', () => {
    writePlan([promptMig, promptTwoMig, promptThreeMig]);

    const first = reconcileAfterInit(runInit());
    runDispensed(first.payload.command);
    const prompt = parseLastDispense(runDispensed(first.payload.next));
    expect(prompt.action).toBe('await-prompt');

    // A full handoff's worth of issues, scoped to the third migration.
    writeHandoff(prompt, {
      status: 'success',
      summary: 'applied by fake agent',
      issues: Array.from({ length: 20 }, (_, i) => ({
        summary: `problem ${i + 1} found while applying prompt-mig`,
        applicableMigrations: [`${PKG}:prompt-three`],
      })),
    });

    // Recorded, archived, and listed unclaimed: they concern a later step.
    const second = parseLastDispense(runDispensed(prompt.payload.next));
    expect(second.action).toBe('next-step');
    expect(second.payload.command).toContain(
      `--run-migration=${PKG}:prompt-two`
    );
    expect(second.payload.instructions).toContain(
      'Known issues reported earlier in this run'
    );
    expect(second.payload.instructions).toContain('issue-1 (recorded)');
    const archived = readJson(
      `.nx/migrate-runs/${first.runId}/issues/issue-1.json`
    );
    expect(archived.summary).toBe('problem 1 found while applying prompt-mig');

    // One more, past the 20-entry cap.
    runDispensed(second.payload.command);
    const promptTwo = parseLastDispense(runDispensed(second.payload.next));
    expect(promptTwo.action).toBe('await-prompt');
    writeHandoff(promptTwo, {
      status: 'success',
      summary: 'applied by fake agent',
      issues: [
        {
          summary: 'problem 21 found while applying prompt-two',
          applicableMigrations: [`${PKG}:prompt-three`],
        },
      ],
    });

    // Claims are capped at what the digest lists (20): the 21st is counted as
    // omitted, never assigned.
    const third = parseLastDispense(runDispensed(promptTwo.payload.next));
    expect(third.action).toBe('next-step');
    expect(third.payload.command).toContain(
      `--run-migration=${PKG}:prompt-three`
    );
    expect(
      existsSync(
        join(
          tmpProjPath(),
          `.nx/migrate-runs/${first.runId}/issues/issue-21.json`
        )
      )
    ).toBe(true);
    runDispensed(third.payload.command);
    const promptThree = parseLastDispense(runDispensed(third.payload.next));
    expect(promptThree.action).toBe('await-prompt');
    expect(promptThree.payload.instructions).toContain(
      'issue-1 (assigned to this step)'
    );
    expect(promptThree.payload.instructions).toContain(
      'issue-20 (assigned to this step)'
    );
    expect(promptThree.payload.instructions).not.toContain('issue-21 (');
    expect(promptThree.payload.instructions).toContain(
      `...and 1 more not listed; see .nx/migrate-runs/${first.runId}/issues/.`
    );
    const claimedState = readRunStateFile(first.runId);
    const stepId = claimedState.steps.find(
      (s) => s.migrationId === `${PKG}:prompt-three`
    ).id;
    expect(
      claimedState.issues.find((i) => i.id === 'issue-1').claimedByStepId
    ).toBe(stepId);
    expect(
      claimedState.issues.find((i) => i.id === 'issue-20').claimedByStepId
    ).toBe(stepId);
    expect(
      claimedState.issues.find((i) => i.id === 'issue-21').claimedByStepId
    ).toBeUndefined();

    // Resolving while changing the tree: the landed commit carries the id.
    updateFile('applied-prompt-three.txt', 'applied by fake agent');
    writeHandoff(promptThree, {
      status: 'success',
      summary: 'applied by fake agent',
      issueUpdates: [{ id: 'issue-1', disposition: 'resolved' }],
    });
    const complete = parseLastDispense(runDispensed(promptThree.payload.next));
    expect(complete.action).toBe('complete');
    expect(complete.payload.instructions).toContain(
      '20 reported issues remain unresolved'
    );
    expect(complete.payload.instructions).not.toContain('issue-1 (');

    const state = readRunStateFile(first.runId);
    expect(state.issues.find((i) => i.id === 'issue-1').disposition).toBe(
      'resolved'
    );
    // Every applicable step terminal: the never-assigned issue is demoted.
    expect(state.issues.find((i) => i.id === 'issue-21').disposition).toBe(
      'deferred-final'
    );
    expect(commitCountFor('prompt-three')).toBe(1);
    const promptThreeCommit = state.commits.find(
      (c) => c.kind === 'landed' && c.stepIds.includes(stepId)
    );
    expect(promptThreeCommit.issueIds).toEqual(['issue-1']);
  }, 600000);

  it('should keep digest claims and rendering aligned under the byte cap', () => {
    writePlan([promptMig, promptTwoMig]);

    const first = reconcileAfterInit(runInit());
    runDispensed(first.payload.command);
    const prompt = parseLastDispense(runDispensed(first.payload.next));
    expect(prompt.action).toBe('await-prompt');

    // Thirteen multibyte entries (~620 bytes each) plus a fourteenth padded so
    // the listed prefix is exactly 8192 bytes; the tiny fifteenth is listed by
    // any cap of 8192 plus its own size or more.
    const entryFor = (issue: { id: string; summary: string }) =>
      `  - ${issue.id} (assigned to this step): ${issue.summary}`;
    const bigSummaries = Array.from(
      { length: 13 },
      (_, i) => `${'題'.repeat(194)} ${i + 1}`
    );
    const bigBytes = bigSummaries.reduce(
      (sum, summary, i) =>
        sum +
        Buffer.byteLength(entryFor({ id: `issue-${i + 1}`, summary }), 'utf8'),
      0
    );
    const padSummary = 'x'.repeat(
      8192 -
        bigBytes -
        Buffer.byteLength(entryFor({ id: 'issue-14', summary: '' }), 'utf8')
    );
    const summaries = [
      ...bigSummaries,
      padSummary,
      ...Array.from({ length: 6 }, (_, i) => `x${i + 15}`),
    ];
    writeHandoff(prompt, {
      status: 'success',
      summary: 'applied by fake agent',
      issues: summaries.map((summary) => ({
        summary,
        applicableMigrations: [`${PKG}:prompt-two`],
      })),
    });

    const second = parseLastDispense(runDispensed(prompt.payload.next));
    expect(second.action).toBe('next-step');
    runDispensed(second.payload.command);
    const promptTwo = parseLastDispense(runDispensed(second.payload.next));
    expect(promptTwo.action).toBe('await-prompt');

    // Claims stop where rendering does.
    const state = readRunStateFile(first.runId);
    const stepId = state.steps.find(
      (s) => s.migrationId === `${PKG}:prompt-two`
    ).id;
    const claimed = state.issues.filter((i) => i.claimedByStepId === stepId);
    expect(claimed.length).toBe(14);
    // Ledger-order prefix.
    expect(claimed.map((i) => i.id)).toEqual(
      state.issues.slice(0, claimed.length).map((i) => i.id)
    );
    for (const issue of state.issues) {
      if (issue.claimedByStepId === stepId) {
        expect(promptTwo.payload.instructions).toContain(
          `${issue.id} (assigned to this step)`
        );
      } else {
        expect(promptTwo.payload.instructions).not.toContain(
          `${issue.id} (assigned`
        );
      }
    }
    expect(promptTwo.payload.instructions).toContain(
      `...and ${20 - claimed.length} more not listed`
    );
    // Exactly fills the bound; the first unclaimed entry would exceed it.
    let listedBytes = 0;
    for (const issue of claimed) {
      expect(promptTwo.payload.instructions).toContain(entryFor(issue));
      listedBytes += Buffer.byteLength(entryFor(issue), 'utf8');
    }
    expect(listedBytes).toBe(8192);
    const firstUnclaimed = state.issues.find(
      (i) => i.claimedByStepId !== stepId
    );
    expect(
      listedBytes + Buffer.byteLength(entryFor(firstUnclaimed), 'utf8')
    ).toBeGreaterThan(8192);

    writeHandoff(promptTwo, {
      status: 'success',
      summary: 'applied by fake agent',
    });
    const complete = parseLastDispense(runDispensed(promptTwo.payload.next));
    expect(complete.action).toBe('complete');
    expect(complete.payload.instructions).toContain(
      '20 reported issues remain unresolved'
    );
  }, 600000);

  it('should classify a killed worker as died and recover with retry-clean', async () => {
    writePlan([slowMig]);

    const { runId, diedBlock, gitRefBefore } = await killWorkerAndReconcile(
      runInit(' --validate=false')
    );

    expect(diedBlock.action).toBe('died');
    expect(diedBlock.payload.instructions).toContain(
      `started from: ${gitRefBefore}`
    );
    expect(diedBlock.payload.instructions).toContain('current HEAD:');
    // The killed worker's half-applied change shows up as dirty-tree evidence.
    expect(diedBlock.payload.instructions).toContain('slow-file');
    // No marker recorded, so no `next`: the agent must choose.
    const retryClean = stepActionCommand(runId, 'retry-clean');
    expect(diedBlock.payload.instructions).toContain(retryClean);
    expect(diedBlock.payload.next).toBeUndefined();

    runCommand(`git reset --hard ${gitRefBefore}`, { failOnError: true });
    runCommand('git clean -fd -e .nx/migrate-runs', { failOnError: true });

    const complete = driveToComplete(runDispensed(retryClean));
    expect(complete.action).toBe('complete');

    const state = readRunStateFile(runId);
    expect(state.status).toBe('completed');
    const step = state.steps.find((s) => s.migrationId === `${PKG}:slow-mig`);
    expect(step.status).toEqual('succeeded');
    expect(step.attempt).toEqual(2);
    expect(readFile('slow-file')).toEqual('slow-content');
    // slow-mig writes via fs, not the tree: a no-op step gets no commit or
    // ledger entry.
    expect(commitCountFor('slow-mig')).toBe(0);
    expect(state.commits.some((c) => c.stepIds.includes(step.id))).toBe(false);
  }, 600000);

  it("should adopt a killed worker's changes as the migration result", async () => {
    writePlan([slowMig, hybridMig]);

    const { runId, diedBlock } = await killWorkerAndReconcile(
      runInit(' --validate=false')
    );
    expect(diedBlock.action).toBe('died');

    const adoptCommand = stepActionCommand(runId, 'adopt');
    expect(diedBlock.payload.instructions).toContain(adoptCommand);
    const afterAdopt = parseLastDispense(runDispensed(adoptCommand));
    expect(afterAdopt.action).toBe('next-step');
    expect(afterAdopt.payload.command).toContain(
      `--run-migration=${PKG}:hybrid-mig`
    );

    // Validation off: the capture is owed to the hybrid half alone.
    const hybridWorkerOutput = runDispensed(afterAdopt.payload.command);
    const hybridBlock = parseLastPromptBlock(hybridWorkerOutput);
    expect(hybridBlock.payload.impl.logs).toContain('hybrid-mig log line');
    expect(hybridBlock.payload.impl.changes).toEqual([
      { type: 'CREATE', path: 'hybrid-file' },
    ]);
    expect(hybridBlock.payload.impl.agentContext).toEqual([
      'hybrid-mig context note',
    ]);
    const hybridAwait = parseLastDispense(
      runDispensed(afterAdopt.payload.next)
    );
    expect(hybridAwait.action).toBe('await-prompt');
    writeHandoff(hybridAwait, {
      status: 'success',
      summary: 'applied by fake agent',
    });
    const complete = driveToComplete(runDispensed(hybridAwait.payload.next));
    expect(complete.action).toBe('complete');

    const state = readRunStateFile(runId);
    expect(state.status).toBe('completed');
    const step = state.steps.find((s) => s.migrationId === `${PKG}:slow-mig`);
    expect(step.status).toEqual('succeeded');
    expect(step.attempt).toEqual(1);
    // The adopted working tree was committed at reconcile.
    expect(
      state.commits.some(
        (c) => c.kind === 'landed' && c.stepIds.includes(step.id)
      )
    ).toBe(true);
    expect(readFile('slow-file')).toEqual('slow-content');
    expect(commitCountFor('slow-mig')).toBe(1);
    expect(commitCountFor('hybrid-mig')).toBe(1);
  }, 600000);

  it('should refuse a different plan while a run is active and resume the same run on a same-plan init', () => {
    const gitignoreMig = {
      package: 'nx',
      name: '23-0-0-add-migrate-runs-to-git-ignore',
      version: '23.0.0',
    };
    writePlan([genMig, genTwoMig, gitignoreMig]);

    // The run dir exists before any migration runs, so init must add the
    // missing ignore entry itself when the plan carries the v23 migration,
    // not defer and refuse.
    const gitignoreInitial = readFile('.gitignore');
    expect(gitignoreInitial).toContain('.nx/migrate-runs');
    updateFile('.gitignore', (content) =>
      content
        .split('\n')
        .filter((l) => !l.includes('migrate-runs'))
        .join('\n')
    );
    const initOutput = runInit(' --validate=false');
    expect(readFile('.gitignore')).toContain('.nx/migrate-runs');
    const first = reconcileAfterInit(initOutput);
    expect(first.action).toBe('next-step');
    // The gitignore migration is hoisted first despite its highest version.
    expect(first.payload.command).toContain(
      '--run-migration=nx:23-0-0-add-migrate-runs-to-git-ignore'
    );
    runDispensed(first.payload.command);
    const second = parseLastDispense(runDispensed(first.payload.next));
    expect(second.action).toBe('next-step');
    expect(second.payload.command).toContain(`--run-migration=${PKG}:gen-mig`);
    runDispensed(second.payload.command);
    const third = parseLastDispense(runDispensed(second.payload.next));
    expect(third.action).toBe('next-step');
    expect(third.payload.command).toContain(`--run-migration=${PKG}:gen-two`);

    // A different plan must not fork, and the refusal precedes any git or
    // state side effect: the entry is stripped and the mismatched plan carries
    // the v23 migration, so a misordered fallback or checkpoint would show.
    const gitignoreBefore = readFile('.gitignore');
    expect(gitignoreBefore).toContain('.nx/migrate-runs');
    updateFile('.gitignore', (content) =>
      content
        .split('\n')
        .filter((l) => !l.includes('migrate-runs'))
        .join('\n')
    );
    const gitignoreStripped = readFile('.gitignore');
    writePlan([genMig, gitignoreMig]);
    const headBeforeMismatch = runCommand('git rev-parse HEAD').trim();
    const runStateBeforeMismatch = readFile(
      `.nx/migrate-runs/${first.runId}/run.json`
    );
    const treeBeforeMismatch = runCommand('git status --porcelain').trim();
    const mismatch = runCLI('migrate --run-migrations=migrations.json', {
      env: INIT_ENV,
      silenceError: true,
    });
    expect(mismatch).toContain(
      `A migrate run '${first.runId}' is already active with a different plan.`
    );
    expect(runCLI.lastExitCode).toBe(1);
    expect(runCommand('git rev-parse HEAD').trim()).toBe(headBeforeMismatch);
    expect(readFile(`.nx/migrate-runs/${first.runId}/run.json`)).toBe(
      runStateBeforeMismatch
    );
    expect(readFile('.gitignore')).toBe(gitignoreStripped);
    expect(runCommand('git status --porcelain').trim()).toBe(
      treeBeforeMismatch
    );
    updateFile('.gitignore', gitignoreBefore);
    writePlan([genMig, genTwoMig, gitignoreMig]);

    // A killed orchestrator is just init running again: resume, not fork. The
    // marker proves the stored bytes are re-emitted, not re-rendered.
    updateFile(
      `.nx/migrate-runs/${first.runId}/RUNBOOK.md`,
      (content) => `${content}\nstored-runbook-marker\n`
    );
    const resumeOutput = runInit(' --validate=false');
    expectRunbookOnlyResponse(resumeOutput);
    const resumedRunbook = parseRunbookBlock(resumeOutput);
    expect(resumedRunbook.runId).toBe(first.runId);
    expect(resumedRunbook.content).toContain('stored-runbook-marker');
    expect(resumedRunbook.content).toBe(
      readFile(`.nx/migrate-runs/${first.runId}/RUNBOOK.md`)
    );
    expect(resumeOutput).toContain(`resuming run ${first.runId}`);
    expect(resumeOutput).toContain(
      'progress: 2 applied, 0 skipped, 1 remaining'
    );
    const resumed = parseLastDispense(resumeOutput);
    expect(resumed.action).toBe('initialized');
    expect(resumeOutput.indexOf('<nx_migrate_runbook')).toBeLessThan(
      resumeOutput.indexOf('<nx_migrate_step')
    );
    // Only run dirs prove no fork; the lock file sits beside them.
    expect(
      listFiles('.nx/migrate-runs').filter((f) => f !== 'init.lock')
    ).toEqual([first.runId]);

    const complete = driveToComplete(runDispensed(resumed.payload.next));
    expect(complete.runId).toBe(first.runId);
    const state = readRunStateFile(first.runId);
    expect(state.status).toBe('completed');
    expect(readFile('gen-file')).toEqual('gen-content');
    expect(readFile('gen-two-file')).toEqual('gen-two-content');
    // The fallback already added the entry, so the hoisted migration is a
    // no-op.
    const gitignoreStep = state.steps.find(
      (s) => s.migrationId === 'nx:23-0-0-add-migrate-runs-to-git-ignore'
    );
    expect(gitignoreStep.status).toBe('succeeded');
    expect(
      state.commits.some((c) => c.stepIds.includes(gitignoreStep.id))
    ).toBe(false);
    // Validation off: the worker commits each changed generator.
    expect(commitCountFor('gen-mig')).toBe(1);
    expect(commitCountFor('gen-two')).toBe(1);
    for (const step of state.steps.filter((s) => s !== gitignoreStep)) {
      expect(
        state.commits.filter(
          (c) => c.kind === 'landed' && c.stepIds.includes(step.id)
        ).length
      ).toBe(1);
    }
    expect(runCommand('git status --porcelain').trim()).toBe('');
  }, 600000);
});
