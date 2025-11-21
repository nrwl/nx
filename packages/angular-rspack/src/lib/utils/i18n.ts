import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { I18nOptions } from '../models';

export function ensureOutputPaths(
  baseOutputPath: string,
  i18n: I18nOptions
): Map<string, string> {
  const outputPaths = getLocaleOutputPaths(i18n);

  for (const [, outputPath] of outputPaths) {
    const fullPath = join(baseOutputPath, outputPath);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  return outputPaths;
}

export function getLocaleOutputPaths(i18n: I18nOptions): Map<string, string> {
  const outputPaths: [string, string][] = i18n.shouldInline
    ? [...i18n.inlineLocales].map((l) => [
        l,
        i18n.flatOutput ? '' : i18n.locales[l].subPath,
      ])
    : [['', '']];

  return new Map(outputPaths);
}
