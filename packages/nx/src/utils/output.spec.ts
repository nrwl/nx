import { Writable } from 'stream';
import { output } from './output';

/**
 * A stdout stand-in that never completes a write until the test releases or fails
 * it, so queued bytes stay queued — the state a slow pipe reader produces.
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

    // Node's real ordering: write callback first, then the 'error' event. Emitting
    // 'error' directly, or dropping the listener assertion, each let a
    // listener-removing refactor pass here while crashing on an actual pipe.
    stalled.failPending(Object.assign(new Error('EPIPE'), { code: 'EPIPE' }));
    expect(stalled.stream.listenerCount('error')).toBe(1);
    await expect(promise).resolves.toBeUndefined();
    // Settle the deferred detach here so a too-early removal surfaces in this test
    // rather than as an unhandled error attributed to whichever test runs next.
    await new Promise((res) => setImmediate(res));
  });

  // process.nextTick drains before the 'error' emit, so a cleanup deferred that far
  // detaches too early and the EPIPE goes unhandled. Only a macrotask is late enough.
  it('keeps the listener attached through the nextTick queue', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    stalled.stream.write('f'.repeat(50));
    const promise = output.drain();
    stalled.release();

    await new Promise((res) => process.nextTick(res));
    expect(stalled.stream.listenerCount('error')).toBe(1);

    await promise;
    await new Promise((res) => setImmediate(res));
    expect(stalled.stream.listenerCount('error')).toBe(0);
  });

  // The cleanup is deferred, so it must target the stream drain() attached to
  // rather than re-reading process.stdout after a caller has swapped it.
  it('detaches from the stream it attached to, not the current process.stdout', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    stalled.stream.write('e'.repeat(50));
    const promise = output.drain();
    // Guards against the assertion below passing vacuously on an early return.
    expect(stalled.stream.listenerCount('error')).toBe(1);
    stalled.release();
    await promise;

    useStdout(realStdout);
    await new Promise((res) => setImmediate(res));

    expect(stalled.stream.listenerCount('error')).toBe(0);
  });

  // A positional (chunk, encoding, callback) stdout patch that does not normalize —
  // as any third-party wrapper may be — drops a two-argument write's callback.
  it('resolves when process.stdout.write is patched positionally', async () => {
    const stalled = stalledStdout(1000);
    useStdout(stalled.stream);

    stalled.stream.write('g'.repeat(50));
    let writes = 0;
    (stalled.stream as any).write = (
      _chunk: unknown,
      _encoding: unknown,
      callback?: () => void
    ) => {
      writes++;
      if (callback) callback();
      return true;
    };

    await expect(output.drain()).resolves.toBeUndefined();
    // Also guards against an early return: drain must have reached the patched
    // writer rather than resolving before it queued anything.
    expect(writes).toBe(1);
  }, 5000);

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
