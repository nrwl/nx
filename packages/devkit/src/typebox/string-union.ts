import { CustomOptions, TLiteral, TUnion } from '@sinclair/typebox';

type IntoStringUnion<T> = {
  [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : never;
};

export function TStringUnion<T extends string[], T2 extends CustomOptions>(
  values: [...T],
  schema?: T2
): TUnion<IntoStringUnion<T>> {
  return { ...schema, type: 'string', enum: values } as any;
}
