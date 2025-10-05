import { Canvas, Image, SKRSContext2D } from '@napi-rs/canvas';
import { PackageMetadata } from '../../../nx-dev/models-package/src/lib/package.models';
import {
  ensureDir,
  readFile,
  readJSONSync,
  writeFileSync,
  copyFileSync,
} from 'fs-extra';
import { resolve } from 'path';

const mapJson = readJSONSync('./docs/map.json', 'utf8').content;

// Helper function to recursively process items including technologies
function processItemRecursively(
  item: any,
  parentIds: string[] = [],
  data: any[]
) {
  const idPath = [...parentIds, item.id].filter(Boolean);
  const filename = idPath.join('-');

  data.push({
    title: item.name,
    content: item.description || (parentIds.length > 0 ? parentIds[0] : ''),
    mediaImage: item.mediaImage,
    filename: filename,
  });

  if (Array.isArray(item.itemList)) {
    item.itemList.forEach((subItem) => {
      processItemRecursively(subItem, idPath, data);
    });
  }
}

const documents: any[] = [];

const nxDocSection = mapJson.find((x) => x.id === 'nx-documentation');
if (nxDocSection) {
  nxDocSection.itemList.forEach((item) => {
    processItemRecursively(item, [], documents);
  });
}

const extendingSection = mapJson.find((x) => x.id === 'extending-nx');
if (extendingSection) {
  extendingSection.itemList.forEach((item) => {
    processItemRecursively(item, ['extending-nx'], documents);
  });
}

const ciSection = mapJson.find((x) => x.id === 'ci');
if (ciSection) {
  ciSection.itemList.forEach((item) => {
    processItemRecursively(item, ['ci'], documents);
  });
}

const packages: PackageMetadata[] = [
  ...readJSONSync(
    resolve(__dirname, '../../../', `./docs/generated/packages-metadata.json`)
  ),
  ...readJSONSync(
    resolve(
      __dirname,
      '../../../',
      `./docs/external-generated/packages-metadata.json`
    )
  ),
];
const targetFolder: string = resolve(
  __dirname,
  '../../../',
  `./nx-dev/nx-dev/public/images/open-graph`
);

const data: {
  title: string;
  content: string;
  mediaImage?: string;
  filename: string;
}[] = documents;

// Add package data
packages.map((pkg) => {
  data.push({
    title: pkg.packageName,
    content: 'Package details',
    filename: ['packages', pkg.name].join('-'),
  });
  pkg.documents.map((document) => {
    data.push({
      title: document.name,
      content: pkg.packageName,
      filename: ['packages', pkg.name, 'documents', document.id].join('-'),
    });
  });
  pkg.executors.map((executor) => {
    data.push({
      title: executor.name,
      content: pkg.packageName,
      filename: ['packages', pkg.name, 'executors', executor.name].join('-'),
    });
  });
  pkg.generators.map((generator) => {
    data.push({
      title: generator.name,
      content: pkg.packageName,
      filename: ['packages', pkg.name, 'generators', generator.name].join('-'),
    });
  });
});

const TITLE_LINE_HEIGHT = 60;
const SUB_LINE_HEIGHT = 38;

function createOpenGraphImage(
  backgroundImagePath: string,
  targetFolder: string,
  title: string,
  content: string,
  filename: string
): Promise<void> {
  const addBackground = readFile(backgroundImagePath).then((content) => {
    const image = new Image();
    image.src = content;
    image.width = 1200;
    image.height = 630;

    return image;
  });

  return addBackground.then((image) => {
    const canvas = new Canvas(1200, 630);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 1200, 630);

    context.font = 'bold 50px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#FFFFFF';
    const titleLines = splitLines(context, title.toUpperCase(), 1100);
    titleLines.forEach((line, index) => {
      context.fillText(line, 600, 220 + index * TITLE_LINE_HEIGHT);
    });

    context.font = 'normal 32px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#F8FAFC';

    const lines = splitLines(context, content, 1100);
    lines.forEach((line, index) => {
      context.fillText(
        line,
        600,
        310 + index * SUB_LINE_HEIGHT + titleLines.length * TITLE_LINE_HEIGHT
      );
    });

    console.log('Generating: ', `${filename}.jpg`);

    return writeFileSync(
      resolve(targetFolder + `/${filename}.jpg`),
      canvas.toBuffer('image/jpeg')
    );
  });
}

function copyImage(
  backgroundImagePath: string,
  targetFolder: string,
  filename: string
) {
  const splits = backgroundImagePath.split('.');
  const extension = splits[splits.length - 1];
  copyFileSync(
    backgroundImagePath,
    resolve(targetFolder, `./${filename}.${extension}`)
  );
}

function splitLines(
  context: SKRSContext2D,
  text: string,
  maxWidth: number
): string[] {
  // calculate line splits
  const words = text.split(' ');
  if (words.length <= 1) {
    return words;
  }
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const newLine = `${currentLine} ${word}`;
    if (context.measureText(newLine).width < maxWidth) {
      currentLine = newLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  return lines;
}

console.log(
  'Generated images will be on this path:\n',
  resolve(targetFolder, '\n\n')
);

ensureDir(targetFolder).then(() =>
  data.map((item) =>
    item.mediaImage
      ? copyImage(
          resolve(__dirname, '../../../docs/' + item.mediaImage),
          targetFolder,
          item.filename
        )
      : createOpenGraphImage(
          resolve(__dirname, './media.jpg'),
          targetFolder,
          item.title,
          item.content,
          item.filename
        )
  )
);
