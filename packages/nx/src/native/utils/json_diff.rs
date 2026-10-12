//! `jsonDiff` from `utils/json-diff.ts`, over values that keep their keys in
//! file order so changes come out in the order the TS walk emits them.

use jsonc_parser::JsonValue;
use serde_json::Value;
use std::collections::HashSet;

pub(crate) const DELETED: &str = "JsonPropertyDeleted";
pub(crate) const ADDED: &str = "JsonPropertyAdded";
pub(crate) const MODIFIED: &str = "JsonPropertyModified";

#[napi(object)]
pub struct JsonChangeValue {
    pub lhs: Option<Value>,
    pub rhs: Option<Value>,
}

/// One entry of `jsonDiff`'s result: `type` is a `JsonDiffType` value.
#[napi(object)]
pub struct JsonChange {
    #[napi(js_name = "type")]
    pub kind: String,
    pub path: Vec<String>,
    pub value: JsonChangeValue,
}

/// `jsonDiff(JSON.parse(lhs), JSON.parse(rhs))`, or `null` when either side is
/// not strict JSON, where `JSON.parse` would throw.
#[napi]
pub fn diff_json(lhs: String, rhs: String) -> Option<Vec<JsonChange>> {
    let parse = |text: &str| -> Option<Ordered> {
        serde_json::from_str::<serde::de::IgnoredAny>(text).ok()?;
        parse_ordered(text)
    };
    Some(json_changes(&parse(&lhs)?, &parse(&rhs)?))
}

/// JSONC, as the hasher's fallback parser reads it, with keys in file order.
pub(crate) fn parse_ordered(text: &str) -> Option<Ordered> {
    Some(
        jsonc_parser::parse_to_value(text, &Default::default())
            .ok()??
            .into(),
    )
}

/// A JSON value with its keys in file order. Numbers keep their text; `same`
/// compares them by value, and derived `==` by text.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Ordered {
    Object(Vec<(String, Ordered)>),
    Array(Vec<Ordered>),
    String(String),
    Number(String),
    Boolean(bool),
    Null,
}

impl From<JsonValue<'_>> for Ordered {
    fn from(value: JsonValue<'_>) -> Self {
        match value {
            JsonValue::Object(object) => Self::Object(
                object
                    .take_inner()
                    .into_iter()
                    .map(|(key, value)| (key, value.into()))
                    .collect(),
            ),
            JsonValue::Array(array) => {
                Self::Array(array.take_inner().into_iter().map(Self::from).collect())
            }
            JsonValue::String(text) => Self::String(text.into_owned()),
            JsonValue::Number(text) => Self::Number(text.to_string()),
            JsonValue::Boolean(value) => Self::Boolean(value),
            JsonValue::Null => Self::Null,
        }
    }
}

impl Ordered {
    /// `Object.keys`: an object's keys, or an array's indices.
    fn children(&self) -> Vec<(String, &Ordered)> {
        match self {
            Self::Object(entries) => entries
                .iter()
                .map(|(key, value)| (key.clone(), value))
                .collect(),
            Self::Array(items) => items
                .iter()
                .enumerate()
                .map(|(index, value)| (index.to_string(), value))
                .collect(),
            _ => Vec::new(),
        }
    }

    fn child(&self, key: &str) -> Option<&Ordered> {
        match self {
            Self::Object(entries) => entries.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            Self::Array(items) => key
                .parse::<usize>()
                .ok()
                .filter(|index| index.to_string() == key)
                .and_then(|index| items.get(index)),
            _ => None,
        }
    }

    fn at(&self, path: &[String]) -> Option<&Ordered> {
        path.iter().try_fold(self, |value, key| value.child(key))
    }

    /// `deepEquals`: key order does not matter and numbers compare by value.
    fn same(&self, other: &Ordered) -> bool {
        match (self, other) {
            (Self::Object(a), Self::Object(b)) => {
                a.len() == b.len()
                    && a.iter()
                        .all(|(key, value)| other.child(key).is_some_and(|o| value.same(o)))
            }
            (Self::Array(a), Self::Array(b)) => {
                a.len() == b.len() && a.iter().zip(b).all(|(a, b)| a.same(b))
            }
            (Self::Number(a), Self::Number(b)) => {
                a == b || matches!((a.parse::<f64>(), b.parse::<f64>()), (Ok(a), Ok(b)) if a == b)
            }
            _ => self == other,
        }
    }

    pub(crate) fn to_json(&self) -> Value {
        match self {
            Self::Object(entries) => Value::Object(
                entries
                    .iter()
                    .map(|(key, value)| (key.clone(), value.to_json()))
                    .collect(),
            ),
            Self::Array(items) => Value::Array(items.iter().map(Self::to_json).collect()),
            Self::String(text) => Value::String(text.clone()),
            Self::Number(text) => serde_json::from_str(text).unwrap_or(Value::Null),
            Self::Boolean(value) => Value::Bool(*value),
            Self::Null => Value::Null,
        }
    }
}

/// Every path under `lhs` that `rhs` lacks or holds differently, containers
/// included, then every path only `rhs` has, each in depth-first order.
pub(crate) fn json_changes(lhs: &Ordered, rhs: &Ordered) -> Vec<JsonChange> {
    let mut changes = Vec::new();
    let mut seen: HashSet<Vec<String>> = HashSet::new();
    walk(lhs, &mut Vec::new(), &mut |path, before| {
        seen.insert(path.to_vec());
        match rhs.at(path) {
            None => changes.push(change(DELETED, path, Some(before), None)),
            Some(after) if !before.same(after) => {
                changes.push(change(MODIFIED, path, Some(before), Some(after)))
            }
            Some(_) => {}
        }
    });
    walk(rhs, &mut Vec::new(), &mut |path, after| {
        if !seen.contains(path) {
            changes.push(change(ADDED, path, None, Some(after)));
        }
    });
    changes
}

fn walk(value: &Ordered, path: &mut Vec<String>, visit: &mut dyn FnMut(&[String], &Ordered)) {
    for (key, child) in value.children() {
        path.push(key);
        visit(path, child);
        walk(child, path, visit);
        path.pop();
    }
}

fn change(kind: &str, path: &[String], lhs: Option<&Ordered>, rhs: Option<&Ordered>) -> JsonChange {
    JsonChange {
        kind: kind.to_string(),
        path: path.to_vec(),
        value: JsonChangeValue {
            lhs: lhs.map(Ordered::to_json),
            rhs: rhs.map(Ordered::to_json),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn diff(lhs: &str, rhs: &str) -> Vec<(String, String)> {
        diff_json(lhs.into(), rhs.into())
            .unwrap()
            .into_iter()
            .map(|c| (c.kind, c.path.join(".")))
            .collect()
    }

    fn entries(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(k, p)| (k.to_string(), p.to_string()))
            .collect()
    }

    /// The case `utils/json-diff.spec.ts` pins, in the TS walk's order.
    #[test]
    fn reports_parents_of_changed_children_then_additions() {
        assert_eq!(
            diff(
                r#"{ "x": 1, "a": { "b": { "c": 1 } } }"#,
                r#"{ "y": 2, "a": { "b": { "c": 2, "d": 2 } } }"#
            ),
            entries(&[
                (DELETED, "x"),
                (MODIFIED, "a"),
                (MODIFIED, "a.b"),
                (MODIFIED, "a.b.c"),
                (ADDED, "y"),
                (ADDED, "a.b.d"),
            ])
        );
    }

    #[test]
    fn walks_arrays_by_index() {
        assert_eq!(
            diff(r#"{ "l": ["a", "b"] }"#, r#"{ "l": ["a", "c", "d"] }"#),
            entries(&[(MODIFIED, "l"), (MODIFIED, "l.1"), (ADDED, "l.2")])
        );
    }

    /// As `deepEquals`: a reorder or `1.0` for `1` is no change.
    #[test]
    fn ignores_key_order_and_number_spelling() {
        assert!(diff(r#"{ "a": 1, "b": 1.0 }"#, r#"{ "b": 1, "a": 1 }"#).is_empty());
    }

    #[test]
    fn a_removed_container_deletes_its_children_too() {
        assert_eq!(
            diff(r#"{ "a": { "b": 1 } }"#, "{}"),
            entries(&[(DELETED, "a"), (DELETED, "a.b")])
        );
    }

    #[test]
    fn carries_the_values_on_each_side() {
        let changes = diff_json(r#"{ "v": "1" }"#.into(), r#"{ "v": "2" }"#.into()).unwrap();
        assert_eq!(changes[0].value.lhs, Some(Value::String("1".into())));
        assert_eq!(changes[0].value.rhs, Some(Value::String("2".into())));
    }

    /// `JSON.parse` throws on comments, so the caller compares the file whole.
    #[test]
    fn is_unset_for_anything_but_strict_json() {
        assert!(diff_json("{ // c\n }".into(), "{}".into()).is_none());
        assert!(diff_json("".into(), "{}".into()).is_none());
    }
}
