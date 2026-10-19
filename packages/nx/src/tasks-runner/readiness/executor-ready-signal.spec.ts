import { signalReadyAtBaseUrl } from './executor-ready-signal';
import { emitReadySignal } from './ready-signal';

vi.mock('./ready-signal', () => ({
  emitReadySignal: vi.fn(),
}));

type Result = { success: boolean; baseUrl?: string };

async function drain(results: Result[], returned?: Result) {
  async function* executor(): AsyncIterableIterator<Result> {
    yield* results;
    return returned;
  }
  const iterator = signalReadyAtBaseUrl(executor());
  const yielded: Result[] = [];
  let next = await iterator.next();
  while (!next.done) {
    yielded.push(next.value);
    next = await iterator.next();
  }
  return { yielded, returned: next.value };
}

describe('signalReadyAtBaseUrl', () => {
  beforeEach(() => {
    vi.mocked(emitReadySignal).mockClear();
  });

  it('signals once, at the first successful result with a url, and passes every result through', async () => {
    const results = [
      { success: false, baseUrl: 'http://localhost:4100/' },
      { success: true },
      { success: true, baseUrl: 'http://localhost:4200/app/' },
      { success: true, baseUrl: 'http://localhost:4300/' },
    ];

    expect(await drain(results, { success: false })).toEqual({
      yielded: results,
      returned: { success: false },
    });
    expect(emitReadySignal).toHaveBeenCalledTimes(1);
    expect(emitReadySignal).toHaveBeenCalledWith('http://localhost:4200/app/');
  });

  it.each([
    ['http://0.0.0.0:4200', 'http://localhost:4200/'],
    ['https://[::]:4200/app/', 'https://localhost:4200/app/'],
    ['http://127.0.0.1:4200', 'http://127.0.0.1:4200/'],
    ['http://:4200', undefined],
    ['', undefined],
    ['localhost:4200', undefined],
  ])('signals %j as %j', async (baseUrl, url) => {
    await drain([{ success: true, baseUrl }]);

    if (url) {
      expect(emitReadySignal).toHaveBeenCalledWith(url);
    } else {
      expect(emitReadySignal).not.toHaveBeenCalled();
    }
  });
});
