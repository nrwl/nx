import { exec, execSync } from 'child_process';
import { dirSync } from 'tmp';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import * as path from 'path';

describe('create-nx-workspace', () => {
  afterEach(() => {
    execSync(`yarn local-registry disable`);
  });

  it('creates a new project', async done => {
    if (!process.env.PUBLISHED_VERSION) {
      console.error(`Please provision the version you are publishing`);
      process.exit(1);
    }

    const tmpFolder = dirSync().name;
    const workspaceDir = `${tmpFolder}/happyorg`;

    await startRegistry();
    await execCommand('Enabling local registry', `yarn local-registry enable`);
    await execCommand(
      'Publishing packages',
      `yarn nx-release ${process.env.PUBLISHED_VERSION} --local`
    );

    await wait(3000);

    await execCommand(
      `Create a workspace in "${workspaceDir}"`,
      `npx create-nx-workspace@${process.env.PUBLISHED_VERSION} happyorg --preset=angular --appName=ngapp --style=css`,
      tmpFolder
    );
    await execCommand(
      'Add ngrx to the Angular app',
      `ng g @nrwl/angular:ngrx state --module=apps/ngapp/src/app/app.module.ts --root`,
      workspaceDir
    );

    await addReact(workspaceDir);
    await execCommand(
      `Generate a React app`,
      `ng g @nrwl/react:app reactapp`,
      workspaceDir
    );
    await execCommand(`Building angular app`, `ng build ngapp`, workspaceDir);
    await execCommand(`Building react app`, `ng build reactapp`, workspaceDir);

    const webpacks = allVersionsOf(workspaceDir, 'webpack');
    if (webpacks.length > 1) {
      console.log(`more than one version of webpack: ${webpacks.join(', ')}`);
    }
    expect(webpacks.length).toEqual(1);

    // filtering out rxjs in the listr package.
    const rxjs = allVersionsOf(workspaceDir, 'rxjs').filter(
      value => value !== '5.5.12'
    );
    if (rxjs.length > 1) {
      console.log(`more than one version of rxjs: ${rxjs.join(', ')}`);
    }
    expect(rxjs.length).toEqual(1);

    console.log('The automatic tests have passed.');
    console.log(
      `Go to "${workspaceDir}" to verify that the workspace works as expected`
    );

    done();
  }, 520000);
});

function wait(value = 500) {
  return new Promise(r => {
    setTimeout(() => r(), value);
  });
}

function startRegistry() {
  return new Promise((res, rej) => {
    const server = exec('yarn local-registry start');
    server.stdout.on('data', d => {
      if (d.toString().indexOf('http address') > -1) {
        res();
      }
    });

    server.on('exit', s => {
      if (s !== 0) {
        rej(`Cannot start local registry`);
      }
    });
  });
}

function allVersionsOf(dir: string, packageToCheck: string) {
  const r = packageJsonFilesInNodeModules(`${dir}/node_modules`)
    .map(p => {
      try {
        const parsed = JSON.parse(readFileSync(p).toString());
        if (parsed.name == packageToCheck) {
          return parsed.version;
        }
        return null;
      } catch (e) {
        return null;
      }
    })
    .filter(p => !!p);
  return r.filter((value, index, self) => self.indexOf(value) === index);
}

function addReact(workspaceDir: string) {
  const packageJson = JSON.parse(
    readFileSync(`${workspaceDir}/package.json`).toString()
  );
  packageJson.dependencies[`@nrwl/react`] = process.env.PUBLISHED_VERSION;
  writeFileSync(
    `${workspaceDir}/package.json`,
    JSON.stringify(packageJson, null, 2)
  );
  execSync(`npm install --registry=http://localhost:4873/`, {
    stdio: [0, 1, 2],
    cwd: workspaceDir
  });
}

async function execCommand(description: string, cmd: string, cwd?: string) {
  console.log(description);
  execSync(`npm_config_registry=http://localhost:4873/ && ${cmd}`, {
    stdio: [0, 1, 2],
    cwd
  });
  await wait();
}

function packageJsonFilesInNodeModules(dirName: string): string[] {
  let res = [];
  try {
    readdirSync(dirName).forEach(c => {
      try {
        const child = path.join(dirName, c);
        const s = statSync(child);
        if (child.endsWith('package.json')) {
          res.push(child);
        } else if (s.isDirectory()) {
          res = [...res, ...packageJsonFilesInNodeModules(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}
