import { ArrowTopRightOnSquareIcon, LinkIcon } from '@heroicons/react/24/solid';
import {
  getSchemaFromResult,
  getTitleForSchema,
  Lookup,
} from '@nrwl/nx-dev/data-access-packages';
import {
  JsonSchema,
  JsonSchema1,
  SimpleTypes,
} from '@nrwl/nx-dev/models-package';
import React from 'react';
import { joinTypes } from './join-types';
import {
  getOrInferType,
  isExternalReference,
  isPresent,
  isPrimitiveType,
} from './type-inference';

class LookupContext {
  readonly lookup: Lookup;
  readonly discriminate: string | undefined;

  private constructor(lookup: Lookup, discriminate: string | undefined) {
    this.lookup = lookup;
    this.discriminate = discriminate;
  }

  public static root(lookup: Lookup): LookupContext {
    return new LookupContext(lookup, undefined);
  }

  public clone(discriminate: string | undefined): LookupContext {
    if (this.discriminate === discriminate) {
      return this;
    }
    return new LookupContext(this.lookup, discriminate);
  }
}

function hasCompositeDefinition(s: JsonSchema1): boolean {
  return (
    (s.anyOf !== undefined && s.anyOf.length > 0) ||
    (s.oneOf !== undefined && s.oneOf.length > 0) ||
    (s.allOf !== undefined && s.allOf.length > 0) ||
    s.not !== undefined
  );
}

function hasProperties(s: JsonSchema1): boolean {
  return s.properties !== undefined && Object.keys(s.properties).length > 0;
}

function hasPatternProperties(s: JsonSchema1): boolean {
  return (
    s.patternProperties !== undefined &&
    Object.keys(s.patternProperties).length > 0
  );
}

function hasAdditionalProperties(s: JsonSchema1): boolean {
  return !(
    typeof s.additionalProperties === 'boolean' && !s.additionalProperties
  );
}

export function isLink(s: JsonSchema): boolean {
  if (typeof s === 'boolean') {
    return false;
  }

  const type = getOrInferType(s);

  return (
    hasProperties(s) ||
    hasPatternProperties(s) ||
    (type === 'object' && hasAdditionalProperties(s))
  );
}

function schemaHasCompositeType(s: JsonSchema1): boolean {
  return (
    (s.allOf !== undefined && s.allOf.length > 0) ||
    (s.anyOf !== undefined && s.anyOf.length > 0) ||
    (s.oneOf !== undefined && s.oneOf.length > 0) ||
    s.not !== undefined
  );
}

const LinkType = ({
  fallbackTitle,
  schema,
  reference,
}: {
  fallbackTitle: string;
  schema: JsonSchema1;
  reference: string;
}): JSX.Element => {
  if (isExternalReference(schema) && schema.$ref !== undefined) {
    return (
      <a href={schema.$ref} target="_blank" rel="noreferrer">
        external reference: {schema.$ref}{' '}
        <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
      </a>
    );
  }

  return (
    <a
      className="text-blue-600 hover:underline"
      href={`?ref=` + reference.replace(/#\//gi, 'root/')}
    >
      {getTitleForSchema(reference, schema) || fallbackTitle}{' '}
      <LinkIcon className="inline h-4 w-4" />
    </a>
  );
};
export const Anything = () => <>anything</>;
export const Nothing = () => <>nothing</>;
export const Not = ({ inside }: { inside: JSX.Element }) => <>not ({inside})</>;
export const AllOf = ({ joined }: { joined: (JSX.Element | string)[] }) => (
  <>allOf [{joined}]</>
);
export const AnyOf = ({ joined }: { joined: (JSX.Element | string)[] }) => (
  <>anyOf [{joined}]</>
);
export const OneOf = ({ joined }: { joined: (JSX.Element | string)[] }) => (
  <>oneOf [{joined}]</>
);
export const Primitives = ({
  type,
}: {
  type: SimpleTypes | undefined | (SimpleTypes | undefined)[];
}) => (Array.isArray(type) ? <>{type.join(' ∪ ')}</> : <>{type}</>);
export const ArrayOf = ({ type }: { type: JSX.Element }) => (
  <>Array&lt;{type}&gt;</>
);
export const ArrayOfAnything = () => <>Array&lt;anything&gt;</>;
export const ArrayOfAnyOf = ({
  joined,
}: {
  joined: (JSX.Element | string)[];
}) => <>Array&lt;anyOf [{joined}]&gt;</>;
export const ObjectNamed = ({ name }: { name: string }) => <>object: {name}</>;

type SchemaAndReference = {
  schema: JsonSchema | undefined;
  reference: string;
};

function extractSchemaAndReference(
  propertyName: string,
  lookup: Lookup,
  currentReference: string
) {
  return (schema: JsonSchema, arrayIndex: number): SchemaAndReference => {
    const lookupResult = lookup.getSchema(schema);
    return {
      schema: getSchemaFromResult(lookupResult),
      reference:
        (lookupResult !== undefined && lookupResult.baseReference) ||
        `${currentReference}/${propertyName}/${arrayIndex}`,
    };
  };
}

function onlyKeyPresent(schema: JsonSchema1, key: keyof JsonSchema1): boolean {
  return Object.keys(schema).every(
    (schemaKey) => schemaKey !== key || schema[schemaKey] !== undefined
  );
}

function getObjectName(s: JsonSchema1, context: LookupContext): string {
  if (s.title !== undefined) {
    return s.title;
  }

  if (context.discriminate !== undefined && s.properties !== undefined) {
    const propertyName = context.discriminate;
    const propertyLookupResult = context.lookup.getSchema(
      s.properties[propertyName]
    );
    if (propertyLookupResult !== undefined) {
      const property = propertyLookupResult.schema;

      if (
        property !== undefined &&
        typeof property !== 'boolean' &&
        property.enum !== undefined &&
        property.enum.length === 1
      ) {
        return `${propertyName}: ${property.enum[0]}`;
      }
    }
  }

  return 'object';
}

function findDis(
  sr: Array<SchemaAndReference>,
  context: LookupContext
): string | undefined {
  return findDiscriminant(
    sr.map((s) => s.schema).filter(isPresent),
    context.lookup
  );
}

const getTypeText = (
  initialSchema: JsonSchema | undefined,
  initialReference: string,
  context: LookupContext
): JSX.Element => {
  const lookup = context.lookup;

  if (initialSchema === undefined) {
    return <Anything />;
  }

  if (typeof initialSchema === 'boolean') {
    return initialSchema ? <Anything /> : <Nothing />;
  }

  if (isExternalReference(initialSchema)) {
    return (
      <LinkType
        fallbackTitle="anything"
        reference={initialReference}
        schema={initialSchema}
      />
    );
  }

  const lookupResult = lookup.getSchema(initialSchema);
  if (lookupResult === undefined) {
    return <Anything />;
  }

  const s = lookupResult.schema;
  const currentReference = lookupResult.baseReference || initialReference;

  if (typeof s === 'boolean') {
    return getTypeText(s, currentReference, context.clone(undefined));
  }

  const type = getOrInferType(s);

  if (isLink(s)) {
    return (
      <LinkType
        schema={s}
        reference={currentReference}
        fallbackTitle={getObjectName(s, context)}
      />
    );
  }

  if (schemaHasCompositeType(s)) {
    const compositeTypes: JSX.Element[] = new Array<JSX.Element>();

    if (s.anyOf !== undefined && s.anyOf.length > 0) {
      const schemas = s.anyOf.map(
        extractSchemaAndReference('anyOf', lookup, currentReference)
      );
      // const schemas = mergeCompositesWithParent(s, s.anyOf.map(sx => schemas.getSchema(sx)));

      if (schemas.find((sx) => sx.schema === undefined)) {
        // If you have an anything in an anyOf then you should just simplify to anything
        return <Anything />;
      } else {
        const renderedSchemas = schemas.map((sx) =>
          getTypeText(sx.schema, sx.reference, context.clone(undefined))
        );
        if (renderedSchemas.length === 1) {
          compositeTypes.push(renderedSchemas[0]);
        } else {
          const joined = joinTypes(renderedSchemas, ', ');

          compositeTypes.push(<AnyOf joined={joined} />);
        }
      }
    }

    if (s.oneOf !== undefined && s.oneOf.length > 0) {
      const schemas = s.oneOf.map(
        extractSchemaAndReference('oneOf', lookup, currentReference)
      );

      const renderedSchemas = schemas.map((sx) =>
        getTypeText(
          sx.schema,
          sx.reference,
          context.clone(findDis(schemas, context))
        )
      );

      if (renderedSchemas.length === 1) {
        compositeTypes.push(renderedSchemas[0]);
      } else {
        const joined = joinTypes(renderedSchemas, ', ');

        compositeTypes.push(<OneOf joined={joined} />);
      }
    }

    if (s.allOf !== undefined && s.allOf.length > 0) {
      const schemas = s.allOf.map(
        extractSchemaAndReference('allOf', lookup, currentReference)
      );

      const renderedSchemas = schemas.map((sx) =>
        getTypeText(
          sx.schema,
          sx.reference,
          context.clone(findDis(schemas, context))
        )
      );
      if (renderedSchemas.length === 1) {
        compositeTypes.push(renderedSchemas[0]);
      } else {
        const joined = joinTypes(renderedSchemas, ', ');

        compositeTypes.push(<AllOf joined={joined} />);
      }
    }

    if (s.not !== undefined && typeof s.not !== 'boolean') {
      const lookupResult = lookup.getSchema(s.not);
      const inside = getTypeText(
        lookupResult?.schema,
        lookupResult?.baseReference || `${currentReference}/not`,
        context.clone(undefined)
      );
      compositeTypes.push(<Not inside={inside} />);
    }

    if (compositeTypes.length === 1) {
      return compositeTypes[0];
    } else if (compositeTypes.length > 1) {
      return <>{joinTypes(compositeTypes, ' AND ')}</>;
    }
  } else if (isPrimitiveType(type)) {
    return <Primitives type={type} />;
  } else if (type === 'array') {
    if (s.items === undefined) {
      return <ArrayOfAnything />;
    } else if (!Array.isArray(s.items)) {
      return (
        <ArrayOf
          type={getTypeText(
            s.items,
            `${currentReference}/items`,
            context.clone(undefined)
          )}
        />
      );
    } else if (s.items.length === 0) {
      return <ArrayOfAnything />;
    } else if (s.items.length === 1) {
      return (
        <ArrayOf
          type={getTypeText(
            s.items[0],
            `${currentReference}/items/0`,
            context.clone(undefined)
          )}
        />
      );
    } else {
      const items = s.items;
      const renderedItems = items.map((item, i) =>
        getTypeText(
          item,
          `${currentReference}/items/${i}`,
          context.clone(findDiscriminant(items, lookup))
        )
      );
      const joined = joinTypes(renderedItems, ', ');

      return <ArrayOfAnyOf joined={joined} />;
    }
  } else if (type === 'object') {
    const name = getObjectName(s, context);
    if (isLink(s)) {
      return (
        <LinkType
          schema={s}
          reference={currentReference}
          fallbackTitle={name}
        />
      );
    } else {
      return <ObjectNamed name={name} />;
    }
  } else if (Array.isArray(type)) {
    if (type.length === 0) {
      return <Anything />;
    } else if (type.length === 1) {
      return getTypeText(
        { ...s, type: type[0] },
        currentReference,
        context.clone(undefined)
      );
    } else {
      const splitSchemas = type.map((t) => ({ ...s, type: t }));

      const renderedSchemas = splitSchemas.map((splitSchema) =>
        getTypeText(
          splitSchema,
          currentReference,
          context.clone(findDiscriminant(splitSchemas, lookup))
        )
      );
      const joined = joinTypes(renderedSchemas, ', ');

      return <AnyOf joined={joined} />;
    }
  } else if (s.required !== undefined && onlyKeyPresent(s, 'required')) {
    return <>required: {s.required.join(' ∩ ')}</>;
  }

  return <Anything />;
};

export const Type: React.FunctionComponent<{
  s: JsonSchema | undefined;
  reference: string;
  lookup: Lookup;
}> = ({ s, lookup, reference }) =>
  getTypeText(s, reference, LookupContext.root(lookup));

function findDiscriminant(
  arg0: (boolean | JsonSchema1)[],
  lookup: Lookup
): string | undefined {
  return 'TODO';
}
