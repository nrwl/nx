const VALID_STYLES = [
  'css',
  'scss',
  'less',
  'styl',
  'styled-components',
  '@emotion/styled'
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
