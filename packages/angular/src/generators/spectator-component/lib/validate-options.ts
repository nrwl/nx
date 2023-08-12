import type { Schema } from '../schema';

export function validateOptions(options: Schema): void {
  validateComponentType(options);
}

function validateComponentType(options: Schema): void {
  if (options.withCustomHost && options.withHost) {
    throw new Error(
      `The provided options are invalid. Please provide either withCustomHost or withHost.`
    );
  }
}
