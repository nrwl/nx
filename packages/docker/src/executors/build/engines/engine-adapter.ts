export interface NormalizedBuildInputs {
  quiet: boolean;
  addHosts: string[];
  allow: string[];
  buildArgs: string[];
  buildContexts: string[];
  builder?: string;
  createBuilder: boolean;
  cacheFrom: string[];
  cacheTo: string[];
  cgroupParent?: string;
  context: string;
  file?: string;
  labels: string[];
  load: boolean;
  network?: string;
  noCache: boolean;
  noCacheFilters: string[];
  outputs: string[];
  platforms: string[];
  provenance?: string;
  pull: boolean;
  push: boolean;
  sbom: boolean;
  secretFiles: string[];
  secrets: string[];
  shmSize?: string;
  ssh: string[];
  tags: string[];
  target?: string;
  ulimit: string[];
}

export interface EngineCommand {
  command: string;
  args: string[];
}

export interface EngineContext {
  projectName: string;
  tempDir: string;
}

/**
 * Resolved engine runtime state produced by `initialize()`. Threaded explicitly through the
 * later calls instead of being held as mutable instance fields (unlike the original's `Docker`/
 * `Podman` classes), so engine argument-building is a pure function of its inputs and testable
 * without mocking `initialize()`.
 */
export interface EngineRuntimeInfo {
  version: string;
  /** Docker only: true when invoking the standalone `buildx` binary (no `docker` CLI present). */
  standalone?: boolean;
  builderCreated?: boolean;
  builderName?: string;
}

export interface EngineAdapter {
  readonly name: 'docker' | 'podman';
  initialize(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext
  ): Promise<EngineRuntimeInfo>;
  finalize(
    inputs: NormalizedBuildInputs,
    ctx: EngineContext,
    runtime: EngineRuntimeInfo
  ): Promise<void>;
  buildArgs(
    inputs: NormalizedBuildInputs,
    defaultContext: string,
    ctx: EngineContext,
    runtime: EngineRuntimeInfo
  ): Promise<string[]>;
  getCommand(args: string[], runtime: EngineRuntimeInfo): EngineCommand;
  getImageId(ctx: EngineContext): string | undefined;
  getMetadata(ctx: EngineContext): string | undefined;
  getDigest(metadata: string | undefined): string | undefined;
}
