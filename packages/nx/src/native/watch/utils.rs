use ignore::WalkBuilder;
use ignore_files::IgnoreFile;
use std::path::Path;
use std::{fs, path::PathBuf};
use tracing::trace;
use watchexec_events::{Event, Tag};

pub(super) fn get_ignore_files<T: AsRef<str>>(
    use_ignore: bool,
    root: T,
) -> Option<Vec<IgnoreFile>> {
    let root = root.as_ref();
    if use_ignore {
        let mut walker = WalkBuilder::new(root);
        walker.hidden(false);
        walker.git_ignore(false);

        let node_folder = PathBuf::from(root).join("node_modules");
        walker.filter_entry(move |entry| !entry.path().starts_with(&node_folder));
        Some(
            walker
                .build()
                .flatten()
                .filter(|result| result.path().ends_with(".gitignore"))
                .map(|result| {
                    let path: PathBuf = result.path().into();
                    let parent: PathBuf = path.parent().unwrap_or(&path).into();
                    IgnoreFile {
                        path,
                        applies_in: Some(parent),
                        applies_to: None,
                    }
                })
                .collect(),
        )
    } else {
        None
    }
}

pub(super) fn get_nx_ignore<P: AsRef<Path>>(origin: P) -> Option<IgnoreFile> {
    let nx_ignore_path = PathBuf::from(origin.as_ref()).join(".nxignore");
    if nx_ignore_path.exists() {
        Some(IgnoreFile {
            path: nx_ignore_path,
            applies_in: Some(origin.as_ref().into()),
            applies_to: None,
        })
    } else {
        None
    }
}

pub(super) fn transform_event(watch_event: &Event) -> Option<Event> {
    if cfg!(target_os = "linux") {
        let tags = watch_event
            .tags
            .clone()
            .into_iter()
            .map(|tag| match tag {
                Tag::Path { path, file_type } => {
                    trace!("canonicalizing {:?}", path);
                    let real_path = fs::canonicalize(&path).unwrap_or(path);
                    trace!("real path {:?}", real_path);
                    Tag::Path {
                        path: real_path,
                        file_type,
                    }
                }
                _ => tag,
            })
            .collect();

        Some(Event {
            tags,
            metadata: watch_event.metadata.clone(),
        })
    } else {
        None
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
    use watchexec_events::{filekind::{FileEventKind, CreateKind}, FileType, Source, Tag, Event};
    use std::collections::HashMap;

    #[test]
    fn get_ignore_files_finds_gitignores() {
        let temp = TempDir::new().unwrap();
        temp.child(".gitignore").write_str("node_modules\n").unwrap();
        temp.child("nested").child(".gitignore").write_str("dist\n").unwrap();
        temp.child("node_modules").child(".gitignore").write_str("ignored\n").unwrap();

        let files = get_ignore_files(true, temp.path().to_str().unwrap()).unwrap();
        let mut names = files
            .iter()
            .map(|f| f.path.strip_prefix(temp.path()).unwrap().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        names.sort();
        assert_eq!(names, vec![".gitignore", "nested/.gitignore"]);
    }

    #[test]
    fn get_nx_ignore_detects_file() {
        let temp = TempDir::new().unwrap();
        temp.child(".nxignore").write_str("dist\n").unwrap();
        let res = get_nx_ignore(temp.path());
        assert!(res.is_some());
    }

    #[test]
    fn transform_event_canonicalizes_paths() {
        if !cfg!(target_os = "linux") {
            return;
        }
        let temp = TempDir::new().unwrap();
        let real = temp.child("real.txt");
        real.touch().unwrap();
        let link = temp.child("link.txt");
        link.symlink_to_file(real.path()).unwrap();

        let event = Event {
            tags: vec![
                Tag::Path { path: link.path().to_path_buf(), file_type: Some(FileType::File) },
                Tag::FileEventKind(FileEventKind::Create(CreateKind::File)),
                Tag::Source(Source::Filesystem),
            ],
            metadata: HashMap::new(),
        };

        let transformed = transform_event(&event).unwrap();
        let (p, _) = transformed.paths().next().unwrap();
        assert_eq!(p, real.path());
    }
}
