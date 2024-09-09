import type { NxReleaseConfiguration } from '../../../config/nx-json';
import { output } from '../../../utils/output';
import type { NxReleaseConfig } from '../config/config';

export function printConfigAndExit({
  userProvidedReleaseConfig,
  nxReleaseConfig,
  isDebug,
}: {
  userProvidedReleaseConfig: NxReleaseConfiguration;
  nxReleaseConfig: NxReleaseConfig;
  isDebug: boolean;
}): any {
  if (isDebug) {
    console.log(
      '============================================================= START FINAL INTERNAL CONFIG'
    );
    console.log(JSON.stringify(nxReleaseConfig, null, 2));
    console.log(
      '============================================================= END FINAL INTERNAL CONFIG'
    );
    console.log('');
    console.log(
      '============================================================= START USER CONFIG'
    );
    console.log(JSON.stringify(userProvidedReleaseConfig, null, 2));
    console.log(
      '============================================================= END USER CONFIG'
    );
    output.log({
      title: 'Resolved Nx Release Configuration',
      bodyLines: [
        'NOTE: --printConfig was set to debug, so the above output contains two different resolved configs:',
        '',
        '- The config immediately above is the user config, the one provided by you in nx.json and/or the programmatic API.',
        '- The config above that is the low level resolved configuration object used internally by nx release. It can be referenced for advanced troubleshooting.',
        '',
        'For the user-facing configuration format, and the full list of available options, please reference https://nx.dev/reference/nx-json#release',
      ],
    });
    process.exit(0);
  }

  console.log(JSON.stringify(userProvidedReleaseConfig, null, 2));

  output.log({
    title: 'Resolved Nx Release Configuration',
    bodyLines: [
      'The above config is the result of merging any nx release config in nx.json and/or the programmatic API.',
      '',
      'For details on the configuration format, and the full list of available options, please reference https://nx.dev/reference/nx-json#release',
    ],
  });
}
