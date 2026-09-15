use crate::native::{types::FileData, utils::normalize_trait::Normalize};
use std::borrow::Cow;
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

fn normalize_nx_path<P: AsRef<Path>>(path: P) -> String {
    normalized_path(path.as_ref()).into_owned()
}

/// The same JS-facing normalization, borrowing valid Unix paths instead of
/// allocating a String for every file inspected by a glob query.
pub(crate) fn normalized_path(path: &Path) -> Cow<'_, str> {
    if path == Path::new("") {
        return Cow::Borrowed(".");
    }
    let path = path.to_string_lossy();
    if cfg!(windows) && path.contains('\\') {
        Cow::Owned(path.replace('\\', "/"))
    } else {
        path
    }
}

pub fn get_child_files<P: AsRef<Path>>(directory: P, files: Vec<FileData>) -> Vec<String> {
    files
        .into_iter()
        .filter(|file_data| Path::new(&file_data.file).starts_with(directory.as_ref()))
        .map(|file_data| file_data.file)
        .collect()
}

#[cfg(test)]
mod test {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn borrowed_normalization_matches_the_previous_display_conversion() {
        for name in [
            "",
            ".",
            "a/b.ts",
            "a\\b.ts",
            "dir with spaces/file.ts",
            "東京/é.ts",
        ] {
            let path = Path::new(name);
            let expected = if path == Path::new("") {
                ".".into()
            } else if cfg!(windows) {
                path.display().to_string().replace('\\', "/")
            } else {
                path.display().to_string()
            };
            assert_eq!(normalized_path(path), expected);
            #[cfg(unix)]
            assert!(matches!(normalized_path(path), Cow::Borrowed(_)));
        }
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_paths_keep_the_previous_lossy_normalization() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        let path = PathBuf::from(OsString::from_vec(vec![b'a', b'/', 0xff, b'.', b't', b's']));
        assert_eq!(normalized_path(&path), path.display().to_string());
        assert!(matches!(normalized_path(&path), Cow::Owned(_)));
    }

    #[test]
    fn should_get_child_files() {
        let directory = PathBuf::from("foo");
        let files = vec![
            FileData {
                file: "foo/bar".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo/baz".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo/child/bar".into(),
                hash: "123".into(),
            },
            FileData {
                file: "bar/baz".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo-other/not-child".into(),
                hash: "123".into(),
            },
        ];
        let child_files = get_child_files(&directory, files);
        assert_eq!(child_files, ["foo/bar", "foo/baz", "foo/child/bar",]);
    }
}
