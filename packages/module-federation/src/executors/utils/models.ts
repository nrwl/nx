import type { ProjectConfiguration, ExecutorContext } from '@nx/devkit';

export type DevRemoteDefinition =
  | string
  | { remoteName: string; configuration: string };

export type StartRemoteFn = (
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: {
    devRemotes: DevRemoteDefinition[];
    verbose: boolean;
  },
  context: ExecutorContext,
  target: 'serve' | 'serve-static'
) => Promise<AsyncIterable<{ success: boolean }>[]>;

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

export interface StartRemoteIteratorsOptions extends BuildStaticRemotesOptions {
  devRemotes: DevRemoteDefinition[];
  skipRemotes?: string[];
  buildTarget?: string;
  liveReload?: boolean;
  open?: boolean;
  ssl?: boolean;
  verbose: boolean;
}
