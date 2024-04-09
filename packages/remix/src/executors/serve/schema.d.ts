export interface RemixServeSchema {
  port: number;
  devServerPort?: number;
  debug?: boolean;
  // TODO this might be deprecated
  command?: string;
  manual?: boolean;
  tlsKey?: string;
  tlsCert?: string;
}
