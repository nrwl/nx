export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  cli: string;
  preset:
    | 'empty'
    | 'angular'
    | 'react'
    | 'web-components'
    | 'angular-nest'
    | 'react-express';
}
