import {
  cleanupProject,
  createFile,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('NextJs SVGR support', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/next'],
    });
  });

  afterAll(() => cleanupProject());

  it('should allow both SVG asset and SVGR component to be used', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --appDir=true --src=true`
    );
    createFile(
      `apps/${appName}/src/app/nx.svg`,
      `
        <svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
          <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG for app</text>
        </svg>
      `
    );
    updateFile(
      `apps/${appName}/src/app/page.tsx`,
      `
      import Image from 'next/image';
      import svgImg, { ReactComponent as Logo } from './nx.svg';
      export default async function Index() {
        return (
          <>
            <Image src={svgImg} alt="Alt for SVG img tag" />
            <Logo />
          </>
        );
      }
    `
    );
    updateFile(
      `apps/${appName}/next.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/next');
      const nextConfig = {
        nx: {
          svgr: true,
        },
      };
      const plugins = [
        withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
    `
    );

    runCLI(`build ${appName}`);

    const pageFile = readFile(`apps/${appName}/.next/server/app/page.js`);
    const svgFile = listFiles(`apps/${appName}/.next/static/media`).find((f) =>
      /nx\.[a-z0-9]+\.svg$/.test(f)
    );
    expect(`apps/${appName}/.next/static/chunks/app/${pageFile}`).toMatch(
      /SVG for app/
    );
    expect(`apps/${appName}/.next/static/chunks/app/${pageFile}`).toMatch(
      /Alt for SVG img tag/
    );
    expect(svgFile).toBeTruthy();
  });

  it('should allow both SVG asset and SVGR component to be used (using SvgrOptions)', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --appDir=true --src=true`
    );
    createFile(
      `apps/${appName}/src/app/nx.svg`,
      `
        <svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
          <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG for app</text>
        </svg>
      `
    );
    updateFile(
      `apps/${appName}/src/app/page.tsx`,
      `
      import Image from 'next/image';
      import svgImg, { ReactComponent as Logo } from './nx.svg';
      export default async function Index() {
        return (
          <>
            <Image src={svgImg} alt="Alt for SVG img tag" />
            <Logo />
          </>
        );
      }
    `
    );
    updateFile(
      `apps/${appName}/next.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/next');
      const nextConfig = {
        nx: {
          svgr: {
            svgo: false,
            titleProp: true,
            ref: true,
          },
        },
      };
      const plugins = [
        withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
    `
    );

    runCLI(`build ${appName}`);

    const pageFile = readFile(`apps/${appName}/.next/server/app/page.js`);
    const svgFile = listFiles(`apps/${appName}/.next/static/media`).find((f) =>
      /nx\.[a-z0-9]+\.svg$/.test(f)
    );
    expect(`apps/${appName}/.next/static/chunks/app/${pageFile}`).toMatch(
      /SVG for app/
    );
    expect(`apps/${appName}/.next/static/chunks/app/${pageFile}`).toMatch(
      /Alt for SVG img tag/
    );
    expect(svgFile).toBeTruthy();
  });
});
