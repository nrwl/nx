use std::path::Path;

pub trait Normalize {
    fn to_normalized_string(&self) -> String;
}

impl Normalize for std::path::Path {
    fn to_normalized_string(&self) -> String {
        normalize_path(self)
    }
}

impl Normalize for std::path::PathBuf {
    fn to_normalized_string(&self) -> String {
        normalize_path(self)
    }
}

fn normalize_path<P>(path: P) -> String
where
    P: AsRef<Path>,
{
    // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
    if cfg!(windows) {
        path.as_ref().display().to_string().replace('\\', "/")
    } else {
        path.as_ref().display().to_string()
    }
}
