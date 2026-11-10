import { readRuntimeDependencies } from './runtime-dependencies';

vi.mock('@nx/devkit/internal', () => ({
  readModulePackageJson: (name: string) => ({
    packageJson:
      name === 'aliased-dependency'
        ? { name: 'target-package', version: '1.0.0' }
        : { name, version: '2.0.0' },
    path: '',
  }),
}));

describe('readRuntimeDependencies', () => {
  it('keeps each requested name and gives an npm alias an npm: spec', () => {
    expect(
      readRuntimeDependencies(['plain-dependency', 'aliased-dependency'], [])
    ).toEqual({
      'plain-dependency': '2.0.0',
      'aliased-dependency': 'npm:target-package@1.0.0',
    });
  });
});
