import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The catalog manager-utils logic is intentionally duplicated in @nx/devkit:
// devkit supports nx across a +/-1 major range and cannot import nx internals,
// so the file is copied rather than shared. Guard the two copies against
// drifting: everything from the first helper onward must stay byte-identical,
// otherwise a fix on one side silently diverges pnpm/yarn catalog behavior
// between `nx` and `@nx/devkit`.
describe('catalog manager-utils nx/devkit parity', () => {
  it('keeps the nx and devkit copies identical below the import block', () => {
    const marker = 'function resolveAt';
    const nxSource = readFileSync(join(__dirname, 'manager-utils.ts'), 'utf-8');
    const devkitSource = readFileSync(
      join(__dirname, '../../../../devkit/src/utils/catalog/manager-utils.ts'),
      'utf-8'
    );

    expect(nxSource).toContain(marker);
    expect(devkitSource).toContain(marker);
    expect(nxSource.slice(nxSource.indexOf(marker))).toBe(
      devkitSource.slice(devkitSource.indexOf(marker))
    );
  });
});
