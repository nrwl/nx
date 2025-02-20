use std::path::{Path, PathBuf};

pub trait ToNormalizedString {
    fn to_normalized_string(&self) -> String;
}

impl ToNormalizedString for Path {
    fn to_normalized_string(&self) -> String {
        normalize_nx_path(self)
    }
}

impl ToNormalizedString for PathBuf {
    fn to_normalized_string(&self) -> String {
        normalize_nx_path(self)
    }
}

fn normalize_nx_path<P>(path: P) -> String
where
    P: AsRef<Path>,
{
    if path.as_ref() == Path::new("") {
        return ".".into();
    }

    // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
    if cfg!(windows) {
        path.as_ref().display().to_string().replace('\\', "/")
    } else {
        path.as_ref().display().to_string()
    }
}
