const { runNxOrAngularMigration, ChangedDepInstaller } = require('./migrate');
const { commitMigrationIfRequested } = require('./migrate-commits');
const { execSync } = require('child_process');

async function runMigrationProcess() {
  const [
    ,
    ,
    workspacePath,
    migrationId,
    migrationPackage,
    migrationName,
    migrationVersion,
    createCommits,
    commitPrefix,
  ] = process.argv;

  const migration = {
    id: migrationId,
    package: migrationPackage,
    name: migrationName,
    version: migrationVersion,
  };

  const configuration = {
    createCommits: createCommits === 'true',
    commitPrefix: commitPrefix || 'chore: [nx migration] ',
  };

  try {
    const gitRefBefore = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      windowsHide: true,
    }).trim();

    // Snapshot package.json deps now so we can detect post-migration drift
    // and run a single install, whether commits are on or off.
    const installer = new ChangedDepInstaller(workspacePath);
    const installDepsIfChanged = () => installer.installDepsIfChanged();

    const { changes: fileChanges, nextSteps } = await runNxOrAngularMigration(
      workspacePath,
      migration,
      false
    );

    if (configuration.createCommits) {
      const commitResult = await commitMigrationIfRequested(
        workspacePath,
        migration,
        true,
        configuration.commitPrefix,
        installDepsIfChanged
      );
      if (commitResult.status === 'failed') {
        // Single-migration UI child surfaces the failure via stdout (logged
        // inside commitMigrationIfRequested) and continues with success-
        // with-warning. The executor's absorption flow does not apply here:
        // there is no later migration that could pick up this migration's
        // diff, so the working tree is left in its post-migration state
        // for the user to commit or revert through the UI.
      }
    } else {
      await installDepsIfChanged();
    }

    const gitRefAfter = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      windowsHide: true,
    }).trim();

    // Report success
    process.stdout.write(
      JSON.stringify({
        type: 'success',
        fileChanges: fileChanges.map((change) => ({
          path: change.path,
          type: change.type,
        })),
        gitRefAfter,
        nextSteps,
      })
    );

    process.exit(0);
  } catch (error) {
    // Report failure
    process.stdout.write(
      JSON.stringify({
        type: 'error',
        message: error.message,
      })
    );

    process.exit(1);
  }
}

runMigrationProcess().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      type: 'error',
      message: error.message,
    })
  );
  process.exit(1);
});
