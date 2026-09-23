// A spec that stops on one side of the socket cannot see what this guards: a
// payload field named `env` makes the server reflect it onto its whole
// process environment before the handler ever runs, deleting every key the
// message omits. That was a Critical, and it is only observable by driving a
// real message through the real routing.
//
// The response assertion pins the shape the client is handed, which is not
// the same as the handler's return value: a string body is parsed by the
// socket layer too, so `JSON.stringify` there is invisible here. The client
// not parsing it a second time is pinned in the client's own spec.
import type { Socket } from 'net';

const fetched = vi.hoisted(() => ({ loadIoSnapshotsForRun: vi.fn() }));
vi.mock('../../io-snapshots/store', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  loadIoSnapshotsForRun: (...args: unknown[]) =>
    fetched.loadIoSnapshotsForRun(...args),
}));
// Partial: importing the server pulls in plenty that wants the real binding.
vi.mock('../../native', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  IoSnapshotStore: vi.fn(function () {
    return { get: () => ({ commit: 'head', resolution: { fetchedAt: 1 } }) };
  }),
}));
vi.mock('../../utils/db-connection', () => ({ getDbConnection: () => 'db' }));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));

import { parseMessage } from '../../utils/consume-messages-from-socket';
import { RESOLVE_IO_SNAPSHOTS } from '../message-types/resolve-io-snapshots';
import { handleMessage } from './server';

/** Collects the framed body the server writes, the way a client reads it. */
function collectingSocket() {
  const chunks: Buffer[] = [];
  const socket = {
    write: (data: Buffer | string, cb?: (err?: Error) => void) => {
      chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      cb?.();
      return true;
    },
    end: () => {},
    destroy: () => {},
  } as unknown as Socket;
  // The first write is the 4-byte length header, the second the body.
  const body = () => chunks[chunks.length - 1];
  return { socket, body };
}

describe('the resolve message across the client/daemon seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetched.loadIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      snapshots: { commit: 'head', resolution: { fetchedAt: 1 } },
    });
  });

  it('answers with what the client can read, without touching the daemon env', async () => {
    process.env.NX_SEAM_SENTINEL = 'kept';
    const before = Object.keys(process.env).length;
    const { socket, body } = collectingSocket();

    await handleMessage(
      socket,
      Buffer.from(
        JSON.stringify({
          type: RESOLVE_IO_SNAPSHOTS,
          runnerOptions: { accessToken: 't' },
          ioSnapshotEnv: { NX_IO_SNAPSHOTS: 'true' },
        })
      )
    );

    // What the client does with the body it reads.
    expect(parseMessage(body())).toEqual({ status: 'fetched', commit: 'head' });
    // `handleClientEnv` deletes every key a reflected env omits.
    expect(process.env.NX_SEAM_SENTINEL).toBe('kept');
    expect(Object.keys(process.env).length).toBe(before);
    expect(fetched.loadIoSnapshotsForRun).toHaveBeenCalledWith(
      {},
      { accessToken: 't' },
      {
        NX_IO_SNAPSHOTS: 'true',
      }
    );
    delete process.env.NX_SEAM_SENTINEL;
  });
});
