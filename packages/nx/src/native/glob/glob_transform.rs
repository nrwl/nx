//! Taking glob text apart and putting it back together for the matching
//! engine: brace groups, the directory a glob is read from, slash
//! normalization, and the conversion the engine needs.

use crate::native::glob::glob_group::GlobGroup;
use crate::native::glob::glob_parser::{is_literal_segment, parse_glob};
use itertools::Itertools;
use std::collections::HashSet;

/// Expands brace groups whose alternatives are all literal names into the
/// exact paths they stand for (`{nx,tsconfig.base}.json` → `nx.json`,
/// `tsconfig.base.json`; several groups multiply out). A group with a wildcard
/// or a nested brace is left as-is. A group of literals at the workspace root
/// names exact files, not a walk.
pub(crate) fn expand_literal_braces(glob: &str) -> Vec<String> {
    let negated = glob.starts_with('!');
    let body = glob.strip_prefix('!').unwrap_or(glob);
    let Some(open) = body.find('{') else {
        return vec![glob.to_string()];
    };
    let Some(close) = body[open..].find('}').map(|i| open + i) else {
        return vec![glob.to_string()];
    };
    let alternatives: Vec<&str> = body[open + 1..close].split(',').collect();
    let literal = alternatives.len() > 1
        && alternatives
            .iter()
            .all(|a| !a.is_empty() && !a.contains(['*', '?', '[', ']', '{', '}', '/', '\\']));
    if !literal {
        return vec![glob.to_string()];
    }
    let prefix = if negated { "!" } else { "" };
    alternatives
        .iter()
        .flat_map(|alternative| {
            let expanded = format!("{}{}{}", &body[..open], alternative, &body[close + 1..]);
            expand_literal_braces(&expanded)
        })
        .map(|expanded| {
            let expanded = expanded.strip_prefix('!').unwrap_or(&expanded).to_string();
            format!("{prefix}{expanded}")
        })
        .collect()
}

/// A glob split into the directory it is read from and the pattern under it.
/// The directory is the glob's own text up to its first pattern segment, so
/// `dist/@scope` is a directory like any other; `normalize_glob` first when
/// `dist//gen/` and `dist/gen` should read the same. The remainder comes back untouched, with a negation marker
/// re-attached, and is `None` when the glob is literal to its end: it then
/// names that path rather than matching under it.
///
/// A segment is literal when the glob parser reads it as nothing but text. One
/// the parser cuts short, like a directory named `paren(`, counts as a pattern:
/// the walk starts shallower and still matches, only slower. See NXC-5001.
pub(crate) fn partition_glob(glob: &str) -> (String, Option<String>) {
    let (negated, body) = match glob.strip_prefix('!') {
        Some(body) => (true, body),
        None => (false, glob),
    };
    let mut literal: Vec<&str> = Vec::new();
    let mut consumed = 0;
    let mut remainder = None;
    for segment in body.split('/') {
        if !is_literal_segment(segment) {
            remainder = Some(&body[consumed..]);
            break;
        }
        literal.push(segment);
        consumed += segment.len() + 1;
    }
    let directory = literal.join("/");
    let remainder = remainder.map(|rest| match negated {
        true => format!("!{rest}"),
        false => rest.to_string(),
    });
    (directory, remainder)
}

/// Collapses repeated and trailing slashes so `dist//gen/` and `dist/gen`
/// name the same directory, and so prefix arithmetic below lines up.
pub(crate) fn normalize_glob(glob: &str) -> String {
    let (prefix, body) = match glob.strip_prefix('!') {
        Some(body) => ("!", body),
        None => ("", glob),
    };
    let mut out = String::with_capacity(glob.len());
    out.push_str(prefix);
    let mut previous_slash = false;
    for c in body.chars() {
        if c == '/' {
            if previous_slash {
                continue;
            }
            previous_slash = true;
        } else {
            previous_slash = false;
        }
        out.push(c);
    }
    if out.len() > prefix.len() && out.ends_with('/') {
        out.pop();
    }
    out
}

/// A fileset entry that names a path with no glob syntax means that file, or
/// that directory and everything under it, so it becomes both. Which one it
/// is depends on the disk, and a glob set never looks; matching both costs
/// one extra pattern and reads the same in either case. An entry that already
/// carries a pattern, or ends in `/`, is left alone.
pub(crate) fn path_or_everything_under(glob: &str) -> Vec<String> {
    let body = glob.strip_prefix('!').unwrap_or(glob);
    // `partition_glob` decides what counts as a pattern, so a directory named
    // `@types` or `+state` is a path here as it is everywhere else. Asking
    // the glob engine instead would call those characters syntax and leave
    // such a directory matching nothing.
    let has_pattern = partition_glob(body).1.is_some();
    if body.is_empty() || body.ends_with('/') || has_pattern {
        return vec![glob.to_string()];
    }
    vec![glob.to_string(), format!("{glob}/**")]
}

/// Every fileset glob read as a path or a pattern, ready for `build_glob_set`.
/// See `path_or_everything_under` for what a pattern-less entry names.
pub(crate) fn fileset_patterns(globs: &[String]) -> Vec<String> {
    globs
        .iter()
        .flat_map(|glob| path_or_everything_under(glob))
        .collect()
}

#[derive(Debug)]
enum GlobType {
    Negative(String),
    Positive(String),
}

fn convert_glob_segments(negated: bool, parsed: Vec<Vec<GlobGroup>>) -> Vec<String> {
    let mut built_segments: Vec<Vec<GlobType>> = Vec::new();
    for (index, glob_segment) in parsed.iter().enumerate() {
        let is_last = index == parsed.len() - 1;
        built_segments.push(build_segment("", glob_segment, is_last, false));
    }

    let mut globs = built_segments
        .iter()
        .multi_cartesian_product()
        .map(|product| {
            let mut negative = false;
            let mut full_path = false;
            let mut path = String::from("");
            for (index, glob) in product.iter().enumerate() {
                full_path = index == product.len() - 1;
                match glob {
                    GlobType::Negative(s) if index != product.len() - 1 => {
                        path.push_str(&format!("{}/", s));
                        negative = true;
                        break;
                    }
                    GlobType::Negative(s) => {
                        path.push_str(&format!("{}/", s));
                        negative = true;
                    }
                    GlobType::Positive(s) => {
                        path.push_str(&format!("{}/", s));
                    }
                }
            }

            let modified_path = if full_path {
                &path[..path.len() - 1]
            } else {
                &path
            };

            if negative || negated {
                format!("!{}", modified_path)
            } else {
                modified_path.to_owned()
            }
        })
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    globs.sort();
    globs
}

pub fn convert_glob(glob: &str) -> anyhow::Result<Vec<String>> {
    let (negated, parsed) = parse_glob(glob)?;
    Ok(convert_glob_segments(negated, parsed))
}

fn build_segment(
    existing: &str,
    group: &[GlobGroup],
    is_last_segment: bool,
    is_negative: bool,
) -> Vec<GlobType> {
    if let Some(glob_part) = group.iter().next() {
        let built_glob = format!("{}{}", existing, glob_part);
        match glob_part {
            GlobGroup::ZeroOrMore(_) => {
                let existing = if !is_last_segment { "*" } else { existing };
                let off_group = build_segment(existing, &group[1..], is_last_segment, is_negative);
                let on_group =
                    build_segment(&built_glob, &group[1..], is_last_segment, is_negative);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::ZeroOrOne(_) => {
                let off_group = build_segment(existing, &group[1..], is_last_segment, is_negative);
                let on_group =
                    build_segment(&built_glob, &group[1..], is_last_segment, is_negative);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::Negated(_) => {
                let existing = if !is_last_segment { "*" } else { existing };
                let off_group = build_segment(existing, &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::NegatedFileName(_) => {
                let off_group = build_segment("*.", &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::NegatedWildcard(_) => {
                let off_group = build_segment("*", &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::OneOrMore(_)
            | GlobGroup::ExactOne(_)
            | GlobGroup::NonSpecialGroup(_)
            | GlobGroup::Literal(_)
            | GlobGroup::Recursive
            | GlobGroup::Wildcard(_)
            | GlobGroup::Any
            | GlobGroup::Class(_)
            | GlobGroup::Alternates(_)
            | GlobGroup::Escaped(_) => {
                build_segment(&built_glob, &group[1..], is_last_segment, is_negative)
            }
        }
    } else if is_negative {
        vec![GlobType::Negative(existing.to_string())]
    } else {
        vec![GlobType::Positive(existing.to_string())]
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn a_path_without_glob_syntax_also_means_everything_under_it() {
        assert_eq!(
            path_or_everything_under("libs/app/src"),
            vec!["libs/app/src", "libs/app/src/**"]
        );
        assert_eq!(
            path_or_everything_under("!libs/app/src"),
            vec!["!libs/app/src", "!libs/app/src/**"],
            "a negation excludes the directory's contents too"
        );
        for untouched in ["libs/app/**/*.ts", "libs/app/src/", "*.json", ""] {
            assert_eq!(path_or_everything_under(untouched), vec![untouched]);
        }
    }

    #[test]
    fn expands_literal_brace_groups() {
        assert_eq!(
            expand_literal_braces("{nx,tsconfig.base}.json"),
            vec!["nx.json", "tsconfig.base.json"]
        );
        assert_eq!(
            expand_literal_braces("tools/{a,b}/{x,y}.ts"),
            vec![
                "tools/a/x.ts",
                "tools/a/y.ts",
                "tools/b/x.ts",
                "tools/b/y.ts"
            ]
        );
        assert_eq!(expand_literal_braces("!{a,b}.md"), vec!["!a.md", "!b.md"]);
        for unchanged in [
            "{a,*}.json",
            "{a,{b,c}}.json",
            "dist/**",
            "{a}.json",
            "{a,b/c}.ts",
        ] {
            assert_eq!(expand_literal_braces(unchanged), vec![unchanged]);
        }
    }

    use super::convert_glob;

    #[test]
    fn convert_globs_full_convert() {
        let full_convert =
            convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            full_convert,
            [
                "!dist/*/**/{README,LICENSE}.{js,ts}",
                "!dist/{cache,cache2}/",
                "dist/*/**/*.{js,ts}",
            ]
        );
    }

    #[test]
    fn convert_globs_no_dirs() {
        let no_dirs = convert_glob("dist/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            no_dirs,
            ["!dist/**/{README,LICENSE}.{js,ts}", "dist/**/*.{js,ts}",]
        );
    }

    #[test]
    fn convert_globs_no_files() {
        let no_files = convert_glob("dist/!(cache|cache2)/**/*.(js|ts)").unwrap();
        assert_eq!(no_files, ["!dist/{cache,cache2}/", "dist/*/**/*.{js,ts}",]);
    }

    #[test]
    fn convert_globs_no_extensions() {
        let no_extensions = convert_glob("dist/!(cache|cache2)/**/*.js").unwrap();
        assert_eq!(no_extensions, ["!dist/{cache,cache2}/", "dist/*/**/*.js",]);
    }

    #[test]
    fn convert_globs_no_patterns() {
        let no_patterns = convert_glob("dist/**/*.js").unwrap();
        assert_eq!(no_patterns, ["dist/**/*.js",]);
    }

    #[test]
    fn convert_globs_single_negative() {
        let negative_single_dir = convert_glob("packages/!(package-a)*").unwrap();
        assert_eq!(negative_single_dir, ["!packages/package-a*", "packages/*"]);
    }

    #[test]
    fn convert_globs_single_negative_wildcard_directory() {
        let negative_single_dir = convert_glob("packages/!(package-a)*/package.json").unwrap();
        assert_eq!(
            negative_single_dir,
            ["!packages/package-a*/", "packages/*/package.json"]
        );
    }

    #[test]
    fn test_transforming_globs() {
        let globs = convert_glob("!(test|e2e)/?(*.)+(spec|test).[jt]s!(x)?(.snap)").unwrap();
        assert_eq!(
            globs,
            vec![
                "!*/*.{spec,test}.[jt]sx",
                "!*/*.{spec,test}.[jt]sx.snap",
                "!*/{spec,test}.[jt]sx",
                "!*/{spec,test}.[jt]sx.snap",
                "!{test,e2e}/",
                "*/*.{spec,test}.[jt]s",
                "*/*.{spec,test}.[jt]s.snap",
                "*/{spec,test}.[jt]s",
                "*/{spec,test}.[jt]s.snap"
            ]
        );

        let globs = convert_glob("**/!(package-a)*").unwrap();
        assert_eq!(globs, vec!["!**/package-a*", "**/*"]);

        let globs = convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            globs,
            [
                "!dist/*/**/{README,LICENSE}.{js,ts}",
                "!dist/{cache,cache2}/",
                "dist/*/**/*.{js,ts}"
            ]
        );
    }

    #[test]
    fn a_special_character_that_begins_no_group_is_literal() {
        // `+`, `@` and `?` only introduce a group when a `(` follows. On
        // their own they are a literal `+`, a literal `@`, and the
        // single-character wildcard.
        assert_eq!(
            convert_glob("libs/**/?(*.)+spec.ts?(.snap)").unwrap(),
            [
                "libs/**/*.+spec.ts",
                "libs/**/*.+spec.ts.snap",
                "libs/**/+spec.ts",
                "libs/**/+spec.ts.snap"
            ]
        );
        assert_eq!(
            convert_glob("libs/**/?(*.)@spec.ts?(.snap)").unwrap(),
            [
                "libs/**/*.@spec.ts",
                "libs/**/*.@spec.ts.snap",
                "libs/**/@spec.ts",
                "libs/**/@spec.ts.snap"
            ]
        );
        assert_eq!(
            convert_glob("libs/**/?(*.)?spec.ts?(.snap)").unwrap(),
            [
                "libs/**/*.?spec.ts",
                "libs/**/*.?spec.ts.snap",
                "libs/**/?spec.ts",
                "libs/**/?spec.ts.snap"
            ]
        );
    }

    #[test]
    fn should_partition_glob_with_leading_dirs() {
        let (leading_dirs, rest) = super::partition_glob("dist/app/**/!(README|LICENSE).(js|ts)");
        assert_eq!(leading_dirs, "dist/app");
        // The remainder is handed on untouched; `build_glob_set` converts it.
        assert_eq!(rest.as_deref(), Some("**/!(README|LICENSE).(js|ts)"));
        assert_eq!(
            convert_glob(&rest.unwrap()).unwrap(),
            ["!**/{README,LICENSE}.{js,ts}", "**/*.{js,ts}"]
        );
    }

    #[test]
    fn should_partition_glob_with_leading_dirs_and_simple_patterns() {
        let (leading_dirs, rest) = super::partition_glob("dist/app/**/*.css");
        assert_eq!(leading_dirs, "dist/app");
        assert_eq!(rest.as_deref(), Some("**/*.css"));
    }

    #[test]
    fn should_partition_glob_with_leading_dirs_dirs_and_patterns() {
        let (leading_dirs, rest) = super::partition_glob("dist/app/**/js/*.js");
        assert_eq!(leading_dirs, "dist/app");
        assert_eq!(rest.as_deref(), Some("**/js/*.js"));
    }

    #[test]
    fn should_partition_glob_with_leading_dirs_and_no_patterns() {
        assert_eq!(super::partition_glob("dist/app"), ("dist/app".into(), None));
        // The split keeps the text as written; cleaning it is normalize_glob's job.
        assert_eq!(
            super::partition_glob("dist//app/"),
            ("dist//app/".into(), None)
        );
        assert_eq!(
            super::partition_glob(&super::normalize_glob("dist//app/")),
            ("dist/app".into(), None)
        );
    }

    /// A negation keeps its marker on the remainder, so the exclusion still
    /// reads as one once it reaches the glob engine.
    #[test]
    fn a_negated_glob_keeps_its_marker_on_the_remainder() {
        let (leading_dirs, rest) = super::partition_glob("!dist/app/**/*.map");
        assert_eq!(leading_dirs, "dist/app");
        assert_eq!(rest.as_deref(), Some("!**/*.map"));
        // With nothing to match under it, the directory stands alone.
        assert_eq!(
            super::partition_glob("!dist/app"),
            ("dist/app".into(), None)
        );
    }

    /// A directory named with a character the engine would read as syntax is
    /// still a directory, the one answer every road gets.
    #[test]
    fn a_special_character_in_a_directory_name_is_literal() {
        for (glob, directory) in [
            ("dist/@scope/pkg/**", "dist/@scope/pkg"),
            ("libs/+state/**/*.ts", "libs/+state"),
            ("dist/co,ma/**", "dist/co,ma"),
            ("dist/pi|pe/*.js", "dist/pi|pe"),
            ("dist/bra]cket/*.js", "dist/bra]cket"),
        ] {
            assert_eq!(super::partition_glob(glob).0, directory, "{glob}");
        }
        // With no pattern anywhere, the glob names one path and nothing is
        // left to match under it.
        assert_eq!(
            super::partition_glob("dist/co,ma/x.js"),
            ("dist/co,ma/x.js".into(), None)
        );
    }

    #[test]
    fn should_handle_test_optional_s_pattern() {
        let globs = convert_glob("**/__test?(s)__/**/*").unwrap();
        assert_eq!(globs, vec!["**/__test__/**/*", "**/__tests__/**/*"]);
    }

    #[test]
    fn should_handle_zero_or_one_patterns_correctly() {
        // Test simple ZeroOrOne pattern - this was the specific issue mentioned in #26880
        let globs = convert_glob("__test?(s)__").unwrap();
        assert_eq!(globs, vec!["__test__", "__tests__"]);

        // Test ZeroOrOne pattern with prefix
        let globs = convert_glob("prefix?(suffix)").unwrap();
        assert_eq!(globs, vec!["prefix", "prefixsuffix"]);

        // Test ZeroOrOne pattern in middle of string
        let globs = convert_glob("start?(middle)end").unwrap();
        assert_eq!(globs, vec!["startend", "startmiddleend"]);

        // Test multiple ZeroOrOne patterns
        let globs = convert_glob("?(a)test?(b)").unwrap();
        assert_eq!(globs, vec!["atest", "atestb", "test", "testb"]);
    }
}
