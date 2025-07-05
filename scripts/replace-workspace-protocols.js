// Since we are using ts solution, we need to replace workspace protocols in package.json files
// with the actual version number before publishing to npm.

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

function main() {
  const projectName = process.argv[2];
  const version = process.argv[3];

  // Validate that project name and version were provided
  if (!projectName || !version) {
    console.error(
      'Usage: node replace-workspace-protocols.js <project-name> <version>'
    );
    process.exit(1);
  }

  const packageJsonPath = join(
    __dirname,
    '..',
    'dist',
    'packages',
    projectName,
    'package.json'
  );

  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    let modified = false;

    // Function to replace Nx package versions
    function replaceNxPackageVersions(deps) {
      if (!deps) return;

      for (const [depName, depVersion] of Object.entries(deps)) {
        // Replace version for all @nx/* packages, nx package, and create-nx-* packages
        if (
          depName === 'nx' ||
          depName.startsWith('@nx/') ||
          depName.startsWith('create-nx-')
        ) {
          if (deps[depName] !== version) {
            deps[depName] = version;
            modified = true;
            console.log(`  ${depName}: ${depVersion} → ${version}`);
          }
        }
      }
    }

    console.log(`Processing ${projectName} with version ${version}...`);

    replaceNxPackageVersions(packageJson.dependencies);
    replaceNxPackageVersions(packageJson.devDependencies);

    if (modified) {
      writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n'
      );
      console.log(`✅ Updated workspace protocols in ${projectName}`);
    } else {
      console.log(`ℹ️  No workspace protocols found in ${projectName}`);
    }
  } catch (error) {
    // Don't fail if the package doesn't exist in dist (e.g., for packages that don't get published)
    if (error.code === 'ENOENT') {
      console.log(`ℹ️  Skipping ${projectName} (not found in dist)`);
      return;
    }
    console.error(`Error processing ${projectName}:`, error.message);
    process.exit(1);
  }
}

main();
