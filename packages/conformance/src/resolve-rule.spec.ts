import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRootTsConfigPath, registerTsProject } = vi.hoisted(() => ({
  getRootTsConfigPath: vi.fn(),
  registerTsProject: vi.fn(),
}));

vi.mock('@nx/js', () => ({
  getRootTsConfigPath,
}));

vi.mock('@nx/js/internal', () => ({
  registerTsProject,
}));

import { resolveRule } from './resolve-rule';

const TS_RULE = './tools/conformance/rule.ts';
const UNRESOLVABLE_RULE = './tools/conformance/does-not-exist';

describe('resolveRule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getRootTsConfigPath.mockReturnValue('/workspace/tsconfig.base.json');
  });

  it('reports a typescript project setup failure with its remedy', async () => {
    const setupError = new Error("Cannot find module '@swc/core'");
    registerTsProject.mockImplementation(() => {
      throw setupError;
    });

    const result = await resolveRule({ rule: TS_RULE });

    expect(result.error?.message).toBe(
      `Failed to set up the TypeScript project for conformance rule "${TS_RULE}": Cannot find module '@swc/core'\nInstall the missing dependency, then re-run the command.`
    );
    expect(result.error?.cause).toBe(setupError);
    expect(result.data).toBeNull();
  });

  it('preserves non-Error setup failures', async () => {
    registerTsProject.mockImplementation(() => {
      throw 'registration failed';
    });

    const result = await resolveRule({ rule: TS_RULE });

    expect(result.error?.message).toContain('registration failed');
    expect(result.error?.cause).toBe('registration failed');
    expect(result.data).toBeNull();
  });

  it('keeps the generic message for unexpected failures and puts detail on cause', async () => {
    registerTsProject.mockReturnValue(vi.fn());

    const result = await resolveRule({ rule: UNRESOLVABLE_RULE });

    expect(result.error?.message).toBe(
      `Failed to resolve rule specifier: "${UNRESOLVABLE_RULE}". Make sure the specifier is correct and the path/package is installed and available.`
    );
    expect((result.error?.cause as Error)?.message).toContain(
      UNRESOLVABLE_RULE
    );
    expect(result.data).toBeNull();
  });
});
