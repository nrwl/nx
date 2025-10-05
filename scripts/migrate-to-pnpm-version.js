const { execSync } = require('child_process');
const fs = require('fs');

let desiredMajorVersion = process.argv[2];

// Fallback to package.json version if no argument provided
if (!desiredMajorVersion) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const packageManager = packageJson.packageManager;

    if (packageManager && packageManager.startsWith('pnpm@')) {
      const version = packageManager.replace('pnpm@', '');
      desiredMajorVersion = version.split('.')[0];
      console.log(
        `📖 Using version from package.json: pnpm ${desiredMajorVersion}`
      );
    } else {
      console.error(
        '❌ No version provided and no pnpm version found in package.json'
      );
      console.error('❌ Usage: pnpm migrate-to-pnpm-version <major-version>');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to read package.json:', error.message);
    console.error('❌ Usage: pnpm migrate-to-pnpm-version <major-version>');
    process.exit(1);
  }
}

console.log(`🚀 Starting migration to pnpm ${desiredMajorVersion}...`);

let currentVersion;
let needsPnpmInstall = true;

try {
  currentVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  const currentMajorVersion = currentVersion.split('.')[0];

  if (currentMajorVersion === desiredMajorVersion) {
    console.log(
      `✅ Already using pnpm ${desiredMajorVersion}.${currentVersion
        .split('.')
        .slice(1)
        .join('.')}`
    );
    needsPnpmInstall = false;

    if (fs.existsSync('node_modules') && fs.existsSync('pnpm-lock.yaml')) {
      try {
        execSync('pnpm list --depth=0', { stdio: 'pipe' });
        console.log('📦 Packages already installed!');
        process.exit(0);
      } catch (error) {
        console.log('🔄 Dependencies need reinstalling...');
      }
    } else {
      console.log('📥 No dependencies installed. Installing...');
    }
  }
} catch (error) {
  console.log('⚠️ pnpm not found, installing...');
}

// Install pnpm if needed
if (needsPnpmInstall) {
  try {
    execSync(`npm install -g pnpm@${desiredMajorVersion}`, {
      stdio: 'inherit',
    });
    const installedVersion = execSync('pnpm --version', {
      encoding: 'utf8',
    }).trim();
    console.log(`✅ Installed pnpm@${installedVersion}`);

    // Update packageManager in package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.packageManager = `pnpm@${installedVersion}`;
    fs.writeFileSync(
      'package.json',
      JSON.stringify(packageJson, null, 2) + '\n'
    );
  } catch (error) {
    console.error('❌ Failed to install pnpm:', error.message);
    process.exit(1);
  }
}

// Backup and install packages
if (fs.existsSync('pnpm-lock.yaml')) {
  fs.copyFileSync('pnpm-lock.yaml', 'pnpm-lock.yaml.backup');
  console.log('💾 Backup created');
}

if (needsPnpmInstall) {
  try {
    if (fs.existsSync('node_modules')) {
      execSync('rm -rf node_modules', { stdio: 'inherit' });
    }
    execSync('pnpm store prune', { stdio: 'pipe' });
  } catch (error) {
    // Store prune can fail, but we can continue
  }
}

console.log('📦 Installing dependencies...');
try {
  execSync('pnpm install', { stdio: 'inherit' });

  // Verify
  execSync('pnpm build --help', { stdio: 'pipe' });
  execSync('pnpm nx --version', { stdio: 'pipe' });

  console.log('🎉 Migration completed successfully!');
  if (fs.existsSync('pnpm-lock.yaml.backup')) {
    console.log('🗑️ Removing backup file...');
    fs.unlinkSync('pnpm-lock.yaml.backup');
  }
} catch (error) {
  console.error('❌ Installation failed:', error.message);
  if (fs.existsSync('pnpm-lock.yaml.backup')) {
    fs.copyFileSync('pnpm-lock.yaml.backup', 'pnpm-lock.yaml');
    console.log('🔄 Backup restored');
  }
  process.exit(1);
}
