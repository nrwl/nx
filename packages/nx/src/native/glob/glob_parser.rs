use crate::native::glob::glob_group::GlobGroup;
use nom::branch::alt;
use nom::bytes::complete::{is_not, tag, take_till, take_until, take_while};
use nom::combinator::{eof, map, map_parser, not};
use nom::error::{VerboseError, context, convert_error};
use nom::multi::{many_till, separated_list0};
use nom::sequence::{preceded, terminated};
use nom::{Finish, IResult};
use std::borrow::Cow;

/// A `?`, `+`, `@` or `!` that begins no group, so it stands for itself: a
/// single-character wildcard, or a literal in a name like `@scope` or `g+en`.
/// Only a following `(` makes one the prefix of an extended group.
fn special_char_alone<'a>(
    input: &'a str,
) -> IResult<&'a str, GlobGroup<'a>, VerboseError<&'a str>> {
    context("special_char_alone", |input: &'a str| {
        let (rest, matched) = alt((tag("?"), tag("+"), tag("@"), tag("!")))(input)?;
        let _ = not(tag("("))(rest)?;
        Ok((rest, GlobGroup::Literal(matched.into())))
    })(input)
}

fn simple_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "simple_group",
        map(preceded(tag("("), group), GlobGroup::NonSpecialGroup),
    )(input)
}

fn zero_or_more_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "zero_or_more_group",
        map(preceded(tag("*("), group), GlobGroup::ZeroOrMore),
    )(input)
}

fn zero_or_one_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "zero_or_one_group",
        map(preceded(tag("?("), group), GlobGroup::ZeroOrOne),
    )(input)
}

fn one_or_more_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "one_or_more_group",
        map(preceded(tag("+("), group), GlobGroup::OneOrMore),
    )(input)
}

fn brace_group_with_empty_item(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "brace_group_with_empty_item",
        map(preceded(tag("{,"), brace_group), GlobGroup::ZeroOrOne),
    )(input)
}

fn exact_one_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "exact_one_group",
        map(preceded(tag("@("), group), GlobGroup::ExactOne),
    )(input)
}

fn negated_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "negated_group",
        map(preceded(tag("!("), group), GlobGroup::Negated),
    )(input)
}

fn negated_file_group(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context("negated_file_group", |input| {
        let (input, result) = preceded(tag("!("), group)(input)?;
        let (input, _) = tag(".")(input)?;
        Ok((input, GlobGroup::NegatedFileName(result)))
    })(input)
}

fn negated_wildcard(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context("negated_wildcard", |input| {
        let (input, result) = preceded(tag("!("), group)(input)?;
        let (input, _) = tag("*")(input)?;
        Ok((input, GlobGroup::NegatedWildcard(result)))
    })(input)
}

fn non_special_character(input: &str) -> IResult<&str, GlobGroup<'_>, VerboseError<&str>> {
    context(
        "non_special_character",
        map(
            alt((
                take_until("{,"),
                take_while(|c| c != '?' && c != '+' && c != '@' && c != '!' && c != '('),
                is_not("*("),
            )),
            |i: &str| GlobGroup::Literal(i.into()),
        ),
    )(input)
}

fn group(input: &str) -> IResult<&str, Cow<'_, str>, VerboseError<&str>> {
    context(
        "group",
        map_parser(terminated(take_until(")"), tag(")")), separated_group_items),
    )(input)
}

fn brace_group(input: &str) -> IResult<&str, Cow<'_, str>, VerboseError<&str>> {
    context(
        "brace_group",
        map_parser(terminated(take_until("}"), tag("}")), separated_group_items),
    )(input)
}

fn separated_group_items(input: &str) -> IResult<&str, Cow<'_, str>, VerboseError<&str>> {
    map(
        separated_list0(
            alt((tag("|"), tag(","))),
            take_while(|c| c != '|' && c != ','),
        ),
        |items: Vec<&str>| {
            if items.len() == 1 {
                Cow::from(items[0])
            } else {
                Cow::from(items.join(","))
            }
        },
    )(input)
}

fn parse_segment(input: &str) -> IResult<&str, Vec<GlobGroup<'_>>, VerboseError<&str>> {
    if input == "**" {
        return Ok(("", vec![GlobGroup::Recursive]));
    }
    extglob_segment(input).map(|(rest, groups)| (rest, split_globset_syntax(groups)))
}

/// The text between extglob groups is globset syntax; split it into parts so
/// a caller can tell a literal name from a wildcard without its own list.
/// Neighbouring text is joined first: the extglob grammar cuts it at `!`, `?`,
/// `+` and `@`, which can fall inside a class like `[!a]`.
fn split_globset_syntax(groups: Vec<GlobGroup<'_>>) -> Vec<GlobGroup<'_>> {
    let mut parts: Vec<GlobGroup> = Vec::new();
    let mut text: Vec<Cow<str>> = Vec::new();
    for group in groups {
        match group {
            GlobGroup::Literal(chunk) => text.push(chunk),
            other => {
                flush_text(&mut text, &mut parts);
                parts.push(other);
            }
        }
    }
    flush_text(&mut text, &mut parts);
    parts
}

fn flush_text<'a>(text: &mut Vec<Cow<'a, str>>, parts: &mut Vec<GlobGroup<'a>>) {
    match text.len() {
        0 => {}
        1 => match text.pop().unwrap() {
            Cow::Borrowed(chunk) => parts.extend(lex_globset(chunk)),
            Cow::Owned(chunk) => parts.extend(owned(lex_globset(&chunk))),
        },
        _ => parts.extend(owned(lex_globset(&text.drain(..).collect::<String>()))),
    }
}

fn owned<'b>(parts: Vec<GlobGroup<'_>>) -> impl Iterator<Item = GlobGroup<'b>> {
    parts.into_iter().map(GlobGroup::into_owned)
}

fn lex_globset(text: &str) -> Vec<GlobGroup<'_>> {
    let mut parts = Vec::new();
    let mut literal_start = 0;
    let mut i = 0;
    let bytes = text.as_bytes();
    while i < bytes.len() {
        let end = match bytes[i] {
            b'*' => i + text[i..].find(|c| c != '*').unwrap_or(text.len() - i),
            b'?' => i + 1,
            b'[' => closing_bracket(text, i),
            b'{' => closing_brace(text, i),
            // globset rejects a `}` that closes no group.
            b'}' => i + 1,
            #[cfg(not(windows))]
            b'\\' => i + 1 + text[i + 1..].chars().next().map_or(0, char::len_utf8),
            _ => {
                i += 1;
                continue;
            }
        };
        if literal_start < i {
            parts.push(GlobGroup::Literal(text[literal_start..i].into()));
        }
        let raw: Cow<str> = text[i..end].into();
        parts.push(match bytes[i] {
            b'*' => GlobGroup::Wildcard(raw),
            b'?' => GlobGroup::Any,
            b'[' => GlobGroup::Class(raw),
            b'{' | b'}' => GlobGroup::Alternates(raw),
            _ => GlobGroup::Escaped(raw),
        });
        i = end;
        literal_start = end;
    }
    if literal_start < text.len() {
        parts.push(GlobGroup::Literal(text[literal_start..].into()));
    }
    parts
}

/// End of the class opened at `start`. A `]` right after `[`, `[!` or `[^` is
/// a member, as globset reads it; an unclosed class runs to the end.
fn closing_bracket(text: &str, start: usize) -> usize {
    let mut i = start + 1;
    if matches!(text.as_bytes().get(i), Some(b'!' | b'^')) {
        i += 1;
    }
    if text.as_bytes().get(i) == Some(&b']') {
        i += 1;
    }
    text[i..].find(']').map_or(text.len(), |at| i + at + 1)
}

/// End of the brace group opened at `start`, counting nested groups; an
/// unclosed group runs to the end.
fn closing_brace(text: &str, start: usize) -> usize {
    let mut depth = 0;
    for (at, c) in text[start..].char_indices() {
        match c {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return start + at + 1;
                }
            }
            _ => {}
        }
    }
    text.len()
}

fn extglob_segment(input: &str) -> IResult<&str, Vec<GlobGroup<'_>>, VerboseError<&str>> {
    context(
        "parse_segment",
        many_till(
            context(
                "glob_group",
                alt((
                    simple_group,
                    zero_or_more_group,
                    zero_or_one_group,
                    one_or_more_group,
                    exact_one_group,
                    negated_file_group,
                    negated_wildcard,
                    negated_group,
                    brace_group_with_empty_item,
                    special_char_alone,
                    non_special_character,
                )),
            ),
            eof,
        ),
    )(input)
    .map(|(i, (groups, _))| (i, groups))
}

fn separated_segments(input: &str) -> IResult<&str, Vec<Vec<GlobGroup<'_>>>, VerboseError<&str>> {
    separated_list0(tag("/"), map_parser(take_till(|c| c == '/'), parse_segment))(input)
}

// match on !test/, but not !(test)/
fn negated_glob(input: &str) -> (&str, bool) {
    let (tagged_input, _) = match tag::<_, _, VerboseError<&str>>("!")(input) {
        Ok(result) => result,
        Err(_) => return (input, false),
    };

    match tag::<_, _, VerboseError<&str>>("(")(tagged_input) {
        Ok(_) => (input, false),
        Err(_) => (tagged_input, true),
    }
}

/// The one name `segment` matches, with escapes resolved, or `None` when it is
/// a pattern: `a\*b` names `a*b`. An escape never resolves to `.` or `..`, so
/// `\.\.` cannot slip past the checks callers run on the raw text.
pub fn literal_segment(segment: &str) -> Option<String> {
    let ("", parts) = parse_segment(segment).finish().ok()? else {
        return None;
    };
    let name: String = parts
        .iter()
        .map(GlobGroup::literal_text)
        .collect::<Option<_>>()?;
    if name != segment && matches!(name.as_str(), "." | "..") {
        return None;
    }
    Some(name)
}

pub fn parse_glob(input: &str) -> anyhow::Result<(bool, Vec<Vec<GlobGroup<'_>>>)> {
    let (input, negated) = negated_glob(input);
    let result = separated_segments(input).finish();
    if let Ok((rest, result)) = result {
        // A segment that fails to parse ends the list early; say so rather
        // than returning the glob cut short.
        if !rest.is_empty() {
            anyhow::bail!(
                "Could not parse the glob \"{input}\" from \"{}\"",
                rest.trim_start_matches('/')
            );
        }
        Ok((negated, result))
    } else {
        Err(anyhow::anyhow!(
            "{}",
            convert_error(input, result.err().unwrap())
        ))
    }
}

#[cfg(test)]
mod test {
    use crate::native::glob::glob_group::GlobGroup;
    use crate::native::glob::glob_parser::{parse_glob, special_char_alone};

    #[test]
    fn a_special_character_that_begins_no_group_is_literal() {
        // A special character that begins no group stands for itself.
        let (rest, group) = special_char_alone("+snap").unwrap();
        assert_eq!((rest, group), ("snap", GlobGroup::Literal("+".into())));
        assert!(special_char_alone("@(a|b)").is_err());
        let result = parse_glob("libs/?(*.)+spec.ts?(.snap)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Literal("libs".into())],
                    vec![
                        GlobGroup::ZeroOrOne("*.".into()),
                        GlobGroup::Literal("+spec.ts".into()),
                        GlobGroup::ZeroOrOne(".snap".into())
                    ]
                ]
            )
        );
    }

    fn segments(glob: &str) -> Vec<Vec<GlobGroup<'_>>> {
        parse_glob(glob).unwrap().1
    }

    #[test]
    fn globset_syntax_is_split_from_literal_names() {
        use GlobGroup::*;
        assert_eq!(
            segments("@scope/a+b/co,ma/pi|pe/x)]/y}"),
            [
                vec![Literal("@scope".into())],
                vec![Literal("a+b".into())],
                vec![Literal("co,ma".into())],
                vec![Literal("pi|pe".into())],
                vec![Literal("x)]".into())],
                vec![Literal("y".into()), Alternates("}".into())],
            ]
        );
        assert_eq!(
            segments("a?b/[]x]/[!]y]z/{a,{b,c}}d/**x"),
            [
                vec![Literal("a".into()), Any, Literal("b".into())],
                vec![Class("[]x]".into())],
                vec![Class("[!]y]".into()), Literal("z".into())],
                vec![Alternates("{a,{b,c}}".into()), Literal("d".into())],
                vec![Wildcard("**".into()), Literal("x".into())],
            ]
        );
        // An unclosed class or group reads as syntax to the end of the segment.
        assert_eq!(
            segments("a[bc/d{e"),
            [
                vec![Literal("a".into()), Class("[bc".into())],
                vec![Literal("d".into()), Alternates("{e".into())]
            ]
        );
    }

    /// NXC-5001: a glob is read whole or refused, never cut short.
    #[test]
    fn a_glob_is_read_whole_or_refused() {
        use GlobGroup::*;
        assert_eq!(
            segments("a/?/b+/c@"),
            [
                vec![Literal("a".into())],
                vec![Any],
                vec![Literal("b+".into())],
                vec![Literal("c@".into())],
            ]
        );
        assert_eq!(super::literal_segment("c++").as_deref(), Some("c++"));
        assert_eq!(super::literal_segment("paren("), None);
        for unclosed in ["dist/paren(/x.js", "?(", "a/@(b/c)"] {
            assert!(parse_glob(unclosed).is_err(), "{unclosed}");
        }
    }

    #[test]
    #[cfg(not(windows))]
    fn a_backslash_escapes_the_next_character() {
        assert_eq!(super::literal_segment(r"\*").as_deref(), Some("*"));
        // An escape never resolves to `.` or `..`, which would dodge `..` checks.
        for escaped_dots in [r"\.", r"\.\.", r".\.", r"\.."] {
            assert_eq!(super::literal_segment(escaped_dots), None, "{escaped_dots}");
        }
        use GlobGroup::*;
        assert_eq!(
            segments(r"a\*b/雪\雪"),
            [
                vec![
                    Literal("a".into()),
                    Escaped(r"\*".into()),
                    Literal("b".into())
                ],
                vec![Literal("雪".into()), Escaped(r"\雪".into())],
            ]
        );
    }

    /// Printing the parts rebuilds the glob, so `convert_glob` sees the same
    /// text it did before the parts were split out.
    #[test]
    fn parts_print_back_to_their_source() {
        let mut truncated = Vec::new();
        let mut rejected = Vec::new();
        for glob in include_str!("fixtures/glob_corpus.txt").lines() {
            let Ok((negated, parsed)) = parse_glob(glob) else {
                rejected.push(glob);
                continue;
            };
            let printed = parsed
                .iter()
                .map(|parts| {
                    parts
                        .iter()
                        .map(|part| part.to_string())
                        .collect::<String>()
                })
                .collect::<Vec<_>>()
                .join("/");
            let has_extglob = parsed.iter().flatten().any(|part| {
                !matches!(
                    part,
                    GlobGroup::Literal(_)
                        | GlobGroup::Recursive
                        | GlobGroup::Wildcard(_)
                        | GlobGroup::Any
                        | GlobGroup::Class(_)
                        | GlobGroup::Alternates(_)
                        | GlobGroup::Escaped(_)
                )
            });
            let source = if negated { &glob[1..] } else { glob };
            if !has_extglob && printed != source {
                truncated.push(glob);
            }
        }
        assert_eq!(truncated, Vec::<&str>::new());
        // Only an unclosed group is refused, never read as a shorter glob.
        rejected.sort();
        assert_eq!(
            rejected,
            [
                "!(",
                "?(",
                "@babel/plugin-transform-destructuring@7.27.3(@babel/core@7.27.4)",
                "paren(/x.ts",
                "{,",
            ]
        );
    }

    #[test]
    fn should_parse_globs() {
        let result = parse_glob("a/b/c").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Literal("a".into())],
                    vec![GlobGroup::Literal("b".into())],
                    vec![GlobGroup::Literal("c".into())]
                ]
            )
        );

        let result = parse_glob("a/*.ts").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Literal("a".into())],
                    vec![
                        GlobGroup::Wildcard("*".into()),
                        GlobGroup::Literal(".ts".into())
                    ]
                ]
            )
        );

        let result = parse_glob("a/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Literal("a".into())],
                    vec![GlobGroup::Recursive,],
                    vec![
                        GlobGroup::ZeroOrOne("*.".into()),
                        GlobGroup::OneOrMore("spec,test".into()),
                        GlobGroup::Literal(".".into()),
                        GlobGroup::Class("[jt]".into()),
                        GlobGroup::Literal("s".into()),
                        GlobGroup::ZeroOrOne("x".into()),
                        GlobGroup::ZeroOrOne(".snap".into())
                    ]
                ]
            )
        );

        let result = parse_glob("!(e2e|test)/*.ts").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Negated("e2e,test".into())],
                    vec![
                        GlobGroup::Wildcard("*".into()),
                        GlobGroup::Literal(".ts".into())
                    ]
                ]
            )
        );

        let result = parse_glob("**/*.(js|ts)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Recursive],
                    vec![
                        GlobGroup::Wildcard("*".into()),
                        GlobGroup::Literal(".".into()),
                        GlobGroup::NonSpecialGroup("js,ts".into())
                    ]
                ]
            )
        );

        let result = parse_glob("**/!(README).[jt]s!(x)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Recursive],
                    vec![
                        GlobGroup::NegatedFileName("README".into()),
                        GlobGroup::Class("[jt]".into()),
                        GlobGroup::Literal("s".into()),
                        GlobGroup::Negated("x".into())
                    ]
                ]
            )
        );

        let result = parse_glob("!test/!(README).[jt]s!(x)").unwrap();
        assert_eq!(
            result,
            (
                true,
                vec![
                    vec![GlobGroup::Literal("test".into())],
                    vec![
                        GlobGroup::NegatedFileName("README".into()),
                        GlobGroup::Class("[jt]".into()),
                        GlobGroup::Literal("s".into()),
                        GlobGroup::Negated("x".into())
                    ]
                ]
            )
        );

        let result = parse_glob("!(test)/!(README).[jt]s!(x)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Negated("test".into())],
                    vec![
                        GlobGroup::NegatedFileName("README".into()),
                        GlobGroup::Class("[jt]".into()),
                        GlobGroup::Literal("s".into()),
                        GlobGroup::Negated("x".into())
                    ]
                ]
            )
        );

        let result = parse_glob("packages/!(package-a)*/package.json").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Literal("packages".into())],
                    vec![GlobGroup::NegatedWildcard("package-a".into()),],
                    vec![GlobGroup::Literal("package.json".into())]
                ]
            )
        );
    }
    #[test]
    fn should_parse_globs_with_braces() {
        let result = parse_glob("**/*.spec.ts{,.snap}").unwrap();

        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Recursive],
                    vec![
                        GlobGroup::Wildcard("*".into()),
                        GlobGroup::Literal(".spec.ts".into()),
                        GlobGroup::ZeroOrOne(".snap".into())
                    ]
                ]
            )
        );
        let result = parse_glob("**/*.spec.ts{.snapshot,.snap}").unwrap();

        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::Recursive],
                    vec![
                        GlobGroup::Wildcard("*".into()),
                        GlobGroup::Literal(".spec.ts".into()),
                        GlobGroup::Alternates("{.snapshot,.snap}".into()),
                    ]
                ]
            )
        );
    }
}
