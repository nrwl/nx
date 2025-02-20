export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  export?: boolean;

  /**
   * @deprecated Provide the full file path including the file extension in the `path` option. This option will be removed in Nx v21.
   */
  js?: boolean;
}
