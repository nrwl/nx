/**
 * Opaque branded types for native ExternalObject handles.
 *
 * These types are not constructed directly — they exist only to brand
 * ExternalObject<T> so that different native handles are not interchangeable.
 *
 * This file is intentionally NOT a module (no import/export) so these types
 * are available in the global scope for the auto-generated index.d.ts.
 */

interface NxDbConnection {
  readonly __brand: unique symbol;
}

interface ParserArc {
  readonly __brand: unique symbol;
}

interface WriterArc {
  readonly __brand: unique symbol;
}

interface HashInstruction {
  readonly __brand: unique symbol;
}
