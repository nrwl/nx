import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { checkApp } from './utils';

describe('Next.js Experimental Features', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));

  afterAll(() => cleanupProject());

  it('should be able to define server actions in workspace libs', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nx/next:app ${appName}`);
    runCLI(`generate @nx/next:lib ${libName} --no-interactive`);

    // Update the app to test two scenarios:
    // 1. Workspace lib with server actions through 'use server' directive
    // 2. Workspace with a client component through 'use client' directive
    updateFile(
      `libs/${libName}/src/lib/action.ts`,
      `
        'use server';
        export async function addItem() {
          console.log('adding item');
        }
      `
    );
    updateFile(
      `libs/${libName}/src/lib/${libName}.tsx`,
      `
        'use client';
        import { addItem } from './action';
        export function TestComponent() {
          return (
            <form action={addItem}>
              <button type="submit">Add</button>
            </form>
          );
        };
      `
    );
    updateFile(
      `apps/${appName}/app/page.tsx`,
      `
        import { TestComponent } from '@proj/${libName}';
        export default function Home() {
          return  <TestComponent />;
        }
      `
    );

    updateFile(
      `apps/${appName}/next.config.js`,
      `
      //@ts-check

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { composePlugins, withNx } = require('@nx/next');

      /**
       * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
       **/
      const nextConfig = {
        nx: {
          // Set this to true if you would like to use SVGR
          // See: https://github.com/gregberge/svgr
          svgr: false,
        },
        experimental: {
          serverActions: true
        }
      };

      const plugins = [
        // Add more Next.js plugins to this list if needed.
        withNx,
      ];

      module.exports = composePlugins(...plugins)(nextConfig);
    `
    );

    await checkApp(appName, {
      checkUnitTest: false,
      checkLint: true,
      checkE2E: false,
      checkExport: false,
    });
  }, 300_000);
});
