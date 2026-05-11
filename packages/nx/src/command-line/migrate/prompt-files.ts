import { mkdirSync, readFileSync, writeFileSync } from 'fs';
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
  promptContents: Record<string, string>
): string[] {
  const writtenPaths = new Set<string>();
  const result: string[] = [];

  for (const migration of migrations) {
    if (!migration.prompt) continue;
    const content =
      promptContents[promptContentKey(migration.package, migration.prompt)];
    if (content === undefined) continue;

    const namespace = packageNameToWorkspaceNamespace(migration.package);
    const fileName = `${migration.version}-${posix.basename(migration.prompt)}`;
    const relPath = joinPathFragments(
      AI_MIGRATIONS_DIR,
      ...namespace,
      fileName
    );

    if (writtenPaths.has(relPath)) {
      throw new Error(
        `Conflicting AI migration prompt destination "${relPath}" for migration "${migration.name}" in package "${migration.package}". Two migrations target the same workspace path (same package + version + filename).`
      );
    }
    writtenPaths.add(relPath);

    const absPath = join(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content);

    migration.prompt = relPath;
    result.push(relPath);
  }

  return result;
}

function packageNameToWorkspaceNamespace(packageName: string): string[] {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.slice(1).split('/');
    return [scope, name];
  }
  return [packageName];
}
