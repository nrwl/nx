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
  /** Takes the lock without blocking; false means another handle holds it. */
  tryLock(): boolean
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
  /**
   * `snapshots` is this run's I/O snapshot set; a task with an eligible
   * entry hashes its observed reads instead of its declared filesets.
   * `options` carries the task ids decided in JS, where executors and
   * target configuration are resolved.
   */
  getPlans(taskIds: Array<string>, taskGraph: TaskGraph, snapshots?: IoSnapshots | undefined | null, options?: IoSnapshotEligibilityOptions | undefined | null): Record<string, string[]>
  getPlansReference(taskIds: Array<string>, taskGraph: TaskGraph, snapshots?: IoSnapshots | undefined | null, options?: IoSnapshotEligibilityOptions | undefined | null): ExternalObject<Record<string, Array<HashInstruction>>>
}

export declare class HttpRemoteCache {
  constructor()
  retrieve(hash: string, cacheDirectory: string): Promise<CachedResult | null>
  store(hash: string, cacheDirectory: string, terminalOutput: string, code: number): Promise<boolean>
}

/**
 * The hasher's handle on an index: lists only after catching up with the
 * watch behind it.
 */
export declare class IgnoredIndexReader {

}

export declare class ImportResult {
  file: string
  sourceProject: string
  dynamicImportExpressions: Array<string>
  staticImportExpressions: Array<string>
}

/**
 * One stored version of a commit's snapshot set. Handed to the hash planner as-is.
 * A fresh import holds every entry; a handle reopened from storage reads
 * them per task as they are asked for and remembers them, so it costs the
 * tasks it plans rather than the workspace's whole set.
 */
export declare class IoSnapshots {
  get commit(): string
  get resolution(): IoSnapshotResolution
}

/**
 * The workspace database's snapshot sets. Each import is its own version,
 * keyed by commit and fetch time, so a run that pinned one keeps reading it
 * while a newer one is imported. Failures throw with a `code` JS maps to a
 * skip reason: `STORE_UNAVAILABLE`, `INVALID_RESPONSE` or `WRITE_FAILED`.
 */
export declare class IoSnapshotStore {
  constructor(db: ExternalObject<NxDbConnection>)
  /**
   * Stores the set the Nx Cloud client read for `requested_commit` as a new
   * version, and returns it with every entry in hand.
   */
  import(options: IoSnapshotImportOptions): IoSnapshots
  /**
   * The newest stored set for `commit`, without touching the network;
   * `null` when none is stored, its row cannot be read, or it was fetched
   * more than `max_age_ms` ago. Reads only the version's summary row.
   */
  get(commit: string, maxAgeMs?: number | undefined | null): IoSnapshots | null
  /**
   * Exactly the version of `commit` fetched at `fetched_at`; `null` when it
   * is not stored or its row cannot be read.
   */
  getVersion(commit: string, fetchedAt: number): IoSnapshots | null
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
  /**
   * Register terminal outputs that were written without a cache entry —
   * uncacheable tasks, and cacheable ones run with `--skip-nx-cache`.
   *
   * Without a row the file is invisible to `remove_old_cache_records`,
   * which only ever walks hashes it finds in the database, so these files
   * would accumulate forever. The row carries `is_cache_entry = FALSE` so it
   * can never be served as a cache hit.
   *
   * On conflict `accessed_at` always moves: the reads filter these rows out,
   * so they would otherwise age from the first write and be collected out
   * from under a task that is still being run daily. `size` moves only while
   * the row is still output-only (`NOT is_cache_entry`), so a task rerun with
   * a longer log stops undercounting against `maxCacheSize`. `is_cache_entry`
   * is never touched, and a row that already has artifacts keeps the size
   * `put` recorded, so a rewrite can neither demote a real entry nor replace
   * its whole-entry size with the terminal output's.
   */
  recordTerminalOutputs(records: Array<TerminalOutputRecord>): void
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

export declare class NxPluginCapabilities {
  constructor(db: ExternalObject<NxDbConnection>)
  record(computedAt: number, capabilities: Array<CachedPluginCapabilities>): void
  /**
   * The capabilities recorded with the graph computed at `computed_at`, or
   * null when what is recorded belongs to another build or nothing is.
   */
  get(computedAt: number): Array<CachedPluginCapabilities> | null
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
  constructor(workspaceRoot: string, projectGraph: ExternalObject<ProjectGraph>, projectFileMap: ExternalObject<Record<string, Array<FileData>>>, allWorkspaceFiles: ExternalObject<Array<FileData>>, tsConfig: Buffer, tsConfigPaths: Record<string, Array<string>>, rootTsconfigPath: string | undefined | null, options: HasherOptions | undefined | null, ignoredIndex: ExternalObject<IgnoredIndexReader>)
  /**
   * Hash each task's instructions using the env map keyed by `task.id`.
   * Every task in `hash_plans` must have an entry in `per_task_envs` —
   * a missing id surfaces as an error rather than silently hashing
   * against an empty env. Callers that want to hash all tasks against
   * the same env should build `per_task_envs` by keying that env under
   * every task id.
   */
  hashPlans(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, perTaskEnvs: Record<string, Record<string, string>>, cwd: string, collectTaskInputs?: boolean | undefined | null): Record<string, HashDetails>
  /**
   * Like `hash_plans`, but only for the plans the planner did not defer
   * (`HashPlans::deferred`: a task that reads another task's outputs, or a
   * disk-backed fileset whose directory contains, or sits inside, an
   * upstream task's output). The rest are left out and hash once those
   * tasks have run; their ids are absent from the result and need no entry
   * in `per_task_envs`.
   */
  hashPlansUpfront(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, perTaskEnvs: Record<string, Record<string, string>>, cwd: string, collectTaskInputs?: boolean | undefined | null): Record<string, HashDetails>
  /**
   * Hashes `task_ids` from plans built earlier, so a task the up-front batch
   * deferred needs no second planning pass. Ids without a plan are absent
   * from the result.
   */
  hashPlansFor(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, taskIds: Array<string>, perTaskEnvs: Record<string, Record<string, string>>, cwd: string, collectTaskInputs?: boolean | undefined | null): Record<string, HashDetails>
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

export declare class WorkspaceContext {
  workspaceRoot: string
  constructor(workspaceRoot: string, cacheDir: string, options?: WorkspaceContextOptions | undefined | null)
  /**
   * Loads the files the last walk recorded instead of walking. For a
   * process whose host already walked, such as a plugin worker.
   */
  static fromArchive(workspaceRoot: string, cacheDir: string, options?: WorkspaceContextOptions | undefined | null): WorkspaceContext
  /**
   * Bumped once per applied batch that changed anything. Equal values
   * mean equal files, so a consumer that remembers the value it computed
   * from can skip recomputing.
   */
  changeSeq(): number
  /**
   * Walks the workspace again into this context, so it and the archive
   * include writes made since the last walk. Does nothing while a walk is
   * in progress. Await `ready()` before reading. What the walk finds
   * changed goes to the subscriber.
   *
   * For a graph built without the daemon, where nothing watches: see
   * `refreshWorkspaceContext`, called by
   * `buildProjectGraphAndSourceMapsWithoutDaemon`.
   */
  refresh(): boolean
  /**
   * Resolves once the files behind this context exist. The readers below
   * block the calling thread until they do; awaiting this first keeps a
   * plugin host responsive while its workers are connecting.
   */
  ready(): Promise<void>
  /** On wasm the files are gathered when the context is constructed. */
  ready(): void
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
  /**
   * Applies changes a caller learned of on its own. Waits through a walk in
   * progress so the answer reflects them. Returns what really changed; the
   * batch is not published to subscribers.
   */
  incrementalUpdate(updatedFiles: Array<string>, deletedFiles: Array<string>): ChangeBatch
  updateProjectFiles(projectRootMappings: Record<string, string>, projectFiles: ExternalObject<Record<string, Array<FileData>>>, globalFiles: ExternalObject<Array<FileData>>, updatedFiles: Record<string, string>, deletedFiles: Array<string>): UpdatedWorkspaceFiles
  allFileData(): Array<FileData>
  /**
   * Recover from dropped watch events: re-walk, and report what changed
   * against the files this context was holding. The fresh files are
   * adopted, so the caller only has to feed the returned changes through
   * its normal recomputation path; subscribers do not see them.
   */
  rescanAndDiff(): ChangeBatch
  /**
   * The subset of `paths` the file map holds: what the watch tracks, with
   * the ignore rules applied. A path it does not hold is gitignored, gone,
   * or not yet reported. Applies what the watch delivered first, as every
   * other read of the files does, so a write already reported counts.
   */
  trackedFiles(paths: Array<string>): Array<string>
  getFilesInDirectory(directory: string): Array<string>
  /**
   * Subscribes to the context's changes: the callback is called whenever
   * something was applied or delivered, with everything not yet taken by
   * it or by `settle`. Replaces any earlier subscriber.
   */
  onChanges(callback: (err: Error | null, batch: ChangeBatch | null) => void): void
  /**
   * Subscribes to every event the watch delivers, whether or not it
   * concerns the files: writes under ignored directories included, and
   * the `rescan` marker when the kernel dropped events. Replaces any
   * earlier subscriber. Batches applied to the files are `onChanges`.
   */
  onWatchEvents(callback: (err: Error | null, events: WatchEvent[] | null) => void): void
  /**
   * Applies everything the watch has delivered, waiting out the kernel hop,
   * then takes every change applied and not yet taken, one entry per path
   * at its latest state. The change subscriber takes from the same place,
   * so no change is handed out twice.
   */
  settle(): ChangeBatch
  /**
   * Takes every change applied and not yet taken, without waiting for the
   * watch: for a caller that just applied changes itself, through
   * `incrementalUpdate` or `rescanAndDiff`.
   */
  takeAppliedChanges(): ChangeBatch
  /**
   * Stops the watcher and forgets the subscribers. The files stay as they
   * were; reads no longer pull anything in.
   */
  stopWatching(): void
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

/**
 * Why the change reached each task. Covers every task it reached, not just
 * the selection, so a reason naming a producer can be looked up too.
 */
export interface AffectedTaskExplanation {
  /** Consumer -> the reached producers whose outputs it reads. */
  producersOf: Record<string, Array<string>>
  /** Changed project configs no longer on disk. Every task was seeded for them. */
  deletedProjectConfigs: Array<string>
  /** Per reached task, the changed files and moved packages among its inputs. */
  inputMatches: Record<string, TaskInputMatches>
}

export declare function affectedTasks(projectGraph: ExternalObject<ProjectGraph>, hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, taskGraph: TaskGraph, changedFiles: Array<string>, options: AffectedTasksOptions): AffectedTaskSelection

export interface AffectedTaskSelection {
  /** Every affected task, sorted. */
  affected: Array<string>
  /** `affected` plus everything it depends on, sorted: what a run keeps. */
  required: Array<string>
}

export interface AffectedTasksOptions {
  /**
   * `createNodes` globs of every loaded plugin. Resolved in TypeScript because
   * `getPlugins` is async and spawns plugin workers.
   */
  projectGlobPatterns: Array<string>
  workspaceRoot: string
  /**
   * Tasks touched whatever their plan says: those of projects a dependency
   * change names outright (`projectsAffectedByDependencyUpdates`, or a
   * workspace project the root package.json depends on), and those whose
   * executor hashes outside its plan. Ids not in the task graph are ignored.
   */
  alwaysTouchedTaskIds: Array<string>
  /**
   * External node names whose version or integrity moved. A plan carries them
   * as `External(name)`, so a package is matched the way a path is.
   */
  changedExternals: Array<string>
  /**
   * Ecosystems whose manifest changed without the change being pinnable to
   * packages, `npm` for a lock file. Every node of that type counts as
   * moved, and a node of any other type does not: a pnpm lock file cannot
   * have moved a Maven artifact.
   */
  changedExternalTypes: Array<string>
  /**
   * Projects `--exclude` names. Their tasks are dropped from the selection
   * after the walk, so they still carry a change to the tasks reading them.
   */
  excludedProjects: Array<string>
  /**
   * The targets the command asked for. The graph also holds what they depend
   * on, which carries a change but is only ever run as a dependency.
   */
  targets: Array<string>
  /**
   * Where a field-filtered JSON input's file is read at both ends of the diff.
   * Unset, as for `--files`, such a file counts as changed whole.
   */
  revisions?: FileRevisions
  /**
   * The runner's `selectivelyHashTsConfig`: a task hashes only its own
   * project's tsconfig `paths` entries, rather than none.
   */
  selectivelyHashTsConfig: boolean
}

export interface BatchInfo {
  executorName: string
  taskIds: Array<string>
}

export declare const enum BatchStatus {
  Running = 'Running',
  Success = 'Success',
  Failure = 'Failure'
}

export interface CachedPluginCapabilities {
  createNodesPattern?: string
  hasCreateDependencies: boolean
  hasCreateMetadata: boolean
  hasPreTasksExecution: boolean
  hasPostTasksExecution: boolean
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

/**
 * What one application of changes did to the files. `seq` is the context's
 * change sequence afterwards; it is unchanged, and the lists empty, when
 * nothing the batch reported was really different. A path can reach a
 * consumer in more than one batch (see `settle`): the one with the higher
 * `seq` holds its later state.
 */
export interface ChangeBatch {
  seq: number
  createdFiles: Array<FileData>
  updatedFiles: Array<FileData>
  deletedFiles: Array<string>
}

export declare function closeDbConnection(connection: ExternalObject<NxDbConnection>): void

export declare function connectToNxDb(cacheDir: string, dbName?: string | undefined | null): ExternalObject<NxDbConnection>

export declare function copy(src: string, dest: string): number

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

/**
 * `jsonDiff(JSON.parse(lhs), JSON.parse(rhs))`, or `null` when either side is
 * not strict JSON, where `JSON.parse` would throw.
 */
export declare function diffJson(lhs: string, rhs: string): Array<JsonChange> | null

/**
 * Only the projects that own a changed file, one entry per file, in input
 * order. `nx release` version plans ignore implicit and config-derived touches.
 */
export declare function directlyTouchedProjects(projectGraph: ExternalObject<ProjectGraph>, touchedFiles: Array<string>): Array<string>

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
  create = 'create',
  /**
   * The kernel dropped events (e.g. an inotify queue overflow); per-path
   * events cannot be trusted complete and consumers must re-walk.
   */
  rescan = 'rescan'
}

/** The files an `includeIgnored` fileset group matches on disk, sorted. */
export declare function expandFilesInput(workspaceRoot: string, globs: Array<string>): Array<string>

export declare function expandOutputs(directory: string, entries: Array<string>): Array<string>

/**
 * Separate from `affected_tasks` because the explanation costs a string per
 * match and only `--explain` reads it; the selection path stays a membership
 * test over interned instruction ids.
 */
export declare function explainAffectedTasks(projectGraph: ExternalObject<ProjectGraph>, hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, taskGraph: TaskGraph, changedFiles: Array<string>, options: AffectedTasksOptions): AffectedTaskExplanation

export interface ExternalDependenciesInput {
  externalDependencies: Array<string>
}

export interface ExternalNode {
  /**
   * The ecosystem the node belongs to, `npm` for a package the JS lock-file
   * parsers found. Optional because a plugin may leave it unset.
   */
  type?: string
  packageName?: string
  version: string
  hash?: string
}

export interface FileData {
  file: string
  hash: string
}

export interface FileMap {
  projectFileMap: Record<string, Array<FileData>>
  nonProjectFiles: Array<FileData>
}

/**
 * Where a changed file's two versions are read: `base` from git, `head` from
 * git or, unset, the working tree.
 */
export interface FileRevisions {
  base: string
  head?: string
}

export interface FileSetInput {
  fileset: string
  dependencies?: boolean
  /**
   * Hash the glob straight from disk (so gitignored/generated files count)
   * instead of the workspace file map.
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
 * Tasks whose snapshot read another task's outputs: they hash after their
 * producers ran, because those files only exist then. Needs no project graph,
 * so the client can call it before the first hashing wave on the daemon path.
 * Opted-out and custom-hasher tasks are not excluded: deferring a task that
 * ends up hashed natively only delays its hash, it never changes it.
 */
export declare function getIoSnapshotDeferredTaskIds(snapshots: IoSnapshots, taskGraph: TaskGraph): Array<string>

/** The eligibility report, for the run summary. */
export declare function getIoSnapshotReport(snapshots: IoSnapshots, taskGraph: TaskGraph, options?: IoSnapshotEligibilityOptions | undefined | null): IoSnapshotReport

/**
 * If `workspace_root` is inside a git worktree, returns the main repo root.
 * Returns `None` when already in the main repo (or not in a git repo at all).
 */
export declare function getMainWorktreeRoot(workspaceRoot: string): string | null

/**
 * Observed outputs per eligible task, for the runner to union into
 * `task.outputs`.
 */
export declare function getObservedIoSnapshotOutputs(snapshots: IoSnapshots, taskGraph: TaskGraph, options?: IoSnapshotEligibilityOptions | undefined | null): Record<string, Array<string>>

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

/** A changed file that reached a task, and the input pattern it reached it by. */
export interface InputMatch {
  file: string
  /**
   * The fileset that matched. Absent for an instruction with no pattern to
   * name, such as the root tsconfig.
   */
  pattern?: string
}

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
 * Why a task (or the whole run) hashes natively; `reason` is rendered by the
 * run summary.
 */
export interface IoSnapshotDiagnostic {
  reason: string
  taskId?: string
  glob?: string
  message?: string
}

/** What JS knows about a run's tasks that the eligibility walk needs. */
export interface IoSnapshotEligibilityOptions {
  /** Tasks whose executor ships a custom hasher. */
  customHasherTaskIds?: Array<string>
}

/** The snapshot set the Nx Cloud client read for HEAD, as JS hands it over. */
export interface IoSnapshotImportOptions {
  requestedCommit: string
  /** `Record<taskId, { commit, inputs, outputs }>` as JSON. */
  snapshotsJson: string
}

export interface IoSnapshotReport {
  /** Task ids hashed from their snapshot. */
  used: Array<string>
  /** Subset of `used` whose snapshot also contributes observed outputs. */
  tasksWithOutputs: Array<string>
  diagnostics: Array<IoSnapshotDiagnostic>
  resolution: IoSnapshotResolution
}

/** What was resolved for a commit; stored beside its entries. */
export interface IoSnapshotResolution {
  requestedCommit: string
  fetchedAt: number
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

/** One entry of `jsonDiff`'s result: `type` is a `JsonDiffType` value. */
export interface JsonChange {
  type: string
  path: Array<string>
  value: JsonChangeValue
}

export interface JsonChangeValue {
  lhs?: any
  rhs?: any
}

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
 * Runs every locator and returns what each marked, in locator order, unsorted
 * overall. A project appears once per reason; callers dedupe by walking the
 * graph.
 *
 * Every branch is deterministic, and must stay so: this order reaches
 * `result.nodes` insertion order and so `nx show projects --affected`.
 */
export declare function locateTouchedProjects(projectGraph: ExternalObject<ProjectGraph>, nxJson: NxJson, touchedFiles: Array<string>, options: AffectedOptions, jsLocators: Array<(files: string[]) => Promise<TouchedProject[]>>): Promise<Array<TouchedProject>>

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
  ignoredIndex: ExternalObject<IgnoredIndexReader>
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

export declare const enum SupportedEditor {
  VSCode = 0,
  VSCodeInsiders = 1,
  Cursor = 2,
  Windsurf = 3,
  JetBrains = 4,
  Unknown = 5
}

/**
 * A free function, not a method: `BatchProcess` writes these logs whichever
 * cache implementation is active, so the sweep must not be reachable only
 * through the DB-backed one.
 *
 * Deletes batch logs by age, then oldest-first while the directory is over
 * budget.
 *
 * No database rows: nothing looks a batch log up by key, so a row would be
 * write-only bookkeeping that a hard-killed process could skip, orphaning
 * the file forever. The filesystem cannot drift from itself, and the file
 * is appended to for the life of its batch, so a size recorded anywhere
 * else is wrong until that batch ends.
 *
 * The budget is separate from `maxCacheSize` on purpose: these are debug
 * artifacts, and sharing a budget would let one evict a replayable cache
 * entry — trading a rebuild for a text file.
 *
 * The age sweep deletes at `BATCH_OUTPUT_MAX_AGE`; the eviction skips
 * anything written within `BATCH_OUTPUT_MIN_EVICTION_AGE`. That is
 * last-write, not creation, so a batch silent through a long quiet phase is
 * not protected.
 */
export declare function sweepBatchOutputs(cachePath: string): void

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
  /** The target's ultracache configuration, if declared */
  ultracache?: TaskUltracacheConfiguration
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
 * What reached one task: the files its filesets matched and the packages it
 * hashes that moved.
 */
export interface TaskInputMatches {
  files: Array<InputMatch>
  /** External node names the plan hashes one by one that moved. */
  packages: Array<string>
  /** The plan hashes every external dependency, and one moved. */
  allExternals: boolean
  /** Changed config files of the projects whose configuration the plan hashes. */
  projectConfigs: Array<string>
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

/** Ultracache configuration of a task's target */
export interface TaskUltracacheConfiguration {
  /** How this target's tasks participate. Defaults to `on`. */
  mode?: 'on' | 'warn' | 'error' | 'off'
  /**
   * Workspace-relative glob patterns for reads that should be excluded
   * from ultracache reports. The first path segment cannot contain `*`,
   * and `?`, `!`, `[`, `]` and extglobs are not supported; anchor the
   * pattern to a directory instead of leading with `**`.
   */
  ignoredReads?: Array<string>
  /**
   * Workspace-relative glob patterns for writes that should be excluded
   * from ultracache reports. The first path segment cannot contain `*`,
   * and `?`, `!`, `[`, `]` and extglobs are not supported; anchor the
   * pattern to a directory instead of leading with `**`.
   */
  ignoredWrites?: Array<string>
}

export interface TerminalOutputRecord {
  hash: string
  /**
   * Byte length of the terminal output written for this hash, so these
   * files are counted against `maxCacheSize` like any other cache content.
   */
  size: number
}

export declare function testOnlyTransferFileMap(projectFiles: Record<string, Array<FileData>>, nonProjectFiles: Array<FileData>): NxWorkspaceFilesExternals

/**
 * One locator's finding: a project, and enough about the signal to explain it.
 *
 * `kind` is a discriminant the TypeScript side narrows on; the payload fields
 * are populated per kind rather than modelled as a union, because napi objects
 * carry no tag. A locator that cannot attribute a single file leaves `file`
 * unset rather than inventing one.
 */
export interface TouchedProject {
  project: string
  kind: string
  /** The changed file that triggered it, when one file is responsible. */
  file?: string
  /**
   * The `{workspaceRoot}` fileset that matched, when the signal came from a
   * pattern rather than from ownership.
   */
  pattern?: string
  /**
   * The external package whose version moved. Set by the JS locators, which
   * return through this same struct, so it has to be declared here or napi
   * drops it on the way back.
   */
  package?: string
}

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

/**
 * How a target's tasks participate in ultracache. Nx Cloud only: nothing in
 * the OSS runner records or applies IO, so every mode behaves as `Off` without
 * it.
 */
export declare const enum UltracacheMode {
  /**
   * Record IO and let the recording stand in for the target's declared
   * inputs and outputs. The default.
   */
  On = 'on',
  /**
   * Record IO and report undeclared reads and writes, but hash and cache
   * from what the target declared.
   */
  Warn = 'warn',
  /**
   * Reserved for failing the task on an undeclared read or write. Nothing
   * enforces that per target yet, so it behaves as `Warn` today.
   */
  Error = 'error',
  /** Record nothing, so no report is produced and nothing is applied. */
  Off = 'off'
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

export interface WorkspaceContextOptions {
  /**
   * Keep the files current from a watcher the context owns. Watching
   * starts before the scan, so nothing written after construction is
   * missed. Off by default; ignored on wasm, which has no watcher.
   */
  watch?: boolean
  /**
   * Paths the watch reports even though a hardcoded ignore covers them,
   * as the daemon does for its own process file. They reach the event
   * stream only, never the files: the workspace ignore rules still decide
   * what enters those.
   */
  alwaysWatch?: Array<string>
}

/** Public NAPI error codes that are for Node */
export declare const enum WorkspaceErrors {
  ParseError = 'ParseError',
  Generic = 'Generic'
}
