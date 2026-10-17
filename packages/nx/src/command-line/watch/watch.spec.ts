import { spawn, type SpawnOptions } from 'child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { daemonClient } from '../../daemon/client/client';
import { watch } from './watch';

vi.mock('child_process', { spy: true });
vi.mock('../../daemon/client/client', () => ({
  daemonClient: {
    enabled: () => true,
    registerFileWatcher: vi.fn(),
  },
  WatcherFailedError: class extends Error {},
}));

describe('watch', () => {
  it('runs each project once per batch and coalesces changes received while commands run', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nx-watch-commands '));
    const releaseFile = join(directory, 'release');
    const children: { project: string; closed: Promise<void> }[] = [];
    const commandErrors: Error[] = [];
    const { spawn: realSpawn } =
      await vi.importActual<typeof import('child_process')>('child_process');

    vi.mocked(spawn).mockImplementation((...args) => {
      const child = realSpawn(...args);
      children.push({
        project: (args.at(-1) as SpawnOptions).env.NX_PROJECT_NAME,
        closed: new Promise<void>((resolve) =>
          child.once('close', (code, signal) => {
            if (code !== 0) {
              commandErrors.push(
                new Error(`Command exited with ${signal ?? code}.`)
              );
            }
            resolve();
          })
        ),
      });
      child.once('error', (error) => commandErrors.push(error));
      return child;
    });

    type FileWatcherCallback = Parameters<
      typeof daemonClient.registerFileWatcher
    >[1];
    const registered = new Promise<FileWatcherCallback>((resolve) => {
      vi.mocked(daemonClient.registerFileWatcher).mockImplementation(
        async (_config, callback) => {
          resolve(callback);
          return () => {};
        }
      );
    });

    type CommandRecord = { project: string; files: string[] };
    function records(): CommandRecord[] {
      return readdirSync(directory)
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(readFileSync(join(directory, file), 'utf8')))
        .map(({ project, files }) => ({ project, files: files.sort() }));
    }

    const byProjectAndFiles = (a: CommandRecord, b: CommandRecord) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b));
    const expectedRecords: CommandRecord[] = [
      { project: 'A', files: ['A/start1', 'A/start2', 'B/start'] },
      { project: 'B', files: ['A/start1', 'A/start2', 'B/start'] },
      { project: 'A', files: ['A/a', 'B/b', 'B/c'] },
      { project: 'B', files: ['A/a', 'B/b', 'B/c'] },
    ].sort(byProjectAndFiles);

    async function drainCommands() {
      let completed = 0;
      do {
        const pending = children.slice(completed);
        completed = children.length;
        await Promise.all(pending.map(({ closed }) => closed));
        // The runner schedules pending batches after command exit callbacks.
        await new Promise<void>((resolve) => setImmediate(resolve));
      } while (completed < children.length);
    }

    try {
      const watching = watch({
        projects: ['A', 'B'],
        command:
          [
            process.execPath,
            join(__dirname, '__fixtures__/watch-command.fixture.js'),
            directory,
          ]
            .map(quoteShellArgument)
            .join(' ') +
          (process.platform === 'win32'
            ? ' "%NX_PROJECT_NAME%"'
            : ' "$NX_PROJECT_NAME"'),
      });
      const onChange = await Promise.race([
        registered,
        watching.then(() => {
          throw new Error('Watch stopped before registering for changes.');
        }),
      ]);
      const deliver = (projects: string[], files: string[]) =>
        onChange(null, {
          changedProjects: projects,
          changedFiles: files.map((path) => ({ path, type: 'update' })),
        });

      deliver(['A', 'B'], ['A/start1', 'A/start2', 'B/start']);
      await vi.waitFor(
        () =>
          expect(records().map(({ project }) => project)).toEqual(
            expect.arrayContaining(['A', 'B'])
          ),
        { timeout: 10_000 }
      );

      deliver(['A'], ['A/a']);
      deliver(['B'], ['B/b']);
      deliver(['B'], ['B/b', 'B/c']);
      writeFileSync(join(directory, 'release-A'), '');
      await children.find(({ project }) => project === 'A').closed;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(children).toHaveLength(2);

      writeFileSync(releaseFile, '');
      await vi.waitFor(
        () =>
          expect(records()).toEqual(expect.arrayContaining(expectedRecords)),
        { timeout: 10_000 }
      );
      await drainCommands();

      expect(commandErrors).toEqual([]);
      expect(records().sort(byProjectAndFiles)).toEqual(expectedRecords);
    } finally {
      writeFileSync(releaseFile, '');
      await drainCommands();
      vi.mocked(spawn).mockImplementation(realSpawn);
      vi.mocked(daemonClient.registerFileWatcher).mockReset();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function quoteShellArgument(value: string) {
  return process.platform === 'win32'
    ? `"${value}"`
    : `'${value.replace(/'/g, "'\\''")}'`;
}
