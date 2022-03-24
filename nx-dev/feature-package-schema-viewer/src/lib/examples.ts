import { getSchemaFromResult, Lookup } from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema, JsonSchema1 } from '@nrwl/nx-dev/models-package';
import { shouldShowInStage, Stage } from './stage';
import { getOrInferType } from './types/type-inference';

export class Example {
  private _value: any;

  public static of(value: any) {
    return new Example(value);
  }

  constructor(value: any) {
    this._value = value;
  }

  get value() {
    return this._value;
  }
}

export type ErrorReason =
  | 'missing-schema'
  | 'schema-not-supported'
  | 'infinite-prop-loop'
  | 'all-of-mismatched-types'
  | 'example-of-nothing-is-impossible'
  | 'type-array-was-empty'
  | 'ran-out-of-memory';

export class Error {
  private _reason: ErrorReason;
  private _message: string;

  constructor(reason: ErrorReason, message: string) {
    this._reason = reason;
    this._message = message;
  }

  get reason() {
    return this._reason;
  }

  get message() {
    return this._message;
  }
}

export class Errors {
  private _errors: Error[];

  public static from(...manyErrors: Errors[]) {
    return new Errors(
      manyErrors
        .map((errs) => errs.errors)
        .reduce((prev, curr) => {
          prev.push(...curr);
          return prev;
        }, [])
    );
  }

  public static of(...errors: Error[]) {
    return new Errors(errors);
  }

  constructor(errors: Error[]) {
    this._errors = errors;
  }

  get errors() {
    return this._errors;
  }

  get length() {
    return this._errors.length;
  }
}

class ChainContext {
  constructor(
    private resolvedReferences: Set<string>,
    private internalLookup: Lookup,
    private internalDepth: number,
    private internalStage: Stage,
    private internalParent: JsonSchema | undefined
  ) {}

  get lookup(): Lookup {
    return this.internalLookup;
  }

  get depth(): number {
    return this.internalDepth;
  }

  get stage(): Stage {
    return this.internalStage;
  }

  get parent(): JsonSchema | undefined {
    return this.internalParent;
  }

  public registerReference(ref: NonNullable<JsonSchema1['$ref']>) {
    this.resolvedReferences.add(ref);
  }

  public seenBefore(ref: NonNullable<JsonSchema1['$ref']>): boolean {
    return this.resolvedReferences.has(ref);
  }

  public clone(currentParent: JsonSchema): ChainContext {
    return new ChainContext(
      new Set(this.resolvedReferences),
      this.internalLookup,
      this.internalDepth + 1,
      this.internalStage,
      currentParent
    );
  }
}

type NameAndExample = {
  name: string;
  example: Example | Errors;
};

function missingSchema(schemaOrRef: JsonSchema): Error {
  return new Error(
    'missing-schema',
    `Could not find a schema for: ${JSON.stringify(schemaOrRef)}`
  );
}

function notSupported(message: string): Error {
  return new Error('schema-not-supported', message);
}

function infinitePropLoopForObject(
  propName: string,
  ref: NonNullable<JsonSchema1['$ref']>,
  schema: JsonSchema1
): Error {
  return new Error(
    'infinite-prop-loop',
    `The reference to '${ref}' in the property '${propName}' in the schema '${
      schema.title || 'object'
    }'
        causes an infinite loop.`
  );
}

function allOfMismatchedTypes(allTypes: (string | null)[]): Error {
  return new Error(
    'all-of-mismatched-types',
    `There was an allOf that evaluated to examples of mismatched types: ${JSON.stringify(
      allTypes
    )}`
  );
}

function nothing(parentSchema: JsonSchema | undefined): Error {
  const renderedParent =
    parentSchema === undefined ? 'root' : JSON.stringify(parentSchema);
  return new Error(
    'example-of-nothing-is-impossible',
    `Can't generate an example of the 'nothing' type for a child of: ${renderedParent}`
  );
}

export function isExample(t: any): t is Example {
  return t instanceof Example;
}

export function isErrors(t: any): t is Errors {
  return t instanceof Errors;
}

function isError(t: any): t is Error {
  return t instanceof Error;
}

function isSchema(t: JsonSchema | Error): t is JsonSchema {
  return !isError(t);
}

type IgnoredProperty = {
  name: string;
};

function isNameAndExample(
  t: NameAndExample | IgnoredProperty
): t is NameAndExample {
  return 'example' in t;
}

function inferExample<A>(
  schema: JsonSchema1,
  typeMatcher: (x: any) => boolean,
  defaultExample: () => Example
): Example {
  const match = (schema.examples || []).find(typeMatcher);
  if (match !== undefined) {
    return Example.of(match);
  }

  if (
    schema.enum !== undefined &&
    schema.enum.length > 0 &&
    typeMatcher(schema.enum[0])
  ) {
    return Example.of(schema.enum[0]);
  }
  return defaultExample();
}

function getSchemaNameForError(schemaOrRef: JsonSchema): string {
  if (typeof schemaOrRef === 'boolean') {
    return '<boolean schema with no name>';
  }

  if (schemaOrRef.$ref !== undefined) {
    return schemaOrRef.$ref;
  }

  return schemaOrRef.title === undefined ? 'object' : schemaOrRef.title;
}

function generateJsonExampleForHelper(
  context: ChainContext,
  schemaOrRef: JsonSchema
): Example | Errors {
  const { lookup } = context;
  const schema = getSchemaFromResult(lookup.getSchema(schemaOrRef));
  if (schema === undefined) {
    return Errors.of(missingSchema(schemaOrRef));
  }

  if (typeof schemaOrRef !== 'boolean' && schemaOrRef.$ref !== undefined) {
    context.registerReference(schemaOrRef.$ref);
  }

  if (typeof schema === 'boolean') {
    if (schema) {
      // We have no examples, so let's just return an empty object
      return Example.of({});
    } else {
      return Errors.of(nothing(context.parent));
    }
  }

  if (Object.keys(schema).length === 0) {
    // You accept anything in this slot, so let's just return an empty object.
    return Example.of({});
  }

  let type = getOrInferType(schema);

  if (Array.isArray(type)) {
    if (type.length >= 1) {
      type = type[0];
    } else {
      return Errors.of(
        new Error(
          'type-array-was-empty',
          `The type was an empty array for: ${JSON.stringify(schemaOrRef)}`
        )
      );
    }
  }

  if (type !== undefined) {
    if (type === 'boolean') {
      return inferExample(
        schema,
        (x) => typeof x === 'boolean',
        () => Example.of(true)
      );
    } else if (type === 'integer' || type === 'number') {
      return inferExample(
        schema,
        (x) => typeof x === 'number' || typeof x === 'bigint',
        () => Example.of(schema.description ? schema.description.length : 2154)
      );
    } else if (type === 'string') {
      return inferExample(
        schema,
        (x) => typeof x === 'string',
        () => Example.of('<string>')
      );
    } else if (type === 'array') {
      const match = (schema.examples || []).find(Array.isArray);
      if (match !== undefined) {
        return Example.of(match);
      }

      if (schema.items === undefined) {
        return Example.of([]);
      }

      const chosenItem = Array.isArray(schema.items)
        ? schema.items[0]
        : schema.items;
      const itemSchema =
        schema.items === undefined
          ? undefined
          : getSchemaFromResult(lookup.getSchema(chosenItem));

      if (itemSchema === undefined) {
        return Example.of([]);
      } else {
        // Setup the next context
        let nextContext = context;
        if (typeof chosenItem !== 'boolean' && chosenItem.$ref !== undefined) {
          if (context.seenBefore(chosenItem.$ref)) {
            // If it's an infinite loop then just return no elements. Magic!
            return Example.of([]);
          }
          nextContext = context.clone(chosenItem);
          nextContext.registerReference(chosenItem.$ref);
        }

        const itemExample = generateJsonExampleForHelper(
          nextContext,
          itemSchema
        );

        if (isErrors(itemExample)) {
          return Example.of([]);
        }

        const itemsToRender = schema.uniqueItems ? 1 : schema.minItems || 1;
        return Example.of(Array(itemsToRender).fill(itemExample.value));
      }
    } else {
      const match = (schema.examples || []).find((x) => typeof x === 'object');
      if (match !== undefined) {
        return Example.of(match);
      }

      const { properties, required } = schema;
      const requiredPropNames = new Set<string>(required || []);
      if (properties === undefined) {
        // Return an empty object because no properties are allowed
        return Example.of({});
      } else {
        const props = Object.keys(properties)
          .filter((name) => {
            const propSchema = getSchemaFromResult(
              context.lookup.getSchema(properties[name])
            );
            if (propSchema === undefined) {
              return true;
            }
            return shouldShowInStage(context.stage, propSchema);
          })
          .map<NameAndExample | IgnoredProperty>((name) => {
            const propOrRef = properties[name];

            if (context.depth >= 1 && !requiredPropNames.has(name)) {
              return { name };
            }

            if (typeof propOrRef === 'boolean') {
              if (propOrRef) {
                // We have no examples, so let's just return an empty object
                return { name, example: Example.of({}) };
              } else {
                return { name, example: Errors.of(nothing(schema)) };
              }
            }

            // Setup the next context
            let nextContext = context;
            if (propOrRef.$ref !== undefined) {
              if (context.seenBefore(propOrRef.$ref)) {
                return requiredPropNames.has(name)
                  ? {
                      name,
                      example: Errors.of(
                        infinitePropLoopForObject(name, propOrRef.$ref, schema)
                      ),
                    }
                  : { name };
              }
              nextContext = context.clone(propOrRef);
              nextContext.registerReference(propOrRef.$ref);
            }

            const prop = getSchemaFromResult(lookup.getSchema(propOrRef));
            if (prop === undefined) {
              return { name, example: Errors.of(missingSchema(propOrRef)) };
            }

            const generatedExample = generateJsonExampleForHelper(
              nextContext,
              prop
            );
            if (isErrors(generatedExample) && !requiredPropNames.has(name)) {
              return { name };
            }

            return {
              name,
              example: generatedExample,
            };
          });

        const nonIgnoredProps = props.filter(isNameAndExample);

        // If there were errors then just return the errors
        const e = Errors.from(
          ...nonIgnoredProps.map((p) => p.example).filter<Errors>(isErrors)
        );
        if (e.length > 0) {
          return e;
        }

        // Otherwise, just make the example
        let example: Record<string, Example['value']> = {};
        nonIgnoredProps.forEach((prop) => {
          if (isExample(prop.example)) {
            example[prop.name] = prop.example.value;
          }
        });
        return Example.of(example);
      }
    }
  } else {
    if (schema.anyOf !== undefined && schema.anyOf.length > 0) {
      return generateJsonExampleForHelper(context, schema.anyOf[0]);
    } else if (schema.oneOf !== undefined && schema.oneOf.length > 0) {
      return generateJsonExampleForHelper(context, schema.oneOf[0]);
    } else if (schema.allOf !== undefined && schema.allOf.length > 0) {
      let nextContext = context.clone(schema);
      const potentialSchemas = schema.allOf.map<JsonSchema | Error>((s) => {
        const ps = getSchemaFromResult(lookup.getSchema(s));
        if (typeof s !== 'boolean' && s.$ref !== undefined) {
          nextContext.registerReference(s.$ref);
        }
        return ps === undefined ? missingSchema(s) : ps;
      });

      let errors = potentialSchemas.filter(isError);
      if (errors.length > 0) {
        return new Errors(errors);
      }

      const exs = potentialSchemas
        .filter(isSchema)
        .map((s) => generateJsonExampleForHelper(nextContext, s));

      const errs = exs.filter(isErrors);
      if (errs.length > 0) {
        return Errors.from(...errs);
      }

      const examples = exs.filter(isExample).map((e) => e.value);
      const allExampleTypes = examples.map<string | null>((e) => typeof e);
      const matchedType = allExampleTypes.reduce((a, b) =>
        a === b ? a : null
      );
      if (matchedType === null) {
        return Errors.of(allOfMismatchedTypes(allExampleTypes));
      }

      if (matchedType === 'object') {
        const example = Object.assign({}, ...examples);
        return Example.of(example);
      } else if (
        matchedType === 'string' ||
        matchedType === 'number' ||
        matchedType === 'boolean'
      ) {
        return Example.of(examples[0]);
      }
    }

    const schemaName = getSchemaNameForError(schemaOrRef);

    return Errors.of(
      notSupported(
        `Support schemas without a "type" has not been written yet. Source: ${schemaName}. Parent ${JSON.stringify(
          context.parent
        )}`
      )
    );
  }
}

export function generateJsonExampleFor(
  schemaOrRef: JsonSchema,
  lookup: Lookup,
  stage: Stage
): Example | Errors {
  try {
    return generateJsonExampleForHelper(
      new ChainContext(new Set<string>(), lookup, 0, stage, undefined),
      schemaOrRef
    );
  } catch (e) {
    return Errors.of(new Error('ran-out-of-memory', `Ran out of memory: ${e}`));
  }
}
