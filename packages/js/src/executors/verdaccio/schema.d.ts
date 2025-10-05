export interface VerdaccioExecutorSchema {
  location: 'global' | 'user' | 'project' | 'none';
  storage?: string;
  port?: number;
  listenAddress: string; // default is 'localhost'
  config?: string;
  clear?: boolean;
  scopes?: string[];
}
