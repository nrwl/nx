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
  runCommandAsync,
  tmpProjPath,
  updateFile,
  waitUntil,
} from '@nx/e2e-utils';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// Mirrors getPackageManagerCommand().exec's per-manager mapping
// (nx/src/utils/package-manager.ts); dispensed commands carry this prefix so
// they resolve even without a global `nx` on PATH.
const PM_EXEC_PREFIX: Record<string, string> = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  bun: 'bun',
};

// The orchestrator is dark-launched behind NX_MIGRATE_ORCHESTRATOR and its
// init additionally requires an agent context (CLAUDECODE is the detection
// seam). Dispensed commands assume the gate env is exported at the session
// level, so the fake agent carries it on every invocation.
const ORCHESTRATOR_ENV = {
  NX_MIGRATE_SKIP_INSTALL: 'true',
  NX_MIGRATE_USE_LOCAL: 'true',
  NX_MIGRATE_ORCHESTRATOR: 'true',
  CLAUDECODE: '1',
};

const PKG = 'migrate-orch-package';

interface DispenseBlock {
  runId: string;
  step: string;
  action: string;
  payload: { command?: string; then?: string; instructions?: string };
}

interface RunStateFile {
  status: string;
  steps: {
    id: string;
    kind: string;
    migrationId?: string;
    status: string;
    attempt: number;
    pid?: number;
    gitRefBefore?: string;
  }[];
  commits: { kind: string; sha?: string; stepIds: string[] }[];
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

// Dispensed commands are POSIX env-prefixed `<pm exec> nx migrate ...`
// strings; split them so they can be re-run through runCLI's package manager
// wrapper.
function parseDispensedCommand(command: string): {
  env: Record<string, string>;
  args: string;
} {
  const tokens = command.split(' ');
  const env: Record<string, string> = {};
  let i = 0;
  while (
    i < tokens.length &&
    !tokens[i].startsWith('-') &&
    tokens[i].includes('=')
  ) {
    const eq = tokens[i].indexOf('=');
    env[tokens[i].slice(0, eq)] = tokens[i].slice(eq + 1);
    i++;
  }
  const execTokens = PM_EXEC_PREFIX[getSelectedPackageManager()].split(' ');
  const prefixMatches = execTokens.every((t, j) => tokens[i + j] === t);
  if (!prefixMatches || tokens[i + execTokens.length] !== 'nx') {
    throw new Error(`Unexpected dispensed command shape: ${command}`);
  }
  return { env, args: tokens.slice(i + execTokens.length + 1).join(' ') };
}

function runDispensed(command: string): string {
  const { env, args } = parseDispensedCommand(command);
  return runCLI(args, { env: { ...env, ...ORCHESTRATOR_ENV } });
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

// The fake agent: follow each dispense until the run completes. A bug that
// loops forever fails via the iteration cap instead of hanging the test.
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
      // Simulate applying the prompt with a real tree change, then hand off.
      updateFile(`applied-${block.step}.txt`, 'applied by fake agent');
      const handoffPath = handoffPathFrom(block);
      mkdirSync(dirname(handoffPath), { recursive: true });
      writeFileSync(
        handoffPath,
        JSON.stringify({ status: 'success', summary: 'applied by fake agent' })
      );
    } else {
      throw new Error(
        `Fake agent cannot handle dispense action '${block.action}':\n${JSON.stringify(
          block.payload
        )}`
      );
    }
    block = parseLastDispense(runDispensed(block.payload.then));
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
        'slow-mig': { version: '1.0.0', implementation: './slow-mig' },
      },
    })
  );
  updateFile(
    `./node_modules/${PKG}/gen-mig.js`,
    `
      exports.default = function (host) {
        host.write('gen-file', 'gen-content');
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
  updateFile(
    `./node_modules/${PKG}/hybrid-mig.js`,
    `
      exports.default = function (host) {
        host.write('hybrid-file', 'hybrid-content');
      };
      `
  );
  // Writes through fs so the changes land before the block; tree writes only
  // flush after the generator returns, which never happens on the first
  // (killed) attempt. The marker survives git clean -fd (node_modules is
  // gitignored), so a retried attempt returns quickly instead of blocking.
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
const hybridMig = {
  package: PKG,
  name: 'hybrid-mig',
  version: '1.3.0',
  implementation: './hybrid-mig',
  prompt: 'prompts/hybrid-mig.md',
};
const slowMig = { package: PKG, name: 'slow-mig', version: '1.0.0' };

function runInit(): string {
  return runCLI('migrate --run-migrations=migrations.json', {
    env: ORCHESTRATOR_ENV,
  });
}

// Spawns the dispensed worker command, waits until the slow migration is
// running, kills the recorded worker pid, and reconciles into a died dispense.
async function killWorkerAndReconcile(initOutput: string): Promise<{
  runId: string;
  diedBlock: DispenseBlock;
  gitRefBefore: string;
}> {
  const dispense = parseLastDispense(initOutput);
  expect(dispense.action).toBe('next-step');

  const { env, args } = parseDispensedCommand(dispense.payload.command);
  const pmc = getPackageManagerCommand();
  const workerPromise = runCommandAsync(`${pmc.runNxSilent} ${args}`, {
    silenceError: true,
    env: {
      ...getStrippedEnvironmentVariables(),
      ...env,
      ...ORCHESTRATOR_ENV,
    },
  });

  let pid: number;
  await waitUntil(
    () => {
      // The worker records running before invoking the migration, so also wait
      // for the marker (written after slow-file) before killing; a kill in
      // between would leave a clean tree and a marker-less retry that blocks.
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
  process.kill(pid, 'SIGKILL');
  await workerPromise;

  const state = readRunStateFile(dispense.runId);
  const step = state.steps.find((s) => s.migrationId === `${PKG}:slow-mig`);

  const diedBlock = parseLastDispense(runDispensed(dispense.payload.then));
  return { runId: dispense.runId, diedBlock, gitRefBefore: step.gitRefBefore };
}

describe('migrate orchestrator (dark launch)', () => {
  beforeEach(() => {
    newProject({ packages: [] });
    setupMigrationPackage();
  });

  afterAll(() => cleanupProject());

  it('should drive a generator, prompt, and hybrid migration to completion through the fake agent loop', () => {
    writePlan([genMig, promptMig, hybridMig]);

    const initOutput = runInit();
    const firstDispense = parseLastDispense(initOutput);
    expect(firstDispense.action).toBe('next-step');
    const execPrefix = PM_EXEC_PREFIX[getSelectedPackageManager()];
    expect(firstDispense.payload.command).toBe(
      `NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true ${execPrefix} nx migrate --run-migration=${PKG}:gen-mig --run-id=${firstDispense.runId}`
    );
    expect(firstDispense.payload.then).toBe(
      `NX_MIGRATE_ORCHESTRATOR=true NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true ${execPrefix} nx migrate --run-id=${firstDispense.runId}`
    );

    const complete = driveToComplete(initOutput);
    expect(complete.runId).toBe(firstDispense.runId);

    const state = readRunStateFile(complete.runId);
    expect(state.status).toBe('completed');
    expect(state.steps.map((s) => [s.kind, s.status])).toEqual([
      ['peer-compat', 'succeeded'],
      ['install', 'succeeded'],
      ['migration', 'succeeded'],
      ['migration', 'succeeded'],
      ['migration', 'succeeded'],
      ['final-validation', 'succeeded'],
    ]);

    // Each migration's changes landed on disk and in a dedicated commit.
    expect(readFile('gen-file')).toEqual('gen-content');
    expect(readFile('hybrid-file')).toEqual('hybrid-content');
    const migrationSteps = state.steps.filter((s) => s.kind === 'migration');
    for (const step of migrationSteps) {
      expect(
        state.commits.some(
          (c) => c.kind === 'landed' && c.stepIds.includes(step.id)
        )
      ).toBe(true);
    }
    const recentCommits = runCommand('git --no-pager log --oneline -n 15');
    expect(recentCommits).toContain('chore: [nx migration] gen-mig');
    expect(recentCommits).toContain('chore: [nx migration] prompt-mig');
    expect(recentCommits).toContain('chore: [nx migration] hybrid-mig');
  }, 600000);

  it('should classify a killed worker as died and recover with retry-clean', async () => {
    writePlan([slowMig]);

    const { runId, diedBlock, gitRefBefore } =
      await killWorkerAndReconcile(runInit());

    expect(diedBlock.action).toBe('died');
    expect(diedBlock.payload.instructions).toContain(
      `started from: ${gitRefBefore}`
    );
    expect(diedBlock.payload.instructions).toContain('current HEAD:');
    // The killed worker's half-applied change shows up as dirty-tree evidence.
    expect(diedBlock.payload.instructions).toContain('slow-file');
    expect(diedBlock.payload.then).toContain('--step-action=retry-clean');

    runCommand(`git reset --hard ${gitRefBefore}`, { failOnError: true });
    runCommand('git clean -fd', { failOnError: true });

    const complete = driveToComplete(runDispensed(diedBlock.payload.then));
    expect(complete.action).toBe('complete');

    const state = readRunStateFile(runId);
    expect(state.status).toBe('completed');
    const step = state.steps.find((s) => s.migrationId === `${PKG}:slow-mig`);
    expect(step.status).toEqual('succeeded');
    expect(step.attempt).toEqual(2);
    expect(readFile('slow-file')).toEqual('slow-content');
  }, 600000);

  it("should adopt a killed worker's changes as the migration result", async () => {
    writePlan([slowMig]);

    const { runId, diedBlock } = await killWorkerAndReconcile(runInit());
    expect(diedBlock.action).toBe('died');

    const adoptCommand = diedBlock.payload.then.replace(
      '--step-action=retry-clean',
      '--step-action=adopt'
    );
    const complete = driveToComplete(runDispensed(adoptCommand));
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
    expect(runCommand('git --no-pager log --oneline -n 10')).toContain(
      'chore: [nx migration] slow-mig'
    );
  }, 600000);

  it('should resume the same run when init re-runs with the same plan', () => {
    writePlan([genMig, genTwoMig]);

    const first = parseLastDispense(runInit());
    expect(first.action).toBe('next-step');
    runDispensed(first.payload.command);
    const second = parseLastDispense(runDispensed(first.payload.then));
    expect(second.action).toBe('next-step');
    expect(second.payload.command).toContain(`--run-migration=${PKG}:gen-two`);

    // The orchestrator holds no process between dispenses, so a "killed"
    // orchestrator is simply init running again; it must resume, not fork.
    const resumeOutput = runInit();
    const resumed = parseLastDispense(resumeOutput);
    expect(resumed.runId).toBe(first.runId);
    expect(resumed.action).toBe('next-step');
    // The creation lock file lives alongside the run dirs; only run dirs
    // prove no fork happened.
    expect(
      listFiles('.nx/migrate-runs').filter((f) => f !== 'init.lock')
    ).toEqual([first.runId]);

    const complete = driveToComplete(resumeOutput);
    expect(complete.runId).toBe(first.runId);
    expect(readRunStateFile(first.runId).status).toBe('completed');
    expect(readFile('gen-file')).toEqual('gen-content');
    expect(readFile('gen-two-file')).toEqual('gen-two-content');
  }, 600000);
});
