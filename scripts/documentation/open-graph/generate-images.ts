import { ensureDir, readFile, readFileSync, writeFileSync } from 'fs-extra';
import { resolve } from 'path';
import { GlobalFonts, Canvas, Image, SKRSContext2D } from '@napi-rs/canvas';

const documents: any[] = require('../../../docs/map.json')[0]['itemList'];
const targetFolder: string = resolve(
  __dirname,
  '../../../',
  `./nx-dev/nx-dev/public/images/open-graph`
);

const data: { title: string; content: string; filename: string }[] = [];
documents.map((category) => {
  category.itemList.map((item) =>
    data.push({
      title: category.name,
      content: item.name,
      filename: [category.id, item.id].join('-'),
    })
  );
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

    context.font = 'bold 52px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#fff';
    context.fillText('Documentation', 600, 112);

    context.font = 'bold 48px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#fff';
    context.fillText(title.toUpperCase() + ':', 600, 260);

    context.font = 'bold 42px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#fff';

    const truncate = (str, n) =>
      str.length > n ? str.substring(0, n) + '…' : str;
    context.fillText(truncate(content, 40), 600, 372);

    console.log('Generating: ' + resolve(targetFolder + `/${filename}.jpg`));

    return writeFileSync(
      resolve(targetFolder + `/${filename}.jpg`),
      canvas.toBuffer('image/jpeg')
    );
  });
}

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
