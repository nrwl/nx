import {
  type ChildProcess,
  execFile,
  type ExecFileException,
} from 'child_process';
import { access, constants } from 'fs/promises';
import { delimiter, resolve } from 'path';
import which from 'which';
import { IS_WASM, killProcessTree } from '../../../native';
import { logger } from '../../../utils/logger';
import { workspaceRoot } from '../../../utils/workspace-root';
import { singleLine } from '../text';
import { AgentDefinition, DetectedInstalledAgent } from './types';
import { adaptSpawnForWindowsShim } from './windows-cmd';

const VERSION_PROBE_DEADLINE_MS = 5_000;

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch (err) {
    // EACCES on an existing path means "this looks installed but we can't
    // execute it" — surface so the user can answer "why isn't my agent
    // detected?" without grep-debugging the filesystem.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code && code !== 'ENOENT') {
      logger.verbose(`Agent detection: cannot probe ${path} (${code}).`);
    }
    return false;
  }
}

// Windows `which` searches the current directory before PATH, and a binary
// there is the workspace's, not the user's. Looking up each entry by absolute
// path skips that search. An empty entry would resolve to the same directory.
async function findAllOnPath(
  binaryNames: readonly string[]
): Promise<string[]> {
  const isWindows = process.platform === 'win32';
  const entries = (process.env.PATH ?? '')
    .split(delimiter)
    // `which` strips the quotes around a PATH entry.
    .map((entry) => (/^".*"$/.test(entry) ? entry.slice(1, -1) : entry))
    .filter((entry) => !isWindows || entry !== '');
  const found: string[] = [];
  const seen = new Set<string>();
  for (const name of binaryNames) {
    for (const entry of entries) {
      // `{ nothrow: true }` avoids the throw-per-missing-binary overhead;
      // EACCES on existing-but-unexecutable paths is handled by `isExecutable`.
      const matches =
        (await which(resolve(entry, name), { all: true, nothrow: true })) ?? [];
      for (const binary of matches) {
        // Windows `which` tries each PATHEXT entry in both cases, so NTFS
        // matches a file twice.
        const key = isWindows ? binary.toLowerCase() : binary;
        if (!seen.has(key)) {
          seen.add(key);
          found.push(binary);
        }
      }
    }
  }
  return found;
}

async function detectOne(
  definition: AgentDefinition
): Promise<DetectedInstalledAgent | null> {
  const [onPath] = await findAllOnPath(definition.binaryNames);
  if (onPath) {
    return {
      id: definition.id,
      displayName: definition.displayName,
      binary: onPath,
      source: 'path',
    };
  }

  for (const candidate of definition.wellKnownPaths()) {
    if (await isExecutable(candidate)) {
      return {
        id: definition.id,
        displayName: definition.displayName,
        binary: candidate,
        source: 'well-known',
      };
    }
  }

  return null;
}

/**
 * Probes each given agent definition for an installed binary on the user's
 * machine. PATH is checked first via `which` (which handles Windows PATHEXT),
 * then the per-agent well-known fallback paths. Probes run in parallel.
 * Nothing is executed: a binary is matched by name only.
 *
 * Returns only the agents that were found, preserving the order of the input
 * `definitions` argument for callers that rely on it for picker presentation.
 */
export async function detectInstalledAgents(
  definitions: readonly AgentDefinition[]
): Promise<DetectedInstalledAgent[]> {
  const results = await Promise.all(definitions.map(detectOne));
  return results.filter(
    (result): result is DetectedInstalledAgent => result !== null
  );
}

/** A binary carrying an agent's name that nx will not launch as that agent. */
export interface RejectedAgentBinary {
  binary: string;
  reason: string;
}

export type AgentIdentity =
  | { kind: 'confirmed'; agent: DetectedInstalledAgent }
  | { kind: 'rejected'; binaries: RejectedAgentBinary[] };

/**
 * Confirms a detected agent. When its definition sets `versionOutputPrefix`,
 * runs `<binary> --version` on each binary carrying its name, PATH first,
 * until one's output starts with the prefix. Call it only once the user has
 * opted in to the agentic flow, since it executes those binaries.
 */
export async function confirmAgentIdentity(
  definition: AgentDefinition,
  agent: DetectedInstalledAgent
): Promise<AgentIdentity> {
  const prefix = definition.versionOutputPrefix;
  if (prefix === undefined) {
    return { kind: 'confirmed', agent };
  }
  const binaries: RejectedAgentBinary[] = [];
  for (const candidate of await findCandidates(definition)) {
    const probe = await probeVersion(candidate.binary);
    if (probe.kind === 'ran' && probe.stdout.startsWith(prefix)) {
      return {
        kind: 'confirmed',
        agent: { ...agent, binary: candidate.binary, source: candidate.source },
      };
    }
    const reason = rejectionReason(probe);
    logger.verbose(
      `Agent detection: ${candidate.binary} is not ${definition.displayName}: ${reason}.`
    );
    binaries.push({ binary: candidate.binary, reason });
  }
  return { kind: 'rejected', binaries };
}

async function findCandidates(
  definition: AgentDefinition
): Promise<Pick<DetectedInstalledAgent, 'binary' | 'source'>[]> {
  const onPath = await findAllOnPath(definition.binaryNames);
  const candidates: Pick<DetectedInstalledAgent, 'binary' | 'source'>[] =
    onPath.map((binary) => ({ binary, source: 'path' }));
  for (const binary of definition.wellKnownPaths()) {
    if (!onPath.includes(binary) && (await isExecutable(binary))) {
      candidates.push({ binary, source: 'well-known' });
    }
  }
  return candidates;
}

type VersionProbe =
  | { kind: 'ran'; stdout: string; exitCode: number }
  | { kind: 'failed'; reason: string };

// `execFile`'s own `timeout` only signals the direct child and then waits for
// it to exit, so a binary that ignores the signal, or a shim's child, would
// hold the probe past it.
function probeVersion(binary: string): Promise<VersionProbe> {
  return new Promise((resolve) => {
    let child: ChildProcess | undefined;
    const deadline = setTimeout(() => {
      resolve({
        kind: 'failed',
        reason: `\`--version\` did not finish within ${VERSION_PROBE_DEADLINE_MS / 1000} s`,
      });
      stopProbe(binary, child);
    }, VERSION_PROBE_DEADLINE_MS);
    try {
      const adapted = adaptSpawnForWindowsShim(binary, ['--version'], {
        cwd: workspaceRoot,
      });
      child = execFile(
        adapted.binary,
        adapted.args,
        { ...adapted.options, encoding: 'utf8', windowsHide: true },
        (error, stdout) => {
          clearTimeout(deadline);
          resolve(probeResult(error, stdout));
        }
      );
    } catch (e) {
      clearTimeout(deadline);
      resolve({
        kind: 'failed',
        reason: `could not run it: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }
    // A binary that reads stdin would otherwise wait for input until the
    // deadline.
    child.stdin?.end();
  });
}

function probeResult(
  error: ExecFileException | null,
  stdout: string
): VersionProbe {
  if (error === null) {
    return { kind: 'ran', stdout, exitCode: 0 };
  }
  // A numeric code is an exit code: the binary ran, so its output still
  // identifies it.
  if (typeof error.code === 'number') {
    return { kind: 'ran', stdout, exitCode: error.code };
  }
  return {
    kind: 'failed',
    reason: `\`--version\` failed (${error.code ?? error.signal ?? error.message})`,
  };
}

function rejectionReason(probe: VersionProbe): string {
  if (probe.kind === 'failed') {
    return probe.reason;
  }
  const firstLine = singleLine(probe.stdout.trim().split(/\r?\n/)[0]);
  const printed = firstLine
    ? `\`--version\` printed "${firstLine}"`
    : '`--version` printed nothing';
  return probe.exitCode === 0
    ? printed
    : `${printed} and exited with code ${probe.exitCode}`;
}

function stopProbe(binary: string, child: ChildProcess | undefined): void {
  if (child === undefined) {
    return;
  }
  // The tree walk finds the binary's children only while it runs, and an
  // exited process's pid can belong to another process by now.
  if (
    child.pid !== undefined &&
    child.exitCode === null &&
    child.signalCode === null
  ) {
    try {
      // The WASM build has no process-tree kill.
      if (IS_WASM) {
        child.kill('SIGKILL');
      } else {
        killProcessTree(child.pid, 'SIGKILL');
      }
    } catch (e) {
      logger.verbose(
        `Agent detection: could not stop ${binary}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  // A child the binary left behind can hold the pipes open after it exits.
  child.stdout?.destroy();
  child.stderr?.destroy();
}
