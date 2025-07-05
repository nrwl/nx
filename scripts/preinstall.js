/*
This pre-install script will check that the necessary dependencies are installed
Checks for:
    * Node 20+
    * pnpm 10+
    * Rust
 */

if (process.env.CI) {
  process.exit(0);
}

const childProcess = require('child_process');
const semverLessThan = require('semver/functions/lt');

// Check node version
if (semverLessThan(process.version, '20.19.0')) {
  console.warn(
    `Please make sure that your installed Node version (${process.version}) is greater than v20.19.0`
  );
}

// Check for pnpm version
try {
  let pnpmVersion = childProcess.execSync('pnpm --version', {
    encoding: 'utf8',
  });
  const version = pnpmVersion.trim();
  if (semverLessThan(version, '10.0.0')) {
    console.error(
      `Found pnpm ${version}. Please make sure that your installed pnpm version is 10.0.0 or greater. You can update with: npm install -g pnpm@10`
    );
    process.exit(1);
  }
} catch {
  console.error(
    'Could not find pnpm on this system. Please make sure it is installed with: npm install -g pnpm@10'
  );
  process.exit(1);
}

// Check for rust
try {
  let rustVersion = childProcess.execSync('rustc --version');
  if (semverLessThan(rustVersion.toString().split(' ')[1], '1.70.0')) {
    console.log(`Found ${rustVersion}`);
    console.error(
      'Please make sure that your installed Rust version is greater than v1.70. You can update your installed Rust version with `rustup update`'
    );
    process.exit(1);
  }
} catch {
  console.error(
    'Could not find the Rust compiler on this system. Please make sure that it is installed with https://rustup.rs'
  );
  process.exit(1);
}
