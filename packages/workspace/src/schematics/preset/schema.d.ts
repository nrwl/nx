export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  cli: string;
  preset:
    | 'empty'
    | 'oss'
    | 'angular'
    | 'react'
    | 'next'
    | 'web-components'
    | 'angular-nest'
    | 'react-express';
}
