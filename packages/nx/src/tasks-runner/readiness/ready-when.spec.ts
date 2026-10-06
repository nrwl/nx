import { normalizeReadyWhen } from './ready-when';

describe('normalizeReadyWhen', () => {
  it('keeps the knobs and fills in the default timeout', () => {
    expect(
      normalizeReadyWhen(
        { url: 'http://localhost:4200', timeout: 5, interval: 2 },
        'app:serve'
      )
    ).toEqual({
      kind: 'url',
      url: 'http://localhost:4200',
      timeout: 5,
      interval: 2,
    });
    expect(normalizeReadyWhen({ port: 3000 }, 'app:serve')).toEqual({
      kind: 'port',
      port: 3000,
      timeout: 60_000,
    });
    expect(
      normalizeReadyWhen({ port: 3000, host: 'localhost' }, 'app:serve')
    ).toMatchObject({ kind: 'port', host: 'localhost' });
    expect(normalizeReadyWhen({ logMatches: 'a' }, 'app:serve')).toMatchObject({
      kind: 'logMatches',
      logMatches: ['a'],
    });
  });

  it.each([
    ['ready on', 'expected an object'],
    [{}, 'expected exactly one of'],
    [{ url: 'http://x', port: 1 }, 'expected exactly one of'],
    [{ url: 'ftp://x' }, '"url" must be an http or https URL'],
    [{ url: 'not a url' }, '"url" must be an http or https URL'],
    [{ port: 0 }, '"port" must be an integer from 1 to 65535'],
    [{ port: 70000 }, '"port" must be an integer from 1 to 65535'],
    [{ port: 80, host: '' }, '"host" must be a non-empty string'],
    [{ command: '' }, '"command" must be a non-empty string'],
    [{ logMatches: [] }, '"logMatches" must be a non-empty string'],
    [{ logMatches: ['a', ''] }, '"logMatches" must be a non-empty string'],
    [{ port: 80, timeout: 0 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, timeout: 2 ** 31 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, interval: 1.5 }, '"interval" must be an integer from 1 to'],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() => normalizeReadyWhen(readyWhen as any, 'app:serve')).toThrow(
      `Task "app:serve" has an invalid "readyWhen": ${reason}`
    );
  });
});
