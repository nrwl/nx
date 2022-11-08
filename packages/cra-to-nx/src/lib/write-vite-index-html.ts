import * as fs from 'fs';

export function writeViteIndexHtml(appName: string) {
  fs.writeFileSync(
    `apps/${appName}/index.html`,
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
    <script type="module" src="/src/index.jsx"></script>
  </body>
</html>`
  );
}
