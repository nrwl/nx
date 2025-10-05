const { runNxOrAngularMigration } = require('./migrate');
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
    }).trim();

    const { changes: fileChanges, nextSteps } = await runNxOrAngularMigration(
      workspacePath,
      migration,
      false,
      configuration.createCommits,
      configuration.commitPrefix,
      undefined,
      true
    );

    const gitRefAfter = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
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
