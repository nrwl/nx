import { I18nOptions as _I18nOptions } from '@angular/build/private';

export type I18nOptions = _I18nOptions;

export interface SourceLocale {
  code?: string;
  baseHref?: string;
  subPath?: string;
}

export interface LocaleMetadata {
  translation?: string | string[];
  baseHref?: string;
  subPath?: string;
}

export interface I18nProjectMetadata {
  sourceLocale?: string | SourceLocale;
  locales?: Record<string, string | string[] | LocaleMetadata>;
}

/**
 * How to handle potential diagnostics.
 */
export type DiagnosticHandlingStrategy = 'error' | 'warning' | 'ignore';

export class Diagnostics {
  readonly messages: { type: 'warning' | 'error'; message: string }[] = [];
  get hasErrors() {
    return this.messages.some((m) => m.type === 'error');
  }
  add(type: DiagnosticHandlingStrategy, message: string) {
    if (type !== 'ignore') {
      this.messages.push({ type, message });
    }
  }
  warn(message: string) {
    this.messages.push({ type: 'warning', message });
  }
  error(message: string) {
    this.messages.push({ type: 'error', message });
  }
  merge(other: Diagnostics) {
    this.messages.push(...other.messages);
  }
  formatDiagnostics(message: string): string {
    const errors = this.messages
      .filter((d) => d.type === 'error')
      .map((d) => ' - ' + d.message);
    const warnings = this.messages
      .filter((d) => d.type === 'warning')
      .map((d) => ' - ' + d.message);
    if (errors.length) {
      message += '\nERRORS:\n' + errors.join('\n');
    }
    if (warnings.length) {
      message += '\nWARNINGS:\n' + warnings.join('\n');
    }
    return message;
  }
}
