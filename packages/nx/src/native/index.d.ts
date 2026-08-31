/**
 * Opaque branded types for native ExternalObject handles.
 *
 * These types are not constructed directly — they exist only to brand
 * ExternalObject<T> so that different native handles are not interchangeable.
 */

interface NxDbConnection {
  readonly __brand: unique symbol;
}

interface ParserArc {
  readonly __brand: unique symbol;
}

interface WriterArc {
  readonly __brand: unique symbol;
}

interface MasterArc {
  readonly __brand: unique symbol;
}

interface HashInstruction {
  readonly __brand: unique symbol;
}

export declare class ExternalObject<T> {
  readonly '': {
    readonly '': unique symbol
    [K: symbol]: T
  }
}
export declare class AppLifeCycle {
  constructor(tasks: Array<Task>, initiatingTasks: Array<string>, runMode: RunMode, pinnedTasks: Array<string>, tuiCliArgs: TuiCliArgs, tuiConfig: TuiConfig, titleText: string, workspaceRoot: string, taskGraph: TaskGraph, isCloudEnabled?: boolean | undefined | null)
  startCommand(threadCount?: number | undefined | null): void
  scheduleTask(task: Task): void
  startTasks(tasks: Array<Task>, metadata: object): void
  printTaskTerminalOutput(task: Task, status: string, output: string): void
  endTasks(taskResults: Array<TaskResult>, metadata: object): void
  endCommand(summary?: PerformanceSummaryPayload | undefined | null): void
  __init(doneCallback: (() => unknown)): void
  registerRunningTask(taskId: string, ptyHandles: ExternalObject<[ParserArc, WriterArc, MasterArc]>): void
  registerRunningTaskWithEmptyParser(taskId: string): void
  appendTaskOutput(taskId: string, output: string, isPtyOutput: boolean): void
  setTaskStatus(taskId: string, status: TaskStatus): void
  setTaskTiming(taskId: string, startTime: number, endTime: number): void
  registerForcedShutdownCallback(forcedShutdownCallback: (() => unknown)): void
  __setCloudMessage(message: string): Promise<void>
  setEstimatedTaskTimings(timings: Record<string, number>): void
  registerRunningBatch(batchId: string, batchInfo: BatchInfo): void
  appendBatchOutput(batchId: string, output: string): void
  setBatchStatus(batchId: string, status: BatchStatus): void
  /**
   * Set a clickable Nx Cloud link in the TUI: `label` is the text shown,
   * `url` is opened when it's clicked. This is a `LifeCycle` method so the Nx
   * Cloud client can call it via the lifecycle it already receives.
   */
  setCloudLink(label: string, url: string): void
}

export declare class ChildProcess {
  getPtyHandles(): ExternalObject<[ParserArc, WriterArc, MasterArc]>
  getPid(): number
  kill(signal?: NodeJS.Signals | number): void
  onExit(callback: (message: string) => void): void
  onOutput(callback: (message: string) => void): void
  cleanup(): void
}

export declare class FileLock {
  locked: boolean
  constructor(lockFilePath: string)
  unlock(): void
  check(): boolean
  wait(): Promise<void>
  lock(): void
}

export declare class HashPlanInspector {
  constructor(allWorkspaceFiles: ExternalObject<Array<FileData>>, projectFileMap: ExternalObject<Record<string, Array<FileData>>>, workspaceRoot: string)
  /** @deprecated Use `inspectInputs()` instead for structured output. */
  inspect(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>): Record<string, string[]>
  /**
   * Like `inspect()` but returns structured `HashInputs` objects instead of flat strings.
   * Each `HashInstruction` is categorized into the appropriate bucket (files, runtime,
   * environment, depOutputs, external). TsConfiguration is resolved to the root tsconfig
   * file path. JsonFileSet is resolved to the matched JSON file paths (field/excludeField
   * filters only affect hashing, not which files are reported as inputs).
   * ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient.
   */
  inspectInputs(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>): Record<string, HashInputs>
}

export declare class HashPlanner {
  constructor(nxJson: NxJson, projectGraph: ExternalObject<ProjectGraph>)
  getPlans(taskIds: Array<string>, taskGraph: TaskGraph, snapshots?: IoSnapshots | undefined | null, customHasherTaskIds?: Array<string> | undefined | null): Record<string, string[]>
  /**
   * The same eligibility walk `getPlans` performs, reported: which tasks
   * hash from their snapshot and why the others do not.
   */
  ioSnapshotReport(taskGraph: TaskGraph, snapshots?: IoSnapshots | undefined | null, customHasherTaskIds?: Array<string> | undefined | null): IoSnapshotReport
  getPlansReference(taskIds: Array<string>, taskGraph: TaskGraph, snapshots?: IoSnapshots | undefined | null, customHasherTaskIds?: Array<string> | undefined | null): ExternalObject<Record<string, Array<HashInstruction>>>
}

export declare class HttpRemoteCache {
  constructor()
  retrieve(hash: string, cacheDirectory: string): Promise<CachedResult | null>
  store(hash: string, cacheDirectory: string, terminalOutput: string, code: number): Promise<boolean>
}

export declare class ImportResult {
  file: string
  sourceProject: string
  dynamicImportExpressions: Array<string>
  staticImportExpressions: Array<string>
}

/**
 * The fetched or loaded bundle for one commit, plus what resolving it
 * reported. Handed to the hash planner as-is; `bundle` is `None` when the
 * task hashes natively (status `skipped`, or a load failure).
 */
export declare class IoSnapshots {
  /** `fetched` | `cached` | `skipped` */
  get status(): string
  /**
   * Why the fetch was skipped, `stale-offline` when a stale bundle was
   * reused, or `no-bundle` / `invalid-bundle` from `loadIoSnapshots`.
   */
  get reason(): string | null
  get message(): string | null
  /** The bundle file a load failure refers to. */
  get file(): string | null
  /** Directory holding `snapshots.json` when a bundle was resolved. */
  get directory(): string | null
  get resolution(): IoSnapshotResolution | null
}

export declare class NxCache {
  cacheDirectory: string
  constructor(workspaceRoot: string, cachePath: string, dbConnection: ExternalObject<NxDbConnection>, linkTaskDetails?: boolean | undefined | null, maxCacheSize?: number | undefined | null)
  get(hash: string): CachedResult | null
  /**
   * Batch version of get() that fetches multiple cache entries in a single
   * SQL query and reads terminal output files in parallel via Rayon.
   */
  getBatch(hashes: Array<string>): Array<CachedResult | undefined | null>
  put(hash: string, terminalOutput: string, outputs: Array<string>, code: number): Array<string>
  applyRemoteCacheResults(hash: string, result: CachedResult, outputs?: Array<string> | undefined | null): void
  getTaskOutputsPath(hash: string): string
  getCacheSize(): number
  copyFilesFromCache(cachedResult: CachedResult, outputs: Array<string>): number
  removeOldCacheRecords(): void
  checkCacheFsInSync(): boolean
}

export declare class NxConsolePreferences {
  constructor(homeDir: string)
  getAutoInstallPreference(): boolean | null
  setAutoInstallPreference(autoInstall: boolean): void
}

export declare class NxTaskHistory {
  constructor(db: ExternalObject<NxDbConnection>)
  recordTaskRuns(taskRuns: Array<TaskRun>): void
  getFlakyTasks(hashes: Array<string>): Array<string>
  getEstimatedTaskTimings(targets: Array<TaskTarget>): Record<string, number>
}

/**
 * High-performance metrics collector for Nx tasks
 * Thread-safe and designed for minimal overhead
 */
export declare class ProcessMetricsCollector {
  /** Create a new ProcessMetricsCollector with default configuration */
  constructor()
  /**
   * Start metrics collection
   * Idempotent - safe to call multiple times
   */
  startCollection(): void
  /**
   * Stop metrics collection
   * Returns true if collection was stopped, false if not running
   */
  stopCollection(): boolean
  /**
   * Get system information (CPU cores and total memory)
   * This is separate from the collection interval and meant to be called imperatively
   */
  getSystemInfo(): SystemInfo
  /** Register the main CLI process for metrics collection */
  registerMainCliProcess(pid: number): void
  /** Register a subprocess of the main CLI for metrics collection */
  registerMainCliSubprocess(pid: number, alias?: string | undefined | null): void
  /** Register the daemon process for metrics collection */
  registerDaemonProcess(pid: number): void
  /**
   * Register a process for a specific task
   * Automatically creates the task if it doesn't exist
   */
  registerTaskProcess(taskId: string, pid: number): void
  /** Register a batch with multiple tasks sharing a worker */
  registerBatch(batchId: string, taskIds: Array<string>, pid: number): void
  /** Subscribe to push-based metrics notifications from TypeScript */
  subscribe(callback: (err: Error | null, event: MetricsUpdate) => void): void
}

export declare class RunningTasksService {
  constructor(db: ExternalObject<NxDbConnection>)
  getRunningTasks(ids: Array<string>): Array<string>
  addRunningTask(taskId: string): void
  removeRunningTask(taskId: string): void
}

export declare class RustPseudoTerminal {
  constructor()
  runCommand(command: string, commandDir?: string | undefined | null, jsEnv?: Record<string, string> | undefined | null, execArgv?: Array<string> | undefined | null, quiet?: boolean | undefined | null, tty?: boolean | undefined | null, commandLabel?: string | undefined | null): ChildProcess
  /**
   * This allows us to run a pseudoterminal with a fake node ipc channel
   * this makes it possible to be backwards compatible with the old implementation
   */
  fork(id: string, forkScript: string, pseudoIpcPath: string, commandDir: string | undefined | null, jsEnv: Record<string, string> | undefined | null, execArgv: Array<string> | undefined | null, quiet: boolean, commandLabel?: string | undefined | null): ChildProcess
}

export declare class TaskDetails {
  constructor(db: ExternalObject<NxDbConnection>)
  recordTaskDetails(tasks: Array<HashedTask>): void
}

export declare class TaskHasher {
  constructor(workspaceRoot: string, projectGraph: ExternalObject<ProjectGraph>, projectFileMap: ExternalObject<Record<string, Array<FileData>>>, allWorkspaceFiles: ExternalObject<Array<FileData>>, tsConfig: Buffer, tsConfigPaths: Record<string, Array<string>>, rootTsconfigPath?: string | undefined | null, options?: HasherOptions | undefined | null)
  /**
   * Hash each task's instructions using the env map keyed by `task.id`.
   * Every task in `hash_plans` must have an entry in `per_task_envs` —
   * a missing id surfaces as an error rather than silently hashing
   * against an empty env. Callers that want to hash all tasks against
   * the same env should build `per_task_envs` by keying that env under
   * every task id.
   */
  hashPlans(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, perTaskEnvs: Record<string, Record<string, string>>, cwd: string, collectTaskInputs?: boolean | undefined | null): Record<string, HashDetails>
}

export declare class TaskInvocationTracker {
  constructor(db: ExternalObject<NxDbConnection>, rootPid: number)
  /** Register a task as invoked. Throws if the task was already registered (loop detected). */
  registerTask(parentPid: number, taskId: string): void
  /** Remove a task invocation record after task completes. */
  unregisterTask(taskId: string): void
  /** Get all invocations for this root_pid, ordered by creation time. */
  getInvocationChain(): Array<InvocationRecord>
  /** Clean up stale invocations older than 1 day (handles PID recycling). */
  cleanupStale(): void
}

export declare class Watcher {
  origin: string
  /**
   * Always applies HARDCODED_IGNORE_PATTERNS plus watcher-specific
   * patterns (vite/vitest timestamp files), regardless of `use_ignore`.
   */
  constructor(origin: string, additionalGlobs?: Array<string> | undefined | null, useIgnore?: boolean | undefined | null)
  watch(callbackTsfn: (err: string | null, events: WatchEvent[]) => void): void
  stop(): Promise<void>
  /**
   * Synchronously drains the accumulator. Used by the daemon before
   * serving a cached project graph so events buffered inside the
   * IDLE_WINDOW debounce don't go missing. Returns an empty vec if
   * the watcher hasn't started, the loop has exited, or no events
   * are buffered.
   */
  forceFlushPending(): Array<WatchEvent>
}

export declare class WorkspaceContext {
  workspaceRoot: string
  constructor(workspaceRoot: string, cacheDir: string)
  getWorkspaceFiles(projectRootMap: Record<string, string>): NxWorkspaceFiles
  glob(globs: Array<string>, exclude?: Array<string> | undefined | null): Array<string>
  /**
   * Performs multiple glob pattern matches against workspace files in parallel
   * @returns An array of arrays, where each inner array contains the file paths
   * that matched the corresponding glob pattern in the input. The outer array maintains the same order
   * as the input globs.
   */
  multiGlob(globs: Array<string>, exclude?: Array<string> | undefined | null): Array<Array<string>>
  hashFilesMatchingGlobs(globGroups: Array<Array<string>>): Array<string>
  hashFilesMatchingGlob(globs: Array<string>, exclude?: Array<string> | undefined | null): string
  incrementalUpdate(updatedFiles: Array<string>, deletedFiles: Array<string>): Record<string, string>
  updateProjectFiles(projectRootMappings: Record<string, string>, projectFiles: ExternalObject<Record<string, Array<FileData>>>, globalFiles: ExternalObject<Array<FileData>>, updatedFiles: Record<string, string>, deletedFiles: Array<string>): UpdatedWorkspaceFiles
  allFileData(): Array<FileData>
  getFilesInDirectory(directory: string): Array<string>
}

export interface AffectedOptions {
  /**
   * `createNodes` globs of every loaded plugin. Resolved in TypeScript because
   * `getPlugins` is async and spawns plugin workers.
   */
  projectGlobPatterns: Array<string>
  projectDeletionAffectsAllProjects: boolean
  workspaceRoot: string
}

/** Task ids with at least one changed file among their plan's file inputs. */
export declare function affectedTasks(projectGraph: ExternalObject<ProjectGraph>, hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, changedFiles: Array<string>): Array<string>

export interface BatchInfo {
  executorName: string
  taskIds: Array<string>
}

export declare const enum BatchStatus {
  Running = 'Running',
  Success = 'Success',
  Failure = 'Failure'
}

export interface CachedResult {
  code: number
  terminalOutput?: string
  outputsPath: string
  size?: number
}

/**
 * Cache hits vs total; present only when there was a cache outcome. A bypassed
 * cache is signalled separately by `cache_skipped`.
 */
export interface CacheStat {
  hits: number
  total: number
}

export declare function canInstallNxConsole(): Promise<boolean>

export declare function canInstallNxConsoleForEditor(editor: SupportedEditor): Promise<boolean>

export declare function closeDbConnection(connection: ExternalObject<NxDbConnection>): void

export declare function connectToNxDb(cacheDir: string, dbName?: string | undefined | null): ExternalObject<NxDbConnection>

export declare function copy(src: string, dest: string): number

/**
 * Consumer task id -> the upstream task ids whose declared outputs it reads.
 *
 * Producers are searched over the whole dependency closure, not just direct
 * dependencies: `TaskOutput` does not record whether its `transitive` flag was
 * set, and an observed read cannot say how deep the producer sits. Over-
 * reporting an edge costs a task that was going to be a cache hit; missing one
 * skips a task that needed to run.
 */
export declare function dependentOutputEdges(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, taskGraph: TaskGraph): Record<string, Array<string>>

export interface DepsOutputsInput {
  dependentTasksOutputFiles: string
  transitive?: boolean
}

/**
 * Detects which AI agent is running and returns its name.
 * Returns None if no agent is detected or when running inside the Nx daemon.
 * Filtering against supported agents should be done on the TypeScript side.
 */
export declare function detectAiAgent(): string | null

export interface EnvironmentInput {
  env: string
}

/**
 * Canonical event dimension and metric names for GA4.
 * TypeScript imports these from the native module instead of redefining the strings.
 */
export interface EventDimensions {
  command: string
  generatorName: string
  packageName: string
  packageVersion: string
  duration: string
  sampleRate: string
  taskCount: string
  projectCount: string
  cachedTaskCount: string
  cliSource: string
  interactive: string
  excludeAppliedMigrations: string
  include: string
  includeSource: string
  multiMajorChoice: string
  fetchMethod: string
  fetchFallbackReason: string
  createCommits: string
  agenticOutcome: string
  agentUsed: string
  errorName: string
  errorLocation: string
  migrationName: string
  promptChoice: string
  majorsCrossed: string
  migrationCount: string
  appliedCount: string
}

export declare const enum EventType {
  delete = 'delete',
  update = 'update',
  create = 'create'
}

/** The existing files a `{ files: [...] }` input group matches on disk, sorted. */
export declare function expandFilesInput(workspaceRoot: string, globs: Array<string>): Array<string>

export declare function expandOutputs(directory: string, entries: Array<string>): Array<string>

export interface ExternalDependenciesInput {
  externalDependencies: Array<string>
}

export interface ExternalNode {
  packageName?: string
  version: string
  hash?: string
}

/**
 * Resolves the I/O snapshot bundle for the workspace's current HEAD, serving
 * it from the on-disk cache when fresh and fetching from Nx Cloud otherwise.
 * Never fails the caller: every problem is reported as a `skipped` result.
 */
export declare function fetchIoSnapshots(options: IoSnapshotFetchOptions): Promise<IoSnapshots>

export interface FileData {
  file: string
  hash: string
}

export interface FileMap {
  projectFileMap: Record<string, Array<FileData>>
  nonProjectFiles: Array<FileData>
}

export interface FileSetInput {
  fileset: string
  dependencies?: boolean
  /**
   * Hash the glob straight from disk (so gitignored/generated files count)
   * instead of the workspace file map. Self inputs only.
   */
  includeIgnored?: boolean
}

export declare function findImports(projectFileMap: Record<string, Array<string>>): Array<ImportResult>

/**
 * Flush all pending telemetry data
 * This should be called before process exit
 */
export declare function flushTelemetry(): void

/**
 * The single duration formatter — used by the task list, terminal report, and TUI
 * popup. Exposed to JS as `formatDuration` so all three share one implementation.
 * 0 (or sub-millisecond) → "<1ms", then "470ms", "13.4s", "1m 30s".
 */
export declare function formatDuration(ms: number): string

export declare function getBinaryTarget(): string

export declare function getDefaultMaxCacheSize(cachePath: string): number

/** Returns the canonical event dimension names. */
export declare function getEventDimensions(): EventDimensions

/**
 * Batch version of get_files_for_outputs that processes multiple output
 * entries in parallel using Rayon. Each entry is a list of output paths
 * for a single task.
 */
export declare function getFilesForOutputsBatch(directory: string, entriesBatch: Array<Array<string>>): Array<Array<string>>

/**
 * The same list, for JavaScript callers that walk a tree rather than the
 * filesystem - `visitNotIgnoredFiles` - so both sides apply one baseline
 * instead of maintaining a second copy that drifts.
 *
 * The patterns are gitignore-shaped, so they read the same to the `ignore`
 * crate here and the `ignore` npm package there.
 */
export declare function getHardcodedIgnorePatterns(): Array<string>

/**
 * If `workspace_root` is inside a git worktree, returns the main repo root.
 * Returns `None` when already in the main repo (or not in a git repo at all).
 */
export declare function getMainWorktreeRoot(workspaceRoot: string): string | null

export declare function getTransformableOutputs(outputs: Array<string>): Array<string>

/**
 * Group information - union of different process group types
 * Use group_type to discriminate which optional fields are present
 */
export interface GroupInfo {
  /** Type discriminator: MainCLI, Daemon, Task, or Batch */
  groupType: GroupType
  /** Display name for the group */
  displayName: string
  /** Unique ID for this group */
  id: string
  /** Task IDs in this batch (present for Batch groups) */
  taskIds?: Array<string>
}

/** Group type discriminator */
export declare const enum GroupType {
  MainCLI = 'MainCLI',
  MainCliSubprocesses = 'MainCliSubprocesses',
  Daemon = 'Daemon',
  DaemonSubprocesses = 'DaemonSubprocesses',
  Task = 'Task',
  Batch = 'Batch'
}

export declare function hashArray(input: Array<string | undefined | null>): string

export interface HashDetails {
  value: string
  details: Record<string, string>
  /** Structured inputs used for hashing (file patterns, env vars, etc.) */
  inputs: HashInputs
}

export interface HashedTask {
  hash: string
  project: string
  target: string
  configuration?: string
}

export interface HasherOptions {
  selectivelyHashTsConfig: boolean
}

export declare function hashFile(file: string): string | null

/** NAPI-compatible struct for returning hash inputs to JavaScript */
export interface HashInputs {
  /** Expanded file paths that were used as inputs */
  files: Array<string>
  /** Runtime commands */
  runtime: Array<string>
  /** Environment variable names */
  environment: Array<string>
  /** Dependent task outputs */
  depOutputs: Array<string>
  /** External dependencies */
  external: Array<string>
  /** Provenance of every value above, keyed by the value itself. */
  sources: Record<string, 'snapshot' | 'target' | 'dependency' | 'native'>
  /** Domain markers in the plan, e.g. `io-snapshot:<digest>`. */
  markers: Array<string>
}

/**
 * Initialize telemetry using a DB connection.
 * Gets/creates the session ID from the DB, stores the connection
 * for persisting session refreshes on flush, and returns the session ID
 * so the caller can set it as an env var for child processes.
 * Used by CLI and daemon.
 */
export declare function initializeTelemetry(connection: ExternalObject<NxDbConnection>, workspaceId: string, userId: string | undefined | null, nxVersion: string, packageManagerName: string, packageManagerVersion: string | undefined | null, nodeVersion: string, osArch: string, osPlatform: string, osRelease: string, isCi: boolean, isNxCloud: boolean): string

/**
 * Initialize telemetry with a pre-fetched session ID.
 * No DB connection — used by plugin workers that inherit the
 * session ID from their parent process via env var.
 */
export declare function initializeTelemetryWithSessionId(sessionId: string, workspaceId: string, userId: string | undefined | null, nxVersion: string, packageManagerName: string, packageManagerVersion: string | undefined | null, nodeVersion: string, osArch: string, osPlatform: string, osRelease: string, isCi: boolean, isNxCloud: boolean): void

export interface InputsInput {
  input: string
  dependencies?: boolean
  projects?: string | Array<string>
}

export declare function installNxConsole(): Promise<boolean>

export declare function installNxConsoleForEditor(editor: SupportedEditor): Promise<boolean>

export interface InvocationRecord {
  parentPid: number
  taskId: string
}

/**
 * Tasks whose snapshot read another task's outputs: they hash after their
 * producers ran, because those files only exist then. Needs no project graph,
 * so the client can call it before the first hashing wave on the daemon path.
 * Opted-out and custom-hasher tasks are not excluded: deferring a task that
 * ends up hashed natively only delays its hash, it never changes it.
 */
export declare function ioSnapshotDeferredTaskIds(snapshots: IoSnapshots, taskGraph: TaskGraph): Array<string>

/**
 * Why a task (or the whole run) hashes natively. `reason` strings are the
 * contract `nx show`, `nx graph`, and the run summary render.
 */
export interface IoSnapshotDiagnostic {
  reason: string
  taskId?: string
  project?: string
  glob?: string
  producer?: string
  file?: string
  message?: string
}

export interface IoSnapshotFetchOptions {
  workspaceRoot: string
  /** Shared cache root for snapshot bundles (`<cacheDir>/io-snapshots`). */
  cacheDirectory: string
  apiUrl: string
  accessToken?: string
  nxCloudId?: string
  clientVersion?: string
  maxCommits?: number
  timeoutMs?: number
  /** Age after which a cached bundle for the same commit is refetched. 0 always refetches. */
  maxAgeMs?: number
  /**
   * Age after which a remembered fetch failure for the same commit and API
   * URL is retried. Defaults to `max_age_ms`.
   */
  failureMaxAgeMs?: number
  retain?: number
}

/**
 * Observed outputs per eligible task (same walk as hashing), for the runner
 * to union into `task.outputs` and for `nx show` to label them.
 */
export declare function ioSnapshotOutputs(snapshots: IoSnapshots, taskGraph: TaskGraph, optedOutTaskIds: Array<string>, customHasherTaskIds: Array<string>, projectRoots?: Record<string, string> | undefined | null): Record<string, Array<string>>

/**
 * The eligibility report without a planner: the client prints the run
 * summary from this on the daemon path, where it never transfers a project
 * graph. `invalid-files-input` needs nx.json to expand named inputs, so it
 * is only reported through the planner.
 */
export declare function ioSnapshotReport(snapshots: IoSnapshots, taskGraph: TaskGraph, optedOutTaskIds: Array<string>, customHasherTaskIds: Array<string>, projectRoots?: Record<string, string> | undefined | null): IoSnapshotReport

export interface IoSnapshotReport {
  /** Task ids hashed from their snapshot. */
  used: Array<string>
  /** Subset of `used` whose snapshot also contributes observed outputs. */
  tasksWithOutputs: Array<string>
  diagnostics: Array<IoSnapshotDiagnostic>
  resolution?: IoSnapshotResolution
}

/** What was resolved for a commit; persisted alongside the bundle. */
export interface IoSnapshotResolution {
  requestedCommit: string
  commits: Array<string>
  sourceCommits: Array<string>
  digest: string
  fetchedAt: number
  clientVersion: string
  tasks: number
}

export const IS_WASM: boolean

/**
 * Detects if the current process is being run by an AI agent.
 * Always returns false when running inside the Nx daemon, since the daemon
 * is a long-lived process that should not inherit AI agent behavior from
 * the client that connected to it.
 */
export declare function isAiAgent(): boolean

export declare function isEditorInstalled(editor: SupportedEditor): Promise<boolean>

export interface JsonInput {
  json: string
  fields?: Array<string>
  excludeFields?: Array<string>
}

/**
 * Kill a process and all its descendants (fire-and-forget).
 *
 * Sends the requested signal but does NOT wait for processes to exit.
 * Use `killProcessTreeGraceful` when cleanup handlers must run.
 */
export declare function killProcessTree(rootPid: number, signal?: string | number | undefined | null): void

/**
 * Kill a process tree gracefully: signal → wait → SIGKILL.
 *
 * Signals leaf processes first, waits for them to exit, then signals
 * their parents (now leaves). Repeats until the tree is empty or the
 * grace period expires, then force-kills survivors.
 */
export declare function killProcessTreeGraceful(rootPid: number, signal?: string | number | undefined | null, gracePeriodMs?: number | undefined | null): Promise<void>

/**
 * A docs link rendered as an OSC 8 hyperlink. Both fields come from TS so the
 * popup never hardcodes a URL.
 */
export interface Link {
  text: string
  href: string
}

/**
 * Reads an already-fetched bundle directory without touching the network:
 * `nx show`/`nx graph` and the daemon load the directory the client resolved.
 */
export declare function loadIoSnapshots(directory: string): IoSnapshots

/**
 * Runs every locator and returns the touched project names, in locator order,
 * unsorted overall and with duplicates. Callers dedupe by walking the graph.
 *
 * Every branch is deterministic, and must stay so: this order reaches
 * `result.nodes` insertion order and so `nx show projects --affected`.
 */
export declare function locateTouchedProjects(projectGraph: ExternalObject<ProjectGraph>, nxJson: NxJson, touchedFiles: Array<string>, options: AffectedOptions, jsLocators: Array<(files: string[]) => Promise<string[]>>): Promise<Array<string>>

export declare function logDebug(message: string): void

/**
 * Checks which `paths` match the given `globs`, using the same glob engine
 * as the task hasher (`build_glob_set`). Used to statically match
 * `dependentTasksOutputFiles` globs against candidate paths.
 */
export declare function matchGlobPaths(globs: Array<string>, paths: Array<string>): Array<boolean>

/**
 * Statically checks which `paths` would be captured by the given output
 * `entries`, without touching the file system. Mirrors `expand_outputs`
 * semantics: entries match themselves and anything nested under them (so a
 * directory entry captures its contents), negated (`!`-prefixed) entries
 * exclude matches from the whole entry set, and a non-empty list with only
 * negated entries matches everything not excluded. An empty list matches
 * nothing.
 */
export declare function matchOutputPaths(entries: Array<string>, paths: Array<string>): Array<boolean>

/** Combined metadata for groups and processes */
export interface Metadata {
  /** Group-level metadata */
  groups: Record<string, GroupInfo>
  /** Process-level metadata (keyed by PID as string for NAPI compatibility) */
  processes: Record<string, ProcessMetadata>
}

/** Metrics update sent every collection cycle */
export interface MetricsUpdate {
  timestamp: number
  processes: Array<ProcessMetrics>
  metadata: Metadata
}

/** Stripped version of the NxJson interface for use in rust */
export interface NxJson {
  namedInputs?: Record<string, Array<InputsInput | string | FileSetInput | RuntimeInput | EnvironmentInput | ExternalDependenciesInput | DepsOutputsInput | WorkingDirectoryInput | JsonInput>>
}

export interface NxWorkspaceFiles {
  projectFileMap: Record<string, Array<FileData>>
  globalFiles: Array<FileData>
  externalReferences?: NxWorkspaceFilesExternals
}

/**
 * Return-only struct (Rust → JS). `object_from_js = false` skips generating
 * `FromNapiValue` since `External<T>` only supports `FromNapiRef` in napi v3.
 */
export interface NxWorkspaceFilesExternals {
  projectFiles: ExternalObject<Record<string, Array<FileData>>>
  globalFiles: ExternalObject<Array<FileData>>
  allWorkspaceFiles: ExternalObject<Array<FileData>>
}

export declare function parseTaskStatus(stringStatus: string): TaskStatus

/**
 * Structured run report shown in the exit-countdown popup. The TUI builds the
 * visual from these numbers rather than receiving a pre-formatted string.
 */
export interface PerformanceSummaryPayload {
  runDurationMs: number
  criticalPathMs: number
  criticalPathTaskCount: number
  recoverableMs: number
  cache?: CacheStat
  cacheSkipped: boolean
  /** Already in display order; a multi-line entry embeds a task list. */
  recommendations: Array<string>
  /**
   * Phrases already in `recommendations` to hyperlink in place (e.g. the
   * remote-cache CTA); empty when none apply.
   */
  links: Array<Link>
}

/** Process metadata (static, doesn't change during process lifetime) */
export interface ProcessMetadata {
  ppid: number
  name: string
  command: string
  exePath: string
  cwd: string
  alias?: string
  groupId: string
  isRoot: boolean
}

/** Process metrics (dynamic, changes every collection) */
export interface ProcessMetrics {
  pid: number
  cpu: number
  memory: number
}

export interface Project {
  root: string
  namedInputs?: Record<string, Array<InputsInput | string | FileSetInput | RuntimeInput | EnvironmentInput | ExternalDependenciesInput | DepsOutputsInput | WorkingDirectoryInput | JsonInput>>
  tags?: Array<string>
  targets: Record<string, Target>
}

export interface ProjectGraph {
  nodes: Record<string, Project>
  dependencies: Record<string, Array<string>>
  externalNodes: Record<string, ExternalNode>
}

export declare function remove(src: string): void

export declare function restoreTerminal(): void

export declare const enum RunMode {
  RunOne = 0,
  RunMany = 1
}

export interface RuntimeInput {
  runtime: string
}

/**
 * Narrows an existing set of plans to `task_ids`, sharing the instruction pool
 * rather than re-planning.
 *
 * Returns `None` when any requested task has no plan, which is the caller's
 * signal that the plans were built for a different task set and cannot answer
 * for this one. A plan depends on the task graph only through the dependent
 * output instructions, so a subset is sound exactly when every kept task's
 * dependency closure survived intact.
 */
export declare function subsetHashPlans(plans: ExternalObject<Record<string, Array<HashInstruction>>>, taskIds: Array<string>): ExternalObject<Record<string, Array<HashInstruction>>> | null

export declare const enum SupportedEditor {
  VSCode = 0,
  VSCodeInsiders = 1,
  Cursor = 2,
  Windsurf = 3,
  JetBrains = 4,
  Unknown = 5
}

/** System information (static system-level data) */
export interface SystemInfo {
  cpuCores: number
  totalMemory: number
}

export interface Target {
  executor?: string
  inputs?: Array<InputsInput | string | FileSetInput | RuntimeInput | EnvironmentInput | ExternalDependenciesInput | DepsOutputsInput | WorkingDirectoryInput | JsonInput>
  outputs?: Array<string>
  options?: string
  configurations?: string
  parallelism?: boolean
  /** `false` hashes the target from its declared inputs only, never a snapshot. */
  ioSnapshots?: boolean
}

/** A representation of the invocation of an Executor */
export interface Task {
  /** Unique ID */
  id: string
  /** Details about which project, target, and configuration to run. */
  target: TaskTarget
  /** Overrides for the configured options of the target */
  overrides: Record<string, unknown>
  /** The outputs the task may produce */
  outputs: Array<string>
  /** Root of the project the task belongs to */
  projectRoot?: string
  /** Hash of the task which is used for caching. */
  hash?: string
  /** Details about the composition of the hash */
  hashDetails?: TaskHashDetails
  /** Unix timestamp of when a Batch Task starts */
  startTime?: number
  /** Unix timestamp of when a Batch Task ends */
  endTime?: number
  /** Determines if a given task should be cacheable. */
  cache: boolean
  /** Determines if a given task should be parallelizable. */
  parallelism?: boolean
  /** This denotes if the task runs continuously */
  continuous?: boolean
}

/** Graph of Tasks to be executed */
export interface TaskGraph {
  /** IDs of Tasks which do not have any dependencies and are thus ready to execute immediately */
  roots: Array<string>
  /** Map of Task IDs to Tasks */
  tasks: Record<string, Task>
  /** Map of Task IDs to IDs of tasks which the task depends on */
  dependencies: Record<string, Array<string>>
  continuousDependencies: Record<string, Array<string>>
}

/** Details about the composition of a task's hash */
export interface TaskHashDetails {
  /** Command of the task */
  command: string
  /** Hashes of inputs used in the hash */
  nodes: Record<string, string>
  /** Hashes of implicit dependencies which are included in the hash */
  implicitDeps?: Record<string, string>
  /** Hash of the runtime environment which the task was executed */
  runtime?: Record<string, string>
}

/**
 * The result of a completed Task.
 *
 * Task timing information (start and end timestamps) is available
 * on the Task object itself via `Task.startTime` and `Task.endTime`.
 */
export interface TaskResult {
  task: Task
  status: 'success' | 'failure' | 'skipped' | 'stopped' | 'local-cache-kept-existing' | 'local-cache' | 'remote-cache'
  code: number
  terminalOutput?: string
}

export interface TaskRun {
  hash: string
  status: string
  code: number
  start: number
  end: number
}

export declare const enum TaskStatus {
  Success = 0,
  Failure = 1,
  Skipped = 2,
  LocalCacheKeptExisting = 3,
  LocalCache = 4,
  RemoteCache = 5,
  NotStarted = 6,
  InProgress = 7,
  Shared = 8,
  Stopped = 9
}

export interface TaskTarget {
  /** The project for which the task belongs to */
  project: string
  /** The target name which the task should invoke */
  target: string
  /** The configuration of the target which the task invokes */
  configuration?: string
}

export declare function testOnlyTransferFileMap(projectFiles: Record<string, Array<FileData>>, nonProjectFiles: Array<FileData>): NxWorkspaceFilesExternals

/** Track an event using the global telemetry instance */
export declare function trackEvent(eventName: string, parameters?: Record<string, string> | undefined | null): void

/** Track a page view using the global telemetry instance */
export declare function trackPageView(pageTitle: string, pageLocation?: string | undefined | null, parameters?: Record<string, string> | undefined | null): void

/**
 * Transfer the project graph from the JS world to the Rust world, so that we can pass the project graph via memory quicker
 * This wont be needed once the project graph is created in Rust
 */
export declare function transferProjectGraph(projectGraph: ProjectGraph): ExternalObject<ProjectGraph>

export interface TuiCliArgs {
  targets?: string[] | undefined
  tuiAutoExit?: boolean | number | undefined
}

export interface TuiConfig {
  autoExit?: boolean | number | undefined
  suppressHints?: boolean
}

export interface UpdatedWorkspaceFiles {
  fileMap: FileMap
  externalReferences: NxWorkspaceFilesExternals
}

export declare function validateOutputs(outputs: Array<string>): void

export interface WatchEvent {
  path: string
  type: EventType
}

export interface WorkingDirectoryInput {
  workingDirectory: string
}

/** Public NAPI error codes that are for Node */
export declare const enum WorkspaceErrors {
  ParseError = 'ParseError',
  Generic = 'Generic'
}
