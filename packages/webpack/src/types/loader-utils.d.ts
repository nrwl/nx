declare module 'loader-utils' {
  export function getHashDigest(
    buffer: string | Buffer,
    hashType?: string,
    digestType?: string,
    maxLength?: number
  ): string;

  export function interpolateName(
    loaderContext: { resourcePath: string; rootContext?: string },
    name: string,
    options?: {
      context?: string;
      content?: string | Buffer;
      regExp?: string | RegExp;
    }
  ): string;
}
