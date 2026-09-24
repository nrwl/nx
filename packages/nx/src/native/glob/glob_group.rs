use std::borrow::Cow;
use std::fmt::{Display, Formatter};

#[derive(Debug, PartialEq)]
pub enum GlobGroup<'a> {
    // *(a|b|c)
    ZeroOrMore(Cow<'a, str>),
    // ?(a|b|c)
    ZeroOrOne(Cow<'a, str>),
    // +(a|b|c)
    OneOrMore(Cow<'a, str>),
    // @(a|b|c)
    ExactOne(Cow<'a, str>),
    // !(a|b|c)
    Negated(Cow<'a, str>),
    // !(a|b|c).js
    NegatedFileName(Cow<'a, str>),
    // !(a|b|c)*
    NegatedWildcard(Cow<'a, str>),
    NonSpecialGroup(Cow<'a, str>),
    // Globset syntax the extglob conversion passes through, named after
    // globset's `Token`s. Each keeps its source text so the converted glob is
    // rebuilt byte for byte.
    Literal(Cow<'a, str>),
    // `**` as a whole segment
    Recursive,
    // `*`, or a run of them inside a segment; globset's `ZeroOrMore`, a name
    // the extglob `*(a|b)` already has here
    Wildcard(Cow<'a, str>),
    // a lone `?`
    Any,
    // `[a-z]`
    Class(Cow<'a, str>),
    // `{a,b}`
    Alternates(Cow<'a, str>),
    // `\*`; never produced on Windows, where `\` is a separator
    Escaped(Cow<'a, str>),
}

impl GlobGroup<'_> {
    pub fn into_owned<'b>(self) -> GlobGroup<'b> {
        let own = |s: Cow<str>| -> Cow<'b, str> { Cow::Owned(s.into_owned()) };
        match self {
            GlobGroup::ZeroOrMore(s) => GlobGroup::ZeroOrMore(own(s)),
            GlobGroup::ZeroOrOne(s) => GlobGroup::ZeroOrOne(own(s)),
            GlobGroup::OneOrMore(s) => GlobGroup::OneOrMore(own(s)),
            GlobGroup::ExactOne(s) => GlobGroup::ExactOne(own(s)),
            GlobGroup::Negated(s) => GlobGroup::Negated(own(s)),
            GlobGroup::NegatedFileName(s) => GlobGroup::NegatedFileName(own(s)),
            GlobGroup::NegatedWildcard(s) => GlobGroup::NegatedWildcard(own(s)),
            GlobGroup::NonSpecialGroup(s) => GlobGroup::NonSpecialGroup(own(s)),
            GlobGroup::Literal(s) => GlobGroup::Literal(own(s)),
            GlobGroup::Recursive => GlobGroup::Recursive,
            GlobGroup::Wildcard(s) => GlobGroup::Wildcard(own(s)),
            GlobGroup::Any => GlobGroup::Any,
            GlobGroup::Class(s) => GlobGroup::Class(own(s)),
            GlobGroup::Alternates(s) => GlobGroup::Alternates(own(s)),
            GlobGroup::Escaped(s) => GlobGroup::Escaped(own(s)),
        }
    }

    /// Whether this part matches only its own text, so a segment made of
    /// such parts names one directory.
    pub fn is_literal(&self) -> bool {
        matches!(self, GlobGroup::Literal(_))
    }
}

impl<'a> Display for GlobGroup<'a> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            GlobGroup::ZeroOrMore(s)
            | GlobGroup::ZeroOrOne(s)
            | GlobGroup::OneOrMore(s)
            | GlobGroup::ExactOne(s)
            | GlobGroup::NonSpecialGroup(s)
            | GlobGroup::Negated(s) => {
                if s.contains(',') {
                    write!(f, "{{{}}}", s)
                } else {
                    write!(f, "{}", s)
                }
            }
            GlobGroup::NegatedFileName(s) => {
                if s.contains(',') {
                    write!(f, "{{{}}}.", s)
                } else {
                    write!(f, "{}.", s)
                }
            }
            GlobGroup::NegatedWildcard(s) => {
                if s.contains(',') {
                    write!(f, "{{{}}}*", s)
                } else {
                    write!(f, "{}*", s)
                }
            }
            GlobGroup::Literal(s)
            | GlobGroup::Wildcard(s)
            | GlobGroup::Class(s)
            | GlobGroup::Alternates(s)
            | GlobGroup::Escaped(s) => write!(f, "{}", s),
            GlobGroup::Recursive => write!(f, "**"),
            GlobGroup::Any => write!(f, "?"),
        }
    }
}
