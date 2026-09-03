import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import {
  isWorkspaceLocalResolution,
  withBuiltEntryResolutionHint,
} from './built-entry-resolution-hint';

describe('isWorkspaceLocalResolution', () => {
  it('accepts a resolved realpath when the configured root is an alias', () => {
    const fs = new TempFs('workspace-local-alias');
    const real = realpathSync(fs.tempDir);
    const alias = join(fs.tempDir, 'alias');
    mkdirSync(join(real, 'ws/packages/pkg/dist'), { recursive: true });
    writeFileSync(join(real, 'ws/packages/pkg/dist/index.js'), '');
    symlinkSync(join(real, 'ws'), alias, 'dir');

    expect(
      isWorkspaceLocalResolution(
        join(real, 'ws/packages/pkg/dist/index.js'),
        alias
      )
    ).toBe(true);
    expect(
      isWorkspaceLocalResolution(
        join(real, 'ws/node_modules/dep/index.js'),
        alias
      )
    ).toBe(false);
    fs.cleanup();
  });
});

describe('withBuiltEntryResolutionHint', () => {
  const root = '/workspace';
  const entry = '/workspace/packages/plugin/dist/index.js';
  const workspacePackageNames = ['@proj/utils', '@proj/plugin'];

  function notFound(message: string, code = 'MODULE_NOT_FOUND') {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }

  it('names the missing workspace package and the built entry, keeping the original error', () => {
    const cause = notFound("Cannot find module '@proj/utils/sub'");

    const result = withBuiltEntryResolutionHint(
      cause,
      entry,
      root,
      workspacePackageNames
    ) as Error;

    expect(result).not.toBe(cause);
    expect(result.message).toMatch(/^Cannot find module '@proj\/utils\/sub'/);
    expect(result.message).toContain(
      '"@proj/utils/sub" was requested from "packages/plugin/dist/index.js"'
    );
    expect(result.message).toContain('Build the workspace packages');
    expect(result.cause).toBe(cause);
  });

  it('relativizes a missing path inside the workspace', () => {
    const cause = notFound(
      "Cannot find module '/workspace/packages/utils/dist/index.js'",
      'ERR_MODULE_NOT_FOUND'
    );

    const result = withBuiltEntryResolutionHint(
      cause,
      entry,
      root,
      workspacePackageNames
    ) as Error;

    expect(result.message).toContain(
      '"packages/utils/dist/index.js" was requested from'
    );
  });

  it('leaves a missing third-party module or outside path untouched', () => {
    for (const cause of [
      notFound("Cannot find module 'left-pad'"),
      notFound("Cannot find module '/elsewhere/lib/index.js'"),
      notFound("Cannot find module '/workspace/node_modules/dep/index.js'"),
    ]) {
      expect(
        withBuiltEntryResolutionHint(cause, entry, root, workspacePackageNames)
      ).toBe(cause);
    }
  });

  it('leaves other errors untouched', () => {
    const error = new SyntaxError('Unexpected token');

    expect(
      withBuiltEntryResolutionHint(error, entry, root, workspacePackageNames)
    ).toBe(error);
  });

  it('leaves errors from entries outside the workspace source tree untouched', () => {
    const cause = notFound("Cannot find module '@proj/utils'");

    expect(
      withBuiltEntryResolutionHint(
        cause,
        '/workspace/node_modules/@proj/plugin/index.js',
        root,
        workspacePackageNames
      )
    ).toBe(cause);
  });
});
