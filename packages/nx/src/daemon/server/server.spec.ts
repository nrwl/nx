import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Socket } from 'net';

vi.mock('../logger', () => ({
  serverLogger: { log: vi.fn(), requestLog: vi.fn() },
}));
vi.mock('./shutdown-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./shutdown-utils')>()),
  resetInactivityTimeout: vi.fn(),
}));
vi.mock('./handle-hash-tasks', () => ({
  handleHashTasks: vi.fn(),
  handleHashTasksUpfront: vi.fn(),
}));

import {
  consumeMessagesFromSocket,
  parseMessage,
} from '../../utils/consume-messages-from-socket';
import { handleHashTasks } from './handle-hash-tasks';
import { handleMessage } from './server';

describe('handleMessage', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-spec-daemon-server-'));
    writeFileSync(
      join(tempDir, 'throws-at-load.js'),
      `throw new Error('load failed');`
    );
    writeFileSync(
      join(tempDir, 'rejects.js'),
      `exports.default = async () => { throw new Error('processing failed'); };`
    );
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function send(message: object) {
    let response: { error: Error | null };
    const receive = consumeMessagesFromSocket((data) => {
      response = parseMessage(data);
    });
    const socket = {
      write: (data: Buffer, cb?: () => void) => {
        receive(data);
        cb?.();
        return true;
      },
    } as unknown as Socket;
    await handleMessage(socket, Buffer.from(JSON.stringify(message)));
    return response;
  }

  it.each([
    ['the module fails to load', 'throws-at-load.js', expect.any(String)],
    ['the default export rejects', 'rejects.js', 'processing failed'],
  ])(
    'keeps running when PROCESS_IN_BACKGROUND fails because %s',
    async (_, file, expectedMessage) => {
      const response = await send({
        type: 'PROCESS_IN_BACKGROUND',
        requirePath: join(tempDir, file),
        data: {},
      });

      expect(response.error).toEqual(
        expect.objectContaining({ message: expectedMessage })
      );
      expect(process.exit).not.toHaveBeenCalled();
    }
  );

  it('exits when another request type fails', async () => {
    vi.mocked(handleHashTasks).mockRejectedValue(new Error('hashing failed'));

    const response = await send({ type: 'HASH_TASKS' });

    expect(response.error).toEqual(
      expect.objectContaining({ message: 'hashing failed' })
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
