import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export function getFileTemplate() {
  return stripIndents`
      const variable = "<%= projectName %>";
    `;
}
