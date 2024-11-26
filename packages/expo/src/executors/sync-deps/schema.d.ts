export interface ExpoSyncDepsOptions {
  include: string[] | string; // default is an empty array []
  exclude: string[] | string; // default is an empty array []
  all: boolean; // default is false
  excludeImplicit: boolean; // default is false
}
