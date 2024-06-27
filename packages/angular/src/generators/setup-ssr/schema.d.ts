export interface Schema {
  project: string;
  appId?: string;
  main?: string;
  serverFileName?: string;
  serverPort?: number;
  rootModuleFileName?: string;
  rootModuleClassName?: string;
  standalone?: boolean;
  hydration?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
