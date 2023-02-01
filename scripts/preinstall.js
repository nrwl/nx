/*
This pre-install script will check that the necessary dependencies are installed
Checks for:
    * Node 18+
    * Cargo
 */

if (process.env.CI) {
  process.exit(0);
}

const childProcess = require('child_process');

// Check node version
const nodeVersion = process.version.slice(1).split('.');
if (+nodeVersion[0] < 18) {
  console.error(
    'Please make sure that your installed Node version is greater than v18'
  );
  process.exit(1);
}

// Check for cargo
try {
  childProcess.execSync('cargo --version');
} catch {
  console.error(
    'Could not find Cargo. Please make sure that Cargo and Rust is installed with https://rustup.rs'
  );
  process.exit(1);
}
