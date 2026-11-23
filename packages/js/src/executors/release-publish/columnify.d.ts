declare module 'columnify' {
  interface ColumnifyOptions {
    include?: string[];
    showHeaders?: boolean;
  }

  function columnify(
    data: unknown[] | Record<string, unknown>,
    options?: ColumnifyOptions
  ): string;

  export = columnify;
}
