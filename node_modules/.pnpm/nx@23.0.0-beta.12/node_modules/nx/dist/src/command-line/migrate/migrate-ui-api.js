"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordInitialMigrationMetadata = recordInitialMigrationMetadata;
exports.finishMigrationProcess = finishMigrationProcess;
exports.runSingleMigration = runSingleMigration;
exports.getImplementationPath = getImplementationPath;
exports.modifyMigrationsJsonMetadata = modifyMigrationsJsonMetadata;
exports.addSuccessfulMigration = addSuccessfulMigration;
exports.updateRefForSuccessfulMigration = updateRefForSuccessfulMigration;
exports.addFailedMigration = addFailedMigration;
exports.addSkippedMigration = addSkippedMigration;
exports.addStoppedMigration = addStoppedMigration;
exports.readMigrationsJsonMetadata = readMigrationsJsonMetadata;
exports.undoMigration = undoMigration;
exports.killMigrationProcess = killMigrationProcess;
exports.stopMigration = stopMigration;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const migrate_1 = require("./migrate");
let currentMigrationProcess = null;
let currentMigrationId = null;
let migrationCancelled = false;
function recordInitialMigrationMetadata(workspacePath, versionToMigrateTo) {
    const migrationsJsonPath = (0, path_1.join)(workspacePath, 'migrations.json');
    const parsedMigrationsJson = JSON.parse((0, fs_1.readFileSync)(migrationsJsonPath, 'utf-8'));
    const gitRef = (0, child_process_1.execSync)('git rev-parse HEAD', {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
    }).trim();
    const gitSubject = (0, child_process_1.execSync)('git log -1 --pretty=%s', {
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
    (0, fs_1.writeFileSync)(migrationsJsonPath, JSON.stringify(parsedMigrationsJson, null, 2));
}
function finishMigrationProcess(workspacePath, squashCommits, commitMessage) {
    const migrationsJsonPath = (0, path_1.join)(workspacePath, 'migrations.json');
    const parsedMigrationsJson = JSON.parse((0, fs_1.readFileSync)(migrationsJsonPath, 'utf-8'));
    const initialGitRef = parsedMigrationsJson['nx-console'].initialGitRef;
    if ((0, fs_1.existsSync)(migrationsJsonPath)) {
        (0, fs_1.rmSync)(migrationsJsonPath);
    }
    (0, child_process_1.execSync)('git add .', {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
    });
    (0, child_process_1.execSync)(`git commit -m "${commitMessage}" --no-verify`, {
        cwd: workspacePath,
        encoding: 'utf-8',
        windowsHide: true,
    });
    if (squashCommits && initialGitRef) {
        (0, child_process_1.execSync)(`git reset --soft ${initialGitRef.ref}`, {
            cwd: workspacePath,
            encoding: 'utf-8',
            windowsHide: true,
        });
        (0, child_process_1.execSync)(`git commit -m "${commitMessage}" --no-verify`, {
            cwd: workspacePath,
            encoding: 'utf-8',
            windowsHide: true,
        });
    }
}
async function runSingleMigration(workspacePath, migration, configuration) {
    try {
        // Set current migration tracking
        currentMigrationId = migration.id;
        migrationCancelled = false;
        modifyMigrationsJsonMetadata(workspacePath, addRunningMigration(migration.id));
        const gitRefBefore = (0, child_process_1.execSync)('git rev-parse HEAD', {
            cwd: workspacePath,
            encoding: 'utf-8',
            windowsHide: true,
        }).trim();
        // Run migration in a separate process so it can be cancelled
        const runMigrationProcessPath = require.resolve('./run-migration-process.js');
        const migrationProcess = (0, child_process_1.spawn)('node', [
            runMigrationProcessPath,
            workspacePath,
            migration.id,
            migration.package,
            migration.name,
            migration.version,
            configuration.createCommits.toString(),
            configuration.commitPrefix || 'chore: [nx migration] ',
        ], {
            cwd: workspacePath,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
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
        const exitCode = await new Promise((resolve, reject) => {
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
        modifyMigrationsJsonMetadata(workspacePath, addSuccessfulMigration(migration.id, fileChanges.map((change) => ({
            path: change.path,
            type: change.type,
        })), gitRefAfter, nextSteps));
        if (gitRefBefore !== gitRefAfter) {
            try {
                (0, child_process_1.execSync)('git add migrations.json', {
                    cwd: workspacePath,
                    encoding: 'utf-8',
                    windowsHide: true,
                });
            }
            catch (e) {
                // do nothing, this will fail if it's gitignored
            }
            (0, child_process_1.execSync)('git commit --amend --no-verify --no-edit', {
                cwd: workspacePath,
                encoding: 'utf-8',
                windowsHide: true,
            });
            // The revision changes after the amend, so we need to update it
            const amendedGitRef = (0, child_process_1.execSync)('git rev-parse HEAD', {
                cwd: workspacePath,
                encoding: 'utf-8',
                windowsHide: true,
            }).trim();
            modifyMigrationsJsonMetadata(workspacePath, updateRefForSuccessfulMigration(migration.id, amendedGitRef));
        }
    }
    catch (e) {
        // Check if migration was cancelled/stopped
        if (migrationCancelled && currentMigrationId === migration.id) {
            // Migration was stopped by user, don't add as failed since it's already marked as stopped
            console.log(`Migration ${migration.id} was stopped by user`);
        }
        else {
            // Migration failed normally
            modifyMigrationsJsonMetadata(workspacePath, addFailedMigration(migration.id, e.message));
        }
    }
    finally {
        // Clear the tracking variables
        currentMigrationProcess = null;
        currentMigrationId = null;
        migrationCancelled = false;
        modifyMigrationsJsonMetadata(workspacePath, removeRunningMigration(migration.id));
        try {
            (0, child_process_1.execSync)('git add migrations.json', {
                cwd: workspacePath,
                encoding: 'utf-8',
                windowsHide: true,
            });
        }
        catch (e) {
            // do nothing, this will fail if it's gitignored
        }
    }
}
async function getImplementationPath(workspacePath, migration) {
    const { collection, collectionPath } = (0, migrate_1.readMigrationCollection)(migration.package, workspacePath);
    const { path } = (0, migrate_1.getImplementationPath)(collection, collectionPath, migration.name);
    return path;
}
function modifyMigrationsJsonMetadata(workspacePath, modify) {
    const migrationsJsonPath = (0, path_1.join)(workspacePath, 'migrations.json');
    const migrationsJson = JSON.parse((0, fs_1.readFileSync)(migrationsJsonPath, 'utf-8'));
    migrationsJson['nx-console'] = modify(migrationsJson['nx-console']);
    (0, fs_1.writeFileSync)(migrationsJsonPath, JSON.stringify(migrationsJson, null, 2));
}
function addSuccessfulMigration(id, fileChanges, ref, nextSteps) {
    return (migrationsJsonMetadata) => {
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
function updateRefForSuccessfulMigration(id, ref) {
    return (migrationsJsonMetadata) => {
        const copied = { ...migrationsJsonMetadata };
        if (!copied.completedMigrations) {
            copied.completedMigrations = {};
        }
        const existing = copied.completedMigrations[id];
        if (existing && existing.type === 'successful') {
            existing.ref = ref;
        }
        else {
            throw new Error(`Attempted to update ref for unsuccessful migration`);
        }
        return copied;
    };
}
function addFailedMigration(id, error) {
    return (migrationsJsonMetadata) => {
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
function addSkippedMigration(id) {
    return (migrationsJsonMetadata) => {
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
function addStoppedMigration(id, error) {
    return (migrationsJsonMetadata) => {
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
function addRunningMigration(id) {
    return (migrationsJsonMetadata) => {
        migrationsJsonMetadata.runningMigrations = [
            ...(migrationsJsonMetadata.runningMigrations ?? []),
            id,
        ];
        return migrationsJsonMetadata;
    };
}
function removeRunningMigration(id) {
    return (migrationsJsonMetadata) => {
        migrationsJsonMetadata.runningMigrations =
            migrationsJsonMetadata.runningMigrations?.filter((n) => n !== id);
        return migrationsJsonMetadata;
    };
}
function readMigrationsJsonMetadata(workspacePath) {
    const migrationsJsonPath = (0, path_1.join)(workspacePath, 'migrations.json');
    const migrationsJson = JSON.parse((0, fs_1.readFileSync)(migrationsJsonPath, 'utf-8'));
    return migrationsJson['nx-console'];
}
function undoMigration(workspacePath, id) {
    return (migrationsJsonMetadata) => {
        const existing = migrationsJsonMetadata.completedMigrations[id];
        if (existing.type !== 'successful')
            throw new Error(`undoMigration called on unsuccessful migration: ${id}`);
        (0, child_process_1.execSync)(`git reset --hard ${existing.ref}^`, {
            cwd: workspacePath,
            encoding: 'utf-8',
            windowsHide: true,
        });
        migrationsJsonMetadata.completedMigrations[id] = {
            type: 'skipped',
        };
        return migrationsJsonMetadata;
    };
}
function killMigrationProcess(migrationId, workspacePath) {
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
    }
    catch (error) {
        console.error(`Failed to stop migration ${migrationId}:`, error);
        return false;
    }
}
function stopMigration(migrationId) {
    return (migrationsJsonMetadata) => {
        const updated = addStoppedMigration(migrationId, 'Migration was stopped by user')(migrationsJsonMetadata);
        return removeRunningMigration(migrationId)(updated);
    };
}
