use crate::native::utils::normalize_trait::Normalize;
use std::collections::BTreeMap;
use std::ops::Bound;
use std::path::{Path, PathBuf};

impl Normalize for Path {
    fn to_normalized_string(&self) -> String {
        normalize_nx_path(self)
    }
}

impl Normalize for PathBuf {
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

pub fn get_child_files<'a, T>(
    directory: &Path,
    files: &'a BTreeMap<PathBuf, T>,
) -> impl Iterator<Item = (&'a PathBuf, &'a T)> {
    // Path order keeps a directory and its descendants contiguous.
    files
        .range::<Path, _>((Bound::Included(directory), Bound::Unbounded))
        .take_while(move |(path, _)| path.starts_with(directory))
}

#[cfg(test)]
mod test {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn should_get_child_files() {
        let files: BTreeMap<_, _> = [
            "foo/bar",
            "foo/baz",
            "foo/child/bar",
            "bar/baz",
            "foo-other/not-child",
        ]
        .into_iter()
        .map(|path| (PathBuf::from(path), "123"))
        .collect();
        let child_files: Vec<_> = get_child_files(Path::new("foo"), &files)
            .map(|(path, _)| path.to_normalized_string())
            .collect();
        assert_eq!(child_files, ["foo/bar", "foo/baz", "foo/child/bar"]);
    }
}
