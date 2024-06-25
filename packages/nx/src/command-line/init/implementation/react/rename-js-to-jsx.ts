import { readFileSync, renameSync } from 'fs-extra';
import { globWithWorkspaceContext } from '../../../../utils/workspace-context';
import { fileExists } from '../../../../utils/fileutils';

// Vite cannot process JSX like <div> or <Header> unless the file is named .jsx or .tsx
export async function renameJsToJsx(appName: string, isStandalone: boolean) {
  const files = await globWithWorkspaceContext(process.cwd(), [
    isStandalone ? 'src/**/*.js' : `apps/${appName}/src/**/*.js`,
  ]);

  files.forEach((file) => {
    if (fileExists(file)) {
      const content = readFileSync(file).toString();
      // Try to detect JSX before renaming to .jsx
      // Files like setupTests.js from CRA should not be renamed
      if (/<[a-zA-Z0-9]+/.test(content)) {
        renameSync(file, `${file}x`);
      }
    }
  });
}
