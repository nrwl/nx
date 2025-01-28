use std::path::{Path, PathBuf};

pub trait Normalize {
    fn to_normalized_string(&self) -> String;
}

impl Normalize for Path {
    fn to_normalized_string(&self) -> String {
        self.to_string_lossy().replace('\\', "/")
    }
}

impl Normalize for PathBuf {
    fn to_normalized_string(&self) -> String {
        self.as_path().to_normalized_string()
    }
}
