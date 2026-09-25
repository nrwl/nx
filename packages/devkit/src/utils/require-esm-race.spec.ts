import {
  isRequireEsmRaceError,
  retryOnRequireEsmRace,
} from './require-esm-race';
import { pathToFileURL } from 'node:url';

function raceError(path: string, code = 'ERR_REQUIRE_ESM_RACE_CONDITION') {
  const prefix =
    code === 'ERR_INTERNAL_ASSERTION' ? 'Unexpected module status 0. ' : '';
  return Object.assign(
    new Error(
      `${prefix}Cannot require() ES Module ${path} because it is not yet fully loaded.`
    ),
    { code }
  );
}

const node26Race = raceError(
  '/x/node_modules/@vitejs/plugin-react/dist/index.js'
);
const node22Race = raceError(
  '/x/node_modules/@vitejs/plugin-react/dist/index.js',
  'ERR_INTERNAL_ASSERTION'
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
  it('awaits the raced module before loading again', async () => {
    const racedModule = '/x/node_modules/esm-only/index.js';
    let racedModuleLoaded = false;
    const load = jest
      .fn()
      .mockRejectedValueOnce(raceError(racedModule))
      .mockImplementation(async () => {
        expect(racedModuleLoaded).toBe(true);
        return 'config';
      });
    const importModule = jest.fn(async () => {
      racedModuleLoaded = true;
    });

    await expect(retryOnRequireEsmRace(load, importModule)).resolves.toBe(
      'config'
    );
    expect(importModule).toHaveBeenCalledWith(pathToFileURL(racedModule).href);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(['ERR_REQUIRE_ESM_RACE_CONDITION', 'ERR_INTERNAL_ASSERTION'])(
    'preserves the complete module path when it contains the error delimiter for %s',
    async (code) => {
      const racedModule =
        '/tmp/workspace because it is not yet fully loaded./node_modules/esm-only/index.js';
      const load = jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(raceError(racedModule, code))
        .mockResolvedValue('config');
      const importModule = jest.fn().mockResolvedValue(undefined);

      await expect(retryOnRequireEsmRace(load, importModule)).resolves.toBe(
        'config'
      );
      expect(importModule).toHaveBeenCalledWith(
        pathToFileURL(racedModule).href
      );
      expect(load).toHaveBeenCalledTimes(2);
    }
  );

  it('suggests an ESM config extension when the module path cannot be extracted', async () => {
    const error = Object.assign(new Error('new message format'), {
      code: 'ERR_REQUIRE_ESM_RACE_CONDITION',
    });
    const load = jest.fn<Promise<string>, []>().mockRejectedValue(error);
    const importModule = jest.fn().mockResolvedValue(undefined);

    await expect(retryOnRequireEsmRace(load, importModule)).rejects.toBe(error);
    expect(error.message).toContain(
      'Rename your Vite or Vitest config file to use the .mts or .mjs extension'
    );
    expect(importModule).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('rethrows other errors without retrying', async () => {
    const error = new Error('syntax error');
    const load = jest.fn().mockRejectedValue(error);

    await expect(retryOnRequireEsmRace(load)).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('waits for each raced module', async () => {
    const firstModule = '/x/node_modules/first/index.js';
    const secondModule = '/x/node_modules/second/index.js';
    const load = jest
      .fn()
      .mockRejectedValueOnce(raceError(firstModule))
      .mockRejectedValueOnce(raceError(secondModule))
      .mockResolvedValue('config');
    const importModule = jest.fn().mockResolvedValue(undefined);

    await expect(retryOnRequireEsmRace(load, importModule)).resolves.toBe(
      'config'
    );
    expect(importModule).toHaveBeenNthCalledWith(
      1,
      pathToFileURL(firstModule).href
    );
    expect(importModule).toHaveBeenNthCalledWith(
      2,
      pathToFileURL(secondModule).href
    );
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('awaits the same raced module again before retrying', async () => {
    const racedModule = '/x/node_modules/esm-only/index.js';
    const error = raceError(racedModule);
    const load = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('config');
    const importModule = jest.fn().mockResolvedValue(undefined);

    await expect(retryOnRequireEsmRace(load, importModule)).resolves.toBe(
      'config'
    );
    expect(importModule).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after the retry limit', async () => {
    const error = raceError('/x/node_modules/esm-only/index.js');
    const load = jest.fn<Promise<string>, []>().mockRejectedValue(error);
    const importModule = jest.fn().mockResolvedValue(undefined);

    await expect(retryOnRequireEsmRace(load, importModule)).rejects.toBe(error);
    expect(importModule).toHaveBeenCalledTimes(20);
    expect(load).toHaveBeenCalledTimes(21);
  });
});
