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
    NonSpecial(Cow<'a, str>),
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
            GlobGroup::NonSpecial(s) => write!(f, "{}", s),
        }
    }
}
