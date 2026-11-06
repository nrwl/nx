import { lstatSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hashFile } from '../native';
import type { FileData } from '../native';

/** Serializable evidence finalized on the executing filesystem, never on main's copy. */
export interface RehashSourceObservation {
  observedDirectories: string[];
  invalidFiles: string[];
  invalidDirectories: string[];
  unobserved: string[];
}

/**
 * ctime detects writes through aliases, restored bytes and link/rename changes.
 * A two-second exclusion window prevents same/coarse-tick mutations from
 * matching a capture made in that tick. Windows ctime is creation time, so
 * that platform cannot produce this evidence. We never trust mtime alone.
 */
export class RehashSourceState {
  private files = new Map<string, string | null>();
  private directories = new Map<string, string | null>();
  private unobserved: string[] = [];

  constructor(
    private readonly root: string,
    files: FileData[]
  ) {
    const cutoff = BigInt(Date.now() - 2100) * 1_000_000n;
    const known = new Set(files.map((f) => f.file));
    for (const { file, hash } of files) {
      const before = this.stamp(file, cutoff);
      this.files.set(
        file,
        before &&
          hashFile(join(root, file)) === hash &&
          this.stamp(file, cutoff) === before
          ? before
          : null
      );
      let dir = dirname(file);
      while (true) {
        const key = dir === '.' ? '' : dir;
        this.directories.set(key, null);
        if (!key) break;
        dir = dirname(dir);
      }
    }
    for (const dir of this.directories.keys()) {
      const before = this.stamp(dir, cutoff);
      try {
        const children = readdirSync(join(root, dir)).sort();
        this.directories.set(
          dir,
          before && this.stamp(dir, cutoff) === before
            ? JSON.stringify([before, children])
            : null
        );
        for (const child of children) {
          const path = dir ? `${dir}/${child}` : child;
          if (!known.has(path) && !this.directories.has(path))
            this.unobserved.push(path);
        }
      } catch {
        this.directories.set(dir, null);
      }
    }
  }

  private stamp(path: string, cutoff?: bigint): string | null {
    try {
      if (process.platform === 'win32') return null;
      const s = lstatSync(join(this.root, path), { bigint: true });
      if (
        s.isSymbolicLink() ||
        s.ctimeNs <= 0n ||
        s.ctimeNs % 1_000_000_000n === 0n ||
        (cutoff !== undefined && s.ctimeNs >= cutoff)
      )
        return null;
      return [s.dev, s.ino, s.mode, s.nlink, s.size, s.mtimeNs, s.ctimeNs].join(
        ':'
      );
    } catch {
      return null;
    }
  }

  export(): RehashSourceObservation {
    const invalidFiles: string[] = [];
    const invalidDirectories: string[] = [];
    for (const [file, before] of this.files) {
      if (!before || this.stamp(file) !== before) invalidFiles.push(file);
    }
    for (const [dir, before] of this.directories) {
      try {
        if (
          !before ||
          JSON.stringify([
            this.stamp(dir),
            readdirSync(join(this.root, dir)).sort(),
          ]) !== before
        )
          invalidDirectories.push(dir);
      } catch {
        invalidDirectories.push(dir);
      }
    }
    return {
      observedDirectories: [...this.directories.keys()],
      invalidFiles,
      invalidDirectories,
      unobserved: [...this.unobserved],
    };
  }
}
