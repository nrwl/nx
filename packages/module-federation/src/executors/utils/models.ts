export interface StaticRemotesOptions {
  staticRemotesPort?: number;
  host?: string;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
}

export interface BuildStaticRemotesOptions extends StaticRemotesOptions {
  parallel?: number;
}
