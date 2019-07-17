import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

function updateJestConfig(host: Tree, context: SchematicContext) {
  if (!host.exists('jest.config.js')) {
    context.logger.warn(`Could not find ./jest.config.js`);
    context.logger.warn(
      'It is recommended that your jest.config.js configuration sets collectCoverage: false'
    );
    return host;
  }

  const originalContent = host.read('jest.config.js').toString();
  const content = originalContent.replace(
    'collectCoverage: true',
    'collectCoverage: false'
  );
  if (content.includes('collectCoverage: false')) {
    host.overwrite('jest.config.js', content);
  } else {
    context.logger.warn('Could not alter ./jest.config.js');
    context.logger.warn(
      'It is recommended that your jest.config.js configuration sets collectCoverage: false'
    );
  }

  return host;
}

export default function(): Rule {
  return updateJestConfig;
}
