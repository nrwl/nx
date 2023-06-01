use tracing::trace;
use watchexec::error::RuntimeError;
use watchexec::filter::Filterer;
use watchexec_events::filekind::{CreateKind, FileEventKind, ModifyKind, RemoveKind};

use watchexec_events::{Event, FileType, Priority, Source, Tag};
use watchexec_filterer_ignore::IgnoreFilterer;

#[derive(Debug)]
pub struct WatchFilterer {
    pub inner: IgnoreFilterer,
}

/// Used to filter out events that that come from watchexec
impl Filterer for WatchFilterer {
    fn check_event(&self, event: &Event, priority: Priority) -> Result<bool, RuntimeError> {
        if !self.inner.check_event(event, priority)? {
            return Ok(false);
        }

        trace!(?event, "checking if event is valid");

        //
        // Tags will be a Vec that contains multiple types of information for a given event
        // We are only interested if:
        // 1) A `FileEventKind` is modified, created, removed, or renamed
        // 2) A Path that is a FileType::File
        // 3) Deleted files do not have a FileType::File (because they're deleted..), check if a path is valid
        // 4) Only FileSystem sources are valid
        // If there's a tag that doesnt confine to this criteria, we `return` early, otherwise we `continue`.
        for tag in &event.tags {
            match tag {
                // Tag::Source(Source::Keyboard) => continue,
                // Tag::Keyboard(Keyboard::Eof) => continue,
                Tag::FileEventKind(file_event) => match file_event {
                    FileEventKind::Modify(ModifyKind::Name(_)) => continue,
                    FileEventKind::Modify(ModifyKind::Data(_)) => continue,
                    FileEventKind::Create(CreateKind::File) => continue,
                    FileEventKind::Remove(RemoveKind::File) => continue,

                    #[cfg(windows)]
                    FileEventKind::Modify(ModifyKind::Any) => continue,
                    #[cfg(windows)]
                    FileEventKind::Create(CreateKind::Any) => continue,
                    #[cfg(windows)]
                    FileEventKind::Remove(RemoveKind::Any) => continue,

                    _ => return Ok(false),
                },
                // Deleted files do not have a file_type + we don't want directory changes + we dont want files that end with `~`
                Tag::Path {
                    path,
                    file_type: Some(FileType::File) | None,
                } if !path.display().to_string().ends_with('~') => continue,
                Tag::Source(Source::Filesystem) => continue,
                _ => return Ok(false),
            }
        }

        trace!(?event, "event passed all checks");

        Ok(true)
    }
}
