import { getWorkspacePackagesMetadata } from './packages';

describe('getWorkspacePackagesMetadata', () => {
  it('only exposes packages linked by the package manager to source resolvers', () => {
    const included = {
      root: 'packages/included',
      metadata: {
        js: {
          packageName: '@proj/utils',
          packageExports: { '.': './src/index.ts' },
          isInPackageManagerWorkspaces: true,
        },
      },
    } as any;
    const excluded = {
      root: 'tools/excluded',
      metadata: {
        js: {
          packageName: '@third-party/utils',
          packageExports: { '.': './src/index.ts' },
          isInPackageManagerWorkspaces: false,
        },
      },
    } as any;

    const metadata = getWorkspacePackagesMetadata({ included, excluded });

    expect(metadata.packageToProjectMap).toEqual({
      '@proj/utils': included,
      '@third-party/utils': excluded,
    });
    expect(metadata.packageManagerWorkspacePackageNames).toEqual([
      '@proj/utils',
    ]);
  });
});
