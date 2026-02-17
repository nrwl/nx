import { nodeNativelySupportsTypeScript } from './transpiler';

describe('nodeNativelySupportsTypeScript', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process,
    'features'
  );

  function setProcessFeatures(value: any) {
    Object.defineProperty(process, 'features', {
      value,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    // Restore original process.features after each test
    if (originalDescriptor) {
      Object.defineProperty(process, 'features', originalDescriptor);
    } else {
      delete (process as any).features;
    }
  });

  it('should return true when process.features.typescript is "strip"', () => {
    setProcessFeatures({ typescript: 'strip' });
    expect(nodeNativelySupportsTypeScript()).toBe(true);
  });

  it('should return true when process.features.typescript is "transform"', () => {
    setProcessFeatures({ typescript: 'transform' });
    expect(nodeNativelySupportsTypeScript()).toBe(true);
  });

  it('should return true when process.features.typescript is true', () => {
    setProcessFeatures({ typescript: true });
    expect(nodeNativelySupportsTypeScript()).toBe(true);
  });

  it('should return false when process.features.typescript is false', () => {
    setProcessFeatures({ typescript: false });
    expect(nodeNativelySupportsTypeScript()).toBe(false);
  });

  it('should return false when process.features is undefined', () => {
    setProcessFeatures(undefined);
    expect(nodeNativelySupportsTypeScript()).toBe(false);
  });

  it('should return false when process.features exists but typescript is not set', () => {
    setProcessFeatures({});
    expect(nodeNativelySupportsTypeScript()).toBe(false);
  });
});

describe('registerPluginTSTranspiler', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process,
    'features'
  );

  function setProcessFeatures(value: any) {
    Object.defineProperty(process, 'features', {
      value,
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(process, 'features', originalDescriptor);
    } else {
      delete (process as any).features;
    }
  });

  it('should skip transpiler registration and only register tsconfig paths when Node supports TS natively', () => {
    // Simulate Node 22.6+ with native TypeScript support
    setProcessFeatures({ typescript: 'strip' });

    const mockRegisterTsConfigPaths = jest.fn(() => jest.fn());
    const mockRegisterTranspiler = jest.fn(() => jest.fn());

    jest.doMock('../../plugins/js/utils/register', () => ({
      registerTsConfigPaths: mockRegisterTsConfigPaths,
      registerTranspiler: mockRegisterTranspiler,
    }));

    jest.doMock('../../plugins/js/utils/typescript', () => ({
      readTsConfigWithoutFiles: jest.fn(() => ({
        options: {},
        raw: {},
      })),
    }));

    jest.doMock('node:fs', () => ({
      existsSync: jest.fn(() => true),
    }));

    const {
      registerPluginTSTranspiler,
      pluginTranspilerIsRegistered,
    } = require('./transpiler');

    registerPluginTSTranspiler();

    // tsconfig paths should still be registered for path mapping
    expect(mockRegisterTsConfigPaths).toHaveBeenCalled();
    // But the transpiler (swc/ts-node) should NOT be registered
    expect(mockRegisterTranspiler).not.toHaveBeenCalled();
    // The transpiler should still be considered "registered" for cleanup
    expect(pluginTranspilerIsRegistered()).toBe(true);
  });

  it('should register transpiler when Node does not support TS natively', () => {
    // Simulate older Node without native TypeScript support
    setProcessFeatures(undefined);

    const mockRegisterTsConfigPaths = jest.fn(() => jest.fn());
    const mockRegisterTranspiler = jest.fn(() => jest.fn());

    jest.doMock('../../plugins/js/utils/register', () => ({
      registerTsConfigPaths: mockRegisterTsConfigPaths,
      registerTranspiler: mockRegisterTranspiler,
    }));

    jest.doMock('../../plugins/js/utils/typescript', () => ({
      readTsConfigWithoutFiles: jest.fn(() => ({
        options: {},
        raw: {},
      })),
    }));

    jest.doMock('node:fs', () => ({
      existsSync: jest.fn(() => true),
    }));

    const { registerPluginTSTranspiler } = require('./transpiler');

    registerPluginTSTranspiler();

    // Both tsconfig paths and transpiler should be registered
    expect(mockRegisterTsConfigPaths).toHaveBeenCalled();
    expect(mockRegisterTranspiler).toHaveBeenCalled();
  });
});
