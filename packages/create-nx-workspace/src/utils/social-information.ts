import { output } from './output.js';

export function printSocialInformation() {
  output.success({
    title: 'Welcome to the Nx community! 👋',
    bodyLines: [
      '🌟 Star Nx on GitHub: https://github.com/nrwl/nx',
      '📢 Stay up to date on X: https://x.com/nxdevtools',
      '💬 Discuss Nx on Discord: https://go.nx.dev/community',
    ],
  });
}
