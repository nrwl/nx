const { execSync } = require('child_process');

function checkGitIgnoredTrackedFiles() {
  const errors = [];

  try {
    // Run git ls-files to find tracked files that would be ignored
    // -i: Show only ignored files
    // --exclude-standard: Use standard git exclusions (.gitignore, .git/info/exclude, etc.)
    // -c: Show cached (tracked) files
    const result = execSync('git ls-files -i --exclude-standard -c', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (result) {
      const ignoredFiles = result.split('\n').filter((file) => file.length > 0);

      errors.push(
        `Found ${ignoredFiles.length} tracked file(s) that would be ignored by git if not already tracked:\n`
      );

      ignoredFiles.forEach((file) => {
        errors.push(`  - ${file}`);
      });

      if (ignoredFiles.length) {
        errors.push('\nThis typically indicates one of the following issues:');
        errors.push(
          '  1. A file was committed before being added to .gitignore'
        );
        errors.push(
          '  2. The .gitignore patterns are too broad or misconfigured'
        );
        errors.push(
          '  3. A file that should not be tracked was accidentally committed'
        );
        errors.push(
          '\nThis is extra important in an Nx repo, because these files are excluded when calculating hashes for the graph.'
        );
        errors.push('\nTo fix this issue:');
        errors.push(
          '  - If the file should not be tracked: git rm --cached <file> && git commit'
        );
        errors.push(
          '  - If the file should be tracked: Update .gitignore to exclude it from ignore patterns'
        );
        errors.push(
          '  - Consider using more specific patterns in .gitignore (e.g., /node_modules/ instead of node_modules)'
        );
      }
    }
  } catch (error) {
    // If the command fails, it might be because we're not in a git repository
    // or git is not available. In CI this should not happen.
    if (error.message.includes('not a git repository')) {
      errors.push(
        'Not in a git repository. This check requires a git repository.'
      );
    } else if (error.message.includes('command not found')) {
      errors.push('Git is not installed or not in PATH.');
    } else {
      // For other errors, report them but don't fail the check
      console.warn(
        'Warning: Could not check for git-ignored tracked files:',
        error.message
      );
    }
  }

  return errors;
}

console.log('🔍🚫 Checking for tracked files that would be ignored 🚫🔍\n');
const errors = checkGitIgnoredTrackedFiles();

if (errors.length > 0) {
  errors.forEach((e) => console.log(e));
  process.exit(1);
} else {
  console.log('No tracked files would be ignored by git 👍');
  process.exit(0);
}
