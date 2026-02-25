declare module 'concat-with-sourcemaps' {
  class Concat {
    constructor(
      generateSourceMap: boolean,
      outputFileName: string,
      separator?: string
    );

    /**
     * Add a file to the output
     * @param filePath - Relative path to the file
     * @param content - File content
     * @param sourceMap - Source map JSON string (optional)
     */
    add(filePath: string, content: string | Buffer, sourceMap?: string): void;

    /**
     * The concatenated content
     */
    readonly content: Buffer;

    /**
     * The combined source map (as JSON string)
     */
    readonly sourceMap: string | undefined;
  }

  export = Concat;
}
