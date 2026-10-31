import { access, readFile, stat } from 'node:fs/promises';
import ts from 'typescript';

export type ParsedFile = {
  text: string;
  ast: ts.SourceFile;
};

const DEFAULT_MAX_PARSED_ENTRIES = 200;

export class FileCache {
  private readonly parsed = new Map<string, Promise<ParsedFile>>();
  private readonly existence = new Map<string, Promise<boolean>>();
  private readonly files = new Map<string, Promise<boolean>>();

  constructor(
    private readonly maxParsedEntries = DEFAULT_MAX_PARSED_ENTRIES
  ) {}

  getOrParse(filePath: string): Promise<ParsedFile> {
    const existing = this.parsed.get(filePath);
    if (existing) {
      this.touchParsedEntry(filePath, existing);
      return existing;
    }

    const promise = readFile(filePath, 'utf8').then((text) => {
      const ast = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFromPath(filePath)
      );
      return { text, ast };
    });
    this.touchParsedEntry(filePath, promise);
    this.evictParsedEntries();
    return promise;
  }

  exists(filePath: string): Promise<boolean> {
    const cached = this.existence.get(filePath);
    if (cached !== undefined) return cached;
    const promise = access(filePath).then(
      () => true,
      () => false
    );
    this.existence.set(filePath, promise);
    return promise;
  }

  isFile(filePath: string): Promise<boolean> {
    const cached = this.files.get(filePath);
    if (cached !== undefined) return cached;
    const promise = stat(filePath).then(
      (fileStat) => fileStat.isFile(),
      () => false
    );
    this.files.set(filePath, promise);
    return promise;
  }

  private touchParsedEntry(
    filePath: string,
    parsedFile: Promise<ParsedFile>
  ): void {
    this.parsed.delete(filePath);
    this.parsed.set(filePath, parsedFile);
  }

  private evictParsedEntries(): void {
    while (this.parsed.size > this.maxParsedEntries) {
      const oldestPath = this.parsed.keys().next().value;
      if (oldestPath === undefined) {
        break;
      }
      this.parsed.delete(oldestPath);
    }
  }
}

function scriptKindFromPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }
  if (filePath.endsWith('.mts')) {
    return ts.ScriptKind.TS;
  }
  if (filePath.endsWith('.cts')) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.TS;
}
