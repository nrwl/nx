import { ChildProcess, exec, execSync, spawn } from 'node:child_process';
import { LARGE_BUFFER } from 'nx/src/executors/run-commands/run-commands.impl';

(async function populateLocalRegistry() {
  try {
    const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
    const verdaccio = await startVerdaccio();

    console.log('Publishing packages to local registry');
    const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
    await new Promise<void>((res, rej) => {
      const publishProcess = exec(`pnpm nx-release --local ${publishVersion}`, {
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      });
      let logs = Buffer.from('');
      if (isVerbose) {
        publishProcess?.stdout?.pipe(process.stdout);
        publishProcess?.stderr?.pipe(process.stderr);
      } else {
        publishProcess?.stdout?.on('data', (data) => (logs += data));
        publishProcess?.stderr?.on('data', (data) => (logs += data));
      }
      publishProcess.on('exit', (code) => {
        if (code && code > 0) {
          if (!isVerbose) {
            console.log(logs.toString());
          }
          rej(code);
        }
        res();
      });
    });
    process.kill(-verdaccio.pid!); // Kill the entire process group
  } catch (err) {
    console.error('Error:', err);
    process.exit(1); // Exit with an error code
  }
})();

function startVerdaccio() {
  return new Promise<ChildProcess>((resolve, reject) => {
    const verdaccio = spawn('pnpm', ['exec', 'nx', 'local-registry'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    });

    const handleOutput = (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('http address -')) {
        resolve(verdaccio);
        verdaccio.stdout.off('data', handleOutput);
        verdaccio.stderr.off('data', handleOutput);
      }
    };

    verdaccio.stdout.on('data', handleOutput);
    verdaccio.stderr.on('data', handleOutput);

    verdaccio.on('error', (err) => {
      reject(err);
    });

    verdaccio.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });

    // Allow the parent script to exit independently of the child
    verdaccio.unref();
  });
}
