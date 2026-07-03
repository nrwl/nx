import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execCommand } from '../../lib/exec-command';
import {
  EngineContext,
  EngineRuntimeInfo,
  NormalizedBuildInputs,
} from '../engine-adapter';
import { DockerEngine } from './docker-engine';

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

describe('DockerEngine', () => {
  let tempDir: string;
  let ctx: EngineContext;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-docker-engine-test-'));
    ctx = { projectName: 'app', tempDir };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  describe('initialize', () => {
    it('probes buildx availability/version and returns runtime info', async () => {
      mockedExecCommand.mockImplementation(
        (command: string, args: string[] = []) => {
          if (command === 'docker' && args.length === 0) {
            return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
          }
          if (args.includes('version')) {
            return Promise.resolve({
              stdout: 'github.com/docker/buildx v0.12.1',
              stderr: '',
              exitCode: 0,
            });
          }
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
        }
      );

      const engine = new DockerEngine();
      const runtime = await engine.initialize(baseInputs(), ctx);
      expect(runtime.version).toEqual('0.12.1');
      expect(runtime.standalone).toBe(false);
      expect(runtime.builderCreated).toBe(false);
    });

    it('throws when buildx is not available', async () => {
      mockedExecCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });

      const engine = new DockerEngine();
      await expect(engine.initialize(baseInputs(), ctx)).rejects.toThrow(
        /buildx is required/
      );
    });

    it('creates a builder when createBuilder is set', async () => {
      mockedExecCommand.mockImplementation(
        (command: string, args: string[] = []) => {
          if (command === 'docker' && args.length === 0) {
            return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
          }
          if (args.includes('version')) {
            return Promise.resolve({
              stdout: 'buildx v0.12.1',
              stderr: '',
              exitCode: 0,
            });
          }
          if (args.includes('create')) {
            return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
          }
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
        }
      );

      const engine = new DockerEngine();
      const runtime = await engine.initialize(
        baseInputs({ createBuilder: true }),
        ctx
      );
      expect(runtime.builderCreated).toBe(true);
      expect(runtime.builderName).toContain('app-');
    });
  });

  describe('finalize', () => {
    it('removes a created builder', async () => {
      mockedExecCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const engine = new DockerEngine();
      const runtime: EngineRuntimeInfo = {
        version: '0.12.1',
        standalone: false,
        builderCreated: true,
        builderName: 'app-abc123',
      };
      await engine.finalize(baseInputs(), ctx, runtime);
      expect(mockedExecCommand).toHaveBeenCalledWith('docker', [
        'buildx',
        'rm',
        'app-abc123',
      ]);
    });

    it('does nothing when no builder was created', async () => {
      const engine = new DockerEngine();
      const runtime: EngineRuntimeInfo = {
        version: '0.12.1',
        standalone: false,
      };
      await engine.finalize(baseInputs(), ctx, runtime);
      expect(mockedExecCommand).not.toHaveBeenCalled();
    });
  });

  describe('buildArgs', () => {
    const runtime: EngineRuntimeInfo = { version: '0.12.1', standalone: false };

    it('includes --tag, --file, and --build-arg for basic inputs', async () => {
      const engine = new DockerEngine();
      const args = await engine.buildArgs(
        baseInputs({
          tags: ['app:latest'],
          file: 'Dockerfile',
          buildArgs: ['APP_NAME=app'],
        }),
        '.',
        ctx,
        runtime
      );
      expect(args).toContain('--tag');
      expect(args).toContain('app:latest');
      expect(args).toContain('--file');
      expect(args).toContain('Dockerfile');
      expect(args).toContain('--build-arg');
      expect(args).toContain('APP_NAME=app');
      expect(args[args.length - 1]).toEqual('.');
    });

    it('omits --build-context below the 0.8.0 buildx version gate', async () => {
      const engine = new DockerEngine();
      const oldRuntime: EngineRuntimeInfo = {
        version: '0.7.0',
        standalone: false,
      };
      const args = await engine.buildArgs(
        baseInputs({ buildContexts: ['alpine=docker-image://alpine'] }),
        '.',
        ctx,
        oldRuntime
      );
      expect(args).not.toContain('--build-context');
    });

    it('includes --build-context at/above the 0.8.0 buildx version gate', async () => {
      const engine = new DockerEngine();
      const args = await engine.buildArgs(
        baseInputs({ buildContexts: ['alpine=docker-image://alpine'] }),
        '.',
        ctx,
        runtime
      );
      expect(args).toContain('--build-context');
    });

    it('includes --metadata-file at/above the 0.6.0 buildx version gate', async () => {
      const engine = new DockerEngine();
      const args = await engine.buildArgs(baseInputs(), '.', ctx, runtime);
      expect(args).toContain('--metadata-file');
    });

    it('omits --metadata-file below the 0.6.0 buildx version gate', async () => {
      const engine = new DockerEngine();
      const oldRuntime: EngineRuntimeInfo = {
        version: '0.5.0',
        standalone: false,
      };
      const args = await engine.buildArgs(baseInputs(), '.', ctx, oldRuntime);
      expect(args).not.toContain('--metadata-file');
    });

    it('omits --iidfile for a local exporter with multiple platforms below the gate', async () => {
      const engine = new DockerEngine();
      const oldRuntime: EngineRuntimeInfo = {
        version: '0.3.0',
        standalone: false,
      };
      const args = await engine.buildArgs(
        baseInputs({ platforms: ['linux/amd64', 'linux/arm64'] }),
        '.',
        ctx,
        oldRuntime
      );
      expect(args).not.toContain('--iidfile');
    });

    it('includes --platform joined by comma', async () => {
      const engine = new DockerEngine();
      const args = await engine.buildArgs(
        baseInputs({ platforms: ['linux/amd64', 'linux/arm64'] }),
        '.',
        ctx,
        runtime
      );
      expect(args).toContain('--platform');
      expect(args).toContain('linux/amd64,linux/arm64');
    });

    it('resolves secret-files into a --secret id=/src= argument', async () => {
      const secretFile = join(tempDir, 'npmrc');
      writeFileSync(secretFile, 'registry=https://example.com');
      const engine = new DockerEngine();
      const args = await engine.buildArgs(
        baseInputs({ secretFiles: [`npmrc=${secretFile}`] }),
        '.',
        ctx,
        runtime
      );
      const secretIdx = args.indexOf('--secret');
      expect(secretIdx).toBeGreaterThan(-1);
      expect(args[secretIdx + 1]).toMatch(/^id=npmrc,src=/);
    });

    it('includes --push and --load from common args', async () => {
      const engine = new DockerEngine();
      const args = await engine.buildArgs(
        baseInputs({ push: true, load: true }),
        '.',
        ctx,
        runtime
      );
      expect(args).toContain('--push');
      expect(args).toContain('--load');
    });

    it('prefers an explicit builder over the runtime-created one', async () => {
      const engine = new DockerEngine();
      const rtWithBuilder: EngineRuntimeInfo = {
        version: '0.12.1',
        standalone: false,
        builderCreated: true,
        builderName: 'created-builder',
      };
      const args = await engine.buildArgs(
        baseInputs({ builder: 'explicit-builder' }),
        '.',
        ctx,
        rtWithBuilder
      );
      const idx = args.indexOf('--builder');
      expect(args[idx + 1]).toEqual('explicit-builder');
    });
  });

  describe('getCommand/getImageId/getMetadata/getDigest', () => {
    it('wraps args under docker buildx when not standalone', () => {
      const engine = new DockerEngine();
      expect(
        engine.getCommand(['build', '.'], {
          version: '0.12.1',
          standalone: false,
        })
      ).toEqual({
        command: 'docker',
        args: ['buildx', 'build', '.'],
      });
    });

    it('returns undefined image id / metadata / digest when files are absent', () => {
      const engine = new DockerEngine();
      expect(engine.getImageId(ctx)).toBeUndefined();
      expect(engine.getMetadata(ctx)).toBeUndefined();
      expect(engine.getDigest(undefined)).toBeUndefined();
    });
  });
});
