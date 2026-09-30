import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache } from '@angular/build/private';
import { createJavaScriptTransformer } from './javascript-transformer';

const {
  transformerCtorMock,
  transformDataMock,
  transformFileMock,
  isAngularBuildVersionAtLeastMock,
} = vi.hoisted(() => ({
  transformerCtorMock: vi.fn(),
  transformDataMock: vi.fn(),
  transformFileMock: vi.fn(),
  isAngularBuildVersionAtLeastMock: vi.fn(),
}));

vi.mock('@angular/build/private', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@angular/build/private')>()),
  JavaScriptTransformer: class {
    transformData = transformDataMock;
    transformFile = transformFileMock;
    constructor(...args: unknown[]) {
      transformerCtorMock(...args);
    }
  },
}));

vi.mock('./angular-build-version', () => ({
  isAngularBuildVersionAtLeast: isAngularBuildVersionAtLeastMock,
}));

vi.mock('./utils', () => ({
  maxWorkers: () => 3,
  maxTransformWorkers: () => 2,
}));

describe('createJavaScriptTransformer', () => {
  const options = { sourcemap: true, jit: false };
  const cache = new Cache<Uint8Array>(new Map());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass the pre-22.2 worker count and flags positionally before @angular/build 22.2', async () => {
    isAngularBuildVersionAtLeastMock.mockReturnValue(false);

    const transformer = createJavaScriptTransformer(options, cache);
    await transformer.transformData('/a.ts', 'code', true, false);

    expect(transformerCtorMock).toHaveBeenCalledWith(options, 3, cache);
    expect(transformDataMock).toHaveBeenCalledWith(
      '/a.ts',
      'code',
      true,
      false
    );
  });

  it('should pass the 22.2 worker count and flags as options on @angular/build 22.2', async () => {
    isAngularBuildVersionAtLeastMock.mockReturnValue(true);

    const transformer = createJavaScriptTransformer(options, cache);
    await transformer.transformData('/a.ts', 'code', true, false);
    await transformer.transformFile('/b.mjs', false);

    expect(transformerCtorMock).toHaveBeenCalledWith(
      { ...options, maxConcurrency: 2 },
      cache
    );
    const [, , dataOptions] = transformDataMock.mock.calls[0];
    expect(dataOptions.skipLinker).toBe(true);
    await expect(dataOptions.sideEffects()).resolves.toBe(false);
    expect(transformFileMock).toHaveBeenCalledWith('/b.mjs', {
      skipLinker: false,
      sideEffects: undefined,
    });
  });
});
