use std::path::{Path, PathBuf};

pub trait ToNormalizedString {
    fn to_normalized_string(&self) -> String;
}

impl ToNormalizedString for Path {
    fn to_normalized_string(&self) -> String {
        self.to_string_lossy().replace('\\', "/")
    }
}

impl ToNormalizedString for PathBuf {
    fn to_normalized_string(&self) -> String {
        self.as_path().to_normalized_string()
    }
}
