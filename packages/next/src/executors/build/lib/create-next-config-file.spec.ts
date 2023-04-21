import { getWithNxContent } from './create-next-config-file';
import { stripIndents } from '@nx/devkit';

describe('Next.js config: getWithNxContent', () => {
  it('should swap distDir and getWithNxContext with static values', () => {
    const result = getWithNxContent({
      withNxFile: `with-nx.js`,
      withNxContent: stripIndents`
      // SHOULD BE LEFT INTACT
      const constants = require("next/constants"); 
      
      // TO BE SWAPPED
      function getWithNxContext() {
        const { workspaceRoot, workspaceLayout } = require('@nx/devkit');
        return {
            workspaceRoot,
            libsDir: workspaceLayout().libsDir,
        };
      }
      
      // SHOULD BE LEFT INTACT
      function withNx(nextConfig = {}, context = getWithNxContext()) {
        return (phase) => {
          if (phase === constants.PHASE_PRODUCTION_SERVER) {
            //...
          } else {
           // ...
          }
        };
      }
      
      // SHOULD BE LEFT INTACT
      module.exports.withNx = withNx;
      `,
    });

    expect(result).toContain(`const constants = require("next/constants")`);
    expect(result).toContain(stripIndents`
      // SHOULD BE LEFT INTACT
      function withNx(nextConfig = {}, context = getWithNxContext()) {
        return (phase) => {
          if (phase === constants.PHASE_PRODUCTION_SERVER) {
            //...
          } else {
           // ...
          }
        };
      }
      
      // SHOULD BE LEFT INTACT
      module.exports.withNx = withNx;
    `);
    expect(result).not.toContain(
      `const { workspaceRoot, workspaceLayout } = require('@nx/devkit');`
    );
    expect(result).toContain(`libsDir: ''`);
    expect(result).not.toContain(`libsDir: workspaceLayout.libsDir()`);
  });
});
