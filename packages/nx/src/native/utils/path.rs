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

/// A path as a person or JS wrote it, for any OS: a Windows drive letter
/// stripped, then `\` swapped for `/`. Mirrors `normalizePath` in
/// `packages/nx/src/utils/path.ts`. Paths read from disk use `Normalize`.
pub fn normalize_js_path(path: &str) -> String {
    let without_drive = match path.as_bytes() {
        [drive, b':', ..] if drive.is_ascii_alphabetic() => &path[2..],
        _ => path,
    };
    without_drive.replace('\\', "/")
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
    fn normalizes_a_js_path_on_any_os() {
        assert_eq!(normalize_js_path("libs\\a\\index.ts"), "libs/a/index.ts");
        // Stripping the drive leaves a leading slash, as `normalizePath` does.
        assert_eq!(normalize_js_path("C:\\libs\\a"), "/libs/a");
        assert_eq!(normalize_js_path("libs/a/index.ts"), "libs/a/index.ts");
    }

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
