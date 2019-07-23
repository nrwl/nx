export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  preset: 'empty' | 'angular' | 'react' | 'web-components' | 'full-stack';
}
