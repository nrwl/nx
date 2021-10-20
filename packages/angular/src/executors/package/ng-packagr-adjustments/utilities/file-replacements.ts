import {
  fileExists,
  renameSync,
  writeToFile,
} from '@nrwl/workspace/src/utilities/fileutils';

import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

interface FileReplacement {
  replace: string;
  with: string;
}

interface ReplacedFile {
  filePath: string;
  fileData: string;
}

export function performFileReplacements(
  fileReplacements: FileReplacement[],
  workspaceRoot: string
) {
  fileReplacements = fileReplacements.map((replacement) => ({
    replace: join(workspaceRoot, replacement.replace),
    with: join(workspaceRoot, replacement.with),
  }));

  const filesToReplace = [];

  for (const replacement of fileReplacements) {
    if (!fileExists(replacement.replace) || !fileExists(replacement.with)) {
      console.warn(
        `WARNING: Could not replace '${replacement.replace}' with '${replacement.with}' as one or both of the files do not exist.`
      );
    }
    filesToReplace.push(replacement);
  }

  const replacedFiles: { filePath: string; fileData: string }[] = [];
  for (const { replace } of filesToReplace) {
    replacedFiles.push({
      filePath: replace,
      fileData: readFileSync(replace, { encoding: 'utf-8' }),
    });
  }

  process.on('exit', () => undoFileReplacements(filesToReplace, replacedFiles));

  for (const replacement of filesToReplace) {
    unlinkSync(replacement.replace);
    renameSync(replacement.with, replacement.replace, (error: Error) => {
      if (error !== null) {
        console.error(
          'An error occured when attempting to perform file replacments. See the error below for more details.'
        );
        console.error(error);
      }
    });
  }
}

export function undoFileReplacements(
  fileReplacements: FileReplacement[],
  replacedFiles: ReplacedFile[]
) {
  for (const replacement of fileReplacements) {
    renameSync(replacement.replace, replacement.with, (error: Error) => {
      console.error(
        'An error occured when attempting to perform file replacments. See the error below for more details.'
      );
      console.error(error);
    });
  }

  for (const { filePath, fileData } of replacedFiles) {
    try {
      writeToFile(filePath, fileData);
    } catch (error) {
      console.error(
        `An error occurred when restoring a replaced file: '${filePath}'. See the error below for more details.`
      );
      console.error(error);
    }
  }
}
