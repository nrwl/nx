import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { workspaceRoot } from '@nx/devkit';
import { sync as globSync } from 'glob';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundledLanguages } from 'shiki';
// Common mappings for file extensions that don't match language IDs exactly
const extensionToLang: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  md: 'markdown',
  sh: 'bash',
  yml: 'yaml',
  env: 'dotenv',
};

const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/.astro/**'];
export default createConformanceRule({
  name: 'codeblock-language',
  category: 'consistency',
  description:
    'Ensures that all code blocks in markdown and markdoc files have a language specified',
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

    // Find markdown files in packages/*.md (excluding node_modules)
    const packageMdFiles = globSync(join(workspaceRoot, 'packages/**/*.md'), {
      ignore: ignorePatterns,
    });

    const markdocFiles = globSync(join(workspaceRoot, 'astro-docs/**/*.mdoc'), {
      ignore: ignorePatterns,
    });

    const allFiles = [...packageMdFiles, ...markdocFiles];

    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      const isMarkdoc = file.endsWith('.mdoc');

      const fileViolations = checkCodeBlocks(content, file, isMarkdoc);
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

// Get all supported language identifiers and aliases from shiki
function getSupportedLanguages(): Set<string> {
  const supported = new Set<string>();

  // bundledLanguages is an object with keys as language IDs
  for (const [langId, langGetter] of Object.entries(bundledLanguages)) {
    supported.add(langId);

    // Also add aliases if they exist in the language definition
    const lang = typeof langGetter === 'function' ? langGetter() : langGetter;
    if (lang && 'aliases' in lang && Array.isArray(lang.aliases)) {
      lang.aliases.forEach((alias: string) => supported.add(alias));
    }
  }

  return supported;
}

// Suggest a language based on file extension
function suggestLanguageFromFilename(
  filename: string,
  supportedLanguages: Set<string>
): string {
  const extensionMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (!extensionMatch) {
    return 'text';
  }

  const ext = extensionMatch[1].toLowerCase();

  // First check our custom mappings
  if (extensionToLang[ext] && supportedLanguages.has(extensionToLang[ext])) {
    return extensionToLang[ext];
  }

  // Then check if the extension itself is a supported language
  if (supportedLanguages.has(ext)) {
    return ext;
  }

  // Fall back to text
  return 'text';
}

function extractFilenameFromComment(line: string): string {
  if (line.startsWith('//')) {
    return line.slice(2).trim();
  }
  if (line.startsWith('#')) {
    return line.slice(1).trim();
  }
  if (line.startsWith('/*')) {
    return line.slice(2).replace('*/', '').trim();
  }
  return line;
}

function looksLikeFilename(line: string): boolean {
  if (!line) return false;

  const isCommentWithContent =
    line.startsWith('//') || line.startsWith('#') || line.startsWith('/*');

  const isFilePathWithExtension =
    line.includes('.') &&
    !line.startsWith('.') &&
    line.split(/\s+/)[0].includes('.');

  return isCommentWithContent || isFilePathWithExtension;
}

function checkEmptyCodeFence(
  lineNumber: number,
  nextLine: string,
  filePath: string,
  supportedLanguages: Set<string>
): ConformanceViolation | null {
  if (!looksLikeFilename(nextLine)) {
    return null;
  }

  const filename = extractFilenameFromComment(nextLine);
  const suggestedLang = suggestLanguageFromFilename(
    filename,
    supportedLanguages
  );

  return {
    message: `Code block at line ${lineNumber} is missing a language identifier but has filename "${filename}" specified. Add a language to code block e.g. \`\`\`${suggestedLang}.`,
    file: filePath,
  };
}

function checkTemplateOnlyFence(
  lineNumber: number,
  filePath: string
): ConformanceViolation {
  return {
    message: `Code block at line ${lineNumber} has template fences but no language identifier. Add a language before the {% %} fences (e.g., \`\`\`text {% ... %})`,
    file: filePath,
  };
}

function checkTreeviewLanguage(
  lineNumber: number,
  language: string,
  filePath: string,
  isMarkdoc: boolean
): ConformanceViolation | null {
  if (isMarkdoc && language === 'treeview') {
    return {
      message: `Code block at line ${lineNumber} uses 'treeview' which is not supported. Use 'text' or the {% filetree %} tag.`,
      file: filePath,
    };
  }
  return null;
}

export function checkCodeBlocks(
  content: string,
  filePath: string,
  isMarkdoc: boolean
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const lines = content.split('\n');
  const supportedLanguages = getSupportedLanguages();
  const codeFenceRegex = /^```(.*)$/;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(codeFenceRegex);
    if (!match) continue;

    if (inCodeBlock) {
      inCodeBlock = false;
      continue;
    }

    inCodeBlock = true;
    const afterBackticks = match[1].trim();

    if (afterBackticks === '') {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const violation = checkEmptyCodeFence(
        i + 1,
        nextLine,
        filePath,
        supportedLanguages
      );
      if (violation) violations.push(violation);
      continue;
    }

    if (afterBackticks.startsWith('{%')) {
      violations.push(checkTemplateOnlyFence(i + 1, filePath));
      continue;
    }

    const languageMatch = afterBackticks.match(/^(\S+)/);
    if (languageMatch) {
      const violation = checkTreeviewLanguage(
        i + 1,
        languageMatch[1],
        filePath,
        isMarkdoc
      );
      if (violation) violations.push(violation);
    }
  }

  return violations;
}
