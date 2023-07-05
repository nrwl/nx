use std::collections::HashMap;
use std::path::Path;
use std::rc::Rc;
use std::sync::Arc;
use std::time::Instant;

use rayon::prelude::*;
use tracing::debug;
use tracing::trace;

use swc_common::{BytePos, SourceFile, SourceMap, Spanned};
use swc_ecma_ast::EsVersion::EsNext;
use swc_ecma_parser::lexer::Lexer;
use swc_ecma_parser::token::Keyword::{Class, Export, Function, Import};
use swc_ecma_parser::token::Word::{Ident, Keyword};
use swc_ecma_parser::token::{BinOpToken, Token, TokenAndSpan};
use swc_ecma_parser::{Syntax, Tokens, TsConfig};

use crate::native::logger::enable_logger;

#[napi]
#[derive(Debug)]
pub struct ImportResult {
    pub file: String,
    pub source_project: String,
    pub dynamic_import_expressions: Vec<String>,
    pub static_import_expressions: Vec<String>,
}

#[derive(Debug)]
enum ImportType {
    Static,
    Dynamic,
}
#[derive(Debug, Clone, Copy, PartialEq)]
enum BlockType {
    Block,
    Function,
    Class,
    Object,
    ObjectType,
    ArrowFunction,
}

fn is_identifier(token: &Token) -> bool {
    matches!(token, Token::Word(Ident(_)))
}

fn process_file((source_project, file_path): (&String, &String)) -> Option<ImportResult> {
    let now = Instant::now();
    let cm = Arc::<SourceMap>::default()
        .load_file(Path::new(file_path))
        .unwrap();

    let tsx = file_path.ends_with(".tsx") || file_path.ends_with(".jsx");
    let mut lexer = Lexer::new(
        Syntax::Typescript(TsConfig {
            tsx,
            decorators: false,
            dts: file_path.ends_with(".d.ts"),
            no_early_errors: false,
            disallow_ambiguous_jsx_like: false,
        }),
        EsNext,
        (&*cm).into(),
        None,
    );

    let mut static_import_expressions: Vec<String> = vec![];
    let mut dynamic_import_expressions: Vec<String> = vec![];

    // State
    let mut open_brace_count: i128 = 0;

    let mut current_token: Option<TokenAndSpan> = None;
    let mut last_token: Option<TokenAndSpan>;
    let mut import_type: ImportType = ImportType::Dynamic;

    let mut blocks_stack: Vec<BlockType> = vec![];
    let mut next_block_type = BlockType::Block;

    'outer: loop {
        // Keep the current token as the last token before calling next
        last_token = current_token;

        if let Some(t) = lexer.next() {
            // Keep track of braces/ when blocks begin and end
            match &t.token {
                Token::DollarLBrace => {
                    open_brace_count += 1;
                }
                Token::LBrace => {
                    open_brace_count += 1;

                    // A new block has opened so push the new block type
                    blocks_stack.push(next_block_type);
                }
                Token::RBrace => {
                    open_brace_count -= 1;

                    // Reset the next block type
                    next_block_type = BlockType::Block;

                    // The block has closed so remove it from the block stack
                    blocks_stack.pop();
                }
                _ => {}
            }

            // Keeps the current token so it can be kept as the last token later
            current_token = Some(t);
        } else {
            // This is the end of the file, break out of the loop
            break;
        }

        // Keep track of when we are in an object declaration because colons mean different things
        let in_object_declaration = blocks_stack.contains(&BlockType::Object);

        if let Some(current) = &current_token {
            let new_line = lexer.had_line_break_before_last();

            // This is the beginning of a new statement, reset the import type to the default
            // Reset import type when there is new line not in braces
            if new_line && open_brace_count == 0 {
                import_type = ImportType::Dynamic;
            }
            match &current.token {
                Token::Word(word) => match word {
                    // Matches something like const a = a as import('a')
                    // This is a static type import
                    Ident(i) if i == "as" => {
                        import_type = ImportType::Static;
                    }
                    // Matches something like export const = import('a')
                    // This is a dynamic import
                    Keyword(keyword) if *keyword == Export => {
                        import_type = ImportType::Dynamic;
                    }

                    // If a function keyword appears, the next open brace will start a function block
                    Keyword(keyword) if *keyword == Function => {
                        next_block_type = BlockType::Function;
                    }
                    // If a class keyword appears, the next open brace will start a class block
                    Keyword(keyword) if *keyword == Class => {
                        next_block_type = BlockType::Class;
                    }
                    _ => {}
                },
                Token::AssignOp(_) => {
                    // When things are assigned, they are dynamic imports
                    // Ex: const a = import('a');
                    import_type = ImportType::Dynamic;

                    // When assigning things, an open brace means an object
                    next_block_type = BlockType::Object
                }
                // When we see a (, the next brace is an object passed into a function
                // Matches console.log({ a: import('a') });
                Token::LParen => {
                    if let Some(t) = &last_token {
                        match t.token {
                            _ if is_identifier(&t.token) => {
                                // Function Call
                                next_block_type = BlockType::Object;
                            }
                            _ => {
                                // Arrow Function Declaration
                                next_block_type = BlockType::ArrowFunction;
                            }
                        }
                    }
                }
                Token::BinOp(op) => match op {
                    BinOpToken::Lt => {
                        // Matches things like Foo<typeof import('a')>
                        // This is a static import
                        if let Some(t) = &last_token {
                            match t.token {
                                _ if is_identifier(&t.token) => {
                                    // Generic
                                    import_type = ImportType::Static;
                                }
                                _ => {}
                            }
                        }
                    }

                    BinOpToken::Div => {
                        if let Some(t) = &last_token {
                            match t.token {
                                // Real division of numbers or identifier
                                // 2 / 1
                                // a / 2
                                // a.getLength() / 2
                                // a.a / 2
                                // "a" / 2
                                // `a` / 2
                                Token::Num { .. }
                                | Token::Word(_)
                                | Token::RParen
                                | Token::RBrace
                                | Token::RBracket
                                | Token::Str { .. }
                                | Token::BackQuote { .. } => {
                                    continue;
                                }
                                // Everything else, is the start of a regex
                                // The lexer needs to know when there's a regex
                                _ => {
                                    lexer.set_next_regexp(Some(current_token.span_lo()));

                                    if lexer.next().is_some() {
                                        lexer.set_next_regexp(None);

                                        continue;
                                    }
                                }
                            }
                        }
                    }

                    // When there are binary operations, it is dynamic
                    // Matches things like const a = 3 + (await import('a'))
                    _ => {
                        import_type = ImportType::Dynamic;
                    }
                },
                // When there is a string literal, ${ begins a dynamic expression
                Token::DollarLBrace => {
                    import_type = ImportType::Dynamic;
                }
                // When functions and methods begin, this starts a dynamic block
                Token::LBrace => {
                    import_type = ImportType::Dynamic;
                }
                // When we see a ; A new dynamic statement begins
                Token::Semi => {
                    import_type = ImportType::Dynamic;
                }
                Token::Colon => {
                    if let Some(t) = &last_token {
                        match t.token {
                            // Matches { 'a': import('a') }
                            Token::Str { .. } if in_object_declaration => {
                                // Object Property Assignment
                                import_type = ImportType::Dynamic
                            }
                            // Matches { [a]: import('a') }
                            Token::RBracket if in_object_declaration => {
                                // Object Property Assignment
                                import_type = ImportType::Dynamic
                            }
                            // Object Property Assignment
                            // Matches { a: import('a') }
                            _ if is_identifier(&t.token) && in_object_declaration => {
                                import_type = ImportType::Dynamic
                            }
                            // Matches const a: typeof import('a')
                            _ => {
                                // A brace would begin an object type
                                // Ex: const a: { a: typeof import('a') }
                                next_block_type = BlockType::ObjectType;
                                // This is a typing and is static
                                import_type = ImportType::Static;
                            }
                        }
                    }
                }
                _ => {}
            }

            let mut add_import = |import: String| match &import_type {
                ImportType::Static => {
                    static_import_expressions.push(import);
                }
                ImportType::Dynamic => {
                    dynamic_import_expressions.push(import);
                }
            };

            let word = match &current.token {
                Token::Word(w) => w,
                _ => {
                    continue;
                }
            };
            match word {
                // This is an import keyword
                Keyword(keyword) if *keyword == Import => {
                    if is_code_ignored(&cm, current.span.lo) {
                        continue;
                    }

                    if let Some(next) = lexer.next() {
                        // This match is pretty strict on what should follow an import, anything else is skipped
                        match next.token {
                            // This begins a module naming
                            // Ex: import { a } from 'a';
                            Token::LBrace => {}
                            // This indicates a import function call
                            // Ex: import('a')
                            Token::LParen => {
                                let mut maybe_literal = None;
                                for current in lexer.by_ref() {
                                    match current.token {
                                        // If we match a string, then it might be a literal import
                                        Token::Str { value, .. } => {
                                            maybe_literal = Some(value.to_string());
                                        }
                                        Token::RParen => {
                                            // When the function call is closed, add the import if it exists
                                            if let Some(maybe_literal) = maybe_literal {
                                                add_import(maybe_literal);
                                                continue 'outer;
                                            }
                                        }
                                        // If we match anything else, continue the outer loop and skip this import
                                        // because it is not a literal import
                                        _ => {
                                            continue 'outer;
                                        }
                                    }
                                }
                            }
                            // This is a import star statement
                            // Ex: import * from 'a';
                            Token::BinOp(op) if op == BinOpToken::Mul => {}
                            Token::Word(word) => match word {
                                // This is a import type statement
                                // Ex: import type { } from 'a';
                                Ident(i) if &i == "type" => {
                                    if let Some(next) = lexer.next() {
                                        // What follows a type import is pretty strict, otherwise ignore it
                                        match next.token {
                                            // Matches import type {} from 'a';
                                            Token::LBrace => {}
                                            // Matches import type * from 'a';
                                            Token::BinOp(op) if op == BinOpToken::Mul => {}
                                            // Matches import type Cat from 'a';
                                            Token::Word(word) if matches!(word, Ident(_)) => {}
                                            _ => {
                                                continue;
                                            }
                                        }
                                    }
                                }
                                _ => {}
                            },
                            // Matches: import 'a';
                            Token::Str { value, .. } => {
                                static_import_expressions.push(value.to_string());
                                continue;
                            }
                            _ => {
                                continue;
                            }
                        }
                    }

                    // This is a static import because it is not a import function call
                    // import { } from 'a';
                    for current in lexer.by_ref() {
                        if let Token::Str { value, .. } = current.token {
                            static_import_expressions.push(value.to_string());
                            break;
                        }
                    }
                }
                Keyword(keyword) if *keyword == Export => {
                    if is_code_ignored(&cm, current.span.lo) {
                        continue;
                    }
                    if let Some(next) = lexer.next() {
                        // This match is pretty strict about what follows an export keyword
                        // Everything else is skipped
                        match next.token {
                            // Matches export { } from 'a';
                            Token::LBrace => {}
                            Token::Word(word) => match word {
                                // Matches an export type
                                Ident(i) if &i == "type" => {
                                    if let Some(next) = lexer.next() {
                                        // What follows is pretty strict
                                        match next.token {
                                            // Matches export type { a } from 'a';
                                            Token::LBrace => {}
                                            // Anything else after a type is a definition, not an import
                                            // Matches export type = 'a';
                                            _ => {
                                                continue;
                                            }
                                        }
                                    }
                                }
                                _ => {
                                    continue;
                                }
                            },
                            // Matches export * from 'a';
                            Token::BinOp(op) if op == BinOpToken::Mul => {}
                            _ => {
                                continue;
                            }
                        }
                    }
                    for current in lexer.by_ref() {
                        // When we find a string, it's a export
                        if let Token::Str { value, .. } = current.token {
                            static_import_expressions.push(value.to_string());
                            break;
                        }
                    }
                }
                Ident(ident) if ident == "require" => {
                    if is_code_ignored(&cm, current.span.lo) {
                        continue;
                    }
                    let mut import = None;
                    for current in lexer.by_ref() {
                        match current.token {
                            // This opens the require call
                            Token::LParen => {}
                            // This could be a string literal
                            Token::Str { value, .. } => {
                                import = Some(value.to_string());
                            }
                            // Matches things like require.resolve
                            Token::Dot => {}
                            Token::Word(Ident(_)) => {}

                            // When the require call ends, add the require
                            Token::RParen => {
                                if let Some(import) = import {
                                    // When all blocks are object blocks, this is a static require
                                    // Matches things like const a = { a: require('a') };
                                    let static_import = blocks_stack
                                        .iter()
                                        .all(|block_type| matches!(block_type, BlockType::Object));
                                    if static_import {
                                        static_import_expressions.push(import);
                                    } else {
                                        dynamic_import_expressions.push(import);
                                    }
                                }
                                break;
                            }
                            // Anything else means this is not a require of a string literal
                            _ => {
                                break;
                            }
                        }
                    }
                }
                _ => {}
            };
        }
    }

    trace!("finding imports in {} {:.2?}", file_path, now.elapsed());

    // These are errors from the lexer. They don't always mean something is broken
    let mut errs = lexer.take_errors();
    if !errs.is_empty() {
        for err in errs.iter() {
            debug!(
                "{}:{}:{} {}",
                file_path,
                cm.lookup_line(err.span_hi()).unwrap() + 1,
                (err.span_lo() - cm.line_begin_pos(err.span_lo())).0,
                err.kind().msg(),
            );
        }
        errs.clear();
    }

    Some(ImportResult {
        file: file_path.clone(),
        source_project: source_project.clone(),
        static_import_expressions,
        dynamic_import_expressions,
    })
}

fn is_code_ignored(cm: &Rc<SourceFile>, pos: BytePos) -> bool {
    let line_with_dep = cm.lookup_line(pos).expect("The dep is on a line");

    if line_with_dep == 0 {
        return false;
    }

    if let Some(line_before_dep) = cm.get_line(line_with_dep - 1) {
        let trimmed_line = line_before_dep.trim();
        if trimmed_line == "// nx-ignore-next-line" || trimmed_line == "/* nx-ignore-next-line */" {
            return true;
        }
    }
    false
}

#[napi]
fn find_imports(project_file_map: HashMap<String, Vec<String>>) -> Vec<ImportResult> {
    enable_logger();

    let files_to_process: Vec<(&String, &String)> = project_file_map
        .iter()
        .flat_map(|(project_name, files)| files.iter().map(move |file| (project_name, file)))
        .collect();

    files_to_process
        .into_par_iter()
        .filter_map(process_file)
        .collect()
}
#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
    use swc_common::comments::NoopComments;

    #[test]
    fn test_find_imports() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
            // nx-ignore-next-line
            import * as bar from 'ignored';
            /* nx-ignore-next-line */
            import * as bar from 'ignored-by-block-comment';

            // TODO: comment

            // import { a } from 'commented-import';

            const a = "import { a } from 'string-import'"

            import 'static-import';
            import a from 'static-default-import-from';
            import { a } from 'static-import-from';
            import { a } from "static-import-from-with-double-quotes";
            import type { c } from 'static-type-import-from';
            import type * as a from 'static-type-import-all';
            import type a from 'static-type-import-default';

            const a = {
              import: a['import-function']
            };

            const a: Foo
            import('dynamic-import-after-line-without-semicolon');

            const a: typeof import('static-typeof-import');
            const a = import('non-literal-' + 'import');
            const a: import('static-type-import') = import('dynamic-const-import') as import('static-as-type-import');

            const a: Gen<typeof import('static-generic-import')>;

            const b = require('static-require');
            const b = require(`require-in-backticks`);
            const b = require.resolve('static-require-dot-resolve');
            const b = require(`non-literal-${'require'}`);

            export * from 'static-export';
            export { a } from 'static-partial-export';
            export type { a } from 'static-type-export';
            export default import('dynamic-exported-import');
            export default require('static-default-export-of-a-require');
            export function a() { return 'function-export';}
            export const a = 'const-export';
            export type a = 'type-export';
            module.exports = {
              a: await import('dynamic-module-export-in-object'),
              a: require('static-module-export-require-in-object'),
            };
            exports = {
              a: await import('dynamic-export-in-object'),
              a: require('static-require-in-object'),
            };



            console.log(`${import('dynamic-import-in-string-template')}`);
            console.log(`${`${import('dynamic-import-in-string-template-in-string-template')}`}`);

            function f(a: import('static-argument-type-import') = import('dynamic-default-argument-import')): import('static-return-type-import') {
                require('dynamic-require');
            }

            class Animal {
                a: import('static-class-property-type-import') = import('dynamic-class-property-value-import');
                a: { a: import('static-class-property-type-import-in-object') } = { a: import('dynamic-class-property-value-import-in-object') };
                eat(food: import('static-method-argument-type-import')) {
                    import('dynamic-method-import');
                    require('dynamic-method-require');
                }
            }

            const obj = {
                [import('dynamic-obj-key-import')]: import('dynamic-obj-prop-import'),
                [require('static-obj-key-require')]: require('static-obj-prop-require')
            };

            const obj = {
                method: function(): import('static-import-in-object-method-return-type') {
                  import('dynamic-import-in-object-method');
                }
            };

            (a as import('static-import-as-type-cast')).a;

            const a: (a: import('static-function-param-type')) => import('static-function-return-type') = () => {
                const a: import('static-import-in-arrow-function') = import('static-import-in-arrow-function');
            }

            (() => {
                const a: import('static-import-in-iife') = import('dynamic-import-in-iife');
            })();

            ((a: { a: import('static-import-in-iife-parameter-type') } = { a: import('static-import-in-iife-parameter-default') }) => {
                const a: import('static-import-in-iife') = import('dynamic-import-in-iife');
            })();

            {
                import('dynamic-import-in-block-closure');
            }

            console.log({
                a: import('dynamic-import-in-object-in-function-call')
            });

            const a = 3 + (await import('dynamic-import-in-binary-operation'));

            const arr = [require('static-require-in-arr')];

            const e = require(name + 'non-literal-require');

            const foo = import(name + 'non-literal-import2');

            console.log(`import { c } from 'in-string-literal';`);

            "#,
            )
            .unwrap();

        temp_dir
            .child("broken-file.ts")
            .write_str(
                r#"
            impo { a } frm 'broken-import';
            import { a } from
            export { }
            import { a } from 'import-in-broken-file';
            "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";
        let broken_file_path = temp_dir.display().to_string() + "/broken-file.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone(), broken_file_path],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
        let result_from_broken_file = results.get(1).unwrap();

        assert_eq!(
            result_from_broken_file.static_import_expressions,
            vec![String::from("import-in-broken-file"),]
        );
    }

    #[test]
    fn test_find_imports_with_all_sorts_of_imports() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
      import * as React from "react";
      import { Component } from "react";
      import {
        Component
      } from "react"
      import {
        Component
      } from "react";

      import "./app.scss";

      function inside() {
        import('./module.ts')
      }
      const a = 1;
      export class App {}
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    #[test]
    fn test_find_imports_with_all_sorts_of_exports() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
      export * from './module';
      export {
        A
      } from './a';

      export { B } from './b';
      export type { B } from './b';

      export { C as D } from './c';

      const a = 1;
      export class App {}
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    #[test]
    fn test_find_with_require_statements() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
     require('./a');

     require('./b');
     const c = require('./c');

     const a = 1;
     export class App {}
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    #[test]
    fn test_find_imports_should_ignore_lines_with_nx_ignore() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"


      // nx-ignore-next-line
      import * as React from "react";

      // nx-ignore-next-line
      import "./app.scss";

      // nx-ignore-next-line
      import('./module.ts')

      // nx-ignore-next-line
      export { B } from './b';

      // nx-ignore-next-line
      const b = require('./b');
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(String::from("a"), vec![test_file_path])]));

        let result = results.get(0).unwrap();

        assert!(result.static_import_expressions.is_empty());
        assert!(result.dynamic_import_expressions.is_empty());
    }

    #[test]
    fn find_imports_should_find_imports_around_template_literals() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"

      const b = `a: ${a}`
      const c = await import('./c')

      const c = `a: ${a}, b: ${b}`
      const d = await import('./d')
      const b = unquotedLiteral.replace(/"/g, '\\"')
      const c = await import('./c')
      const d = require('./d')
      const b = `"${unquotedLiteral.replace(/"/g, '\\"')}"`
      const c = await import('./c')
      const d = require('./d')
      const b = `"${1 / 2} ${await import('./b')} ${await require('./c')}"`;
      const a = `"${require('./a')}"`
      const b = `"${await import('./b')}"`
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    #[test]
    fn find_imports_should_find_imports_after_regexp() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"

      const b = /"/g; const c = await import('dynamic-import-after-regex-assignment'); const d = require('static-require-after-regex-assignment')

    (async () => {
      /"/g.test(await import('dynamic-import-after-regex'));
    })();


      const a = 10 / 1; const c = await import('dynamic-import-after-number-division'); const d = require('static-require-after-number-division')
      const a = new RegExp(require('static-require-in-regex'))
      const a = 10 / require('static-require-being-divided-by')

      const a = 10; const b = a / 1; const c = await import('dynamic-import-after-identifier-division'); const d = require('static-require-after-identifier-division')
      const a = {}; const b = a.a / 1; const c = await import('dynamic-import-after-property-access-division'); const d = require('static-require-after-property-access-division')
      const a = {}; const b = a.getLength() / 1; const c = await import('dynamic-import-after-return-value-division'); const d = require('static-require-after-return-value-division')
      const a = "a" / 1; const c = await import('dynamic-import-after-string-division'); const d = require('static-require-after-string-division')
      const a = `a` / 1; const c = await import('dynamic-import-after-string-template-division'); const d = require('static-require-after-string-template-division')


      const a = new RegExp(/"/g); const c = await import('dynamic-import-after-new-regexp'); const d = require('static-require-after-new-regexp')
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]));

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path);

        dbg!(&result);
        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    // This function finds imports with the ast which verifies that the imports we find are the same as the ones typescript finds
    fn find_imports_with_ast(file_path: String) -> ImportResult {
        let cm = Arc::<SourceMap>::default()
            .load_file(Path::new(file_path.as_str()))
            .unwrap();

        let mut errs: Vec<swc_ecma_parser::error::Error> = vec![];
        let tsx = file_path.ends_with(".tsx") || file_path.ends_with(".jsx");

        let module = swc_ecma_parser::parse_file_as_module(
            &cm,
            Syntax::Typescript(TsConfig {
                tsx,
                decorators: true,
                dts: file_path.ends_with(".d.ts"),
                no_early_errors: false,
                ..TsConfig::default()
            }),
            EsNext,
            None,
            &mut errs,
        )
        .unwrap();

        let comments = NoopComments;
        let deps = swc_ecma_dep_graph::analyze_dependencies(&module, &comments);

        let mut static_import_expressions = vec![];
        let mut dynamic_import_expressions = vec![];
        for dep in deps {
            let line_with_dep = cm.lookup_line(dep.span.lo).expect("The dep is on a line");

            if line_with_dep > 0 {
                if let Some(line_before_dep) = cm.get_line(line_with_dep - 1) {
                    let trimmed_line = line_before_dep.trim();
                    if trimmed_line == "// nx-ignore-next-line"
                        || trimmed_line == "/* nx-ignore-next-line */"
                    {
                        continue;
                    }
                }
            }

            if dep.is_dynamic {
                dynamic_import_expressions.push(dep.specifier.to_string());
            } else {
                static_import_expressions.push(dep.specifier.to_string());
            }
        }
        ImportResult {
            source_project: String::from("source"),
            file: file_path,
            static_import_expressions,
            dynamic_import_expressions,
        }
    }
}
