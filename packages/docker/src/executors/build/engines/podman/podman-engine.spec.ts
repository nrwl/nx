import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execCommand } from '../../lib/exec-command';
import {
  EngineContext,
  EngineRuntimeInfo,
  NormalizedBuildInputs,
} from '../engine-adapter';
import { PodmanEngine } from './podman-engine';

jest.mock('../../lib/exec-command');

const mockedExecCommand = execCommand as jest.Mock;

function baseInputs(
  overrides: Partial<NormalizedBuildInputs> = {}
): NormalizedBuildInputs {
  return {
    quiet: true,
    addHosts: [],
    allow: [],
    buildArgs: [],
    buildContexts: [],
    createBuilder: false,
    cacheFrom: [],
    cacheTo: [],
    context: '.',
    labels: [],
    load: false,
    noCache: false,
    noCacheFilters: [],
    outputs: [],
    platforms: [],
    pull: false,
    push: false,
    sbom: false,
    secretFiles: [],
    secrets: [],
    ssh: [],
    tags: [],
    ulimit: [],
    ...overrides,
  };
}

describe('PodmanEngine', () => {
  let tempDir: string;
  let ctx: EngineContext;
  const runtime: EngineRuntimeInfo = { version: '4.9.3' };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-docker-podman-engine-test-'));
    ctx = { projectName: 'app', tempDir };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  describe('initialize', () => {
    it('throws when podman is not available', async () => {
      mockedExecCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      const engine = new PodmanEngine();
      await expect(engine.initialize(baseInputs(), ctx)).rejects.toThrow(
        /Podman is required/
      );
    });

    it('resolves version when podman is available', async () => {
      mockedExecCommand.mockImplementation(
        (_cmd: string, args: string[] = []) => {
          if (args[0] === '--version') {
            return Promise.resolve({
              stdout: 'podman version 4.9.3',
              stderr: '',
              exitCode: 0,
            });
          }
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
        }
      );
      const engine = new PodmanEngine();
      const result = await engine.initialize(baseInputs(), ctx);
      expect(result.version).toEqual('4.9.3');
    });
  });

  describe('finalize', () => {
    it('does nothing when push is not set', async () => {
      const engine = new PodmanEngine();
      await engine.finalize(baseInputs({ push: false }), ctx, runtime);
      expect(mockedExecCommand).not.toHaveBeenCalled();
    });

    it('pushes each tag individually when push is set', async () => {
      mockedExecCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const engine = new PodmanEngine();
      await engine.finalize(
        baseInputs({ push: true, tags: ['app:1.0', 'app:latest'] }),
        ctx,
        runtime
      );
      expect(mockedExecCommand).toHaveBeenCalledWith('podman', [
        'push',
        'app:1.0',
      ]);
      expect(mockedExecCommand).toHaveBeenCalledWith('podman', [
        'push',
        'app:latest',
      ]);
    });

    it('throws if a push fails', async () => {
      mockedExecCommand.mockResolvedValue({
        stdout: '',
        stderr: 'denied',
        exitCode: 1,
      });
      const engine = new PodmanEngine();
      await expect(
        engine.finalize(
          baseInputs({ push: true, tags: ['app:1.0'] }),
          ctx,
          runtime
        )
      ).rejects.toThrow(/podman failed with/);
    });
  });

  describe('buildArgs', () => {
    it('omits provenance/sbom/allow flags entirely (not supported by podman)', async () => {
      const engine = new PodmanEngine();
      const args = await engine.buildArgs(
        baseInputs({ tags: ['app:latest'] }),
        '.',
        ctx,
        runtime
      );
      expect(args).not.toContain('--provenance');
      expect(args).not.toContain('--attest');
      expect(args).not.toContain('--allow');
      expect(args).toContain('--tag');
    });

    it('omits --build-context below the 4.2.0 podman version gate', async () => {
      const engine = new PodmanEngine();
      const oldRuntime: EngineRuntimeInfo = { version: '4.0.0' };
      const args = await engine.buildArgs(
        baseInputs({ buildContexts: ['alpine=docker-image://alpine'] }),
        '.',
        ctx,
        oldRuntime
      );
      expect(args).not.toContain('--build-context');
    });

    it('includes --build-context at/above the 4.2.0 podman version gate', async () => {
      const engine = new PodmanEngine();
      const args = await engine.buildArgs(
        baseInputs({ buildContexts: ['alpine=docker-image://alpine'] }),
        '.',
        ctx,
        runtime
      );
      expect(args).toContain('--build-context');
    });

    it('never includes --metadata-file (podman has no equivalent flag)', async () => {
      const engine = new PodmanEngine();
      const args = await engine.buildArgs(baseInputs(), '.', ctx, runtime);
      expect(args).not.toContain('--metadata-file');
    });
  });

  describe('getCommand', () => {
    it('always invokes the podman binary directly', () => {
      const engine = new PodmanEngine();
      expect(engine.getCommand(['build', '.'], runtime)).toEqual({
        command: 'podman',
        args: ['build', '.'],
      });
    });
  });
});
