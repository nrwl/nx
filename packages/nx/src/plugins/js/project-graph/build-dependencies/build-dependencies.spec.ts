import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { Module } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspace = vi.hoisted(() => ({ root: '' }));

vi.mock('../../../../utils/workspace-root', () => ({
  get workspaceRoot() {
    return workspace.root;
  },
}));

const warn = vi.fn();
vi.mock('../../../../utils/logger', () => ({
  logger: { warn: (...args: unknown[]) => warn(...args), info: vi.fn() },
}));

const ctx = {
  projects: {},
  externalNodes: {},
  filesToProcess: {
    projectFileMap: { app: [{ file: 'apps/app/main.ts', hash: 'a' }] },
  },
} as any;

describe('buildExplicitDependencies', () => {
  const resolveFilename = (Module as any)._resolveFilename;

  function hideTypeScriptFromNx() {
    (Module as any)._resolveFilename = function (
      request: string,
      parent: unknown,
      ...rest: unknown[]
    ) {
      const fromWorkspace = (rest[1] as { paths?: string[] } | undefined)
        ?.paths;
      if (request === 'typescript' && !fromWorkspace) {
        throw Object.assign(new Error('hidden'), {
          code: 'MODULE_NOT_FOUND',
        });
      }
      return resolveFilename.call(this, request, parent, ...rest);
    };
  }

  beforeEach(() => {
    workspace.root = mkdtempSync(join(tmpdir(), 'build-dependencies-'));
    warn.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    (Module as any)._resolveFilename = resolveFilename;
    rmSync(workspace.root, { recursive: true, force: true });
  });

  async function run() {
    const { buildExplicitDependencies } = await import('./build-dependencies');
    return buildExplicitDependencies({ analyzePackageJson: false }, ctx);
  }

  it('should warn once when typescript is installed in the workspace but not resolvable from nx', async () => {
    const tsDir = join(workspace.root, 'node_modules', 'typescript');
    mkdirSync(tsDir, { recursive: true });
    writeFileSync(join(tsDir, 'package.json'), '{"name":"typescript"}');
    writeFileSync(join(tsDir, 'index.js'), '');
    hideTypeScriptFromNx();

    await run();
    await run();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('nx reset');
  });

  it('should not warn when typescript is not installed in the workspace', async () => {
    hideTypeScriptFromNx();

    await run();

    expect(warn).not.toHaveBeenCalled();
  });
});
