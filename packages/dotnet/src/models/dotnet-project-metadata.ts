export interface DotnetProjectMetadata {
  /** Omitted when evaluated framework package identities disagree or none is available. */
  packageId?: string;
  targetFrameworks: DotnetTargetFrameworkMetadata[];
}

export interface DotnetTargetFrameworkMetadata {
  /** Evaluated `PackageId`, falling back to `AssemblyName` when unset. */
  packageId?: string;
  targetFramework: string;
  targetFrameworkIdentifier?: string;
  targetFrameworkVersion?: string;
  targetPlatformIdentifier?: string;
  targetPlatformVersion?: string;
  runtimeIdentifier?: string;
  runtimeIdentifiers: string[];
  capabilities: DotnetCapabilities;
}

export interface DotnetCapabilities {
  test: boolean;
  executable: boolean;
  packable: boolean;
  publishable: boolean;
  tool: boolean;
}
