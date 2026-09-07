export type Schema = {
  servers: Array<{
    port?: number;
    url?: string;
    ignoreHTTPSErrors?: boolean;
    timeout?: number;
  }>;
  timeout?: number;
};
