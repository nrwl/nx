import {
  getDescriptionForSchema,
  getSchemaFromResult,
  Lookup,
  LookupResult,
} from '@nx/nx-dev/data-access-packages';
import { JsonSchema, JsonSchema1 } from '@nx/nx-dev/models-package';
import { ParameterView } from './parameter-view';
import { shouldShowInStage, Stage } from './stage';
import { Type } from './types/type';

interface PropertySchema extends JsonSchema1 {
  alias?: string;
  'x-deprecated'?: boolean;
  'x-priority'?: 'important' | 'internal';
}

interface PropertyModel {
  alias: string;
  initialSchema: PropertySchema;
  isRequired: boolean;
  lookupResult: LookupResult;
  propertyName: string;
  propertyReference: string;
}

const isPropertyDeprecated = (schema: PropertySchema | JsonSchema): boolean =>
  typeof schema === 'boolean' ? false : !!schema['x-deprecated'];
const getPropertyAlias = (schema: PropertySchema | JsonSchema): string => {
  if (typeof schema === 'boolean' || schema.alias === undefined) return '';
  return String(schema.alias);
};

function getViewModel(
  schema: JsonSchema1,
  lookup: Lookup,
  reference: string
): PropertyModel[] {
  const properties = schema.properties || {};
  return Object.keys(properties)
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort properties alphabetically
    .map((propertyName) => {
      const propertySchema = properties[propertyName] as PropertySchema;
      const lookupResult = lookup.getSchema(propertySchema);
      return {
        propertyName,
        alias: propertySchema['alias'] ?? '',
        initialSchema: propertySchema,
        isRequired:
          typeof schema.required !== 'undefined' &&
          !!schema.required.find((n) => n === propertyName),
        lookupResult,
        propertyReference:
          lookupResult?.baseReference ||
          `${reference}/properties/${propertyName}`,
      };
    });
}

function extractPropertiesByImportance(properties: PropertyModel[]): {
  deprecated: PropertyModel[];
  important: PropertyModel[];
  internal: PropertyModel[];
  required: PropertyModel[];
  rest: PropertyModel[];
} {
  const result: {
    deprecated: PropertyModel[];
    important: PropertyModel[];
    internal: PropertyModel[];
    required: PropertyModel[];
    rest: PropertyModel[];
  } = {
    deprecated: [],
    important: [],
    internal: [],
    required: [],
    rest: [],
  };
  for (const property of properties) {
    if (property.isRequired) {
      result.required.push(property);
      continue;
    }
    if (isPropertyDeprecated(property.initialSchema)) {
      result.deprecated.push(property);
      continue;
    }
    if (
      property.initialSchema['x-priority'] &&
      property.initialSchema['x-priority'] === 'important'
    ) {
      result.important.push(property);
      continue;
    }
    if (
      property.initialSchema['x-priority'] &&
      property.initialSchema['x-priority'] === 'internal'
    ) {
      result.internal.push(property);
      continue;
    }
    result.rest.push(property);
  }

  return result;
}

export function SchemaViewer({
  schema,
  reference,
  lookup,
  stage,
}: {
  schema: JsonSchema1;
  reference: string;
  lookup: Lookup;
  stage: Stage;
}): JSX.Element {
  const properties = getViewModel(schema, lookup, reference).filter((p) => {
    if (p.lookupResult === undefined) {
      return true;
    }
    return shouldShowInStage(stage, p.lookupResult.schema);
  });

  const categorizedProperties = extractPropertiesByImportance(properties);

  function renderProps(properties: any[]): JSX.Element[] {
    return properties.map((p) => {
      if (p.lookupResult) {
        return (
          <ParameterView
            key={p.propertyName}
            alias={p.alias}
            name={p.propertyName}
            description={getDescriptionForSchema(p.lookupResult.schema)}
            required={p.isRequired}
            deprecated={isPropertyDeprecated(p.lookupResult.schema)}
            schema={p.lookupResult.schema}
            reference={p.propertyReference}
            lookup={lookup}
          />
        );
      } else {
        return (
          <ParameterView
            key={p.propertyName}
            alias={p.alias}
            deprecated={isPropertyDeprecated(p.initialSchema)}
            name={p.propertyName}
            description={getDescriptionForSchema(p.initialSchema)}
            required={p.isRequired}
            schema={p.initialSchema}
            reference={p.propertyReference}
            lookup={lookup}
          />
        );
      }
    });
  }

  const additionalProperties = new Array<JSX.Element>();
  if (typeof schema.additionalProperties === 'boolean') {
    if (schema.additionalProperties) {
      additionalProperties.push(
        <ParameterView
          key="schema-additional-properties"
          name="Additional Properties"
          description="Extra properties of any type may be provided to this object."
          required={false}
          alias={''}
          deprecated={false}
          schema={{}}
          reference={`${reference}/additionalProperties`}
          lookup={lookup}
        />
      );
    }
  } else if (schema.additionalProperties !== undefined) {
    const additionalPropertiesResult = lookup.getSchema(
      schema.additionalProperties
    );
    if (additionalPropertiesResult !== undefined) {
      const resolvedReference =
        additionalPropertiesResult.baseReference ||
        `${reference}/additionalProperties`;
      additionalProperties.push(
        <ParameterView
          key="schema-additional-properties"
          name="Additional Properties"
          description={getDescriptionForSchema(additionalPropertiesResult)}
          required={false}
          alias={getPropertyAlias(additionalPropertiesResult.schema)}
          deprecated={isPropertyDeprecated(additionalPropertiesResult.schema)}
          schema={additionalPropertiesResult.schema}
          reference={resolvedReference}
          lookup={lookup}
        />
      );
    }
  }

  const patternProperties = schema.patternProperties || {};
  const renderedPatternProperties = Object.keys(patternProperties).map(
    (pattern, i) => {
      const lookupResult = lookup.getSchema(patternProperties[pattern]);
      const currentSchema =
        getSchemaFromResult(lookupResult) || patternProperties[pattern];
      return (
        <ParameterView
          key={`pattern-properties-${i}`}
          name={`/${pattern}/ (keys of pattern)`}
          alias={getPropertyAlias(currentSchema)}
          deprecated={isPropertyDeprecated(currentSchema)}
          description={getDescriptionForSchema(schema)}
          required={false}
          schema={currentSchema}
          reference={
            lookupResult?.baseReference ||
            `${reference}/patternProperties/${pattern}`
          }
          lookup={lookup}
        />
      );
    }
  );

  const hasProperties =
    Object.keys(properties).length > 0 ||
    renderedPatternProperties.length > 0 ||
    additionalProperties.length > 0;

  const { anyOf, allOf, oneOf, not } = schema;
  const compositeOnlyType: JsonSchema1 = { anyOf, allOf, oneOf, not };
  let mixinProps = <></>;
  if (
    Object.keys(compositeOnlyType).some(
      (key) => compositeOnlyType[key] !== undefined
    )
  ) {
    mixinProps = (
      <>
        <h3 key="mixins-header">Mixins</h3>
        {hasProperties ? (
          <p key="mixins-description">
            This type has all of the properties below, but must also match this
            type:
          </p>
        ) : (
          <p key="mixins-description">
            This object must match the following conditions:
          </p>
        )}
        <Type
          key="mixins-type"
          s={compositeOnlyType}
          lookup={lookup}
          reference={reference}
        />
      </>
    );
  }

  let allRenderedProperties = <></>;
  const renderedProps = [
    renderProps([
      ...categorizedProperties.required,
      ...categorizedProperties.important,
      ...categorizedProperties.rest,
    ]),
    ...renderedPatternProperties,
    ...additionalProperties,
    renderProps([
      ...categorizedProperties.internal,
      ...categorizedProperties.deprecated,
    ]),
  ];
  if (hasProperties) {
    allRenderedProperties = <>{renderedProps}</>;
  }

  return (
    <div key="schema-explorer">
      {mixinProps}
      {allRenderedProperties}
    </div>
  );
}
