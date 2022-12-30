import { Readable, Writable } from 'stream';

export async function htmlRewritingStream(content: string): Promise<{
  rewriter: import('parse5-html-rewriting-stream');
  transformedContent: Promise<string>;
}> {
  const chunks: Buffer[] = [];
  const rewriter = new (await import('parse5-html-rewriting-stream'))();

  return {
    rewriter,
    transformedContent: new Promise((resolve) => {
      new Readable({
        encoding: 'utf8',
        read(): void {
          this.push(Buffer.from(content));
          this.push(null);
        },
      })
        .pipe(rewriter)
        .pipe(
          new Writable({
            write(
              chunk: string | Buffer,
              encoding: string | undefined,
              callback: Function
            ): void {
              chunks.push(
                typeof chunk === 'string'
                  ? Buffer.from(chunk, encoding as BufferEncoding)
                  : chunk
              );
              callback();
            },
            final(callback: (error?: Error) => void): void {
              callback();
              resolve(Buffer.concat(chunks).toString());
            },
          })
        );
    }),
  };
}
