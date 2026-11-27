// Kept apart from detect-installed.spec.ts, which mocks `which` and the
// filesystem: these cases run real stand-in binaries.

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { delimiter, dirname, join } from 'path';
import { AGENT_DEFINITIONS } from './definitions';
import { confirmAgentIdentity } from './detect-installed';
import type { DetectedInstalledAgent } from './types';

const copilot = AGENT_DEFINITIONS.find((d) => d.id === 'copilot')!;
const opencode = AGENT_DEFINITIONS.find((d) => d.id === 'opencode')!;

const GITHUB = '#!/bin/sh\necho "GitHub Copilot CLI 1.0.114."\n';
const AWS = '#!/bin/sh\necho "copilot version: v1.34.1"\n';
const AWS_REASON = '`--version` printed "copilot version: v1.34.1"';

// A killed process stays a zombie until its parent reaps it, and a container
// whose init process doesn't reap leaves it there. Linux shows that in /proc.
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
    // The state follows the command name, which can contain spaces and parentheses.
    return stat[stat.lastIndexOf(')') + 2] !== 'Z';
  } catch {
    // No /proc on macOS, where launchd reaps orphans.
    return true;
  }
}

// The stand-ins are shell scripts.
describe.skipIf(process.platform === 'win32')(
  'confirmAgentIdentity with real binaries',
  () => {
    const originalPath = process.env.PATH;
    const originalHome = process.env.HOME;
    let root: string;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'nx-agent-identity-'));
      process.env.HOME = join(root, 'home');
    });

    afterEach(() => {
      process.env.PATH = originalPath;
      process.env.HOME = originalHome;
      delete process.env.HUNG_CHILD_PID_FILE;
      rmSync(root, { recursive: true, force: true });
    });

    function standIn(dir: string, script: string, name = 'copilot'): string {
      mkdirSync(join(root, dir), { recursive: true });
      const binary = join(root, dir, name);
      writeFileSync(binary, script, { mode: 0o755 });
      return binary;
    }

    // Only the stand-ins' directories, so an agent installed on the machine
    // can't become a candidate. An empty PATH would search the current directory.
    function putOnPath(...binaries: string[]): void {
      process.env.PATH = binaries.map(dirname).join(delimiter) || root;
    }

    // Detection matches by name, so it hands over the first binary found.
    function detectedAt(
      binary: string,
      definition = copilot
    ): DetectedInstalledAgent {
      return {
        id: definition.id,
        displayName: definition.displayName,
        binary,
        source: 'path',
      };
    }

    it.each([
      ['prints another product version', AWS],
      ['cannot start', '#!/nonexistent/interpreter\n'],
    ])(
      'keeps searching PATH past a copilot that %s',
      async (_label, script) => {
        const other = standIn('other', script);
        const github = standIn('github', GITHUB);
        putOnPath(other, github);

        const identity = await confirmAgentIdentity(copilot, detectedAt(other));

        expect(identity).toEqual({
          kind: 'confirmed',
          agent: detectedAt(github),
        });
      }
    );

    it.each([
      ['on PATH', 'aws', true],
      ['at the well-known path', join('home', '.local', 'bin'), false],
    ])(
      'rejects a non-GitHub copilot %s and says why',
      async (_label, dir, onPath) => {
        const aws = standIn(dir, AWS);
        putOnPath(...(onPath ? [aws] : []));

        const identity = await confirmAgentIdentity(copilot, detectedAt(aws));

        expect(identity).toEqual({
          kind: 'rejected',
          binaries: [{ binary: aws, reason: AWS_REASON, unsupported: false }],
        });
      }
    );

    describe('opencode', () => {
      // Both add well-known paths outside the stand-ins.
      beforeEach(() => {
        vi.stubEnv('OPENCODE_INSTALL_DIR', undefined);
        vi.stubEnv('XDG_BIN_DIR', undefined);
      });

      afterEach(() => vi.unstubAllEnvs());

      it.each([
        ['1.19.6', 1],
        ['opencode v2.0.19', 2],
        ['opencode v2.4.1', 2],
      ])(
        'reads the release from `--version` printing "%s"',
        async (printed, opencodeMajor) => {
          const binary = standIn(
            'opencode',
            `#!/bin/sh\necho "${printed}"\n`,
            'opencode'
          );
          putOnPath(binary);

          const identity = await confirmAgentIdentity(
            opencode,
            detectedAt(binary, opencode)
          );

          expect(identity).toEqual({
            kind: 'confirmed',
            agent: { ...detectedAt(binary, opencode), opencodeMajor },
          });
        }
      );

      it.each([
        ['matches no release', 'local', '`--version` printed "local"', false],
        [
          'predates 2.0.19',
          'opencode v2.0.18',
          'OpenCode 2.0.18 can leave its starting prompt unsent; update OpenCode to 2.0.19 or later',
          true,
        ],
        [
          'is a prerelease',
          'opencode v0.0.0-beta-19507',
          "OpenCode 0.0.0-beta-19507 is not a stable release, so Nx can't tell whether it sends its starting prompt; install a stable release of OpenCode, 2.0.19 or later",
          true,
        ],
        [
          'carries no version',
          'opencode vlocal',
          "OpenCode local is not a stable release, so Nx can't tell whether it sends its starting prompt; install a stable release of OpenCode, 2.0.19 or later",
          true,
        ],
      ])(
        'rejects an opencode whose `--version` output %s and says why',
        async (_label, printed, reason, unsupported) => {
          const binary = standIn(
            'opencode',
            `#!/bin/sh\necho "${printed}"\n`,
            'opencode'
          );
          putOnPath(binary);

          const identity = await confirmAgentIdentity(
            opencode,
            detectedAt(binary, opencode)
          );

          expect(identity).toEqual({
            kind: 'rejected',
            binaries: [{ binary, reason, unsupported }],
          });
        }
      );
    });

    it('stops a hung probe at its deadline, with its children, and moves on', async () => {
      const pidFile = join(root, 'hung-child.pid');
      process.env.HUNG_CHILD_PID_FILE = pidFile;
      const hung = standIn(
        'hung',
        `#!/bin/sh\ntrap '' TERM\n/bin/sleep 30 &\necho $! > "$HUNG_CHILD_PID_FILE"\nwait\n`
      );
      const github = standIn('github', GITHUB);
      putOnPath(hung, github);

      const identity = await confirmAgentIdentity(copilot, detectedAt(hung));

      expect(identity).toEqual({
        kind: 'confirmed',
        agent: detectedAt(github),
      });
      const hungChild = Number(readFileSync(pidFile, 'utf-8'));
      await vi.waitFor(() => expect(isRunning(hungChild)).toBe(false), {
        timeout: 5_000,
      });
    }, 15_000);
  }
);
