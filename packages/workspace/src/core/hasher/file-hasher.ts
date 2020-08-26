import { getFileHashes } from './git-hasher';
import { readFileSync } from 'fs';
import { defaultHashing, HashingImp } from './hashing-impl';
import { appRootPath } from '../../utils/app-root';
import { performance } from 'perf_hooks';

type PathAndTransformer = {
  path: string;
  transformer: (x: string) => string | null;
};

export function extractNameAndVersion(content: string): string {
  try {
    const c = JSON.parse(content);
    return `${c.name}${c.version}`;
  } catch (e) {
    return '';
  }
}

export class FileHasher {
  fileHashes: { [path: string]: string } = {};
  workspaceFiles = [];
  usesGitForHashing = false;

  constructor(private readonly hashing: HashingImp) {
    this.init();
  }

  init() {
    performance.mark('init hashing:start');
    this.fileHashes = {};
    this.workspaceFiles = [];
    this.getHashesFromGit();
    this.usesGitForHashing = Object.keys(this.fileHashes).length > 0;
    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );
  }

  hashFile(path: string, transformer: (x: string) => string | null = null) {
    const relativePath = path.startsWith(appRootPath)
      ? path.substr(appRootPath.length + 1)
      : path;
    if (!this.fileHashes[relativePath]) {
      this.fileHashes[relativePath] = this.processPath({ path, transformer });
    }
    return this.fileHashes[relativePath];
  }

  private getHashesFromGit() {
    const sliceIndex = appRootPath.length + 1;
    getFileHashes(appRootPath).forEach((hash, filename) => {
      this.fileHashes[filename.substr(sliceIndex)] = hash;
      /**
       * we have to store it separately because fileHashes can be modified
       * later on and can contain files that do not exist in the workspace
       */
      this.workspaceFiles.push(filename.substr(sliceIndex));
    });
  }

  private processPath(pathAndTransformer: PathAndTransformer): string {
    try {
      if (pathAndTransformer.transformer) {
        const transformedFile = pathAndTransformer.transformer(
          readFileSync(pathAndTransformer.path).toString()
        );
        return this.hashing.hashArray([transformedFile]);
      } else {
        return this.hashing.hashFile(pathAndTransformer.path);
      }
    } catch (e) {
      return '';
    }
  }
}

export const defaultFileHasher = new FileHasher(defaultHashing);
