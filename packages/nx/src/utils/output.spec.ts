import { Writable } from 'stream';
import { output } from './output';

/**
 * A stdout stand-in that never completes a write until `release()` is called,
 * so queued bytes stay queued — the state a slow pipe reader produces.
 */
function stalledStdout(highWaterMark: number) {
  const pending: Array<(err?: Error) => void> = [];
  let received = '';
  const stream = new Writable({
    highWaterMark,
    write(chunk, _enc, cb) {
      pending.push((err) => {
        if (!err) received += chunk.toString();
        cb(err);
      });
    },
  });
  return {
    stream,
    get received() {
      return received;
    },
    release: () => {
      while (pending.length) pending.shift()!();
    },
    // Node hands EPIPE to the write callback first, then emits 'error'.
    failPending: (err: Error) => {
      while (pending.length) pending.shift()!(err);
    },
  };
}

describe('output.drain', () => {
  const realStdout = process.stdout;

  function useStdout(stream: Writable) {
    Object.defineProperty(process, 'stdout', {
      value: stream,
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(process, 'stdout', {
      value: realStdout,
      configurable: true,
    });
  });

  it('resolves immediately when nothing is queued', async () => {
    const { stream } = stalledStdout(1000);
    useStdout(stream);

    await expect(output.drain()).resolves.toBeUndefined();
  });

  // Regression: `writableNeedDrain` is only set past the high-water mark, so a
  // queue shorter than it used to resolve drain() instantly and let process.exit()
  // discard the bytes. 50 bytes against a 1000-byte mark reproduces that exactly.
  it('waits for a queue shorter than the high-water mark', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    stalled.stream.write('a'.repeat(50));
    expect(stalled.stream.writableNeedDrain).toBe(false);
    expect(stalled.stream.writableLength).toBeGreaterThan(0);

    let drained = false;
    const promise = output.drain().then(() => (drained = true));

    await new Promise((res) => setImmediate(res));
    expect(drained).toBe(false);

    stalled.release();
    await promise;
    expect(drained).toBe(true);
    expect(stalled.received).toBe('a'.repeat(50));
  });

  it('waits for a queue longer than the high-water mark', async () => {
    const stalled = stalledStdout(100);
    useStdout(stalled.stream);

    stalled.stream.write('b'.repeat(500));
    expect(stalled.stream.writableNeedDrain).toBe(true);

    let drained = false;
    const promise = output.drain().then(() => (drained = true));

    await new Promise((res) => setImmediate(res));
    expect(drained).toBe(false);

    stalled.release();
    await promise;
    expect(drained).toBe(true);
    expect(stalled.received).toBe('b'.repeat(500));
  });

  // `nx ... | head` leaves the write end open with no reader; the EPIPE must not
  // hang the drain or surface as an unhandled 'error' event.
  it('resolves instead of hanging when the stream errors', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    stalled.stream.write('c'.repeat(50));
    const promise = output.drain();

    // Drive the error through Node's real ordering — write callback first, then
    // the 'error' event. A bare emit lets a listener-removing refactor pass here
    // while crashing on an actual pipe.
    stalled.failPending(Object.assign(new Error('EPIPE'), { code: 'EPIPE' }));

    await expect(promise).resolves.toBeUndefined();
  });

  it('leaves no error listener behind', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    for (let i = 0; i < 3; i++) {
      stalled.stream.write('d'.repeat(50));
      const promise = output.drain();
      stalled.release();
      await promise;
    }
    await new Promise((res) => setImmediate(res));

    expect(stalled.stream.listenerCount('error')).toBe(0);
  });
});
