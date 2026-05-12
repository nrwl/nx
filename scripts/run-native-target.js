// @ts-check

const { execSync } = require('node:child_process');

if (
  process.env.SKIP_ANALYZER_BUILD !== 'true' &&
  process.env.SKIP_NATIVE_TARGET !== 'true'
) {
  const [target, project] = process.argv.slice(2);
  // Detach from the parent nx invocation chain so the recursive-task detector
  // in nx@23+ doesn't treat this sibling task as a recursive call.
  const { NX_INVOCATION_ROOT_PID, ...env } = process.env;
  execSync(`nx run ${project}:${target}`, { stdio: 'inherit', env });
}
