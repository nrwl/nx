import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isRspackV2 } from '../../utils/rspack-version';
import { getSwcTranspilationTransform } from './swc-transpilation';

vi.mock('../../utils/rspack-version', () => ({
  isRspackV2: vi.fn().mockReturnValue(true),
}));

describe('getSwcTranspilationTransform', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'swc-transpilation-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const writeTsConfig = (
    name: string,
    compilerOptions: Record<string, unknown>
  ) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify({ compilerOptions, files: [] }));
    return path;
  };

  it('should not set a decorator revision for legacy decorators', () => {
    const path = writeTsConfig('legacy.json', {
      experimentalDecorators: true,
      target: 'ES2022',
    });

    expect(getSwcTranspilationTransform(path).decoratorVersion).toBeUndefined();
  });

  it("should select the '2023-11' standard decorator revision on rspack v2", () => {
    const path = writeTsConfig('standard-v2.json', { target: 'ES2022' });

    expect(getSwcTranspilationTransform(path)).toMatchObject({
      legacyDecorator: false,
      decoratorVersion: '2023-11',
    });
  });

  it("should fall back to the '2022-03' standard decorator revision on rspack v1", () => {
    vi.mocked(isRspackV2).mockReturnValueOnce(false);
    const path = writeTsConfig('standard-v1.json', { target: 'ES2022' });

    expect(getSwcTranspilationTransform(path)).toMatchObject({
      legacyDecorator: false,
      decoratorVersion: '2022-03',
    });
  });
});
