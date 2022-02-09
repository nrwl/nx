export interface Schema {
  project: string;
  type: 'js' | 'node' | 'nest' | 'next' | 'react' | 'angular' | 'detox' | 'web';
  skipFormat?: boolean;
}
