import { readJsonSync } from 'fs-extra';
import * as glob from 'glob';
import * as chalk from 'chalk';

console.log(`${chalk.blue('i')} Documentation Map Check`);

const basePath = 'docs';
const sharedFilesPattern = 'shared/cli';

const readmePathList: string[] = glob
  .sync(`${basePath}/**/*.md`)
  .map((path: string) => path.split(basePath)[1])
  .map((path: string) => path.slice(1, -3)) // Removing first `/` and `.md`
  .filter((path: string) => !path.startsWith(sharedFilesPattern));

function pathExtractor(
  pathList: string[] = [],
  item: any,
  currentPath: string = ''
): string[] {
  currentPath = currentPath ? [currentPath, item.id].join('/') : item.id;
  if (item.itemList) {
    return item.itemList
      .map((i: any) => pathExtractor(pathList, i, currentPath))
      .flat();
  }
  if (item.file) {
    pathList.push(item.file);
    return pathList;
  }
  pathList.push(currentPath);
  return pathList;
}

const mapPathList: string[] = readJsonSync(`${basePath}/map.json`)
  .map((file: any) => pathExtractor([], file, ''))
  .flat()
  .filter(
    // Removing duplicates
    (item: string, index: number, array: string[]) =>
      array.indexOf(item) === index
  )
  .filter((item: string) => item.split('/').length > 1); // Removing "category" paths (not linked to a file)

const readmeMissList = readmePathList.filter((x) => !mapPathList.includes(x));
const mapMissList = mapPathList.filter((x) => !readmePathList.includes(x));

let scriptError = false;

if (!!readmeMissList.length) {
  console.error(
    chalk.red(
      "\n⚠️  Documentation files and 'map.json' file are out of sync!\n"
    )
  );
  console.log(readmeMissList.map((x) => x.concat('.md')).join('\n'));
  console.error(
    chalk.red(
      `\nSome documentation files exist without any reference in \'map.json\', make sure to add an entry.`
    )
  );
  scriptError = true;
} else {
  console.log(
    `${chalk.green('✓')} Markdown files are in sync with ${chalk.grey(
      'docs/maps.json'
    )}.`
  );
}

if (!!mapMissList.length) {
  console.log(
    `\n${chalk.red(
      'ERROR'
    )} The 'map.json' file and the documentation files are out of sync!\n`
  );
  console.log(mapMissList.map((x) => x.concat('.md')).join('\n'));
  console.log(
    `\n${chalk.red(
      'ERROR'
    )} The \'map.json\' file is linking documenation files that do not exist.`
  );
  scriptError = true;
} else {
  console.log(
    `${chalk.green(
      '✓'
    )} The 'map.json' file and the documentation files are in sync.`
  );
}

if (scriptError) {
  process.exit(1);
}
