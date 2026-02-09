import { ChildProcess, spawn } from 'child_process';
import { Socket, connect } from 'net';
import { Readable, Writable } from 'stream';
import path = require('path');

import type { PluginConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import { getPluginOsSocketPath } from '../../../daemon/socket-utils';
import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { logger } from '../../../utils/logger';
import type { RawProjectGraphDependency } from '../../project-graph-builder';
import { LoadedNxPlugin } from '../loaded-nx-plugin';
import type {
  CreateDependenciesContext,
  CreateMetadataContext,
  CreateNodesContextV2,
  CreateNodesResult,
  PostTasksExecutionContext,
  PreTasksExecutionContext,
  ProjectsMetadata,
} from '../public-api';
import { resolveNxPlugin } from '../resolve-plugin';
import type {
  MessageResult,
  PluginWorkerLoadResult,
  PluginWorkerMessage,
  PluginWorkerResult,
} from './messaging';
import { isPluginWorkerResult, sendMessageOverSocket } from './messaging';
import { Hook, PluginLifecycleManager } from './plugin-lifecycle-manager';

const PLUGIN_TIMEOUT_HINT_TEXT =
  'As a last resort, you can set NX_PLUGIN_NO_TIMEOUTS=true to bypass this timeout.';

const MINUTES = 10;

const MAX_MESSAGE_WAIT =
  process.env.NX_PLUGIN_NO_TIMEOUTS === 'true'
    ? // Registering a timeout prevents the process from exiting
      // if the call to a plugin happens to be the only thing
      // keeping the process alive. As such, even if timeouts are disabled
      // we need to register one. 2147483647 is the max timeout
      // that Node.js allows, and is equivalent to 24.8 days.
      2147483647
    : 1000 * 60 * MINUTES;

export type LoadResultPayload = Extract<
  PluginWorkerLoadResult['payload'],
  { success: true }
>;

export class IsolatedPlugin implements LoadedNxPlugin {
  readonly name: string;
  readonly include?: string[];
  readonly exclude?: string[];

  readonly createNodes?: [
    filePattern: string,
    fn: (
      matchedFiles: string[],
      context: CreateNodesContextV2
    ) => Promise<
      Array<readonly [plugin: string, file: string, result: CreateNodesResult]>
    >,
  ];
  readonly createDependencies?: (
    context: CreateDependenciesContext
  ) => Promise<RawProjectGraphDependency[]>;
  readonly createMetadata?: (
    graph: ProjectGraph,
    context: CreateMetadataContext
  ) => Promise<ProjectsMetadata>;
  readonly preTasksExecution?: (
    context: PreTasksExecutionContext
  ) => Promise<NodeJS.ProcessEnv>;
  readonly postTasksExecution?: (
    context: PostTasksExecutionContext
  ) => Promise<void>;

  // Worker state
  private worker: ChildProcess | null = null;
  private socket: Socket | null = null;
  private _alive = false;
  private _connectPromise: Promise<LoadResultPayload> | null = null;
  private txId = 0;
  private pendingCount = 0;

  // Typed response handlers keyed by transaction ID
  private responseHandlers = new Map<
    string,
    {
      onMessage: (msg: PluginWorkerResult) => void;
      onError: (error: Error) => void;
    }
  >();

  // Configuration for restart
  private readonly plugin: PluginConfiguration;
  private readonly root: string;
  private readonly pluginPath: string;
  private readonly shouldRegisterTSTranspiler: boolean;

  private lifecycle: PluginLifecycleManager;
  private exitHandler: (() => void) | null = null;

  /**
   * Creates and loads an isolated plugin worker.
   */
  static async load(
    plugin: PluginConfiguration,
    root: string,
    index?: number
  ): Promise<IsolatedPlugin> {
    const moduleName = typeof plugin === 'string' ? plugin : plugin.plugin;
    const { name, pluginPath, shouldRegisterTSTranspiler } =
      await resolveNxPlugin(moduleName, root, getNxRequirePaths(root));

    const instance = new IsolatedPlugin(
      plugin,
      root,
      name,
      pluginPath,
      shouldRegisterTSTranspiler,
      index
    );

    const loadResult = await instance.spawnAndConnect();
    instance.setupHooks(loadResult);
    return instance;
  }

  private constructor(
    plugin: PluginConfiguration,
    root: string,
    name: string,
    pluginPath: string,
    shouldRegisterTSTranspiler: boolean,
    public readonly index?: number
  ) {
    this.plugin = plugin;
    this.root = root;
    this.name = name;
    this.pluginPath = pluginPath;
    this.shouldRegisterTSTranspiler = shouldRegisterTSTranspiler;
  }

  private async spawnAndConnect(): Promise<LoadResultPayload> {
    const { worker, socket } = await startPluginWorker(this.name);
    this.worker = worker;
    this.socket = socket;

    this.registerProcessMetrics();

    this.exitHandler = () => {
      this._alive = false;
      this._connectPromise = null;
      if (this.worker?.stdout) {
        this.worker.stdout.unpipe(process.stdout);
      }
      if (this.worker?.stderr) {
        this.worker.stderr.unpipe(process.stderr);
      }
      // Reject all pending requests
      const error = new Error(
        `Plugin worker "${this.name}" exited unexpectedly.`
      );
      for (const { onError } of this.responseHandlers.values()) {
        onError(error);
      }
      this.responseHandlers.clear();
    };
    worker.on('exit', this.exitHandler);

    socket.on('data', consumeMessagesFromSocket(this.handleSocketData));

    return this.sendLoadMessage();
  }

  /**
   * Ensures the worker is alive, restarting it if necessary.
   * Called before each hook execution to handle plugins that were
   * eagerly shutdown (e.g., post-task-only plugins).
   *
   * Uses a stored promise to coalesce concurrent restart attempts
   * so that only one worker is ever spawned at a time.
   */
  private async ensureAlive(): Promise<void> {
    if (this._alive) {
      return;
    }

    if (!this._connectPromise) {
      logger.verbose(`[plugin-client] restarting worker for "${this.name}"`);
      this._connectPromise = this.spawnAndConnect();
    }

    await this._connectPromise;
  }

  private handleSocketData = (raw: string) => {
    const message = JSON.parse(raw);
    if (!isPluginWorkerResult(message)) {
      return;
    }
    const pending = this.responseHandlers.get(message.tx);
    if (pending) {
      this.responseHandlers.delete(message.tx);
      pending.onMessage(message);
    }
  };

  private sendLoadMessage(): Promise<LoadResultPayload> {
    return new Promise((resolve, reject) => {
      const tx = this.generateTxId('load');

      const timeout = setTimeout(() => {
        this.responseHandlers.delete(tx);
        reject(
          new Error(
            `Loading "${
              typeof this.plugin === 'string' ? this.plugin : this.plugin.plugin
            }" timed out after ${MINUTES} minutes. ${PLUGIN_TIMEOUT_HINT_TEXT}`
          )
        );
      }, MAX_MESSAGE_WAIT);

      this.responseHandlers.set(tx, {
        onMessage: (msg) => {
          clearTimeout(timeout);
          if (msg.type !== 'loadResult') {
            reject(new Error(`Expected loadResult, got ${msg.type}`));
            return;
          }
          const payload = msg.payload as PluginWorkerLoadResult['payload'];
          if (payload.success === false) {
            reject(payload.error);
          } else {
            this._alive = true;
            resolve(payload);
          }
        },
        onError: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      sendMessageOverSocket(this.socket, {
        type: 'load',
        payload: {
          plugin: this.plugin,
          root: this.root,
          name: this.name,
          pluginPath: this.pluginPath,
          shouldRegisterTSTranspiler: this.shouldRegisterTSTranspiler,
        },
        tx,
      });
    });
  }

  private setupHooks(loadResult: LoadResultPayload): void {
    // These are set via Object.defineProperty to work around readonly
    (this as { name: string }).name = loadResult.name;
    (this as { include?: string[] }).include = loadResult.include;
    (this as { exclude?: string[] }).exclude = loadResult.exclude;

    const registeredHooks: Hook[] = hooks(
      loadResult.createNodesPattern && 'createNodes',
      loadResult.hasCreateDependencies && 'createDependencies',
      loadResult.hasCreateMetadata && 'createMetadata',
      loadResult.hasPreTasksExecution && 'preTasksExecution',
      loadResult.hasPostTasksExecution && 'postTasksExecution'
    );

    this.lifecycle = new PluginLifecycleManager(registeredHooks);

    const shutdown = () => this.shutdownIfInactive();
    const wrap = <TArgs extends unknown[], TReturn>(
      hook: Hook,
      hookFn: (...args: TArgs) => Promise<TReturn>
    ) =>
      this.lifecycle.wrapHook(
        hook,
        async (...args: TArgs) => {
          await this.ensureAlive();
          return hookFn(...args);
        },
        shutdown
      );

    if (loadResult.createNodesPattern) {
      (this as { createNodes: IsolatedPlugin['createNodes'] }).createNodes = [
        loadResult.createNodesPattern,
        wrap('createNodes', async (configFiles, ctx) => {
          const result = await this.sendRequest('createNodes', {
            configFiles,
            context: ctx,
          });
          if (result.success === false) {
            throw result.error;
          }
          return result.result;
        }),
      ];
    }

    if (loadResult.hasCreateDependencies) {
      (
        this as { createDependencies: IsolatedPlugin['createDependencies'] }
      ).createDependencies = wrap('createDependencies', async (ctx) => {
        const result = await this.sendRequest('createDependencies', {
          context: ctx,
        });
        if (result.success === false) {
          throw result.error;
        }
        return result.dependencies;
      });
    }

    if (loadResult.hasCreateMetadata) {
      (
        this as { createMetadata: IsolatedPlugin['createMetadata'] }
      ).createMetadata = wrap('createMetadata', async (graph, ctx) => {
        const result = await this.sendRequest('createMetadata', {
          graph,
          context: ctx,
        });
        if (result.success === false) {
          throw result.error;
        }
        return result.metadata;
      });
    }

    if (loadResult.hasPreTasksExecution) {
      (
        this as { preTasksExecution: IsolatedPlugin['preTasksExecution'] }
      ).preTasksExecution = wrap('preTasksExecution', async (context) => {
        const result = await this.sendRequest('preTasksExecution', {
          context,
        });
        if (result.success === false) {
          throw result.error;
        }
        return result.mutations;
      });
    }

    if (loadResult.hasPostTasksExecution) {
      (
        this as { postTasksExecution: IsolatedPlugin['postTasksExecution'] }
      ).postTasksExecution = wrap('postTasksExecution', async (context) => {
        const result = await this.sendRequest('postTasksExecution', {
          context,
        });
        if (result.success === false) {
          throw result.error;
        }
      });
    }

    // Shut down immediately if no graph phase hooks
    if (this.lifecycle.shouldShutdownImmediately()) {
      this.shutdown();
    }
  }

  private generateTxId(type: string): string {
    return `${this.name}:${this.worker?.pid ?? ''}:${type}:${this.txId++}`;
  }

  private sendRequest<TType extends PluginWorkerMessage['type']>(
    type: TType,
    payload: Extract<PluginWorkerMessage, { type: TType }>['payload']
  ): Promise<MessageResult<TType>['payload']> {
    const tx = this.generateTxId(type);
    this.pendingCount++;

    return new Promise<MessageResult<TType>['payload']>((resolve, reject) => {
      const expectedResultType = `${type}Result`;

      const timeout = setTimeout(() => {
        this.responseHandlers.delete(tx);
        this.pendingCount--;
        reject(
          new Error(
            `${this.name} timed out after ${MINUTES} minutes during ${type}. ${PLUGIN_TIMEOUT_HINT_TEXT}`
          )
        );
      }, MAX_MESSAGE_WAIT);

      this.responseHandlers.set(tx, {
        onMessage: (msg) => {
          clearTimeout(timeout);
          this.pendingCount--;

          if (msg.type !== expectedResultType) {
            reject(
              new Error(`Expected ${expectedResultType}, got ${msg.type}`)
            );
            return;
          }

          resolve(msg.payload as MessageResult<TType>['payload']);
        },
        onError: (error) => {
          clearTimeout(timeout);
          this.pendingCount--;
          reject(error);
        },
      });

      sendMessageOverSocket(this.socket, {
        type,
        payload,
        tx,
      } as PluginWorkerMessage);
    });
  }

  private shutdownIfInactive(): void {
    if (this.pendingCount > 0) {
      logger.verbose(
        `[isolated-plugin] worker for "${this.name}" has ${this.pendingCount} pending request(s), not shutting down yet`
      );
      return;
    }
    logger.verbose(
      `[isolated-plugin] shutting down worker for "${this.name}" after last hook`
    );
    this.shutdown();
  }

  shutdown(): void {
    if (!this._alive) return;
    this._alive = false;
    this._connectPromise = null;

    if (this.worker && this.exitHandler) {
      this.worker.off('exit', this.exitHandler);
    }

    if (this.worker?.stdout) {
      this.worker.stdout.unpipe(process.stdout);
      this.worker.stdout.destroy();
    }
    if (this.worker?.stderr) {
      this.worker.stderr.unpipe(process.stderr);
      this.worker.stderr.destroy();
    }
    if (this.socket) {
      this.socket.end();
    }

    this.worker = null;
    this.socket = null;
    this.exitHandler = null;
  }

  private registerProcessMetrics(): void {
    if (!this.worker?.pid) return;
    (async () => {
      try {
        const { isOnDaemon } = await import('../../../daemon/is-on-daemon.js');
        if (!isOnDaemon()) {
          const { getProcessMetricsService } = await import(
            '../../../tasks-runner/process-metrics-service.js'
          );
          getProcessMetricsService().registerMainCliSubprocess(
            this.worker.pid,
            `${this.name}${this.index !== undefined ? ` (${this.index})` : ''}`
          );
        }
      } catch {
        // Silently ignore - metrics collection is optional
      }
    })();
  }
}

// --- Worker Spawning Utilities ---

global.nxPluginWorkerCount ??= 0;

async function startPluginWorker(name: string) {
  performance.mark(`start-plugin-worker:${name}`);

  const isWorkerTypescript = path.extname(__filename) === '.ts';
  const workerPath = path.join(__dirname, 'plugin-worker');

  const env: Record<string, string> = {
    ...process.env,
    ...(isWorkerTypescript
      ? {
          TS_NODE_PROJECT: path.join(
            __dirname,
            '../../../../tsconfig.lib.json'
          ),
        }
      : {}),
  };

  const ipcPath = getPluginOsSocketPath(
    [process.pid, global.nxPluginWorkerCount++, performance.now()].join('-')
  );

  const worker = spawn(
    process.execPath,
    [
      ...(isWorkerTypescript ? ['--require', 'ts-node/register'] : []),
      workerPath,
      ipcPath,
      name,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      detached: true,
      shell: false,
      windowsHide: true,
    }
  );

  logger.verbose(
    `[isolated-plugin] spawned worker for "${name}" (pid: ${worker.pid}, socket: ${ipcPath})`
  );

  const stdoutMaxListeners = process.stdout.getMaxListeners();
  const stderrMaxListeners = process.stderr.getMaxListeners();
  if (stdoutMaxListeners !== 0) {
    process.stdout.setMaxListeners(stdoutMaxListeners + 1);
  }
  if (stderrMaxListeners !== 0) {
    process.stderr.setMaxListeners(stderrMaxListeners + 1);
  }

  pipeAndUnrefChildStream(worker.stdout, process.stdout, 'stdout');
  pipeAndUnrefChildStream(worker.stderr, process.stderr, 'stderr');

  worker.unref();

  let attempts = 0;
  return new Promise<{ worker: ChildProcess; socket: Socket }>(
    (resolve, reject) => {
      const id = setInterval(async () => {
        const socket = await isServerAvailable(ipcPath);
        if (socket) {
          socket.unref();
          clearInterval(id);
          logger.verbose(
            `[isolated-plugin] connected to worker for "${name}" (pid: ${worker.pid}) after ${attempts} attempt(s)`
          );
          resolve({ worker, socket });
        } else if (attempts > 10000) {
          clearInterval(id);
          reject(new Error(`Failed to start plugin worker for plugin ${name}`));
        } else {
          attempts++;
        }
      }, 10);
    }
  ).finally(() => {
    performance.mark(`start-plugin-worker-end:${name}`);
    performance.measure(
      `start-plugin-worker:${name}`,
      `start-plugin-worker:${name}`,
      `start-plugin-worker-end:${name}`
    );
  });
}

function isServerAvailable(ipcPath: string): Promise<Socket | false> {
  return new Promise((resolve) => {
    try {
      const socket = connect(ipcPath, () => {
        resolve(socket);
      });
      socket.once('error', () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

function getTypeName(u: unknown): string {
  if (u === null) return 'null';
  if (u === undefined) return 'undefined';
  if (typeof u !== 'object') return typeof u;
  if (Array.isArray(u)) {
    const innerTypes = u.map((el) => getTypeName(el));
    return `Array<${Array.from(new Set(innerTypes)).join('|')}>`;
  }
  return u.constructor?.name ?? 'unknown object';
}

function detectAlternativeRuntime(): 'bun' | 'deno' | null {
  if ('Bun' in globalThis && typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun';
  }
  if ('Deno' in globalThis && typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno';
  }
  return null;
}

function pipeAndUnrefChildStream(
  source: Readable | null,
  destination: Writable,
  streamName: 'stdout' | 'stderr'
): void {
  if (!source) {
    return;
  }

  source.pipe(destination);

  if (source instanceof Socket) {
    source.unref();
    return;
  }

  if (typeof (source as any).unref === 'function') {
    (source as any).unref();
    return;
  }

  const runtime = detectAlternativeRuntime();
  if (runtime) {
    console.warn(
      `[NX] worker.${streamName} does not support unref() in ${runtime}. ` +
        `This may cause the process to hang when waiting for plugin workers to exit. ` +
        `This is a known limitation of ${runtime}'s Node.js compatibility layer.`
    );
  } else {
    console.warn(
      `[NX] worker.${streamName} is not a net.Socket and does not have an unref() method. ` +
        `Expected Socket, got ${getTypeName(source)}. ` +
        `This may cause the process to hang when waiting for plugin workers to exit.`
    );
  }
}

// --- Utility functions ---

type Falsy = false | 0 | '' | null | undefined | 0n;

function hooks(...array: Array<Hook | Falsy>): Array<Hook> {
  return array.filter((v): v is Hook => !!v);
}
