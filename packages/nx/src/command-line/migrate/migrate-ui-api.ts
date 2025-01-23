import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { FileChange } from '../../generators/tree';
import { join, resolve } from 'path';
import { GeneratedMigrationDetails } from '../../config/misc-interfaces';
import { nxCliPath } from './migrate';
import { execSync } from 'child_process';

export type MigrationsJsonMetadata = {
  completedMigrations?: Record<string, SuccessfulMigration | FailedMigration>;
  runningMigrations?: string[];
  initialGitRef?: {
    ref: string;
    subject: string;
  };
  confirmedPackageUpdates?: boolean;
  targetVersion?: string;
};

export type SuccessfulMigration = {
  type: 'successful';
  name: string;
  changedFiles: Omit<FileChange, 'content'>[];
};

export type FailedMigration = {
  type: 'failed';
  name: string;
  error: string;
};

export function recordInitialMigrationMetadata(
  workspacePath: string,
  versionToMigrateTo: string
) {
  const migrationsJsonPath = join(workspacePath, 'migrations.json');
  const parsedMigrationsJson = JSON.parse(
    readFileSync(migrationsJsonPath, 'utf-8')
  );

  const gitRef = execSync('git rev-parse HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
  }).trim();

  const gitSubject = execSync('git log -1 --pretty=%s', {
    cwd: workspacePath,
    encoding: 'utf-8',
  }).trim();

  parsedMigrationsJson['nx-console'] = {
    initialGitRef: {
      ref: gitRef,
      subject: gitSubject,
    },
    targetVersion: versionToMigrateTo,
  };

  writeFileSync(
    migrationsJsonPath,
    JSON.stringify(parsedMigrationsJson, null, 2)
  );
}

export function finishMigrationProcess(
  workspacePath: string,
  squashCommits: boolean,
  commitMessage: string
) {
  const migrationsJsonPath = join(workspacePath, 'migrations.json');
  const parsedMigrationsJson = JSON.parse(
    readFileSync(migrationsJsonPath, 'utf-8')
  );
  const initialGitRef = parsedMigrationsJson['nx-console'].initialGitRef;

  if (existsSync(migrationsJsonPath)) {
    rmSync(migrationsJsonPath);
  }
  execSync('git add .', {
    cwd: workspacePath,
    encoding: 'utf-8',
  });

  execSync(`git commit -m "${commitMessage}" --no-verify`, {
    cwd: workspacePath,
    encoding: 'utf-8',
  });

  if (squashCommits && initialGitRef) {
    execSync(`git reset --soft ${initialGitRef}`, {
      cwd: workspacePath,
      encoding: 'utf-8',
    });

    execSync(`git commit -m "${commitMessage}" --no-verify`, {
      cwd: workspacePath,
      encoding: 'utf-8',
    });
  }
}

export async function runSingleMigration(
  workspacePath: string,
  migration: GeneratedMigrationDetails,
  configuration: {
    createCommits: boolean;
  }
) {
  try {
    modifyMigrationsJsonMetadata(
      workspacePath,
      addRunningMigration(migration.name)
    );

    const gitRefBefore = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    const cliPath = nxCliPath(workspacePath);
    const updatedMigrateLocation = resolve(
      cliPath,
      '..',
      '..',
      'nx',
      'src',
      'command-line',
      'migrate',
      'migrate.js'
    );

    const updatedMigrateModule: typeof import('./migrate') = await import(
      updatedMigrateLocation
    );

    const fileChanges = await updatedMigrateModule.runNxOrAngularMigration(
      workspacePath,
      migration,
      false,
      configuration.createCommits,
      'chore: [nx migration] '
    );

    const gitRefAfter = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    modifyMigrationsJsonMetadata(
      workspacePath,
      addSuccessfulMigration(
        migration.name,
        fileChanges.map((change) => ({
          path: change.path,
          type: change.type,
        }))
      )
    );

    if (gitRefBefore !== gitRefAfter) {
      execSync('git add migrations.json', {
        cwd: workspacePath,
        encoding: 'utf-8',
      });
      execSync('git commit --amend --no-verify --no-edit', {
        cwd: workspacePath,
        encoding: 'utf-8',
      });
    }
  } catch (e) {
    modifyMigrationsJsonMetadata(
      workspacePath,
      addFailedMigration(migration.name, e.message)
    );
  } finally {
    modifyMigrationsJsonMetadata(
      workspacePath,
      removeRunningMigration(migration.name)
    );
  }
}

export function modifyMigrationsJsonMetadata(
  workspacePath: string,
  modify: (
    migrationsJsonMetadata: MigrationsJsonMetadata
  ) => MigrationsJsonMetadata
) {
  const migrationsJsonPath = join(workspacePath, 'migrations.json');
  const migrationsJson = JSON.parse(readFileSync(migrationsJsonPath, 'utf-8'));
  migrationsJson['nx-console'] = modify(migrationsJson['nx-console']);
  writeFileSync(migrationsJsonPath, JSON.stringify(migrationsJson, null, 2));
}

function addSuccessfulMigration(
  name: string,
  fileChanges: Omit<FileChange, 'content'>[]
) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    if (!migrationsJsonMetadata.completedMigrations) {
      migrationsJsonMetadata.completedMigrations = {};
    }
    migrationsJsonMetadata.completedMigrations[name] = {
      type: 'successful',
      name,
      changedFiles: fileChanges,
    };
    return migrationsJsonMetadata;
  };
}

function addFailedMigration(name: string, error: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    if (!migrationsJsonMetadata.completedMigrations) {
      migrationsJsonMetadata.completedMigrations = {};
    }
    migrationsJsonMetadata.completedMigrations[name] = {
      type: 'failed',
      name,
      error,
    };
    return migrationsJsonMetadata;
  };
}

function addRunningMigration(name: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    migrationsJsonMetadata.runningMigrations = [
      ...(migrationsJsonMetadata.runningMigrations ?? []),
      name,
    ];
    return migrationsJsonMetadata;
  };
}

function removeRunningMigration(name: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    migrationsJsonMetadata.runningMigrations =
      migrationsJsonMetadata.runningMigrations?.filter((n) => n !== name);
    if (migrationsJsonMetadata.runningMigrations?.length === 0) {
      delete migrationsJsonMetadata.runningMigrations;
    }
    return migrationsJsonMetadata;
  };
}

export function readMigrationsJsonMetadata(
  workspacePath: string
): MigrationsJsonMetadata {
  const migrationsJsonPath = join(workspacePath, 'migrations.json');
  const migrationsJson = JSON.parse(readFileSync(migrationsJsonPath, 'utf-8'));
  return migrationsJson['nx-console'];
}
