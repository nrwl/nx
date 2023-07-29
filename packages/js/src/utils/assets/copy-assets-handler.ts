import * as minimatch from 'minimatch';
import * as path from 'path';
import * as fse from 'fs-extra';
import ignore from 'ignore';
import * as fg from 'fast-glob';
import { AssetGlob } from './assets';
import { logger } from '@nx/devkit';
import { ChangedFile, daemonClient } from 'nx/src/daemon/client/client';

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
}

interface AssetEntry {
  isGlob: boolean;
  pattern: string;
  ignore: string[] | null;
  input: string;
  output: string;
}

export const defaultFileEventHandler = (events: FileEvent[]) => {
  const dirs = new Set(events.map((event) => path.dirname(event.dest)));
  dirs.forEach((d) => fse.ensureDirSync(d));
  events.forEach((event) => {
    if (event.type === 'create' || event.type === 'update') {
      if (fse.lstatSync(event.src).isFile()) {
        fse.copyFileSync(event.src, event.dest);
      }
    } else if (event.type === 'delete') {
      fse.removeSync(event.dest);
    } else {
      logger.error(`Unknown file event: ${event.type}`);
    }
  });
};

export class CopyAssetsHandler {
  private readonly projectDir: string;
  private readonly rootDir: string;
  private readonly outputDir: string;
  private readonly assetGlobs: AssetEntry[];
  private readonly ignore: ReturnType<typeof ignore>;
  private readonly callback: (events: FileEvent[]) => void;

  constructor(opts: CopyAssetHandlerOptions) {
    this.rootDir = opts.rootDir;
    this.projectDir = opts.projectDir;
    this.outputDir = opts.outputDir;
    this.callback = opts.callback ?? defaultFileEventHandler;

    // TODO(jack): Should handle nested .gitignore files
    this.ignore = ignore();
    const gitignore = path.join(opts.rootDir, '.gitignore');
    const nxignore = path.join(opts.rootDir, '.nxignore');
    if (fse.existsSync(gitignore))
      this.ignore.add(fse.readFileSync(gitignore).toString());
    if (fse.existsSync(nxignore))
      this.ignore.add(fse.readFileSync(nxignore).toString());

    this.assetGlobs = opts.assets.map((f) => {
      let isGlob = false;
      let pattern: string;
      // Input and output directories are normalized to be relative to root
      let input: string;
      let output: string;
      let ignore: string[] | null = null;
      if (typeof f === 'string') {
        pattern = f;
        input = path.relative(opts.rootDir, opts.projectDir);
        output = path.relative(opts.rootDir, opts.outputDir);
      } else {
        isGlob = true;
        pattern = path.join(f.input, f.glob);
        input = f.input;
        output = path.join(
          path.relative(opts.rootDir, opts.outputDir),
          f.output
        );
        if (f.ignore) ignore = f.ignore.map((ig) => path.join(f.input, ig));
      }
      return {
        isGlob,
        input,
        pattern,
        ignore,
        output,
      };
    });
  }

  async processAllAssetsOnce(): Promise<void> {
    await Promise.all(
      this.assetGlobs.map(async (ag) => {
        const pattern = this.normalizeAssetPattern(ag);

        // fast-glob only supports Unix paths
        const files = await fg(pattern.replace(/\\/g, '/'), {
          cwd: this.rootDir,
          dot: true, // enable hidden files
        });

        this.callback(this.filesToEvent(files, ag));
      })
    );
  }

  processAllAssetsOnceSync(): void {
    this.assetGlobs.forEach((ag) => {
      const pattern = this.normalizeAssetPattern(ag);

      // fast-glob only supports Unix paths
      const files = fg.sync(pattern.replace(/\\/g, '/'), {
        cwd: this.rootDir,
        dot: true, // enable hidden files
      });

      this.callback(this.filesToEvent(files, ag));
    });
  }

  async watchAndProcessOnAssetChange(): Promise<() => void> {
    const unregisterFileWatcher = await daemonClient.registerFileWatcher(
      {
        watchProjects: 'all',
        includeGlobalWorkspaceFiles: true,
      },
      (err, data) => {
        if (err === 'closed') {
          logger.error(`Watch error: Daemon closed the connection`);
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
    const fileEvents: FileEvent[] = [];
    for (const event of events) {
      const pathFromRoot = path.relative(this.rootDir, event.path);
      for (const ag of this.assetGlobs) {
        if (
          minimatch(pathFromRoot, ag.pattern) &&
          !ag.ignore?.some((ig) => minimatch(pathFromRoot, ig)) &&
          !this.ignore.ignores(pathFromRoot)
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
        !assetGlob.ignore?.some((ig) => minimatch(src, ig)) &&
        !this.ignore.ignores(src)
      ) {
        const relPath = path.relative(assetGlob.input, src);
        const dest = relPath.startsWith('..') ? src : relPath;
        acc.push({
          type: 'create',
          src: path.join(this.rootDir, src),
          dest: path.join(this.rootDir, assetGlob.output, dest),
        });
      }
      return acc;
    }, []);
  }

  private normalizeAssetPattern(assetEntry: AssetEntry): string {
    return typeof assetEntry === 'string' ? assetEntry : assetEntry.pattern;
  }
}
