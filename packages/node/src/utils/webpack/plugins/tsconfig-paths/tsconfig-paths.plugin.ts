// Adapted from https://github.com/dividab/tsconfig-paths-webpack-plugin
import * as chalk from 'chalk';
import * as TsconfigPaths from 'tsconfig-paths';
import * as path from 'path';
import * as Options from './tsconfig-paths.options';
import * as Logger from './tsconfig-paths.logger';
import * as fs from 'fs';
import { ResolveContext, ResolveRequest } from 'enhanced-resolve';
type ResolvePluginInstance = any;
type Resolver = any;

type FileSystem = Resolver['fileSystem'];
type TapAsyncCallback = (
  request: ResolveRequest,
  context: ResolveContext,
  callback: TapAsyncInnerCallback
) => void;
type TapAsyncInnerCallback = (
  error?: Error | null | false,
  result?: null | ResolveRequest
) => void;

export interface LegacyResolverPlugin {
  readonly apply: (resolver: LegacyResolver) => void;
}

export interface LegacyResolver {
  readonly apply: (plugin: LegacyResolverPlugin) => void;
  readonly plugin: (source: string, cb: ResolverCallbackLegacy) => void;
  readonly doResolve: doResolveLegacy | doResolve;
  readonly join: (relativePath: string, innerRequest: Request) => Request;
  readonly fileSystem: LegacyResolverFileSystem;
  readonly getHook: (hook: string) => Tapable;
}

export type doResolveLegacy = (
  target: string,
  req: Request,
  desc: string,
  callback: Callback
) => void;

export type doResolve = (
  hook: Tapable,
  req: Request,
  message: string,
  resolveContext: LegacyResolveContext,
  callback: Callback
) => void;

export type ReadJsonCallback = (error: Error | undefined, result?: {}) => void;

export type ReadJson = (path2: string, callback: ReadJsonCallback) => void;

export type LegacyResolverFileSystem = typeof fs & { readJson?: ReadJson };

export interface LegacyResolveContext {
  log?: string;
  stack?: string;
  missing?: string;
}

export interface Tapable {
  readonly tapAsync: (
    options: TapableOptions,
    callback: TapAsyncCallback
  ) => void;
}

export interface TapableOptions {
  readonly name: string;
}

export type ResolverCallbackLegacy = (
  request: Request,
  callback: Callback
) => void;
export type ResolverCallback = (
  request: Request,
  resolveContext: LegacyResolveContext,
  callback: Callback
) => void;

type CreateInnerCallback = (
  callback: Callback,
  options: Callback,
  message?: string,
  messageOptional?: string
) => Callback;

type CreateInnerContext = (
  options: {
    log?: string;
    stack?: string;
    missing?: string;
  },
  message?: string,
  messageOptional?: string
) => ResolveContext;

type getInnerRequest = (
  resolver: Resolver | LegacyResolver,
  request: ResolveRequest | Request
) => string;

export interface Request {
  readonly request?: Request | string;
  readonly relativePath: string;
  readonly path: string;
  readonly context: {
    readonly issuer: string;
  };
}

export interface Callback {
  (err?: Error, result?: string): void;

  log?: string;
  stack?: string;
  missing?: string;
}

const getInnerRequest: getInnerRequest = require('enhanced-resolve/lib/getInnerRequest');

export class TsconfigPathsPlugin implements ResolvePluginInstance {
  source: string = 'described-resolve';
  target: string = 'resolve';

  log: Logger.Logger;
  baseUrl: string;
  absoluteBaseUrl: string;
  extensions: ReadonlyArray<string>;

  matchPath: TsconfigPaths.MatchPathAsync;

  constructor(rawOptions: Partial<Options.Options> = {}) {
    const options = Options.getOptions(rawOptions);

    this.extensions = options.extensions;

    // const colors = new chalk.constructor({ enabled: options.colors });

    this.log = Logger.makeLogger(
      options,
      new chalk.Instance({ level: options.colors ? undefined : 0 })
    );

    const context = options.context || process.cwd();
    const loadFrom = options.configFile || context;

    const loadResult = TsconfigPaths.loadConfig(loadFrom);
    if (loadResult.resultType === 'failed') {
      this.log.logError(`Failed to load ${loadFrom}: ${loadResult.message}`);
    } else {
      this.log.logInfo(
        `tsconfig-paths-webpack-plugin: Using config file at ${loadResult.configFileAbsolutePath}`
      );
      this.baseUrl = options.baseUrl || loadResult.baseUrl;
      this.absoluteBaseUrl = options.baseUrl
        ? path.resolve(options.baseUrl)
        : loadResult.absoluteBaseUrl;
      this.matchPath = TsconfigPaths.createMatchPathAsync(
        this.absoluteBaseUrl,
        loadResult.paths,
        options.mainFields
      );
    }
  }

  apply(resolver: Resolver): void {
    if (!resolver) {
      this.log.logWarning(
        'tsconfig-paths-webpack-plugin: Found no resolver, not applying tsconfig-paths-webpack-plugin'
      );
      return;
    }

    const { baseUrl } = this;

    if (!baseUrl) {
      // Nothing to do if there is no baseUrl
      this.log.logWarning(
        'tsconfig-paths-webpack-plugin: Found no baseUrl in tsconfig.json, not applying tsconfig-paths-webpack-plugin'
      );
      return;
    }

    // The file system only exists when the plugin is in the resolve context. This means it's also properly placed in the resolve.plugins array.
    // If not, we should warn the user that this plugin should be placed in resolve.plugins and not the plugins array of the root config for example.
    // This should hopefully prevent issues like: https://github.com/dividab/tsconfig-paths-webpack-plugin/issues/9
    if (!('fileSystem' in resolver)) {
      this.log.logWarning(
        'tsconfig-paths-webpack-plugin: No file system found on resolver.' +
          " Please make sure you've placed the plugin in the correct part of the configuration." +
          ' This plugin is a resolver plugin and should be placed in the resolve part of the Webpack configuration.'
      );
      return;
    }

    resolver.getHook(this.source).tapAsync(
      { name: 'TsconfigPathsPlugin' },
      // @ts-ignore
      createPluginCallback(
        this.matchPath,
        resolver,
        this.absoluteBaseUrl,
        // @ts-ignore
        resolver.getHook(this.target),
        this.extensions
      )
    );
  }
}

function createPluginCallback(
  matchPath: TsconfigPaths.MatchPathAsync,
  resolver: Resolver,
  absoluteBaseUrl: string,
  hook: Tapable,
  extensions: ReadonlyArray<string>
): TapAsyncCallback {
  const fileExistAsync = createFileExistAsync(resolver.fileSystem);
  const readJsonAsync = createReadJsonAsync(resolver.fileSystem);
  return (
    request: ResolveRequest,
    resolveContext: ResolveContext,
    callback: TapAsyncInnerCallback
  ) => {
    const innerRequest = getInnerRequest(resolver, request);

    // innerRequest never starts with '.' in new enhanced-resolve
    if (
      !innerRequest ||
      request?.request?.startsWith('.') ||
      request?.request?.startsWith('..')
    ) {
      return callback();
    }

    matchPath(
      innerRequest,
      readJsonAsync,
      fileExistAsync,
      extensions,
      (err, foundMatch) => {
        if (err) {
          return callback(err);
        }

        if (!foundMatch) {
          return callback();
        }

        const newRequest = {
          ...request,
          request: foundMatch,
          path: absoluteBaseUrl,
        };

        // Only at this point we are sure we are dealing with the latest Webpack version (>= 4.0.0)
        // So only now can we require the createInnerContext function.
        // (It doesn't exist in legacy versions)
        const createInnerContext: CreateInnerContext = require('enhanced-resolve/lib/createInnerContext');

        return resolver.doResolve(
          hook,
          newRequest as never,
          `Resolved request '${innerRequest}' to '${foundMatch}' using tsconfig.json paths mapping`,
          // tslint:disable-next-line:no-any
          createInnerContext({ ...(resolveContext as any) }),
          (err2: Error, result2: ResolveRequest): void => {
            // Pattern taken from:
            // https://github.com/webpack/enhanced-resolve/blob/42ff594140582c3f8f86811f95dea7bf6774a1c8/lib/AliasPlugin.js#L44
            if (err2) {
              return callback(err2);
            }

            // Don't allow other aliasing or raw request
            if (result2 === undefined) {
              return callback(undefined, undefined);
            }

            // tslint:disable-next-line:no-any
            callback(undefined, result2);
          }
        );
      }
    );
  };
}

function readJson(
  fileSystem: FileSystem,
  path2: string,
  callback: ReadJsonCallback
): void {
  if ('readJson' in fileSystem && fileSystem.readJson) {
    return fileSystem.readJson(path2, callback);
  }

  fileSystem.readFile(path2, (err, buf) => {
    if (err) {
      return callback(err);
    }

    let data;

    try {
      // @ts-ignore  This will crash if buf is undefined, which I guess it can be...
      data = JSON.parse(buf.toString('utf-8'));
    } catch (e) {
      return callback(e);
    }

    return callback(undefined, data);
  });
}

function createReadJsonAsync(
  filesystem: FileSystem
): TsconfigPaths.ReadJsonAsync {
  // tslint:disable-next-line:no-any
  return (path2: string, callback2: (err?: Error, content?: any) => void) => {
    readJson(filesystem, path2, (err, json) => {
      // If error assume file does not exist
      if (err || !json) {
        callback2();
        return;
      }
      callback2(undefined, json);
    });
  };
}

function createFileExistAsync(
  filesystem: FileSystem
): TsconfigPaths.FileExistsAsync {
  return (
    path2: string,
    callback2: (err?: Error, exists?: boolean) => void
  ) => {
    filesystem.stat(path2, (err: Error, stats: fs.Stats) => {
      // If error assume file does not exist
      if (err) {
        callback2(undefined, false);
        return;
      }
      callback2(undefined, stats ? stats.isFile() : false);
    });
  };
}

export default TsconfigPathsPlugin;
