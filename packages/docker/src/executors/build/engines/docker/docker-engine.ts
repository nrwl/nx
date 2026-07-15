import { randomBytes } from 'crypto';
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
import * as buildx from './buildx';

export class DockerEngine implements EngineAdapter {
  readonly name = 'docker' as const;

  async initialize(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext
  ): Promise<EngineRuntimeInfo> {
    const standalone = !(await buildx.isDockerCliAvailable());

    if (!inputs.quiet && !standalone) {
      await execCommand('docker', ['version']);
      await execCommand('docker', ['info']);
    }

    if (!(await buildx.isBuildxAvailable(standalone))) {
      throw new Error('Docker buildx is required to build container images.');
    }

    const version = await buildx.getBuildxVersion(standalone);

    if (!inputs.quiet) {
      const versionCmd = buildx.getBuildxCommand(['version'], standalone);
      await execCommand(versionCmd.command, versionCmd.args);
    }

    let builderName = inputs.builder;
    let builderCreated = false;
    if (inputs.createBuilder) {
      builderName =
        builderName ||
        `${ctx.projectName}-${randomBytes(24).toString('hex').substring(0, 6)}`;
      const createCmd = buildx.getBuildxCommand(
        ['create', `--name=${builderName}`],
        standalone
      );
      const res = await execCommand(createCmd.command, createCmd.args);
      if (res.exitCode !== 0) {
        throw new Error(
          `buildx failed with: ${res.stderr.trim() || 'unknown error'}`
        );
      }
      builderCreated = true;
    }

    return { version, standalone, builderCreated, builderName };
  }

  async finalize(
    _inputs: NormalizedBuildInputs,
    _ctx: EngineContext,
    runtime: EngineRuntimeInfo
  ): Promise<void> {
    if (runtime.builderCreated && runtime.builderName) {
      const cmd = buildx.getBuildxCommand(
        ['rm', runtime.builderName],
        !!runtime.standalone
      );
      await execCommand(cmd.command, cmd.args);
    }
  }

  getCommand(args: string[], runtime: EngineRuntimeInfo): EngineCommand {
    return buildx.getBuildxCommand(args, !!runtime.standalone);
  }

  getImageId(ctx: EngineContext): string | undefined {
    return buildx.readImageId(ctx.tempDir);
  }

  getMetadata(ctx: EngineContext): string | undefined {
    return buildx.readMetadata(ctx.tempDir);
  }

  getDigest(metadata: string | undefined): string | undefined {
    return buildx.extractDigest(metadata);
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
      ...this.getCommonArgs(inputs, ctx, runtime),
      context,
    ];
  }

  private getBuildOnlyArgs(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext,
    buildxVersion: string
  ): string[] {
    const args: string[] = ['build'];
    for (const addHost of inputs.addHosts) {
      args.push('--add-host', addHost);
    }
    if (inputs.allow.length > 0) {
      args.push('--allow', inputs.allow.join(','));
    }
    for (const buildArg of inputs.buildArgs) {
      args.push('--build-arg', buildArg);
    }
    if (buildx.satisfiesBuildx(buildxVersion, '>=0.8.0')) {
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
      !buildx.isLocalOrTarExporter(inputs.outputs) &&
      (inputs.platforms.length === 0 ||
        buildx.satisfiesBuildx(buildxVersion, '>=0.4.2'))
    ) {
      args.push('--iidfile', buildx.getImageIdFilePath(ctx.tempDir));
    }
    for (const label of inputs.labels) {
      args.push('--label', label);
    }
    for (const noCacheFilter of inputs.noCacheFilters) {
      args.push('--no-cache-filter', noCacheFilter);
    }
    for (const output of inputs.outputs) {
      args.push('--output', output);
    }
    if (inputs.platforms.length > 0) {
      args.push('--platform', inputs.platforms.join(','));
    }
    if (inputs.provenance !== undefined) {
      args.push('--provenance', inputs.provenance);
    }
    for (const secret of inputs.secrets) {
      args.push('--secret', resolveSecretArg(secret, ctx.tempDir, false));
    }
    for (const secretFile of inputs.secretFiles) {
      args.push('--secret', resolveSecretArg(secretFile, ctx.tempDir, true));
    }
    if (inputs.sbom) {
      args.push('--attest', 'type=sbom');
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

  private getCommonArgs(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext,
    runtime: EngineRuntimeInfo
  ): string[] {
    const args: string[] = [];
    const builder = inputs.builder || runtime.builderName;
    if (builder) {
      args.push('--builder', builder);
    }
    if (inputs.load) {
      args.push('--load');
    }
    if (buildx.satisfiesBuildx(runtime.version, '>=0.6.0')) {
      args.push('--metadata-file', buildx.getMetadataFilePath(ctx.tempDir));
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
    if (inputs.push) {
      args.push('--push');
    }
    return args;
  }
}
