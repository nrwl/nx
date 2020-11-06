import * as chalk from 'chalk';
import * as fs from 'fs';
import * as shell from 'shelljs';

const { green, red } = chalk.default;
const basePath = 'docs';

const readmePathList: string[] = shell
  .ls(`${basePath}/**/*.md`)
  .map((path) => path.split(basePath)[1])
  .map((path) => path.slice(1, -3)); // Removing first `/` and `.md`

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
const mapPathList: string[] = JSON.parse(
  fs.readFileSync(`${basePath}/map.json`, { encoding: 'utf8' })
)
  .map((file: any) => pathExtractor([], file, ''))
  .flat()
  .filter(
    // Removing duplicates
    (item: string, index: number, array: string[]) =>
      array.indexOf(item) === index
  )
  .filter((item: string) => item.split('/').length > 1); // Removing "category" paths (not linked to a file)

const readmeMissList = readmePathList.filter((x) => !mapPathList.includes(x));

if (!!readmeMissList.length) {
  console.error(
    red("Documentation files and 'map.json' file are out of sync!\n")
  );
  console.log(readmeMissList.map((x) => x.concat('.md')).join('\n'));
  console.error(
    red(
      `\nSome documentation files exist without any reference in \'map.json\', make sure to add an entry.`
    )
  );
  process.exit(1);
} else {
  console.log(
    green("Markdown files are in sync with 'map.json', everything is good 👍")
  );
  process.exit(0);
}

const mapMissList = mapPathList.filter((x) => !readmePathList.includes(x));

if (!!mapMissList.length) {
  console.error(
    red("The 'map.json' file and the documentation files are out of sync!\n")
  );
  console.log(mapMissList.map((x) => x.concat('.md')).join('\n'));
  console.error(
    red(
      `\nThe \'map.json\' file is linking documenation files that do not exist.`
    )
  );
  process.exit(1);
} else {
  console.log(
    green(
      "The 'map.json' file and the documentation files are in sync, everything is good 👍"
    )
  );
  process.exit(0);
}
