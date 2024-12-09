export interface RemixRouteSchema {
  path: string;
  style: 'css' | 'none';
  action: boolean;
  meta: boolean;
  loader: boolean;
  skipChecks: boolean;
}
