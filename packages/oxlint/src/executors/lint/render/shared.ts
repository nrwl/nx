import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import type { OxlintDiagnostic, OxlintSpan } from '../run-oxlint.js';

export interface RenderContext {
  workspaceRoot: string;
  /** In CI or under an AI agent `default` renders as `agent`, as Oxlint does. */
  agentMode: boolean;
}

export function countBySeverity(diagnostics: OxlintDiagnostic[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
  }
  return { errors, warnings: diagnostics.length - errors };
}

export function summary(diagnostics: OxlintDiagnostic[]): string {
  const { errors, warnings } = countBySeverity(diagnostics);
  const line = `Found ${warnings} warning${warnings === 1 ? '' : 's'} and ${errors} error${errors === 1 ? '' : 's'}.`;
  return (
    (diagnostics.length ? '\n' : '') +
    (errors ? pc.red(line) : warnings ? pc.yellow(line) : line) +
    '\n'
  );
}

export function position(d: OxlintDiagnostic): {
  line: number;
  column: number;
} {
  const span = d.labels[0]?.span;
  return { line: span?.line ?? 1, column: span?.column ?? 1 };
}

export class SourceCache {
  private cache = new Map<string, string[] | null>();
  private workspaceRoot: string;
  // No parameter property: Node's strip-only TypeScript mode rejects them,
  // which would push the whole executor onto the slower swc fallback.
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  lines(file: string): string[] | null {
    if (!this.cache.has(file)) {
      try {
        this.cache.set(
          file,
          readFileSync(join(this.workspaceRoot, file), 'utf-8').split('\n')
        );
      } catch {
        this.cache.set(file, null);
      }
    }
    return this.cache.get(file);
  }

  endOf(file: string, span: OxlintSpan): { line: number; column: number } {
    const lines = this.lines(file);
    if (!lines) {
      return { line: span.line, column: span.column + span.length };
    }
    let remaining = span.offset + span.length;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (remaining <= lineLength) {
        return { line: i + 1, column: remaining + 1 };
      }
      remaining -= lineLength;
    }
    return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
  }
}
