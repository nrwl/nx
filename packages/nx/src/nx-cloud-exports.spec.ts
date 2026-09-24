import * as nxCloudExports from './nx-cloud-exports';

// The Nx Cloud client probes these names; removing or renaming one breaks it.
it('exposes what the Nx Cloud client loads', () => {
  expect(Object.keys(nxCloudExports).sort()).toEqual(['importIoSnapshots']);
  expect(typeof nxCloudExports.importIoSnapshots).toBe('function');
});
