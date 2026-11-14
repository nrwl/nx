import { join } from 'node:path';
import * as ts from 'typescript';
import { readJsonFile } from '../utils/fileutils';

const schemasDir = join(__dirname, '../../schemas');
const nxSchema = readJsonFile(join(schemasDir, 'nx-schema.json'));
const projectSchema = readJsonFile(join(schemasDir, 'project-schema.json'));

const nxJsonSource = join(__dirname, 'nx-json.ts');
const projectJsonSource = join(__dirname, 'workspace-json-project-json.ts');
const program = ts.createProgram([nxJsonSource, projectJsonSource], {
  noEmit: true,
});
const checker = program.getTypeChecker();

function readTypeKeys(file: string, name: string): string[] {
  const declaration = program
    .getSourceFile(file)
    .statements.find(
      (
        statement
      ): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
        (ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text === name
    );
  if (!declaration) {
    throw new Error(`Type ${name} not found in ${file}`);
  }
  return checker
    .getPropertiesOfType(checker.getTypeAtLocation(declaration.name))
    .map((property) => property.name);
}

function dependsOnObjectForms(
  node: unknown,
  pointer = ''
): [string, Record<string, unknown>][] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  const forms = Object.entries(node).flatMap(([key, value]) =>
    dependsOnObjectForms(value, `${pointer}/${key}`)
  );
  const options: any[] = node['dependsOn']?.items?.oneOf ?? [];
  const index = options.findIndex((option) => option.type === 'object');
  if (index !== -1) {
    forms.push([
      `${pointer}/dependsOn/items/oneOf/${index}`,
      options[index].properties,
    ]);
  }
  return forms;
}

function expectSameKeys(
  interfaceKeys: string[],
  schemaProperties: Record<string, unknown>,
  location: string,
  allowed: {
    interfaceOnly?: Record<string, string>;
    schemaOnly?: Record<string, string>;
  } = {}
) {
  const schemaKeys = Object.keys(schemaProperties);
  const interfaceOnly = Object.keys(allowed.interfaceOnly ?? {});
  const schemaOnly = Object.keys(allowed.schemaOnly ?? {});
  expect(
    {
      missingFromSchema: interfaceKeys.filter(
        (key) => !schemaKeys.includes(key) && !interfaceOnly.includes(key)
      ),
      missingFromInterface: schemaKeys.filter(
        (key) => !interfaceKeys.includes(key) && !schemaOnly.includes(key)
      ),
    },
    location
  ).toEqual({ missingFromSchema: [], missingFromInterface: [] });
}

describe('config JSON schemas', () => {
  it.each([
    ['nx-schema.json', nxSchema],
    ['project-schema.json', projectSchema],
  ])(
    'should declare the TargetDependencyConfig properties in every dependsOn object form of %s',
    (file, schema) => {
      const forms = dependsOnObjectForms(schema);

      expect(forms, `no dependsOn object form found in ${file}`).not.toEqual(
        []
      );
      for (const [pointer, properties] of forms) {
        expectSameKeys(
          readTypeKeys(projectJsonSource, 'TargetDependencyConfig'),
          properties,
          `${file}#${pointer}/properties`
        );
      }
    }
  );

  it.each([
    [
      'project-schema.json#/properties/targets/additionalProperties/properties',
      projectSchema.properties.targets.additionalProperties.properties,
    ],
    [
      'nx-schema.json#/definitions/targetDefaultsConfig/properties',
      nxSchema.definitions.targetDefaultsConfig.properties,
    ],
  ])(
    'should declare the TargetConfiguration properties at %s',
    (location, properties) => {
      expectSameKeys(
        readTypeKeys(projectJsonSource, 'TargetConfiguration'),
        properties,
        location
      );
    }
  );

  it('should declare the TargetDefaultArrayEntry properties in the nx.json target defaults array entry', () => {
    expectSameKeys(
      readTypeKeys(nxJsonSource, 'TargetDefaultArrayEntry'),
      nxSchema.definitions.targetDefaultArrayEntry.properties,
      'nx-schema.json#/definitions/targetDefaultArrayEntry/properties'
    );
  });

  it('should declare the NxJsonConfiguration properties at the nx.json schema root', () => {
    expectSameKeys(
      readTypeKeys(nxJsonSource, 'NxJsonConfiguration'),
      nxSchema.properties,
      'nx-schema.json#/properties',
      {
        interfaceOnly: {
          $schema: 'Points editors at this schema, not an Nx setting',
        },
        schemaOnly: {
          conformance:
            'Read by the Powerpack @nx/conformance plugin, not by Nx core',
          owners: 'Read by the Powerpack @nx/owners plugin, not by Nx core',
        },
      }
    );
  });
});
