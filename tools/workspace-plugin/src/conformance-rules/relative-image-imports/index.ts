import { ConformanceViolation, createConformanceRule } from '@nx/conformance';
import { workspaceRoot } from '@nx/devkit';
import { sync as globSync } from 'glob';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';

const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/.astro/**'];

// Image file extensions to check
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

export default createConformanceRule({
  name: 'image-import-paths',
  category: 'consistency',
  description: 'Ensures that all doc image references are valid',
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

    // Find all .mdoc files in astro-docs
    const mdocFiles = globSync(join(workspaceRoot, 'astro-docs/**/*.mdoc'), {
      ignore: ignorePatterns,
    });

    for (const file of mdocFiles) {
      const content = readFileSync(file, 'utf-8');
      const fileViolations = checkImagePaths(content, file);
      violations.push(...fileViolations);
    }

    return {
      severity: violations.length > 0 ? 'medium' : 'low',
      details: {
        violations,
      },
    };
  },
});

function checkImagePaths(
  content: string,
  filePath: string
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code block state
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip lines inside code blocks
    if (inCodeBlock) {
      continue;
    }

    // Check for markdown image syntax: ![alt](path)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = markdownImageRegex.exec(line)) !== null) {
      const imagePath = match[2];

      // Skip URLs (http://, https://, //)
      if (
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://') ||
        imagePath.startsWith('//')
      ) {
        continue;
      }

      const violation = validateImagePath(imagePath, filePath, i + 1);
      if (violation) {
        violations.push(violation);
      }
    }

    // Check for import statements: import ... from './path/to/image.png'
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/;
    const importMatch = line.match(importRegex);

    if (importMatch) {
      const importPath = importMatch[1];

      // Check if this is an image import
      const hasImageExtension = imageExtensions.some((ext) =>
        importPath.toLowerCase().endsWith(ext)
      );

      if (hasImageExtension) {
        const violation = validateImagePath(importPath, filePath, i + 1);
        if (violation) {
          violations.push(violation);
        }
      }
    }
  }

  return violations;
}

function validateImagePath(
  imagePath: string,
  mdocFilePath: string,
  lineNumber: number
): ConformanceViolation | null {
  // Handle paths starting with / (public folder references in Astro)
  if (imagePath.startsWith('/')) {
    const publicPath = join(workspaceRoot, 'astro-docs/public', imagePath);

    if (!existsSync(publicPath)) {
      return {
        message: `Image path at line ${lineNumber} does not exist in public folder: "${imagePath}"`,
        file: resolveFilePathToWorkspaceRoot(mdocFilePath),
      };
    }

    // Path exists in public folder - this is valid
    return null;
  }

  // Check if path is absolute (not relative)
  if (
    isAbsolute(imagePath) ||
    (!imagePath.startsWith('.') && !imagePath.startsWith('..'))
  ) {
    return {
      message: `Image path at line ${lineNumber} must be relative (start with ./ or ../) or an absolute path to public folder (start with /). Found: "${imagePath}"`,
      file: resolveFilePathToWorkspaceRoot(mdocFilePath),
    };
  }

  // Resolve the full path to the image
  const mdocDir = dirname(mdocFilePath);
  const resolvedImagePath = resolve(mdocDir, imagePath);

  // Check if the file exists
  if (!existsSync(resolvedImagePath)) {
    return {
      message: `Image path at line ${lineNumber} does not exist: "${imagePath}"`,
      file: resolveFilePathToWorkspaceRoot(mdocFilePath),
    };
  }

  // Relative paths must be in src/assets folder only
  const relativeToWorkspace = relative(workspaceRoot, resolvedImagePath);
  const isInAssets = relativeToWorkspace.startsWith('astro-docs/src/assets/');

  if (!isInAssets) {
    return {
      message: `Image at line ${lineNumber} with relative path must be in astro-docs/src/assets/ folder. Found: "${relativeToWorkspace}". If the image is in the public folder, use an absolute path starting with /`,
      file: resolveFilePathToWorkspaceRoot(mdocFilePath),
    };
  }

  return null;
}

function resolveFilePathToWorkspaceRoot(filePath: string) {
  if (!filePath || !filePath.startsWith(workspaceRoot)) {
    return filePath;
  }

  return filePath.replace(workspaceRoot + '/', '');
}
