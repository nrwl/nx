// @ts-check

const { execSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

if (
  process.env.SKIP_ANALYZER_BUILD !== 'true' &&
  process.env.SKIP_NATIVE_TARGET !== 'true'
) {
  const [target, project] = process.argv.slice(2);
  try {
    execSync(`nx run ${project}:${target}`, { stdio: 'inherit' });
  } catch (e) {
    // Task output is all CI shows; the daemon log lives on the agent.
    const daemonLog = join(
      process.cwd(),
      '.nx',
      'workspace-data',
      'd',
      'daemon.log'
    );
    if (existsSync(daemonLog)) {
      const lines = readFileSync(daemonLog, 'utf-8').split('\n');
      console.error(
        `\n========== daemon.log (last 300 lines) ==========\n${lines.slice(-300).join('\n')}`
      );
    }
    throw e;
  }
}
