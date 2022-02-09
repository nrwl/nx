export interface Schema {
  project: string;
  type: 'js' | 'node' | 'nest' | 'next' | 'react' | 'detox' | 'web';
  skipFormat?: boolean;
}
