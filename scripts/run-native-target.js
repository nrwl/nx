// @ts-check

const { execSync } = require('node:child_process');

if (
  process.env.SKIP_ANALYZER_BUILD !== 'true' &&
  process.env.SKIP_NATIVE_TARGET !== 'true'
) {
  const [target, project] = process.argv.slice(2);
  execSync(`nx run ${project}:${target}`, { stdio: 'inherit' });
}
