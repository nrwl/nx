import { Canvas, Image, SKRSContext2D } from '@napi-rs/canvas';
import { PackageMetadata } from '../../../nx-dev/models-package/src/lib/package.models';
import { ensureDir, readFile, readJSONSync, writeFileSync } from 'fs-extra';
import { resolve } from 'path';

const mapJson = readJSONSync('./docs/map.json', 'utf8').content;

const documents: any[] = [
  ...mapJson.find((x) => x.id === 'nx-documentation')?.['itemList'],
].filter(Boolean);

const packages: PackageMetadata[] = readJSONSync(
  resolve(__dirname, '../../../', `./docs/generated/packages-metadata.json`)
);
const targetFolder: string = resolve(
  __dirname,
  '../../../',
  `./nx-dev/nx-dev/public/images/open-graph`
);

const data: { title: string; content: string; filename: string }[] = [];
documents.map((category) => {
  data.push({
    title: category.name,
    content: category.description,
    filename: [category.id].join('-'),
  });
  category.itemList.map((item) =>
    data.push({
      title: item.name,
      content: category.name,
      filename: [category.id, item.id].join('-'),
    })
  );
});
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
    context.fillStyle = '#0F172A';
    context.fillText(title.toUpperCase(), 600, 220);

    context.font = 'normal 32px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#334155';

    const lines = splitLines(context, content, 1100);
    lines.forEach((line, index) => {
      context.fillText(line, 600, 310 + index * 55);
    });

    console.log('Generating: ', `${filename}.jpg`);

    return writeFileSync(
      resolve(targetFolder + `/${filename}.jpg`),
      canvas.toBuffer('image/jpeg')
    );
  });
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
  const lines = [];
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
    createOpenGraphImage(
      resolve(__dirname, './media.jpg'),
      targetFolder,
      item.title,
      item.content,
      item.filename
    )
  )
);
