import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, posix, relative, sep } from 'path';
import {
  MigrationsJson,
  MigrationsJsonEntry,
} from '../../config/misc-interfaces';
import { extractFileFromTarball } from '../../utils/fileutils';
import { joinPathFragments } from '../../utils/path';

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
  migrationsDir: string,
  resolveContent: (promptRelPath: string) => string | Promise<string>
): Promise<Record<string, string> | undefined> {
  const resolvedPromptFiles: Record<string, string> = {};
  for (const [migrationName, entry] of iterateMigrationEntries(migrations)) {
    if (!entry.prompt || resolvedPromptFiles[entry.prompt] !== undefined) {
      continue;
    }
    assertPromptPathWithinMigrationsDir(
      migrationsDir,
      entry.prompt,
      packageName,
      packageVersion
    );
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
  migrationsDir: string,
  promptRelPath: string,
  packageName: string,
  packageVersion: string
): void {
  const rel = relative(migrationsDir, join(migrationsDir, promptRelPath));
  if (
    isAbsolute(promptRelPath) ||
    rel === '..' ||
    rel.startsWith(`..${sep}`) ||
    rel.startsWith(`..${posix.sep}`)
  ) {
    throw new Error(
      `Invalid prompt path "${promptRelPath}" in package "${packageName}@${packageVersion}": prompt paths must be relative and resolve within the package's migrations directory.`
    );
  }
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
    migrationsDir,
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
    migrationsDir,
    (promptRelPath) => readFileSync(join(migrationsDir, promptRelPath), 'utf-8')
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

    const baseName = posix.basename(migration.prompt);
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
