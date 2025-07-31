// Jest 30 + Node.js 24 can't parse TS configs with imports.
// This flag does not exist in Node 20/22.
// https://github.com/jestjs/jest/issues/15682
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion >= 24) {
  const currentOptions = process.env.NODE_OPTIONS || '';
  if (!currentOptions.includes('--no-experimental-strip-types')) {
    process.env.NODE_OPTIONS = (
      currentOptions + ' --no-experimental-strip-types'
    ).trim();
  }
}

const { spawn } = require('child_process');
const [, , ...args] = process.argv;

if (args.length === 0) {
  console.error('Usage: node set-node-options.js <command> [args...]');
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
