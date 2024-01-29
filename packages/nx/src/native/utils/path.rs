use crate::native::{utils::normalize_trait::Normalize, types::FileData};
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
            }
        ];
        let child_files = get_child_files(&directory, files);
        assert_eq!(child_files, [
            "foo/bar",
            "foo/baz",
            "foo/child/bar",
        ]);
    }
}