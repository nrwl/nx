export interface PackageDependencies {
  dependencies: DependencyEntries;
  devDependencies: DependencyEntries;
}

export interface DependencyEntries {
  [module: string]: string;
}
