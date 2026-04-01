/*
This pre-install script will check that the necessary dependencies are installed
Checks for:
    * Node 20+
    * pnpm 10+
    * Rust 1.70+
    * mise trust status (if applicable)
 */

if (process.env.CI) {
  process.exit(0);
}

const { execSync } = require('child_process');
const lt = require('semver/functions/lt');

function execOrNull(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getToolData() {
  const pnpm = execOrNull('pnpm --version');
  const rustRaw = execOrNull('rustc --version');
  const miseRaw = execOrNull('mise trust --show');

  return {
    node: process.version,
    pnpm,
    rust: rustRaw ? rustRaw.split(' ')[1] : null,
    miseInstalled: miseRaw !== null,
    miseUntrusted: miseRaw !== null && miseRaw.includes('untrusted'),
  };
}

function checkNode({ node }) {
  if (lt(node, '20.19.0')) {
    console.warn(
      `Please make sure that your installed Node version (${node}) is greater than v20.19.0`
    );
  }
  return false;
}

function checkPnpm({ pnpm }) {
  if (pnpm === null) {
    console.error(
      'Could not find pnpm on this system. Please make sure it is installed with: npm install -g pnpm@10'
    );
    return true;
  }
  if (lt(pnpm, '10.0.0')) {
    console.error(
      `Found pnpm ${pnpm}. Please make sure that your installed pnpm version is 10.0.0 or greater. You can update with: npm install -g pnpm@10`
    );
    return true;
  }
  return false;
}

function checkRust({ rust, miseInstalled, miseUntrusted }) {
  const missing = rust === null;
  const outdated = !missing && lt(rust, '1.70.0');

  if (!missing && !outdated) {
    return false;
  }

  // If mise is installed but untrusted, a simple `mise trust` likely fixes Rust
  if (miseInstalled && miseUntrusted) {
    console.error(
      missing
        ? 'Could not find the Rust compiler on this system.'
        : `Found Rust ${rust}, but version 1.70.0 or greater is required.`,
      '\nmise is installed but this directory is not trusted. Run `mise trust` in this directory to install the correct toolchain.'
    );
    return true;
  }

  if (outdated) {
    console.log(`Found rustc ${rust}`);
    console.error(
      'Please make sure that your installed Rust version is greater than v1.70. You can update with `rustup update`, or install mise (https://mise.jdx.dev/) and run `mise trust` in this directory.'
    );
  } else {
    console.error(
      'Could not find the Rust compiler on this system. Please install it with https://rustup.rs, or install mise (https://mise.jdx.dev/) and run `mise trust` in this directory.'
    );
  }
  return true;
}

const toolData = getToolData();
const hasErrors = [checkNode, checkPnpm, checkRust].some((check) =>
  check(toolData)
);

if (hasErrors) {
  process.exit(1);
}
