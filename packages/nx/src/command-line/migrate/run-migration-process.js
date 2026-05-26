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

    // `ChangedDepInstaller` snapshots package.json deps at construction time
    // so we can detect post-migration dep drift and run a single install
    // regardless of whether commits are on (commit path installs internally
    // before commit) or off (we install explicitly afterward).
    const installer = new ChangedDepInstaller(workspacePath);
    const installDepsIfChanged = () => installer.installDepsIfChanged();

    const { changes: fileChanges, nextSteps } = await runNxOrAngularMigration(
      workspacePath,
      migration,
      false
    );

    if (configuration.createCommits) {
      await commitMigrationIfRequested(
        workspacePath,
        migration,
        true,
        configuration.commitPrefix,
        installDepsIfChanged
      );
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
