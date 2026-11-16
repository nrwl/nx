import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initializeAngularBuildHash } from './angular-build-hash';

describe('initializeAngularBuildHash', () => {
  it('should initialize the hashing the installed @angular/build tools use', async () => {
    const requireFn = createRequire(__filename);
    const { calculateHash }: { calculateHash: (data: string) => string } =
      requireFn(
        join(
          dirname(requireFn.resolve('@angular/build/package.json')),
          'src/utils/hash.js'
        )
      );
    expect(() => calculateHash('content')).toThrow(
      'Hash utility must be initialized'
    );

    await initializeAngularBuildHash();

    expect(calculateHash('content')).toMatch(/^[0-9a-f]{16}$/);
  });
});
