import { TempFs } from '@nx/devkit/internal-testing-utils';
import {
  PNPM_INSTALL_SETTINGS_INPUTS,
  PNPM_MAJOR_RUNTIME_INPUT,
  pnpmInstallSettingsInputsForInferredTarget,
  shouldIncludePnpmMajorRuntimeInput,
} from './pnpm-install-settings-inputs';

describe('shouldIncludePnpmMajorRuntimeInput', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('pnpm-install-settings-inputs');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('is false outside pnpm workspaces regardless of the pin', () => {
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );

    expect(shouldIncludePnpmMajorRuntimeInput('npm', tempFs.tempDir)).toBe(
      false
    );
  });

  it('is false when the root package.json pins a pnpm version', () => {
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );

    expect(shouldIncludePnpmMajorRuntimeInput('pnpm', tempFs.tempDir)).toBe(
      false
    );
  });

  it.each([
    ['no root package.json', undefined],
    ['an unreadable root package.json', '{ not json'],
    ['no packageManager field', JSON.stringify({})],
    [
      'a non-string packageManager field',
      JSON.stringify({ packageManager: 1 }),
    ],
    [
      'another package manager',
      JSON.stringify({ packageManager: 'yarn@4.9.1' }),
    ],
    [
      'a URL',
      JSON.stringify({ packageManager: 'pnpm@https://example.com/pnpm.tgz' }),
    ],
    [
      'an unparseable version',
      JSON.stringify({ packageManager: 'pnpm@latest' }),
    ],
  ])('is true with %s', (_, content) => {
    if (content !== undefined) {
      tempFs.createFileSync('package.json', content);
    }

    expect(shouldIncludePnpmMajorRuntimeInput('pnpm', tempFs.tempDir)).toBe(
      true
    );
  });
});

describe('pnpmInstallSettingsInputsForInferredTarget', () => {
  it('returns the full set with the probe', () => {
    expect(pnpmInstallSettingsInputsForInferredTarget(true)).toEqual(
      PNPM_INSTALL_SETTINGS_INPUTS
    );
  });

  it('returns only the file inputs without the probe', () => {
    expect(pnpmInstallSettingsInputsForInferredTarget(false)).toEqual(
      PNPM_INSTALL_SETTINGS_INPUTS.filter(
        (input) => input !== PNPM_MAJOR_RUNTIME_INPUT
      )
    );
  });
});
