/**
 * Inlined from @yarnpkg/parsers v3.0.2 to eliminate transitive dependency
 * conflicts (js-yaml -> argparse@1.x) for supply chain hardening.
 *
 * Source: https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-parsers/sources/syml.ts
 * Grammar: https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-parsers/sources/grammars/syml.pegjs
 *
 * Changes from upstream:
 * - Replaced js-yaml with @zkochan/js-yaml (already an nx dependency)
 * - Converted to TypeScript
 *
 * To update: compare against the upstream source files linked above and apply
 * any changes. The syml-grammar.js file is PEG.js-generated from syml.pegjs
 * and can be copied from the published @yarnpkg/parsers package directly.
 */
export declare class PreserveOrdering {
    readonly data: any;
    constructor(data: any);
}
export declare function stringifySyml(value: any): string;
export declare function parseSyml(source: string): {
    [key: string]: any;
};
