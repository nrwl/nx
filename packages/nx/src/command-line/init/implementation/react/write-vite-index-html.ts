import { copyFileSync, existsSync, writeFileSync } from 'fs';

export function writeViteIndexHtml(
  appName: string,
  isStandalone: boolean,
  isJs: boolean
) {
  const indexPath = isStandalone ? 'index.html' : `apps/${appName}/index.html`;
  if (existsSync(indexPath)) {
    copyFileSync(indexPath, indexPath + '.old');
  }
  const indexFile = isJs ? '/src/index.jsx' : '/src/index.tsx';
  writeFileSync(
    indexPath,
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + Nx</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${indexFile}"></script>
  </body>
</html>`
  );
}
