import { Tree } from '@nrwl/devkit';

export function updateDecorateAngularCLI(host: Tree) {
  const decorate = host.read('decorate-angular-cli.js')?.toString();
  if (decorate) {
    host.write(
      'decorate-angular-cli.js',
      decorate.replace('@nrwl/cli/lib/decorate-cli', 'nx/src/cli/decorate-cli')
    );
  }
}

export default updateDecorateAngularCLI;
