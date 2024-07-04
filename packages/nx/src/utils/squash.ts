import { readFileSync, writeFileSync } from 'fs';
import { updateRebaseFile } from './git-utils';

// This script is used as an editor for git rebase -i

// This is the file which git creates. When this script exits, the updates should be written to this file.
const filePath = process.argv[2];

// Change the second commit from pick to fixup
const contents = readFileSync(filePath).toString();
const newContents = updateRebaseFile(contents);

// Write the updated contents back to the file
writeFileSync(filePath, newContents);
