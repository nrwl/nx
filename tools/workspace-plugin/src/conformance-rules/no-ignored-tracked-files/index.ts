import { createConformanceRule, ConformanceViolation } from '@nx/conformance';
import { execSync } from 'child_process';

export default createConformanceRule({
  name: 'no-ignored-tracked-files',
  category: 'reliability',
  description:
    'There should be no files that are both tracked by git and ignored by .gitignore. Git supports this, but in an nx workspace this results in files which are present but unaccounted for in hash calculations and is almost always a mistake.',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

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
        const ignoredFiles = result
          .split('\n')
          .filter((file) => file.length > 0);

        ignoredFiles.forEach((file) => {
          violations.push({
            file,
            message: `File "${file}" is tracked by git but would be ignored if not already tracked. This can cause issues with Nx hashing. Either:\n  - Remove from tracking: git rm --cached ${file} && git commit\n  - Update .gitignore to exclude it from ignore patterns\n  - Use more specific patterns in .gitignore (e.g., /node_modules/ instead of node_modules)`,
          });
        });
      }
    } catch (error: any) {
      // If the command fails, it might be because we're not in a git repository
      // or git is not available. In conformance rules, we should handle this gracefully.
      if (error.message?.includes('not a git repository')) {
        // Not in a git repository - no violations to report
        return {
          severity: 'low',
          details: {
            violations: [],
          },
        };
      } else if (error.message?.includes('command not found')) {
        // Git is not installed - skip this rule
        return {
          severity: 'low',
          details: {
            violations: [],
          },
        };
      }
      // For other errors, we can log them but continue
      console.warn(
        'Warning: Could not check for git-ignored tracked files:',
        error.message
      );
    }

    return {
      severity: violations.length > 0 ? 'medium' : 'low',
      details: {
        violations,
      },
    };
  },
});
