import * as packageManager from '../package-manager';
import { getCatalogManager } from './manager-factory';
import { PnpmCatalogManager } from './pnpm-manager';
import {
  BunCatalogManager,
  NpmCatalogManager,
  YarnCatalogManager,
} from './unsupported-manager';

describe('getCatalogManager', () => {
  const mockDetectPackageManager = jest.spyOn(
    packageManager,
    'detectPackageManager'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return PnpmCatalogManager for pnpm', () => {
    mockDetectPackageManager.mockReturnValue('pnpm');

    const manager = getCatalogManager('/test');

    expect(manager).toBeInstanceOf(PnpmCatalogManager);
    expect(manager.supportsCatalogs()).toBe(true);
  });

  it('should return NpmCatalogManager for npm', () => {
    mockDetectPackageManager.mockReturnValue('npm');

    const manager = getCatalogManager('/test');

    expect(manager).toBeInstanceOf(NpmCatalogManager);
    expect(manager.supportsCatalogs()).toBe(false);
  });

  it('should return YarnCatalogManager for yarn', () => {
    mockDetectPackageManager.mockReturnValue('yarn');

    const manager = getCatalogManager('/test');

    expect(manager).toBeInstanceOf(YarnCatalogManager);
    expect(manager.supportsCatalogs()).toBe(false);
  });

  it('should return BunCatalogManager for bun', () => {
    mockDetectPackageManager.mockReturnValue('bun');

    const manager = getCatalogManager('/test');

    expect(manager).toBeInstanceOf(BunCatalogManager);
    expect(manager.supportsCatalogs()).toBe(false);
  });
});
