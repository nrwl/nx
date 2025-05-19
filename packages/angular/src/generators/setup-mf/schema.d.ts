import type { ComponentMetadata } from '../utils/app-components-info';

type FederationType = 'static' | 'dynamic';

export interface Schema {
  appName: string;
  mfType: 'host' | 'remote';
  port?: number;
  remotes?: string[];
  host?: string;
  federationType?: FederationType;
  routing?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  e2eProjectName?: string;
  prefix?: string;
  standalone?: boolean;
  skipE2E?: boolean;
  typescriptConfiguration?: boolean;
  setParserOptionsProject?: boolean;
}

export interface NormalizedOptions extends Schema {
  federationType: FederationType;
  prefix: string | undefined;
  componentType: string;
  componentFileSuffix: string;
  entryModuleFileName: string;
  appComponentInfo: ComponentMetadata;
  nxWelcomeComponentInfo: ComponentMetadata;
}
