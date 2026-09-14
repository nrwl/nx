import {
  isRequireEsmRaceError,
  retryOnRequireEsmRace,
} from './retry-on-require-esm-race';

const node26Race = Object.assign(
  new Error(
    'Cannot require() ES Module /x/node_modules/@vitejs/plugin-react/dist/index.js because it is not yet fully loaded.'
  ),
  { code: 'ERR_REQUIRE_ESM_RACE_CONDITION' }
);
const node22Race = Object.assign(
  new Error(
    'Unexpected module status 0. Cannot require() ES Module /x/node_modules/@vitejs/plugin-react/dist/index.js because it is not yet fully loaded.'
  ),
  { code: 'ERR_INTERNAL_ASSERTION' }
);

describe('isRequireEsmRaceError', () => {
  it('matches both Node spellings of the require/import race', () => {
    expect(isRequireEsmRaceError(node26Race)).toBe(true);
    expect(isRequireEsmRaceError(node22Race)).toBe(true);
  });

  it('does not match other internal assertions or errors', () => {
    expect(
      isRequireEsmRaceError(
        Object.assign(new Error('boom'), { code: 'ERR_INTERNAL_ASSERTION' })
      )
    ).toBe(false);
    expect(isRequireEsmRaceError(new Error('not yet fully loaded'))).toBe(
      false
    );
    expect(isRequireEsmRaceError(undefined)).toBe(false);
  });
});

describe('retryOnRequireEsmRace', () => {
  it('re-runs the load after a race error', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(node22Race)
      .mockRejectedValueOnce(node26Race)
      .mockResolvedValue('config');

    await expect(retryOnRequireEsmRace(load)).resolves.toBe('config');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('rethrows other errors without retrying', async () => {
    const load = jest.fn().mockRejectedValue(new Error('syntax error'));

    await expect(retryOnRequireEsmRace(load)).rejects.toThrow('syntax error');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('gives up after a bounded number of attempts', async () => {
    const load = jest.fn().mockRejectedValue(node26Race);

    await expect(retryOnRequireEsmRace(load)).rejects.toBe(node26Race);
    expect(load).toHaveBeenCalledTimes(5);
  });
});
