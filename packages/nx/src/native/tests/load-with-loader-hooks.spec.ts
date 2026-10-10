import { join } from 'path';
import { pathToFileURL } from 'url';
import { runWithHookSuppliedSource } from '../../internal-testing-utils/hook-supplied-source';

describe('native index', () => {
  it('loads when a loader hook supplies its CommonJS source', () => {
    const index = pathToFileURL(join(__dirname, '../index.js')).href;

    const result = runWithHookSuppliedSource(
      `const native = await import(${JSON.stringify(index)}); console.log(typeof native.hashArray);`
    );

    expect(result.stderr).not.toContain('TypeError');
    expect(result.stdout.trim()).toBe('function');
  });
});
