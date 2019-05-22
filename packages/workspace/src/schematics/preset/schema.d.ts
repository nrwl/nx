export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  preset:
    | 'empty'
    | 'angular'
    | 'angular-ivy'
    | 'react'
    | 'web-components'
    | 'full-stack';
}
