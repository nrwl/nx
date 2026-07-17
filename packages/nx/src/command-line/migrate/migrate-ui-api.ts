import { execSync, execFileSync, spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { MigrationDetailsWithId } from '../../config/misc-interfaces';
import type { FileChange } from '../../generators/tree';
import {
  getImplementationPath as getMigrationImplementationPath,
  isHybridMigration,
  isPromptOnlyMigration,
  readMigrationCollection,
} from './migrate';

export { isPromptOnlyMigration, isHybridMigration };

let currentMigrationProcess: ChildProcess | null = null;
let currentMigrationId: string | null = null;
let migrationCancelled = false;

export type MigrationsJsonMetadata = {
  completedMigrations?: Record<
    string,
    SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration
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
  // True after the user clicks Mark as Completed on a hybrid migration whose
  // generator already succeeded — confirms the AI prompt phase is done. Stays
  // undefined for non-prompt migrations and for prompt-only (which use the
  // existing successful state directly: no separate pre-ack phase).
  acknowledgedPrompt?: boolean;
};

export type FailedMigration = {
  type: 'failed';
  name: string;
  error: string;
};

export type SkippedMigration = {
  type: 'skipped';
};

export type StoppedMigration = {
  type: 'stopped';
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
    windowsHide: true,
  }).trim();

  const gitSubject = execSync('git log -1 --pretty=%s', {
    cwd: workspacePath,
    encoding: 'utf-8',
    windowsHide: true,
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
    windowsHide: true,
  });

  // Pass args as an array (no shell) so commit messages and refs read from
  // migrations.json can't break out into shell command injection.
  execFileSync('git', ['commit', '-m', commitMessage, '--no-verify'], {
    cwd: workspacePath,
    encoding: 'utf-8',
    windowsHide: true,
  });

  if (squashCommits && initialGitRef) {
    execFileSync('git', ['reset', '--soft', initialGitRef.ref], {
      cwd: workspacePath,
      encoding: 'utf-8',
      windowsHide: true,
    });

    execFileSync('git', ['commit', '-m', commitMessage, '--no-verify'], {
      cwd: workspacePath,
      encoding: 'utf-8',
      windowsHide: true,
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
    // Set current migration tracking
    currentMigrationId = migration.id;
    migrationCancelled = false;

    modifyMigrationsJsonMetadata(
      workspacePath,
      addRunningMigration(migration.id)
    );

    // Prompt-only migrations have no deterministic implementation to spawn.
    // The state-machine's auto-run hits this branch; the manual Mark-as-
    // Completed path calls `recordPromptOnlySuccess` directly so it stays out
    // of the process-tracking lifecycle.
    if (isPromptOnlyMigration(migration)) {
      recordPromptOnlySuccess(workspacePath, migration);
      return;
    }

    const gitRefBefore = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      windowsHide: true,
    }).trim();

    // Run migration in a separate process so it can be cancelled
    const runMigrationProcessPath = require.resolve(
      './run-migration-process.js'
    );

    const migrationProcess = spawn(
      'node',
      [
        runMigrationProcessPath,
        workspacePath,
        migration.id,
        migration.package,
        migration.name,
        migration.version,
        configuration.createCommits.toString(),
        configuration.commitPrefix || 'chore: [nx migration] ',
      ],
      {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }
    );

    // Track the process for cancellation
    currentMigrationProcess = migrationProcess;

    // Handle process output
    let output = '';
    migrationProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    migrationProcess.stderr.on('data', (data) => {
      console.error('Migration stderr:', data.toString());
    });

    // Wait for the process to complete
    const exitCode = await new Promise<number>((resolve, reject) => {
      migrationProcess.on('close', (code) => {
        resolve(code);
      });

      migrationProcess.on('error', (error) => {
        reject(error);
      });
    });

    currentMigrationProcess = null;

    if (exitCode !== 0) {
      throw new Error(`Migration process exited with code ${exitCode}`);
    }

    // Parse the result from the migration process (extract the JSON output)
    const jsonStr = output
      .trim()
      .split('\n')
      .find((line) => line.startsWith('{'));
    const result = JSON.parse(jsonStr);
    if (result.type === 'error') {
      throw new Error(result.message);
    }

    const { fileChanges, gitRefAfter, nextSteps } = result;

    modifyMigrationsJsonMetadata(
      workspacePath,
      addSuccessfulMigration(
        migration.id,
        fileChanges.map((change: FileChange) => ({
          path: change.path,
          type: change.type,
        })),
        gitRefAfter,
        nextSteps
      )
    );

    if (gitRefBefore !== gitRefAfter) {
      try {
        execSync('git add migrations.json', {
          cwd: workspacePath,
          encoding: 'utf-8',
          windowsHide: true,
        });
      } catch (e) {
        // do nothing, this will fail if it's gitignored
      }
      execSync('git commit --amend --no-verify --no-edit', {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
      });
      // The revision changes after the amend, so we need to update it
      const amendedGitRef = execSync('git rev-parse HEAD', {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
      }).trim();

      modifyMigrationsJsonMetadata(
        workspacePath,
        updateRefForSuccessfulMigration(migration.id, amendedGitRef)
      );
    }
  } catch (e) {
    // Check if migration was cancelled/stopped
    if (migrationCancelled && currentMigrationId === migration.id) {
      // Migration was stopped by user, don't add as failed since it's already marked as stopped
      console.log(`Migration ${migration.id} was stopped by user`);
    } else {
      // Migration failed normally
      modifyMigrationsJsonMetadata(
        workspacePath,
        addFailedMigration(migration.id, e.message)
      );
    }
  } finally {
    // Clear the tracking variables
    currentMigrationProcess = null;
    currentMigrationId = null;
    migrationCancelled = false;

    modifyMigrationsJsonMetadata(
      workspacePath,
      removeRunningMigration(migration.id)
    );

    try {
      execSync('git add migrations.json', {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
      });
    } catch (e) {
      // do nothing, this will fail if it's gitignored
    }
  }
}

export async function getImplementationPath(
  workspacePath: string,
  migration: MigrationDetailsWithId
) {
  // Prompt-only migrations have no implementation — the "source" the user
  // wants to see is the prompt file itself. Resolving via the regular
  // implementation lookup would throw because both `implementation` and
  // `factory` are unset.
  if (isPromptOnlyMigration(migration)) {
    return join(workspacePath, migration.prompt!);
  }

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
    // Carry forward a previously-set acknowledgedPrompt so any caller that
    // re-records a successful entry for the same id (no current trigger; this
    // is defensive against future paths) cannot silently drop the user's ack.
    const existing = copied.completedMigrations[id];
    const acknowledgedPrompt =
      existing?.type === 'successful' && existing.acknowledgedPrompt;
    copied.completedMigrations = {
      ...copied.completedMigrations,
      [id]: {
        type: 'successful',
        name: id,
        changedFiles: fileChanges,
        ref,
        nextSteps,
        ...(acknowledgedPrompt && { acknowledgedPrompt: true }),
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

export function addStoppedMigration(id: string, error: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    const copied = { ...migrationsJsonMetadata };
    if (!copied.completedMigrations) {
      copied.completedMigrations = {};
    }
    copied.completedMigrations = {
      ...copied.completedMigrations,
      [id]: {
        type: 'stopped',
        name: id,
        error,
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
    // No-changes successful entries (prompt-only short-circuit, generators
    // that ran but produced no diff) have no migration commit to roll back;
    // `existing.ref` is the unmodified HEAD at run time, so `ref^` would
    // reset past unrelated history. Only flip the metadata to skipped.
    if (existing.changedFiles.length > 0) {
      execFileSync('git', ['reset', '--hard', `${existing.ref}^`], {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
      });
    }
    migrationsJsonMetadata.completedMigrations[id] = {
      type: 'skipped',
    };
    return migrationsJsonMetadata;
  };
}

/**
 * Records that the user has confirmed completion of a prompt-bearing
 * migration's AI prompt phase. Dispatches by shape so callers (the webview
 * event handler in Nx Console) don't need to know which is which:
 *  - prompt-only: records success directly (no spawn, no process lifecycle).
 *  - hybrid: persists the `acknowledgedPrompt` flag on the existing
 *    successful record from the generator phase.
 */
export function acknowledgeMigrationPrompt(
  workspacePath: string,
  migration: MigrationDetailsWithId
) {
  if (isPromptOnlyMigration(migration)) {
    recordPromptOnlySuccess(workspacePath, migration);
    return;
  }
  modifyMigrationsJsonMetadata(workspacePath, (metadata) => {
    const existing = metadata.completedMigrations?.[migration.id];
    if (!existing || existing.type !== 'successful') {
      return metadata;
    }
    metadata.completedMigrations = {
      ...metadata.completedMigrations,
      [migration.id]: { ...existing, acknowledgedPrompt: true },
    };
    return metadata;
  });
}

// Writes a successful record for a prompt-only migration without touching the
// process-lifecycle tracking that `runSingleMigration` manages — safe to call
// from `acknowledgeMigrationPrompt` while another migration may be running.
// The prompt-path reminder is rendered by the UI from `migration.prompt`, so
// no next step is recorded here.
function recordPromptOnlySuccess(
  workspacePath: string,
  migration: MigrationDetailsWithId
) {
  const ref = execSync('git rev-parse HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
    windowsHide: true,
  }).trim();
  modifyMigrationsJsonMetadata(
    workspacePath,
    addSuccessfulMigration(migration.id, [], ref, [])
  );
}

export function killMigrationProcess(
  migrationId: string,
  workspacePath?: string
): boolean {
  try {
    if (workspacePath) {
      modifyMigrationsJsonMetadata(workspacePath, stopMigration(migrationId));
    }

    // Check if this is the currently running migration and kill the process
    if (currentMigrationId === migrationId && currentMigrationProcess) {
      currentMigrationProcess.kill('SIGTERM');
      // Some processes may not respond to SIGTERM immediately,
      // so we give it a short timeout before forcefully killing it
      setTimeout(() => {
        if (currentMigrationProcess && !currentMigrationProcess.killed) {
          currentMigrationProcess.kill('SIGKILL');
        }
      }, 2000);
    }

    return true;
  } catch (error) {
    console.error(`Failed to stop migration ${migrationId}:`, error);
    return false;
  }
}

export function stopMigration(migrationId: string) {
  return (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    const updated = addStoppedMigration(
      migrationId,
      'Migration was stopped by user'
    )(migrationsJsonMetadata);
    return removeRunningMigration(migrationId)(updated);
  };
}
