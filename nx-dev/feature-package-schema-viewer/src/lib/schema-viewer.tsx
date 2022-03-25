import {
  getDescriptionForSchema,
  getSchemaFromResult,
  Lookup,
} from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema, JsonSchema1 } from '@nrwl/nx-dev/models-package';
import { ParameterView } from './parameter-view';
import { shouldShowInStage, Stage } from './stage';
import { Type } from './types/type';

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
}) {
  const properties = schema.properties || {};
  const isDeprecated = (schema: JsonSchema): boolean =>
    typeof schema === 'boolean' ? false : !!schema['x-deprecated'];
  const getAlias = (schema: JsonSchema): string =>
    typeof schema === 'boolean' ? '' : (schema['alias'] as string);

  const renderedProps = Object.keys(properties)
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort properties alphabetically
    .map((propertyName) => {
      const propertySchema = properties[propertyName];
      const lookupResult = lookup.getSchema(propertySchema);
      return {
        propertyName,
        alias: ((properties[propertyName] as any)['alias'] as string) ?? '',
        initialSchema: propertySchema,
        lookupResult,
        propertyReference:
          lookupResult?.baseReference ||
          `${reference}/properties/${propertyName}`,
      };
    })
    .filter((p) => {
      if (p.lookupResult === undefined) {
        return true;
      }
      return shouldShowInStage(stage, p.lookupResult.schema);
    })
    .map((p) => {
      const isRequired =
        typeof schema.required !== 'undefined' &&
        !!schema.required.find((n) => n === p.propertyName);

      if (p.lookupResult) {
        return (
          <ParameterView
            key={p.propertyName}
            alias={p.alias}
            name={p.propertyName}
            description={getDescriptionForSchema(p.lookupResult.schema)}
            required={isRequired}
            deprecated={isDeprecated(p.lookupResult.schema)}
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
            deprecated={isDeprecated(p.initialSchema)}
            name={p.propertyName}
            description={getDescriptionForSchema(p.initialSchema)}
            required={isRequired}
            schema={p.initialSchema}
            reference={p.propertyReference}
            lookup={lookup}
          />
        );
      }
    });

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
          alias={getAlias(additionalPropertiesResult.schema)}
          deprecated={isDeprecated(additionalPropertiesResult.schema)}
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
          alias={getAlias(currentSchema)}
          deprecated={isDeprecated(currentSchema)}
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
    renderedProps.length > 0 ||
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
  if (hasProperties) {
    allRenderedProperties = (
      <>
        {renderedProps}
        {renderedPatternProperties}
        {additionalProperties}
      </>
    );
  }

  return (
    <div key="schema-explorer">
      {mixinProps}
      {allRenderedProperties}
    </div>
  );
}
