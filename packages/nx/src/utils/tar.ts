import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'path';
import * as tar from 'tar-stream';
import { createGunzip } from 'zlib';

/**
 * Extracts a file from a given tarball to the specified destination.
 * @param tarballPath The path to the tarball from where the file should be extracted.
 * @param file The path to the file inside the tarball.
 * @param destinationFilePath The destination file path.
 * @returns True if the file was extracted successfully, false otherwise.
 */
export async function extractFileFromTarball(
  tarballPath: string,
  file: string,
  destinationFilePath: string
) {
  return new Promise<string>((resolve, reject) => {
    mkdirSync(dirname(destinationFilePath), { recursive: true });
    var tarExtractStream = tar.extract();
    const destinationFileStream = createWriteStream(destinationFilePath);

    let isFileExtracted = false;
    tarExtractStream.on('entry', function (header, stream, next) {
      if (header.name === file) {
        stream.pipe(destinationFileStream);
        stream.on('end', () => {
          isFileExtracted = true;
        });
        destinationFileStream.on('close', () => {
          resolve(destinationFilePath);
        });
      }

      stream.on('end', function () {
        next();
      });

      stream.resume();
    });

    tarExtractStream.on('finish', function () {
      if (!isFileExtracted) {
        reject();
      }
    });

    createReadStream(tarballPath).pipe(createGunzip()).pipe(tarExtractStream);
  });
}
