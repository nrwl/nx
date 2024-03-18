import { tsquery } from '@phenomnomnominal/tsquery';
import { ObjectLiteralExpression, PropertyAssignment } from 'typescript';

/**
 * match testing file based on their name file
 */
export const TEST_FILE_PATTERN = new RegExp('.*(spec|test).[jt]sx?$');

/**
 * Match right hand side of `export default` or `module.exports` = statements
 */
export const TS_QUERY_JEST_CONFIG_PREFIX =
  ':matches(ExportAssignment, BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"]))';

export function addTransformerToConfig(
  configContents: string,
  transformer: string
): string {
  // TODO make sure there isn't an existing matching transformer regex
  const transformerConfig = tsquery.query<ObjectLiteralExpression>(
    configContents,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="transform"])`
  );
  if (transformerConfig.length === 0) {
    return tsquery.replace(
      configContents,
      `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression`,
      (node: ObjectLiteralExpression) => {
        return `{
${node.properties.map((p) => p.getText()).join(',\n')},
transform: { ${transformer} }
}`;
      }
    );
  }
  return tsquery.replace(
    configContents,
    `${TS_QUERY_JEST_CONFIG_PREFIX} > ObjectLiteralExpression PropertyAssignment:has(Identifier[name="transform"])`,
    (node: PropertyAssignment) => {
      const transformObject = node.initializer as ObjectLiteralExpression;
      const transformProperties = transformObject.properties
        .map((p) => p.getText())
        .join(',\n');
      return `transform: { ${transformer}, ${transformProperties} }`;
    }
  );
}
