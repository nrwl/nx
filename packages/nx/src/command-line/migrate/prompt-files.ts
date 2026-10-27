import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'fs';
import { dirname, join, posix, relative, sep } from 'path';
import {
  MigrationsJson,
  MigrationsJsonEntry,
} from '../../config/misc-interfaces';
import { extractFileFromTarball } from '../../utils/tar';
import {
  isContainedRelativePath,
  joinPathFragments,
  normalizePath,
} from '../../utils/path';

export const AI_MIGRATIONS_DIR = joinPathFragments('tools', 'ai-migrations');

export function promptContentKey(
  packageName: string,
  promptRelPath: string
): string {
  return `${packageName}::${promptRelPath}`;
}

function* iterateMigrationEntries(
  migrations: MigrationsJson
): Iterable<[string, MigrationsJsonEntry]> {
  const merged = { ...migrations.schematics, ...migrations.generators };
  yield* Object.entries(merged);
}

export function validateMigrationEntries(
  packageName: string,
  packageVersion: string,
  migrations: MigrationsJson
): void {
  for (const [migrationName, entry] of iterateMigrationEntries(migrations)) {
    if (!entry.implementation && !entry.factory && !entry.prompt) {
      throw new Error(
        `Invalid migration "${migrationName}" in package "${packageName}@${packageVersion}": migration entries must have at least one of "implementation", "factory", or "prompt".`
      );
    }
  }
}

async function resolvePromptFiles(
  packageName: string,
  packageVersion: string,
  migrations: MigrationsJson,
  resolveContent: (promptRelPath: string) => string | Promise<string>
): Promise<Record<string, string> | undefined> {
  const resolvedPromptFiles: Record<string, string> = {};
  for (const [migrationName, entry] of iterateMigrationEntries(migrations)) {
    if (!entry.prompt || resolvedPromptFiles[entry.prompt] !== undefined) {
      continue;
    }
    assertPromptPathWithinMigrationsDir(
      entry.prompt,
      packageName,
      packageVersion
    );
    if (!isMarkdownFile(entry.prompt)) {
      throw new Error(
        `Invalid prompt path "${entry.prompt}" in package "${packageName}@${packageVersion}": prompt files must be markdown (.md) files.`
      );
    }
    try {
      resolvedPromptFiles[entry.prompt] = await resolveContent(entry.prompt);
    } catch (e) {
      throw new Error(
        `Could not find prompt file "${entry.prompt}" for migration "${migrationName}" in package "${packageName}@${packageVersion}".`,
        { cause: e }
      );
    }
  }

  return Object.keys(resolvedPromptFiles).length > 0
    ? resolvedPromptFiles
    : undefined;
}

function assertPromptPathWithinMigrationsDir(
  promptRelPath: string,
  packageName: string,
  packageVersion: string
): void {
  if (!isContainedRelativePath(promptRelPath)) {
    throw new Error(
      `Invalid prompt path "${promptRelPath}" in package "${packageName}@${packageVersion}": prompt paths must be relative and resolve within the package's migrations directory.`
    );
  }
}

// Prompt files are copied into the workspace under their own name, so any
// other extension could land as workspace configuration (e.g. project.json).
function isMarkdownFile(promptPath: string): boolean {
  return posix.extname(promptPath).toLowerCase() === '.md';
}

/**
 * Thrown when the markdown prompt file referenced by a migration cannot be
 * resolved.
 */
export class PromptResolutionError extends Error {
  constructor(
    public readonly promptPath: string,
    public readonly migrationsDir: string,
    options?: { cause?: unknown }
  ) {
    super(
      `Could not resolve prompt "${promptPath}" from "${migrationsDir}".`,
      options
    );
    this.name = 'PromptResolutionError';
  }
}

/**
 * Resolves a migration prompt file path to an absolute path. Prompt paths are
 * plain markdown files referenced relative to the directory containing the
 * `migrations.json` - unlike schemas, they are not resolved through package
 * exports or `require.resolve`. The path must point at an existing markdown
 * (`.md`) file that stays within the migrations directory after resolving
 * links, outside any nested `node_modules`.
 */
export function resolvePrompt(
  promptPath: string,
  migrationsDir: string
): string {
  if (!isContainedRelativePath(promptPath) || !isMarkdownFile(promptPath)) {
    throw new PromptResolutionError(promptPath, migrationsDir);
  }
  const resolvedPath = join(migrationsDir, promptPath);
  if (!existsSync(resolvedPath)) {
    throw new PromptResolutionError(promptPath, migrationsDir);
  }
  const realRelativePath = relative(
    realpathSync(migrationsDir),
    realpathSync(resolvedPath)
  );
  if (
    !isContainedRelativePath(realRelativePath) ||
    realRelativePath
      .split(sep)
      .some((segment) => segment.toLowerCase() === 'node_modules')
  ) {
    throw new PromptResolutionError(promptPath, migrationsDir);
  }
  return resolvedPath;
}

export function extractPromptFilesFromTarball(
  packageName: string,
  packageVersion: string,
  migrations: MigrationsJson,
  migrationsFilePath: string,
  fullTarballPath: string,
  destDir: string
): Promise<Record<string, string> | undefined> {
  const migrationsDir = dirname(migrationsFilePath);
  return resolvePromptFiles(
    packageName,
    packageVersion,
    migrations,
    async (promptRelPath) => {
      const promptInTarball = joinPathFragments(
        'package',
        migrationsDir,
        promptRelPath
      );
      const promptDest = join(destDir, migrationsDir, promptRelPath);
      await extractFileFromTarball(
        fullTarballPath,
        promptInTarball,
        promptDest
      );
      return readFileSync(promptDest, 'utf-8');
    }
  );
}

export function readPromptFilesFromInstall(
  packageName: string,
  packageVersion: string,
  migrations: MigrationsJson,
  migrationsFilePath: string
): Promise<Record<string, string> | undefined> {
  const migrationsDir = dirname(migrationsFilePath);
  return resolvePromptFiles(
    packageName,
    packageVersion,
    migrations,
    (promptRelPath) =>
      readFileSync(resolvePrompt(promptRelPath, migrationsDir), 'utf-8')
  );
}

export function writePromptMigrationFiles(
  root: string,
  migrations: {
    package: string;
    name: string;
    version: string;
    prompt?: string;
  }[],
  promptContents: Record<string, string>,
  targetVersion: string
): string[] {
  const sourceToChosen = new Map<string, string>();
  const result: string[] = [];

  for (const migration of migrations) {
    if (!migration.prompt) continue;
    const sourceKey = promptContentKey(migration.package, migration.prompt);
    const content = promptContents[sourceKey];
    if (content === undefined) continue;

    const cached = sourceToChosen.get(sourceKey);
    if (cached !== undefined) {
      migration.prompt = cached;
      continue;
    }

    const baseName = posix.basename(
      posix.normalize(normalizePath(migration.prompt))
    );
    const ext = posix.extname(baseName);
    const stem = ext ? baseName.slice(0, -ext.length) : baseName;
    const destDir = joinPathFragments(
      AI_MIGRATIONS_DIR,
      migration.package,
      targetVersion
    );

    let chosenPath!: string;
    for (let n = 0; ; n++) {
      const candidate = joinPathFragments(
        destDir,
        n === 0 ? baseName : `${stem}-${n}${ext}`
      );
      const absCandidate = join(root, candidate);
      if (!existsSync(absCandidate)) {
        mkdirSync(dirname(absCandidate), { recursive: true });
        writeFileSync(absCandidate, content);
        result.push(candidate);
        chosenPath = candidate;
        break;
      }
      if (readFileSync(absCandidate, 'utf-8') === content) {
        chosenPath = candidate;
        break;
      }
    }

    sourceToChosen.set(sourceKey, chosenPath);
    migration.prompt = chosenPath;
  }

  return result;
}
