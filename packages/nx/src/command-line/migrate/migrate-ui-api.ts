import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { MigrationDetailsWithId } from '../../config/misc-interfaces';
import type { FileChange } from '../../generators/tree';
import {
  getImplementationPath as getMigrationImplementationPath,
  readMigrationCollection,
} from './migrate';

export type MigrationsJsonMetadata = {
  completedMigrations?: Record<
    string,
    SuccessfulMigration | FailedMigration | SkippedMigration
  >;
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
  ref: string;
  nextSteps?: string[];
};

export type FailedMigration = {
  type: 'failed';
  name: string;
  error: string;
};

export type SkippedMigration = {
  type: 'skipped';
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
  const initialGitRef = (
    parsedMigrationsJson['nx-console'] as MigrationsJsonMetadata
  ).initialGitRef;

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
    execSync(`git reset --soft ${initialGitRef.ref}`, {
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
  migration: MigrationDetailsWithId,
  configuration: {
    createCommits: boolean;
    commitPrefix?: string;
  }
) {
  try {
    modifyMigrationsJsonMetadata(
      workspacePath,
      addRunningMigration(migration.id)
    );

    const gitRefBefore = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    // For Migrate UI, this current module is loaded either from:
    // 1. The CLI path to the migrated modules. The version of Nx is of the user's choosing. This may or may not have the new migrate API, so Console will check that `runSingleMigration` exists before using it.
    // 2. Bundled into Console, so the version is fixed to what we build Console with.
    const updatedMigrateModule = await import('./migrate.js');

    const { changes: fileChanges, nextSteps } =
      await updatedMigrateModule.runNxOrAngularMigration(
        workspacePath,
        migration,
        false,
        configuration.createCommits,
        configuration.commitPrefix || 'chore: [nx migration] ',
        undefined,
        true
      );

    const gitRefAfter = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    modifyMigrationsJsonMetadata(
      workspacePath,
      addSuccessfulMigration(
        migration.id,
        fileChanges.map((change) => ({
          path: change.path,
          type: change.type,
        })),
        gitRefAfter,
        nextSteps
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
      // The revision changes after the amend, so we need to update it
      const amendedGitRef = execSync('git rev-parse HEAD', {
        cwd: workspacePath,
        encoding: 'utf-8',
      }).trim();

      modifyMigrationsJsonMetadata(
        workspacePath,
        updateRefForSuccessfulMigration(migration.id, amendedGitRef)
      );
    }
  } catch (e) {
    modifyMigrationsJsonMetadata(
      workspacePath,
      addFailedMigration(migration.id, e.message)
    );
  } finally {
    modifyMigrationsJsonMetadata(
      workspacePath,
      removeRunningMigration(migration.id)
    );

    execSync('git add migrations.json', {
      cwd: workspacePath,
      encoding: 'utf-8',
    });
  }
}

export async function getImplementationPath(
  workspacePath: string,
  migration: MigrationDetailsWithId
) {
  const { collection, collectionPath } = readMigrationCollection(
    migration.package,
    workspacePath
  );

  const { path } = getMigrationImplementationPath(
    collection,
    collectionPath,
    migration.name
  );

  return path;
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

export function addSuccessfulMigration(
  id: string,
  fileChanges: Omit<FileChange, 'content'>[],
  ref: string,
  nextSteps: string[]
) {
  return (
    migrationsJsonMetadata: MigrationsJsonMetadata
  ): MigrationsJsonMetadata => {
    const copied = { ...migrationsJsonMetadata };
    if (!copied.completedMigrations) {
      copied.completedMigrations = {};
    }
    copied.completedMigrations = {
      ...copied.completedMigrations,
      [id]: {
        type: 'successful',
        name: id,
        changedFiles: fileChanges,
        ref,
        nextSteps,
      },
    };
    return copied;
  };
}

export function updateRefForSuccessfulMigration(id: string, ref: string) {
  return (
    migrationsJsonMetadata: MigrationsJsonMetadata
  ): MigrationsJsonMetadata => {
    const copied = { ...migrationsJsonMetadata };
    if (!copied.completedMigrations) {
      copied.completedMigrations = {};
    }
    const existing = copied.completedMigrations[id];
    if (existing && existing.type === 'successful') {
      existing.ref = ref;
    } else {
      throw new Error(`Attempted to update ref for unsuccessful migration`);
    }
    return copied;
  };
}

export function addFailedMigration(id: string, error: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    const copied = { ...migrationsJsonMetadata };
    if (!copied.completedMigrations) {
      copied.completedMigrations = {};
    }
    copied.completedMigrations = {
      ...copied.completedMigrations,
      [id]: {
        type: 'failed',
        name: id,
        error,
      },
    };
    return copied;
  };
}

export function addSkippedMigration(id: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    const copied = { ...migrationsJsonMetadata };
    if (!copied.completedMigrations) {
      copied.completedMigrations = {};
    }
    copied.completedMigrations = {
      ...copied.completedMigrations,
      [id]: {
        type: 'skipped',
      },
    };
    return copied;
  };
}

function addRunningMigration(id: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    migrationsJsonMetadata.runningMigrations = [
      ...(migrationsJsonMetadata.runningMigrations ?? []),
      id,
    ];
    return migrationsJsonMetadata;
  };
}

function removeRunningMigration(id: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    migrationsJsonMetadata.runningMigrations =
      migrationsJsonMetadata.runningMigrations?.filter((n) => n !== id);
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

export function undoMigration(workspacePath: string, id: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    const existing = migrationsJsonMetadata.completedMigrations[id];
    if (existing.type !== 'successful')
      throw new Error(`undoMigration called on unsuccessful migration: ${id}`);
    execSync(`git reset --hard ${existing.ref}^`, {
      cwd: workspacePath,
      encoding: 'utf-8',
    });
    migrationsJsonMetadata.completedMigrations[id] = {
      type: 'skipped',
    };
    return migrationsJsonMetadata;
  };
}
