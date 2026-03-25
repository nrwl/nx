import picomatch = require('picomatch');
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import * as pathPosix from 'node:path/posix';
import * as path from 'node:path';
import ignore from 'ignore';
import { globSync } from 'tinyglobby';
import { AssetGlob } from './assets';
import { logger, workspaceRoot } from '@nx/devkit';
import { ChangedFile, daemonClient } from 'nx/src/daemon/client/client';
import { dim } from 'picocolors';

export type FileEventType = 'create' | 'update' | 'delete';

export interface FileEvent {
  type: FileEventType;
  src: string;
  dest: string;
}

interface CopyAssetHandlerOptions {
  projectDir: string;
  rootDir: string;
  outputDir: string;
  assets: (string | AssetGlob)[];
  callback?: (events: FileEvent[]) => void;
  includeIgnoredFiles?: boolean;
}

export interface AssetEntry {
  isGlob: boolean;
  pattern: string;
  ignore: string[] | null;
  input: string;
  output: string;
  includeIgnoredFiles?: boolean;
}

export const defaultFileEventHandler = (events: FileEvent[]) => {
  const dirs = new Set(events.map((event) => path.dirname(event.dest)));
  dirs.forEach((d) => mkdirSync(d, { recursive: true }));
  events.forEach((event) => {
    if (event.type === 'create' || event.type === 'update') {
      if (lstatSync(event.src).isFile()) {
        copyFileSync(event.src, event.dest);
      }
    } else if (event.type === 'delete') {
      rmSync(event.dest, { recursive: true, force: true });
    } else {
      logger.error(`Unknown file event: ${event.type}`);
    }
    const eventDir = path.dirname(event.src);
    const relativeDest = path.relative(eventDir, event.dest);
    logger.verbose(`\n${dim(relativeDest)}`);
  });
};

/**
 * Normalize raw asset definitions (strings or objects) into resolved
 * AssetEntry objects with computed input, output, and pattern fields.
 */
export function normalizeAssets(
  assets: (string | AssetGlob)[],
  rootDir: string,
  projectDir: string,
  outputDir: string
): AssetEntry[] {
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(rootDir, outputDir);

  return assets.map((f) => {
    if (typeof f === 'string') {
      return {
        isGlob: false,
        pattern: f,
        input: path.relative(rootDir, projectDir),
        output: path.relative(rootDir, resolvedOutputDir),
        ignore: null,
        includeIgnoredFiles: undefined,
      };
    }
    return {
      isGlob: true,
      pattern: pathPosix.join(f.input, f.glob),
      input: f.input,
      output: pathPosix.join(
        path.relative(rootDir, resolvedOutputDir),
        f.output
      ),
      ignore: f.ignore
        ? f.ignore.map((ig) => pathPosix.join(f.input, ig))
        : null,
      includeIgnoredFiles: f.includeIgnoredFiles,
    };
  });
}

/**
 * Compute the output path for a file given its asset entry,
 * matching the dest logic used during file copying.
 */
export function getAssetOutputPath(
  src: string,
  assetEntry: AssetEntry
): string {
  const relPath = path.relative(assetEntry.input, src);
  const dest = relPath.startsWith('..') ? src : relPath;
  return pathPosix.join(assetEntry.output, dest);
}

export class CopyAssetsHandler {
  private readonly projectDir: string;
  private readonly rootDir: string;
  private readonly outputDir: string;
  private readonly assetGlobs: AssetEntry[];
  private readonly ignore: ReturnType<typeof ignore>;
  private readonly callback: (events: FileEvent[]) => void;
  private readonly includeIgnoredFiles: boolean;

  constructor(opts: CopyAssetHandlerOptions) {
    this.rootDir = opts.rootDir;
    this.projectDir = opts.projectDir;
    this.outputDir = opts.outputDir;
    this.callback = opts.callback ?? defaultFileEventHandler;
    this.includeIgnoredFiles = opts.includeIgnoredFiles ?? false;

    // TODO(jack): Should handle nested .gitignore files
    this.ignore = ignore();
    const gitignore = pathPosix.join(opts.rootDir, '.gitignore');
    const nxignore = pathPosix.join(opts.rootDir, '.nxignore');

    if (existsSync(gitignore)) {
      this.ignore.add(readFileSync(gitignore).toString());
    }
    if (existsSync(nxignore)) {
      this.ignore.add(readFileSync(nxignore).toString());
    }

    this.assetGlobs = normalizeAssets(
      opts.assets,
      opts.rootDir,
      opts.projectDir,
      opts.outputDir
    );
  }

  async processAllAssetsOnce(): Promise<void> {
    await Promise.all(
      this.assetGlobs.map(async (ag) => {
        const pattern = this.normalizeAssetPattern(ag);

        // globbing only supports Unix paths
        const files = await globSync(pattern.replace(/\\/g, '/'), {
          cwd: this.rootDir,
          dot: true, // enable hidden files
          expandDirectories: false,
          // Only ignore node_modules when the pattern doesn't explicitly reference it.
          // This allows copying generated files from node_modules (e.g., Prisma client)
          // while avoiding performance issues from scanning all node_modules for other patterns.
          ignore: this.getIgnorePatternsForAsset(ag),
        });

        this.callback(this.filesToEvent(files, ag));
      })
    );
  }

  processAllAssetsOnceSync(): void {
    this.assetGlobs.forEach((ag) => {
      const pattern = this.normalizeAssetPattern(ag);

      // globbing only supports Unix paths
      const files = globSync(pattern.replace(/\\/g, '/'), {
        cwd: this.rootDir,
        dot: true, // enable hidden files
        expandDirectories: false,
        ignore: this.getIgnorePatternsForAsset(ag),
      });

      this.callback(this.filesToEvent(files, ag));
    });
  }

  private getIgnorePatternsForAsset(ag: AssetEntry): string[] {
    // If the asset input path starts with 'node_modules', allow traversing node_modules
    // for that specific pattern. This enables copying generated files like Prisma client.
    const inputStartsWithNodeModules =
      ag.input.startsWith('node_modules/') || ag.input === 'node_modules';

    if (inputStartsWithNodeModules) {
      return ['**/.git/**'];
    }

    return ['**/node_modules/**', '**/.git/**'];
  }

  async watchAndProcessOnAssetChange(): Promise<() => void> {
    const unregisterFileWatcher = await daemonClient.registerFileWatcher(
      {
        watchProjects: 'all',
        includeGlobalWorkspaceFiles: true,
      },
      (err, data) => {
        if (err === 'reconnecting') {
          // Silent - daemon restarts automatically on lockfile changes
          return;
        } else if (err === 'reconnected') {
          // Silent - reconnection succeeded
          return;
        } else if (err === 'closed') {
          logger.error(`Failed to reconnect to daemon after multiple attempts`);
          process.exit(1);
        } else if (err) {
          logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
        } else {
          this.processWatchEvents(data.changedFiles);
        }
      }
    );

    return () => unregisterFileWatcher();
  }

  async processWatchEvents(events: ChangedFile[]): Promise<void> {
    if (events.length === 0) return;

    const fileEvents: FileEvent[] = [];

    for (const event of events) {
      const pathFromRoot = event.path.startsWith(this.rootDir)
        ? path.relative(this.rootDir, event.path)
        : event.path;

      for (const ag of this.assetGlobs) {
        if (
          picomatch(ag.pattern)(pathFromRoot) &&
          !ag.ignore?.some((ig) => picomatch(ig)(pathFromRoot)) &&
          ((ag.includeIgnoredFiles ?? this.includeIgnoredFiles) ||
            !this.ignore.ignores(pathFromRoot))
        ) {
          const relPath = path.relative(ag.input, pathFromRoot);
          const destPath = relPath.startsWith('..') ? pathFromRoot : relPath;
          fileEvents.push({
            type: event.type,
            src: path.join(this.rootDir, pathFromRoot),
            dest: path.join(this.rootDir, ag.output, destPath),
          });
          // Match first entry and skip the rest for this file.
          break;
        }
      }
    }

    if (fileEvents.length > 0) this.callback(fileEvents);
  }

  private filesToEvent(files: string[], assetGlob: AssetEntry): FileEvent[] {
    return files.reduce((acc, src) => {
      if (
        !assetGlob.ignore?.some((ig) => picomatch(ig)(src)) &&
        ((assetGlob.includeIgnoredFiles ?? this.includeIgnoredFiles) ||
          !this.ignore.ignores(src))
      ) {
        acc.push({
          type: 'create',
          src: path.join(this.rootDir, src),
          dest: path.join(this.rootDir, getAssetOutputPath(src, assetGlob)),
        });
      }
      return acc;
    }, []);
  }

  private normalizeAssetPattern(assetEntry: AssetEntry): string {
    return typeof assetEntry === 'string' ? assetEntry : assetEntry.pattern;
  }
}
