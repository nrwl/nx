mod glob_group;
mod glob_parser;
mod glob_transform;
pub use glob_transform::*;
mod glob_set;
pub use glob_set::*;

pub fn contains_glob_pattern(value: &str) -> bool {
    value.contains('!')
        || value.contains('?')
        || value.contains('@')
        || value.contains('+')
        || value.contains('*')
        || value.contains('|')
        || value.contains(',')
        || value.contains('{')
        || value.contains('}')
        || value.contains('[')
        || value.contains(']')
        || value.contains('(')
        || value.contains(')')
}

