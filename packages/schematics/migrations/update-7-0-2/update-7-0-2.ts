import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

function fixKarmaConf(host: Tree, context: SchematicContext) {
  if (!host.exists('karma.conf.js')) {
    context.logger.warn(`Could not find ./karma.conf.js`);
    context.logger.warn(
      'It is recommended that your karma configuration sets autoWatch: true'
    );
    return host;
  }

  const originalContent = host.read('karma.conf.js').toString();
  const content = originalContent.replace(
    'autoWatch: false',
    'autoWatch: true'
  );
  if (content.includes('autoWatch: true')) {
    host.overwrite('karma.conf.js', content);
  } else {
    context.logger.warn('Could not alter ./karma.conf.js');
    context.logger.warn(
      'It is recommended that your karma configuration sets autoWatch: true'
    );
  }

  return host;
}

export default function(): Rule {
  return fixKarmaConf;
}
