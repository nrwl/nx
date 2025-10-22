// @ts-check

const { execSync } = require('node:child_process');

if (process.env.SKIP_ANALYZER_BUILD !== 'true') {
  execSync('nx _build-analyzer dotnet', { stdio: 'inherit' });
}
