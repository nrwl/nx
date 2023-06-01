use ignore::WalkBuilder;
use ignore_files::IgnoreFile;
use std::path::PathBuf;

pub(super) fn get_ignore_files<T: AsRef<str>>(root: T) -> Vec<IgnoreFile> {
    let root = root.as_ref();

    let mut walker = WalkBuilder::new(root);
    walker.hidden(false);
    walker.git_ignore(false);

    let node_folder = PathBuf::from(root).join("node_modules");
    walker.filter_entry(move |entry| !entry.path().starts_with(&node_folder));
    walker
        .build()
        .flatten()
        .filter(|result| {
            result.path().ends_with(".nxignore") || result.path().ends_with(".gitignore")
        })
        .map(|result| {
            let path: PathBuf = result.path().into();
            let parent: PathBuf = path.parent().unwrap_or(&path).into();
            IgnoreFile {
                path,
                applies_in: Some(parent),
                applies_to: None,
            }
        })
        .collect()
}

// /// Get only the root level folders to watch.
// /// These will not include git ignored folders
// pub(super) fn get_watch_directories<T: AsRef<str>>(root: T) -> Vec<PathBuf> {
//     let root = root.as_ref();
//
//     let mut walker = WalkBuilder::new(root);
//     walker.hidden(false);
//     walker.max_depth(Some(1));
//     walker.filter_entry(|entry| entry.path().is_dir());
//
//     walker
//         .build()
//         .flatten()
//         .map(|result| result.path().into())
//         .collect()
// }
