import type { CatalogError } from './types';

export class CatalogValidationError extends Error {
  constructor(public readonly catalogError: CatalogError, message?: string) {
    super(message || catalogError.message);
    this.name = 'CatalogValidationError';
  }
}

export class CatalogUnsupportedError extends Error {
  constructor(public readonly packageManager: string, operation: string) {
    super(
      `Tried to ${operation} but Nx doesn't support catalogs for the current package manager (${packageManager})`
    );
    this.name = 'CatalogUnsupportedError';
  }
}
