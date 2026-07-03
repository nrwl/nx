import Handlebars from 'handlebars';
import { execCommand } from '../../lib/exec-command';
import { resolveSecretArg } from '../../lib/secrets';
import {
  EngineAdapter,
  EngineCommand,
  EngineContext,
  EngineRuntimeInfo,
  NormalizedBuildInputs,
} from '../engine-adapter';
import * as podman from './podman';

export class PodmanEngine implements EngineAdapter {
  readonly name = 'podman' as const;

  async initialize(
    inputs: NormalizedBuildInputs,
    _ctx: EngineContext
  ): Promise<EngineRuntimeInfo> {
    if (!(await podman.isPodmanAvailable())) {
      throw new Error(
        'Podman is required to build container images with the podman engine.'
      );
    }

    if (!inputs.quiet) {
      await execCommand('podman', ['version']);
      await execCommand('podman', ['info']);
    }

    const version = await podman.getPodmanVersion();
    return { version };
  }

  async finalize(
    inputs: NormalizedBuildInputs,
    _ctx: EngineContext,
    _runtime: EngineRuntimeInfo
  ): Promise<void> {
    // Podman's `build` has no buildx-style `--push` flag; pushing happens as a separate step
    // per tag after a successful build.
    if (!inputs.push) {
      return;
    }
    for (const tag of inputs.tags) {
      const cmd = this.getCommand(['push', tag], _runtime);
      const res = await execCommand(cmd.command, cmd.args);
      if (res.exitCode !== 0) {
        throw new Error(
          `podman failed with: ${res.stderr.trim() || 'unknown error'}`
        );
      }
    }
  }

  getCommand(args: string[], _runtime: EngineRuntimeInfo): EngineCommand {
    return podman.getPodmanCommand(args);
  }

  getImageId(ctx: EngineContext): string | undefined {
    return podman.readImageId(ctx.tempDir);
  }

  getMetadata(ctx: EngineContext): string | undefined {
    return podman.readMetadata(ctx.tempDir);
  }

  getDigest(metadata: string | undefined): string | undefined {
    return podman.extractDigest(metadata);
  }

  async buildArgs(
    inputs: NormalizedBuildInputs,
    defaultContext: string,
    ctx: EngineContext,
    runtime: EngineRuntimeInfo
  ): Promise<string[]> {
    const context = Handlebars.compile(inputs.context)({ defaultContext });
    return [
      ...this.getBuildOnlyArgs(inputs, ctx, runtime.version),
      ...this.getCommonArgs(inputs),
      context,
    ];
  }

  private getBuildOnlyArgs(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext,
    podmanVersion: string
  ): string[] {
    const args: string[] = ['build'];
    for (const addHost of inputs.addHosts) {
      args.push('--add-host', addHost);
    }
    for (const buildArg of inputs.buildArgs) {
      args.push('--build-arg', buildArg);
    }
    if (podman.satisfiesPodman(podmanVersion, '>=4.2.0')) {
      for (const buildContext of inputs.buildContexts) {
        args.push('--build-context', buildContext);
      }
    }
    for (const cacheFrom of inputs.cacheFrom) {
      args.push('--cache-from', cacheFrom);
    }
    for (const cacheTo of inputs.cacheTo) {
      args.push('--cache-to', cacheTo);
    }
    if (inputs.cgroupParent) {
      args.push('--cgroup-parent', inputs.cgroupParent);
    }
    if (inputs.file) {
      args.push('--file', inputs.file);
    }
    if (
      !podman.isLocalOrTarExporter(inputs.outputs) &&
      (inputs.platforms.length === 0 ||
        podman.satisfiesPodman(podmanVersion, '>=3.1.0'))
    ) {
      args.push('--iidfile', podman.getImageIdFilePath(ctx.tempDir));
    }
    for (const label of inputs.labels) {
      args.push('--label', label);
    }
    for (const output of inputs.outputs) {
      args.push('--output', output);
    }
    if (inputs.platforms.length > 0) {
      args.push('--platform', inputs.platforms.join(','));
    }
    for (const secret of inputs.secrets) {
      args.push('--secret', resolveSecretArg(secret, ctx.tempDir, false));
    }
    for (const secretFile of inputs.secretFiles) {
      args.push('--secret', resolveSecretArg(secretFile, ctx.tempDir, true));
    }
    if (inputs.shmSize) {
      args.push('--shm-size', inputs.shmSize);
    }
    for (const ssh of inputs.ssh) {
      args.push('--ssh', ssh);
    }
    for (const tag of inputs.tags) {
      args.push('--tag', tag);
    }
    if (inputs.target) {
      args.push('--target', inputs.target);
    }
    for (const ulimit of inputs.ulimit) {
      args.push('--ulimit', ulimit);
    }
    return args;
  }

  private getCommonArgs(inputs: NormalizedBuildInputs): string[] {
    const args: string[] = [];
    if (inputs.load) {
      args.push('--load');
    }
    if (inputs.network) {
      args.push('--network', inputs.network);
    }
    if (inputs.noCache) {
      args.push('--no-cache');
    }
    if (inputs.pull) {
      args.push('--pull');
    }
    return args;
  }
}
