/*
This pre-install script will check that the necessary dependencies are installed
Checks for:
    * Node 18+
    * Rust
 */

if (process.env.CI) {
  process.exit(0);
}

const childProcess = require('child_process');
const semverLessThan = require('semver/functions/lt');

// Check node version
if (semverLessThan(process.version, '18.0.0')) {
  console.error(
    'Please make sure that your installed Node version is greater than v18'
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
