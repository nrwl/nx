#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}
