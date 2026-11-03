const { existsSync, renameSync, writeFileSync } = require('fs');
const { join } = require('path');

const [directory, project] = process.argv.slice(2);
const record = join(directory, `${process.pid}`);
writeFileSync(
  `${record}.tmp`,
  JSON.stringify({
    project,
    files: process.env.NX_FILE_CHANGES.split(' '),
  })
);
renameSync(`${record}.tmp`, `${record}.json`);

const deadline = setTimeout(() => process.exit(1), 20_000);
const interval = setInterval(() => {
  if (
    existsSync(join(directory, 'release')) ||
    existsSync(join(directory, `release-${project}`))
  ) {
    clearTimeout(deadline);
    clearInterval(interval);
  }
}, 10);
