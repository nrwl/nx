import { join } from 'path';
import { pathToFileURL } from 'url';
import { runWithHookSuppliedSource } from '../../internal-testing-utils/hook-supplied-source';

describe('native index', () => {
  it('loads the bindings through Module._load when a loader hook supplies its CommonJS source', () => {
    const index = pathToFileURL(join(__dirname, '../index.js')).href;

    const result = runWithHookSuppliedSource(`
      import Module from 'node:module';
      const load = Module._load;
      let viaModuleLoad = false;
      Module._load = function (request, ...rest) {
        if (request === './native-bindings.js') viaModuleLoad = true;
        return load.call(this, request, ...rest);
      };
      const native = await import(${JSON.stringify(index)});
      console.log(typeof native.hashArray, viaModuleLoad);
    `);

    expect(result.stderr).not.toContain('Error');
    expect(result.stdout.trim()).toBe('function true');
  });
});
