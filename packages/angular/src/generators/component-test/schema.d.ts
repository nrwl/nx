export interface ComponentTestSchema {
  project: string;
  // SomethingComponent
  componentName: string;
  // path from source root to component dir
  // ./src/lib/something
  componentDir: string;
  // file name without ext
  // something.component
  componentFileName: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
