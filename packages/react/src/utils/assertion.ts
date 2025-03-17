import { type Schema } from '../generators/application/schema';

const VALID_STYLES = [
  'css',
  'scss',
  'less',
  'tailwind',
  'styled-components',
  '@emotion/styled',
  'styled-jsx',
  'none',
];

export function assertValidStyle(style: string): void {
  if (VALID_STYLES.indexOf(style) === -1) {
    throw new Error(
      `Unsupported style option found: ${style}. Valid values are: "${VALID_STYLES.join(
        '", "'
      )}"`
    );
  }
}

export function assertValidReactRouter(
  reactRouter: boolean,
  bundler: Schema['bundler']
): void {
  if (reactRouter && bundler !== 'vite') {
    throw new Error(
      `Unsupported bundler found: ${bundler}. React Router is only supported with 'vite'.`
    );
  }
}
