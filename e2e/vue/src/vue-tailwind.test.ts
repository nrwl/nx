import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('vue tailwind support', () => {
  beforeAll(() => {
    newProject({ unsetProjectNameAndRootFormat: false, packages: ['@nx/vue'] });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should setup tailwind and build correctly', async () => {
    const app = uniq('app');

    runCLI(`generate @nx/vue:app ${app} --style=css --no-interactive`);
    runCLI(`generate @nx/vue:setup-tailwind --project=${app}`);

    updateFile(
      `${app}/src/App.vue`,
      `
         <template>
           <h1 className='text-3xl font-bold'>
             Hello TailwindCSS!
           </h1>
         </template>
      `
    );

    runCLI(`build ${app}`);

    const fileArray = listFiles(`dist/${app}/assets`);
    const stylesheet = fileArray.find((file) => file.endsWith('.css'));
    const content = readFile(`dist/${app}/assets/${stylesheet}`);

    // used, not purged
    expect(content).toContain('text-3xl');
    expect(content).toContain('font-bold');
    // unused, purged
    expect(content).not.toContain('text-xl');
  }, 300_000);
});
