import * as packageManager from './package-manager';
import { ensurePackageHasProvenance } from './provenance';

describe('ensurePackageHasProvenance', () => {
  const attestationUrl =
    'https://registry.npmjs.org/-/npm/v1/attestations/nx@1.0.0';
  // shaped like a real `npm view <pkg>@<version> --json` entry
  const packument = (version: string, withAttestations = true) => ({
    version,
    dist: {
      integrity: `sha512-${version}`,
      ...(withAttestations
        ? { attestations: { url: `${attestationUrl}-${version}` } }
        : {}),
    },
  });

  let packageRegistryViewSpy: jest.SpyInstance;
  const originalFetch = global.fetch;
  const originalSkip = process.env.NX_SKIP_PROVENANCE_CHECK;

  beforeEach(() => {
    delete process.env.NX_SKIP_PROVENANCE_CHECK;
    packageRegistryViewSpy = jest.spyOn(packageManager, 'packageRegistryView');
    // fail the fetch so the check stops right after locating the attestation
    // URL; isolates the npm-view parsing from full attestation validation.
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalSkip === undefined) {
      delete process.env.NX_SKIP_PROVENANCE_CHECK;
    } else {
      process.env.NX_SKIP_PROVENANCE_CHECK = originalSkip;
    }
  });

  it('does nothing when NX_SKIP_PROVENANCE_CHECK is set', async () => {
    process.env.NX_SKIP_PROVENANCE_CHECK = 'true';

    await expect(
      ensurePackageHasProvenance('nx', '1.0.0')
    ).resolves.toBeUndefined();
    expect(packageRegistryViewSpy).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('locates the attestation URL when npm returns a bare object (npm <= 11)', async () => {
    packageRegistryViewSpy.mockResolvedValue(
      JSON.stringify(packument('1.0.0'))
    );

    // reaching the fetch (HTTP 500) proves the attestation URL was found
    await expect(ensurePackageHasProvenance('nx', '1.0.0')).rejects.toThrow(
      'HTTP 500'
    );
    expect(global.fetch).toHaveBeenCalledWith(`${attestationUrl}-1.0.0`);
  });

  it('locates the attestation URL when npm 12 / pnpm wrap a single version in an array', async () => {
    packageRegistryViewSpy.mockResolvedValue(
      JSON.stringify([packument('1.0.0')])
    );

    await expect(ensurePackageHasProvenance('nx', '1.0.0')).rejects.toThrow(
      'HTTP 500'
    );
    expect(global.fetch).toHaveBeenCalledWith(`${attestationUrl}-1.0.0`);
  });

  it('refuses a version range that matches multiple versions', async () => {
    // a range yields every matching version; we cannot tell which one installs
    packageRegistryViewSpy.mockResolvedValue(
      JSON.stringify([
        packument('1.0.0'),
        packument('1.1.0'),
        packument('1.2.0'),
      ])
    );

    await expect(ensurePackageHasProvenance('nx', '^1.0.0')).rejects.toThrow(
      'Specify an exact version'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when a bare object has no attestation URL', async () => {
    packageRegistryViewSpy.mockResolvedValue(
      JSON.stringify(packument('1.0.0', false))
    );

    await expect(ensurePackageHasProvenance('nx', '1.0.0')).rejects.toThrow(
      'No attestation URL found'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when a single-element array has no attestation URL', async () => {
    packageRegistryViewSpy.mockResolvedValue(
      JSON.stringify([packument('1.0.0', false)])
    );

    await expect(ensurePackageHasProvenance('nx', '1.0.0')).rejects.toThrow(
      'No attestation URL found'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws on an empty array rather than crashing', async () => {
    packageRegistryViewSpy.mockResolvedValue(JSON.stringify([]));

    await expect(ensurePackageHasProvenance('nx', '1.0.0')).rejects.toThrow(
      'No attestation URL found'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
