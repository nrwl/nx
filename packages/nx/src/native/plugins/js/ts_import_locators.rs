use anyhow::anyhow;
use std::collections::{HashMap, HashSet};
use std::fmt::Debug;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use rayon::prelude::*;
use tracing::debug;
use tracing::trace;

use swc_common::comments::SingleThreadedComments;
use swc_common::{BytePos, SourceMap, Spanned};
use swc_ecma_ast::EsVersion::EsNext;
use swc_ecma_parser::error::Error;
use swc_ecma_parser::lexer::Lexer;
use swc_ecma_parser::token::Keyword::{
    Catch, Class, Default_, Export, Finally, Function, Import, Try,
};
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
    TryCatchFinally,
}

fn is_identifier(token: &Token) -> bool {
    matches!(token, Token::Word(Ident(_)))
}

struct State<'a> {
    lexer: Lexer<'a>,
    pub current_token: Option<TokenAndSpan>,
    pub previous_token: Option<TokenAndSpan>,
    pub import_type: ImportType,
    open_brace_count: i128,
    open_bracket_count: i128,
    blocks_stack: Vec<BlockType>,
    next_block_type: BlockType,
}

impl<'a> State<'a> {
    pub fn new(lexer: Lexer<'a>) -> Self {
        State {
            lexer,
            current_token: None,
            previous_token: None,
            open_brace_count: 0,
            open_bracket_count: 0,
            blocks_stack: vec![],
            next_block_type: BlockType::Block,
            import_type: ImportType::Dynamic,
        }
    }

    pub fn take_errors(&mut self) -> Vec<Error> {
        self.lexer.take_errors()
    }

    pub fn next(&mut self) -> &Option<TokenAndSpan> {
        // Keep the current token as the last token before calling next
        self.previous_token = self.current_token.clone();

        let next = self.lexer.next();

        // Store current token
        self.current_token = next;

        if let Some(current) = &self.current_token {
            // Keep track of braces/ when blocks begin and end
            match &current.token {
                Token::DollarLBrace => {
                    self.open_brace_count += 1;
                }
                Token::LBrace => {
                    self.open_brace_count += 1;

                    // A new block has opened so push the new block type
                    self.blocks_stack.push(self.next_block_type);
                }
                Token::RBrace => {
                    self.open_brace_count -= 1;

                    // Reset the next block type
                    self.next_block_type = BlockType::Block;

                    // The block has closed so remove it from the block stack
                    self.blocks_stack.pop();
                }
                Token::LBracket => {
                    self.open_bracket_count += 1;
                }
                Token::RBracket => {
                    self.open_bracket_count -= 1;
                }
                _ => {}
            }

            // Keep track of when we are in an object declaration because colons mean different things
            let in_object_declaration = self.blocks_stack.contains(&BlockType::Object);
            // Keep track of when we are in an array declaration because commas mean different things
            let in_array_declaration = self.open_bracket_count > 0;

            let new_line = self.lexer.had_line_break_before_last();

            // This is the beginning of a new statement, reset the import type to the default
            // Reset import type when there is new line not in braces
            if new_line && self.open_brace_count == 0 {
                self.import_type = ImportType::Dynamic;
            }

            match &current.token {
                Token::Word(word) => match word {
                    // Matches something like const a = a as import('a')
                    // This is a static type import
                    Ident(i) if i == "as" => {
                        self.import_type = ImportType::Static;
                    }
                    // Matches something like export const = import('a')
                    // This is a dynamic import
                    Keyword(keyword) if *keyword == Export => {
                        self.import_type = ImportType::Dynamic;
                    }

                    // If a function keyword appears, the next open brace will start a function block
                    Keyword(keyword) if *keyword == Function => {
                        self.next_block_type = BlockType::Function;
                    }
                    // If a class keyword appears, the next open brace will start a class block
                    Keyword(keyword) if *keyword == Class => {
                        self.next_block_type = BlockType::Class;
                    }

                    // If a try/catch/finally keyword appears, the next open brace will start a function block
                    Keyword(keyword)
                        if *keyword == Try || *keyword == Catch || *keyword == Finally =>
                    {
                        self.next_block_type = BlockType::TryCatchFinally;
                    }
                    _ => {}
                },
                Token::AssignOp(_) => {
                    // When things are assigned, they are dynamic imports
                    // Ex: const a = import('a');
                    self.import_type = ImportType::Dynamic;

                    // When assigning things, an open brace means an object
                    self.next_block_type = BlockType::Object
                }
                // When we see a (, the next brace is an object passed into a function
                // Matches console.log({ a: import('a') });
                Token::LParen => {
                    if let Some(t) = &self.previous_token {
                        match t.token {
                            _ if is_identifier(&t.token) => {
                                // Function Call
                                self.next_block_type = BlockType::Object;
                            }
                            _ => {
                                // Arrow Function Declaration
                                self.next_block_type = BlockType::ArrowFunction;
                            }
                        }
                    }
                }
                // When an array opens, the next brace will be an object
                // Matches [{ }]
                Token::LBracket => {
                    if let Some(t) = &self.previous_token {
                        match t.token {
                            Token::Colon => {
                                self.next_block_type = BlockType::ObjectType;
                            }
                            _ => {
                                self.next_block_type = BlockType::Object;
                            }
                        }
                    }
                }
                Token::Comma => {
                    if in_array_declaration {
                        self.next_block_type = BlockType::Object;
                    }
                }
                Token::BinOp(op) => match op {
                    BinOpToken::Lt => {
                        // Matches things like Foo<typeof import('a')>
                        // This is a static import
                        if let Some(t) = &self.previous_token {
                            match t.token {
                                _ if is_identifier(&t.token) => {
                                    // Generic
                                    self.import_type = ImportType::Static;
                                }
                                _ => {}
                            }
                        }
                    }

                    BinOpToken::Div => {
                        if let Some(t) = &self.previous_token {
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
                                | Token::BackQuote
                                | Token::JSXTagStart
                                | Token::JSXName { .. } => {
                                    return self.next();
                                }
                                // Everything else, is the start of a regex
                                // The lexer needs to know when there's a regex
                                _ => {
                                    self.lexer
                                        .set_next_regexp(Some(self.current_token.span_lo()));

                                    if self.next().is_some() {
                                        self.lexer.set_next_regexp(None);
                                    }
                                }
                            }
                        }
                    }

                    // When there are binary operations, it is dynamic
                    // Matches things like const a = 3 + (await import('a'))
                    _ => {
                        self.import_type = ImportType::Dynamic;
                    }
                },
                // When there is a string literal, ${ begins a dynamic expression
                // When functions and methods begin, this starts a dynamic block
                Token::DollarLBrace | Token::LBrace => {
                    self.import_type = ImportType::Dynamic;
                }
                // When we see a ; A new dynamic statement begins
                Token::Semi => {
                    self.import_type = ImportType::Dynamic;
                }
                Token::Colon => {
                    if let Some(t) = &self.previous_token {
                        match t.token {
                            // Matches { 'a': import('a') }
                            Token::Str { .. } if in_object_declaration => {
                                // Object Property Assignment
                                self.import_type = ImportType::Dynamic
                            }
                            // Matches { [a]: import('a') }
                            Token::RBracket if in_object_declaration => {
                                // Object Property Assignment
                                self.import_type = ImportType::Dynamic
                            }
                            // Object Property Assignment
                            // Matches { a: import('a') }
                            _ if is_identifier(&t.token) && in_object_declaration => {
                                self.import_type = ImportType::Dynamic
                            }
                            // Matches const a: typeof import('a')
                            _ => {
                                // A brace would begin an object type
                                // Ex: const a: { a: typeof import('a') }
                                self.next_block_type = BlockType::ObjectType;
                                // This is a typing and is static
                                self.import_type = ImportType::Static;
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        &self.current_token
    }
}

fn find_specifier_in_import(state: &mut State) -> Option<(String, ImportType)> {
    if let Some(next) = state.next() {
        // This match is pretty strict on what should follow an import, anything else is skipped
        match &next.token {
            // This begins a module naming
            // Ex: import { a } from 'a';
            Token::LBrace => {}
            // This indicates a import function call
            // Ex: import('a')
            Token::LParen => {
                let mut maybe_literal = None;

                while let Some(current) = state.next() {
                    match &current.token {
                        // If we match a string, then it might be a literal import
                        Token::Str { value, .. } => {
                            maybe_literal = Some(value.to_string());
                        }
                        Token::BackQuote => {
                            let mut set = false;
                            while let Some(current) = state.next() {
                                match &current.token {
                                    // If we match a string, then it might be a literal import
                                    Token::BackQuote => {
                                        break;
                                    }
                                    Token::Template { raw, .. } => {
                                        if !set {
                                            set = true;
                                            maybe_literal = Some(raw.to_string());
                                        } else {
                                            return None;
                                        }
                                    }
                                    _ => return None,
                                };
                            }
                        }
                        Token::RParen => {
                            // When the function call is closed, add the import if it exists
                            if let Some(import) = maybe_literal {
                                return match &state.import_type {
                                    ImportType::Static => Some((import, ImportType::Static)),
                                    ImportType::Dynamic => Some((import, ImportType::Dynamic)),
                                };
                            }
                        }
                        // If we match anything else, continue the outer loop and skip this import
                        // because it is not a literal import
                        _ => {
                            return None;
                        }
                    }
                }
            }
            // This is a import star statement
            // Ex: import * from 'a';
            Token::BinOp(op) if *op == BinOpToken::Mul => {}
            Token::Word(word) => match word {
                // This is a import type statement
                // Ex: import type { } from 'a';
                Ident(i) if i == "type" => {
                    if let Some(next) = state.next() {
                        // What follows a type import is pretty strict, otherwise ignore it
                        match &next.token {
                            // Matches import type {} from 'a';
                            Token::LBrace => {}
                            // Matches import type * from 'a';
                            Token::BinOp(op) if *op == BinOpToken::Mul => {}
                            // Matches import type Cat from 'a';
                            Token::Word(Ident(_)) => {}
                            _ => {
                                return None;
                            }
                        }
                    }
                }
                _ => {}
            },
            // Matches: import 'a';
            Token::Str { value, .. } => {
                return Some((value.to_string(), ImportType::Static));
            }
            _ => {
                return None;
            }
        }
    }

    // This is a static import because it is not a import function call
    // import { } from 'a';
    while let Some(current) = state.next() {
        if let Token::Str { value, .. } = &current.token {
            return Some((value.to_string(), ImportType::Static));
        }
    }

    None
}

fn find_specifier_in_export(state: &mut State) -> Option<(String, ImportType)> {
    if let Some(next) = state.next() {
        // This match is pretty strict about what follows an export keyword
        // Everything else is skipped
        match &next.token {
            // Matches export { } from 'a';
            Token::LBrace => {}
            Token::Word(Ident(i)) if i == "type" => {
                // Matches an export type
                if let Some(next) = state.next() {
                    // What follows is pretty strict
                    match next.token {
                        // Matches export type { a } from 'a';
                        Token::LBrace => {}
                        // Anything else after a type is a definition, not an import
                        // Matches export type = 'a';
                        _ => {
                            return None;
                        }
                    }
                }
            }
            // Matches export * from 'a';
            Token::BinOp(op) if *op == BinOpToken::Mul => {}
            _ => {
                return None;
            }
        }
    }

    while let Some(current) = state.next() {
        match &current.token {
            // Matches:
            // export { A }
            // export { A as B }
            // export { A } from
            // export { A, B } from
            Token::RBrace | Token::Word(Ident(_)) | Token::Comma => {}
            Token::Word(Keyword(kw)) if *kw == Default_ => {}
            // When we find a string, it's a export
            Token::Str { value, .. } => return Some((value.to_string(), ImportType::Static)),
            _ => {
                return None;
            }
        }
    }

    None
}

fn find_specifier_in_require(state: &mut State) -> Option<(String, ImportType)> {
    let mut import = None;
    let mut set = false;
    while let Some(current) = state.next() {
        match &current.token {
            // This opens the require call
            Token::LParen |
            // Matches things like require.resolve
            Token::Dot |
            Token::Comma |
            Token::LBrace |
            Token::RBrace |
            Token::LBracket |
            Token::RBracket |
            Token::Colon |
            Token::Word(Ident(_)) => {}
            // This could be a string literal
            Token::Str { value, .. }=> {
                if !set {
                    set = true;
                    import = Some(value.to_string());
                } else {
                    import = None
                }
            }
            Token::BackQuote => {
                let mut set = false;
                while let Some(current) = state.next() {
                    match &current.token {
                        // If we match a string, then it might be a literal import
                        Token::BackQuote => {
                            break;
                        }
                        Token::Template { raw, .. } => {
                            if !set {
                                set = true;
                                import = Some(raw.to_string());
                            } else {
                                return None;
                            }
                        }
                        _ => return None,
                    };
                }
            }

            // When the require call ends, add the require
            Token::RParen => {
                if let Some(import) = import {
                    // When all blocks are object blocks, this is a static require
                    // Matches things like const a = { a: require('a') };
                    let static_import = state
                        .blocks_stack
                        .iter()
                        .all(|block_type| matches!(block_type, BlockType::Object));

                    let import_type = if static_import {
                        ImportType::Static
                    } else {
                        ImportType::Dynamic
                    };

                    return Some((import, import_type));
                } else {
                    return None;
                }
            }
            // If we found an import, definitely wait for the RParen so it gets added
            _ if import.is_some() => {}
            // Anything else means this is not a require of a string literal
            _ => {
                return None;
            }
        }
    }

    None
}

fn process_file(
    (source_project, file_path): (&String, &String),
) -> anyhow::Result<Option<ImportResult>> {
    let now = Instant::now();
    let cm = Arc::<SourceMap>::default()
        .load_file(Path::new(file_path))
        .map_err(|e| anyhow!("Unable to load {}: {}", file_path, e))?;

    let comments = SingleThreadedComments::default();

    let tsx = file_path.ends_with(".tsx") || file_path.ends_with(".jsx");
    let lexer = Lexer::new(
        Syntax::Typescript(TsConfig {
            tsx,
            decorators: false,
            dts: file_path.ends_with(".d.ts"),
            no_early_errors: false,
            disallow_ambiguous_jsx_like: false,
        }),
        EsNext,
        (&*cm).into(),
        Some(&comments),
    );

    // State
    let mut state = State::new(lexer);

    let mut static_import_expressions: Vec<(String, BytePos)> = vec![];
    let mut dynamic_import_expressions: Vec<(String, BytePos)> = vec![];

    loop {
        let current_token = state.next();

        // This is the end of the file
        if current_token.is_none() {
            break;
        }

        let mut pos: Option<BytePos> = None;

        if let Some(current) = &current_token {
            let word = match &current.token {
                Token::Word(w) => w,
                _ => {
                    continue;
                }
            };
            let import = match word {
                // This is an import keyword
                Keyword(keyword) if *keyword == Import => {
                    pos = Some(current.span.lo);
                    find_specifier_in_import(&mut state)
                }
                Keyword(keyword) if *keyword == Export => {
                    pos = Some(current.span.lo);

                    find_specifier_in_export(&mut state)
                }
                Ident(ident) if ident == "require" => {
                    pos = Some(current.span.lo);
                    find_specifier_in_require(&mut state)
                }
                _ => None,
            };

            if let Some((specifier, import_type)) = import {
                let pos = pos.expect("Always exists when there is an import");
                match import_type {
                    ImportType::Static => {
                        static_import_expressions.push((specifier, pos));
                    }
                    ImportType::Dynamic => {
                        dynamic_import_expressions.push((specifier, pos));
                    }
                }
            }
        }
    }

    trace!("finding imports in {} {:.2?}", file_path, now.elapsed());

    // These are errors from the lexer. They don't always mean something is broken
    let mut errs = state.take_errors();
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

    // Create a HashMap of comments by the lines where they end
    let (leading_comments, _) = comments.take_all();
    let mut lines_with_nx_ignore_comments: HashSet<usize> = HashSet::new();
    let leading_comments = leading_comments.borrow();
    for (_, comments) in leading_comments.iter() {
        for comment in comments {
            let comment_text = comment.text.trim();

            if comment_text.contains("nx-ignore-next-line") {
                let line_where_comment_ends = cm
                    .lookup_line(comment.span.hi)
                    .expect("Comments end on a line");

                lines_with_nx_ignore_comments.insert(line_where_comment_ends);
            }
        }
    }

    let code_is_not_ignored = |(specifier, pos): (String, BytePos)| {
        let line_with_code = cm.lookup_line(pos).expect("All code is on a line");
        if line_with_code > 0 && lines_with_nx_ignore_comments.contains(&(line_with_code - 1)) {
            None
        } else {
            Some(specifier)
        }
    };

    let static_import_expressions = static_import_expressions
        .into_iter()
        .filter_map(code_is_not_ignored)
        .collect();
    let dynamic_import_expressions = dynamic_import_expressions
        .into_iter()
        .filter_map(code_is_not_ignored)
        .collect();

    Ok(Some(ImportResult {
        file: file_path.clone(),
        source_project: source_project.clone(),
        static_import_expressions,
        dynamic_import_expressions,
    }))
}

#[napi]
fn find_imports(
    project_file_map: HashMap<String, Vec<String>>,
) -> anyhow::Result<Vec<ImportResult>> {
    enable_logger();

    let files_to_process: Vec<(&String, &String)> = project_file_map
        .iter()
        .flat_map(|(project_name, files)| files.iter().map(move |file| (project_name, file)))
        .collect();

    let (successes, errors): (Vec<_>, Vec<_>) = files_to_process
        .into_par_iter()
        .map(process_file)
        .partition(|r| r.is_ok());

    if !errors.is_empty() {
        let errors = errors
            .into_iter()
            .map(|e| e.unwrap_err())
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("\n");
        anyhow::bail!("{:?}", errors);
    }

    successes
        .into_iter()
        .filter_map(|r| r.transpose())
        .collect()
}
#[cfg(test)]
mod find_imports {
    use super::*;
    use crate::native::glob::build_glob_set;
    use crate::native::walker::nx_walker;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
    use std::env;
    use std::path::PathBuf;
    use swc_common::comments::NoopComments;

    #[test]
    fn should_not_include_ignored_imports() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
  // nx-ignore-next-line
  import 'a';

/* nx-ignore-next-line */
import 'a1';

/*      nx-ignore-next-line */
import 'a2';

/**
  * nx-ignore-next-line
  */
import 'a3';

/*
  nx-ignore-next-line
  */
import 'a4'; import 'a5';

/* prettier-ignore */ /* nx-ignore-next-line */
import 'a4'; import 'a5';

/* nx-ignore-next-line */ /* prettier-ignore */
import 'a4'; import 'a5';

                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();

        assert!(result.static_import_expressions.is_empty());
        assert!(result.dynamic_import_expressions.is_empty());
    }

    #[test]
    fn should_find_imports() {
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
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let mut ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

        // SWC does not find imports with backticks
        ast_results
            .static_import_expressions
            .insert(12, "require-in-backticks".to_string());

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
    fn should_find_imports_in_vue_files() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.vue")
            .write_str(
                r#"

                <script setup lang="ts">
import { VueComponent } from './component.vue'
import('./dynamic-import.vue')
</script>

<template>
  <WelcomeItem>
    <template #icon>
      <DocumentationIcon />
    </template>
    <template #heading>Documentation</template>

    Vue’s
    <a href="https://vuejs.org/" target="_blank" rel="noopener">official documentation</a>
    provides you with all information you need to get started.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <ToolingIcon />
    </template>
    <template #heading>Tooling</template>

    This project is served and bundled with
    <a href="https://vitejs.dev/guide/features.html" target="_blank" rel="noopener">Vite</a>. The
    recommended IDE setup is
    <a href="https://code.visualstudio.com/" target="_blank" rel="noopener">VSCode</a> +
    <a href="https://github.com/johnsoncodehk/volar" target="_blank" rel="noopener">Volar</a>. If
    you need to test your components and web pages, check out
    <a href="https://www.cypress.io/" target="_blank" rel="noopener">Cypress</a> and
    <a href="https://on.cypress.io/component" target="_blank">Cypress Component Testing</a>.

    <br />

    More instructions are available in <code>README.md</code>.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <EcosystemIcon />
    </template>
    <template #heading>Ecosystem</template>

    Get official tools and libraries for your project:
    <a href="https://pinia.vuejs.org/" target="_blank" rel="noopener">Pinia</a>,
    <a href="https://router.vuejs.org/" target="_blank" rel="noopener">Vue Router</a>,
    <a href="https://test-utils.vuejs.org/" target="_blank" rel="noopener">Vue Test Utils</a>, and
    <a href="https://github.com/vuejs/devtools" target="_blank" rel="noopener">Vue Dev Tools</a>. If
    you need more resources, we suggest paying
    <a href="https://github.com/vuejs/awesome-vue" target="_blank" rel="noopener">Awesome Vue</a>
    a visit.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <CommunityIcon />
    </template>
    <template #heading>Community</template>

    Got stuck? Ask your question on
    <a href="https://chat.vuejs.org" target="_blank" rel="noopener">Vue Land</a>, our official
    Discord server, or
    <a href="https://stackoverflow.com/questions/tagged/vue.js" target="_blank" rel="noopener"
      >StackOverflow</a
    >. You should also subscribe to
    <a href="https://news.vuejs.org" target="_blank" rel="noopener">our mailing list</a> and follow
    the official
    <a href="https://twitter.com/vuejs" target="_blank" rel="noopener">@vuejs</a>
    twitter account for latest news in the Vue world.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <SupportIcon />
    </template>
    <template #heading>Support Vue</template>

    As an independent project, Vue relies on community backing for its sustainability. You can help
    us by
    <a href="https://vuejs.org/sponsor/" target="_blank" rel="noopener">becoming a sponsor</a>.
  </WelcomeItem>
</template>


            "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.vue";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();

        assert_eq!(
            result.static_import_expressions,
            vec![String::from("./component.vue")]
        );
        assert_eq!(
            result.dynamic_import_expressions,
            vec![String::from("./dynamic-import.vue")]
        );
    }

    #[test]
    fn should_find_imports_in_all_sorts_of_import_statements() {
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


      const a: [{ a: typeof import('static-import-in-array-type-in-object')}] = [];

      const a = [{ a: import('dynamic-import-in-object-in-array')}];

      const a = { a: [import('dynamic-import-in-array-in-object')]};

      const routes = [
        {},
        {
            lazy: () => import('dynamic-import-lazy-route')
        }
      ]
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

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
    fn should_find_imports_in_all_sorts_of_export_statements() {
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

      export { a as aa }

      export function f() {
        return 'value-after-export';
      }

      export { a as aa };

      export { a as default } from 'static-default-export';

      export function f() {
        return 'value-after-export';
      }
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

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
    fn should_find_imports_in_all_sorts_of_require_statements() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
     require('./a');

     require('./b');
     const c = require('./c');

     const d = require(`./d`);
     const d = require('dynamic-portion' + 'dynamic-portion');

     const a = 1;
     export class App {}
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let mut ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

        // SWC does not find imports with backticks
        ast_results
            .static_import_expressions
            .push("./d".to_string());

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
    fn should_find_imports_in_tsx_files() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.tsx")
            .write_str(
                r#"
                import dynamic from 'next/dynamic';
                import { ReactElement, useEffect, useState } from 'react';


                export function A() {
                  return (
                        <button className="sr-only">Loading...</button>
                  );
                }
                const NxProjectGraphViz = dynamic(
                  () => import('dynamic-import-after-jsx').then((m) => m.A),
                  {
                    ssr: false,
                    loading: () => <A />,
                  }
                );
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.tsx";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

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
    fn should_ignore_lines_with_nx_ignore() {
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

        let results =
            find_imports(HashMap::from([(String::from("a"), vec![test_file_path])])).unwrap();

        let result = results.get(0).unwrap();

        assert!(result.static_import_expressions.is_empty());
        assert!(result.dynamic_import_expressions.is_empty());
    }

    #[test]
    fn should_find_imports_around_template_literals() {
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
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

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
    fn should_find_imports_after_regexp() {
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
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

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
    fn should_find_imports_in_imports_with_template_literals() {
        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child("test.ts")
            .write_str(
                r#"
// Basic static import
import { Component } from 'react';

// Import with template literal
import(`react`);
const moduleName = 'react';
import(`${moduleName}`);

// Import with template literal and string concatenation
const modulePart1 = 're';
const modulePart2 = 'act';
import(`${modulePart1}${modulePart2}`);

// Import with template literal and expression
const version = 17;
import(`react@${version}`);

// Import with template literal and multi-line string
import(`react
@${version}`);

// Import with template literal and tagged template
function myTag(strings, ...values) {
  return strings[0] + values[0];
}
import(myTag`react@${version}`);
                "#,
            )
            .unwrap();

        let test_file_path = temp_dir.display().to_string() + "/test.ts";

        let results = find_imports(HashMap::from([(
            String::from("a"),
            vec![test_file_path.clone()],
        )]))
        .unwrap();

        let result = results.get(0).unwrap();
        let mut ast_results: ImportResult = find_imports_with_ast(test_file_path).unwrap();

        assert_eq!(
            result.static_import_expressions,
            ast_results.static_import_expressions
        );
        // SWC does not find the template literal import
        ast_results.dynamic_import_expressions.push("react".into());
        assert_eq!(
            result.dynamic_import_expressions,
            ast_results.dynamic_import_expressions
        );
    }

    #[test]
    #[ignore]
    fn should_find_imports_properly_for_all_files_in_nx_repo() {
        let current_dir = env::current_dir().unwrap();

        let mut ancestors = current_dir.ancestors();

        ancestors.next();
        ancestors.next();
        let root = PathBuf::from(ancestors.next().unwrap());

        let glob = build_glob_set(&["**/*.[jt]s"]).unwrap();
        let files = nx_walker(root.clone())
            .filter(|file| glob.is_match(&file.full_path))
            .map(|file| file.full_path)
            .collect::<Vec<_>>();

        let results: HashMap<_, _> =
            find_imports(HashMap::from([(String::from("nx"), files.clone())]))
                .unwrap()
                .into_iter()
                .map(|import_result| (import_result.file.clone(), import_result))
                .collect();

        let ast_results: HashMap<_, _> = files
            .into_iter()
            .filter_map(|p| find_imports_with_ast(p).ok())
            .map(|import_result| (import_result.file.clone(), import_result))
            .collect();

        for (path, import_result) in results {
            let ast_result = ast_results.get(&path);

            if let Some(ast_result) = ast_result {
                dbg!(&path, &import_result, &ast_result);
                assert_eq!(
                    import_result.static_import_expressions,
                    ast_result.static_import_expressions
                );
                assert_eq!(
                    import_result.dynamic_import_expressions,
                    ast_result.dynamic_import_expressions
                );
            }
        }
    }

    // This function finds imports with the ast which verifies that the imports we find are the same as the ones typescript finds
    fn find_imports_with_ast(file_path: String) -> anyhow::Result<ImportResult> {
        let cm = Arc::<SourceMap>::default()
            .load_file(Path::new(file_path.as_str()))
            .unwrap();

        let mut errs: Vec<Error> = vec![];
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
        .map_err(|_| anyhow::anyhow!("Failed to create ast"))?;

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
        Ok(ImportResult {
            source_project: String::from("source"),
            file: file_path,
            static_import_expressions,
            dynamic_import_expressions,
        })
    }
}
