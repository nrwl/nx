use crate::native::glob::glob_group::GlobGroup;
use nom::branch::alt;
use nom::bytes::complete::{is_not, tag, take_till, take_until, take_while};
use nom::combinator::{eof, map, map_parser};
use nom::error::{context, convert_error, VerboseError};
use nom::multi::{many_till, separated_list0};
use nom::sequence::{preceded, terminated};
use nom::{Finish, IResult};
use std::borrow::Cow;

fn simple_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "simple_group",
        map(preceded(tag("("), group), GlobGroup::NonSpecialGroup),
    )(input)
}

fn zero_or_more_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "zero_or_more_group",
        map(preceded(tag("*("), group), GlobGroup::ZeroOrMore),
    )(input)
}

fn zero_or_one_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "zero_or_one_group",
        map(preceded(tag("?("), group), GlobGroup::ZeroOrOne),
    )(input)
}

fn one_or_more_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "one_or_more_group",
        map(preceded(tag("+("), group), GlobGroup::OneOrMore),
    )(input)
}

fn exact_one_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "exact_one_group",
        map(preceded(tag("@("), group), GlobGroup::ExactOne),
    )(input)
}

fn negated_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "negated_group",
        map(preceded(tag("!("), group), GlobGroup::Negated),
    )(input)
}

fn negated_file_group(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context("negated_file_group", |input| {
        let (input, result) = preceded(tag("!("), group)(input)?;
        let (input, _) = tag(".")(input)?;
        Ok((input, GlobGroup::NegatedFileName(result)))
    })(input)
}

fn non_special_character(input: &str) -> IResult<&str, GlobGroup, VerboseError<&str>> {
    context(
        "non_special_character",
        map(
            alt((
                take_while(|c| c != '?' && c != '+' && c != '@' && c != '!' && c != '('),
                is_not("*("),
            )),
            |i: &str| GlobGroup::NonSpecial(i.into()),
        ),
    )(input)
}

fn group(input: &str) -> IResult<&str, Cow<str>, VerboseError<&str>> {
    context(
        "group",
        map_parser(terminated(take_until(")"), tag(")")), separated_group_items),
    )(input)
}

fn separated_group_items(input: &str) -> IResult<&str, Cow<str>, VerboseError<&str>> {
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

fn parse_segment(input: &str) -> IResult<&str, Vec<GlobGroup>, VerboseError<&str>> {
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
                    negated_group,
                    non_special_character,
                )),
            ),
            eof,
        ),
    )(input)
    .map(|(i, (groups, _))| (i, groups))
}

fn separated_segments(input: &str) -> IResult<&str, Vec<Vec<GlobGroup>>, VerboseError<&str>> {
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

pub fn parse_glob(input: &str) -> anyhow::Result<(bool, Vec<Vec<GlobGroup>>)> {
    let (input, negated) = negated_glob(input);
    let result = separated_segments(input).finish();
    if let Ok((_, result)) = result {
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
    use crate::native::glob::glob_parser::parse_glob;

    #[test]
    fn should_parse_globs() {
        let result = parse_glob("a/b/c").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::NonSpecial("a".into())],
                    vec![GlobGroup::NonSpecial("b".into())],
                    vec![GlobGroup::NonSpecial("c".into())]
                ]
            )
        );

        let result = parse_glob("a/*.ts").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::NonSpecial("a".into())],
                    vec![GlobGroup::NonSpecial("*.ts".into())]
                ]
            )
        );

        let result = parse_glob("a/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::NonSpecial("a".into())],
                    vec![GlobGroup::NonSpecial("**".into()),],
                    vec![
                        GlobGroup::ZeroOrOne("*.".into()),
                        GlobGroup::OneOrMore("spec,test".into()),
                        GlobGroup::NonSpecial(".[jt]s".into()),
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
                    vec![GlobGroup::NonSpecial("*.ts".into())]
                ]
            )
        );

        let result = parse_glob("**/*.(js|ts)").unwrap();
        assert_eq!(
            result,
            (
                false,
                vec![
                    vec![GlobGroup::NonSpecial("**".into())],
                    vec![
                        GlobGroup::NonSpecial("*.".into()),
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
                    vec![GlobGroup::NonSpecial("**".into())],
                    vec![
                        GlobGroup::NegatedFileName("README".into()),
                        GlobGroup::NonSpecial("[jt]s".into()),
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
                    vec![GlobGroup::NonSpecial("test".into())],
                    vec![
                        GlobGroup::NegatedFileName("README".into()),
                        GlobGroup::NonSpecial("[jt]s".into()),
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
                        GlobGroup::NonSpecial("[jt]s".into()),
                        GlobGroup::Negated("x".into())
                    ]
                ]
            )
        );
    }
}
