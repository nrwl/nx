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
  const entry = {
    path: '/workspace/packages/plugin/dist/index.js',
    projectRoot: 'packages/plugin',
  };
  const workspacePackages = [
    { name: '@proj/utils', root: 'packages/utils' },
    { name: '@proj/plugin', root: 'packages/plugin' },
  ];

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
      workspacePackages
    ) as Error;

    expect(result).not.toBe(cause);
    expect(result.message).toMatch(/^Cannot find module '@proj\/utils\/sub'/);
    expect(result.message).toContain(
      '"@proj/utils/sub" was requested from "packages/plugin/dist/index.js"'
    );
    expect(result.message).toContain('Build the workspace packages');
    expect(result.cause).toBe(cause);
  });

  it('relativizes a missing path inside another workspace package', () => {
    const cause = notFound(
      "Cannot find module '/workspace/packages/utils/dist/index.js'",
      'ERR_MODULE_NOT_FOUND'
    );

    const result = withBuiltEntryResolutionHint(
      cause,
      entry,
      root,
      workspacePackages
    ) as Error;

    expect(result.message).toContain(
      '"packages/utils/dist/index.js" was requested from'
    );
  });

  it('relativizes from the real root when the workspace root is an alias', () => {
    const fs = new TempFs('built-entry-hint-alias');
    const real = realpathSync(fs.tempDir);
    const alias = join(fs.tempDir, 'alias');
    mkdirSync(join(real, 'ws/packages/plugin/dist'), { recursive: true });
    mkdirSync(join(real, 'ws/packages/utils'), { recursive: true });
    symlinkSync(join(real, 'ws'), alias, 'dir');
    const cause = notFound(
      `Cannot find module '${join(real, 'ws/packages/utils/dist/index.js')}'`,
      'ERR_MODULE_NOT_FOUND'
    );

    const result = withBuiltEntryResolutionHint(
      cause,
      {
        path: join(alias, 'packages/plugin/dist/index.js'),
        projectRoot: 'packages/plugin',
      },
      alias,
      workspacePackages
    ) as Error;

    expect(result.message).toContain(
      '"packages/utils/dist/index.js" was requested from "packages/plugin/dist/index.js"'
    );
    fs.cleanup();
  });

  it("leaves a file missing from the entry's own package untouched", () => {
    for (const cause of [
      notFound(
        "Cannot find module '/workspace/packages/plugin/dist/missing.js' imported from /workspace/packages/plugin/dist/index.js",
        'ERR_MODULE_NOT_FOUND'
      ),
      notFound(
        "Cannot find module '/workspace/packages/plugin/dist/missing.js'"
      ),
      notFound("Cannot find module '@proj/plugin/missing'"),
    ]) {
      expect(
        withBuiltEntryResolutionHint(cause, entry, root, workspacePackages)
      ).toBe(cause);
    }
  });

  it("leaves a file missing from the entry's own project untouched when the build output lives outside the project root", () => {
    const cause = notFound(
      "Cannot find module '/workspace/packages/plugin/assets/missing.json'"
    );
    const relocatedEntry = {
      path: '/workspace/dist/packages/plugin/index.js',
      projectRoot: 'packages/plugin',
    };

    for (const packages of [
      workspacePackages,
      [...workspacePackages, { name: '@proj/root', root: '.' }],
    ]) {
      expect(
        withBuiltEntryResolutionHint(cause, relocatedEntry, root, packages)
      ).toBe(cause);
    }
  });

  it('leaves a file missing from relocated build output untouched when a root package absorbs it', () => {
    const cause = notFound(
      "Cannot find module '/workspace/dist/packages/plugin/missing.js'"
    );

    expect(
      withBuiltEntryResolutionHint(
        cause,
        {
          path: '/workspace/dist/packages/plugin/index.js',
          projectRoot: 'packages/plugin',
        },
        root,
        [...workspacePackages, { name: '@proj/root', root: '.' }]
      )
    ).toBe(cause);
  });

  it('leaves a file missing next to an entry generated inside another package untouched', () => {
    const cause = notFound(
      "Cannot find module '/workspace/packages/utils/generated/plugin/missing.js'"
    );

    expect(
      withBuiltEntryResolutionHint(
        cause,
        {
          path: '/workspace/packages/utils/generated/plugin/index.js',
          projectRoot: 'packages/plugin',
        },
        root,
        workspacePackages
      )
    ).toBe(cause);
  });

  it('adds no hint between a project and a package nested under it', () => {
    const packages = [
      ...workspacePackages,
      { name: '@proj/plugin-sub', root: 'packages/plugin/sub' },
    ];
    const fromParent = notFound("Cannot find module '@proj/plugin-sub'");
    const fromChild = notFound("Cannot find module '@proj/plugin'");

    expect(
      withBuiltEntryResolutionHint(fromParent, entry, root, packages)
    ).toBe(fromParent);
    expect(
      withBuiltEntryResolutionHint(
        fromChild,
        {
          path: '/workspace/packages/plugin/sub/dist/index.js',
          projectRoot: 'packages/plugin/sub',
        },
        root,
        packages
      )
    ).toBe(fromChild);
  });

  it("adds no hint when the entry's project is unknown", () => {
    const cause = notFound("Cannot find module '@proj/utils'");

    expect(
      withBuiltEntryResolutionHint(
        cause,
        { path: entry.path, projectRoot: undefined },
        root,
        workspacePackages
      )
    ).toBe(cause);
  });

  it('leaves a missing third-party module, unowned path or outside path untouched', () => {
    for (const cause of [
      notFound("Cannot find module 'left-pad'"),
      notFound("Cannot find module '/workspace/tools/missing.js'"),
      notFound("Cannot find module '/elsewhere/lib/index.js'"),
      notFound("Cannot find module '/workspace/node_modules/dep/index.js'"),
    ]) {
      expect(
        withBuiltEntryResolutionHint(cause, entry, root, workspacePackages)
      ).toBe(cause);
    }
  });

  it('leaves other errors untouched', () => {
    const error = new SyntaxError('Unexpected token');

    expect(
      withBuiltEntryResolutionHint(error, entry, root, workspacePackages)
    ).toBe(error);
  });

  it('leaves errors from entries outside the workspace source tree untouched', () => {
    const cause = notFound("Cannot find module '@proj/utils'");

    expect(
      withBuiltEntryResolutionHint(
        cause,
        {
          path: '/workspace/node_modules/@proj/plugin/index.js',
          projectRoot: 'packages/plugin',
        },
        root,
        workspacePackages
      )
    ).toBe(cause);
  });
});
