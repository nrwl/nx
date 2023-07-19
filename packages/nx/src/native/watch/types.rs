use napi::bindgen_prelude::*;

use std::path::PathBuf;
use tracing::trace;
use watchexec_events::filekind::FileEventKind;
use watchexec_events::{Event, Tag};

#[napi(string_enum)]
#[derive(Debug)]
/// Newly created files will have the `update` EventType as well.
/// This simplifies logic between OS's, IDEs and git operations
pub enum EventType {
    #[allow(non_camel_case_types)]
    delete,
    #[allow(non_camel_case_types)]
    update,
    #[allow(non_camel_case_types)]
    create,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct WatchEvent {
    pub path: String,
    pub r#type: EventType,
}

impl From<&WatchEventInternal> for WatchEvent {
    fn from(value: &WatchEventInternal) -> Self {
        let path = value
            .path
            .strip_prefix(value.origin.as_ref().expect("origin is available"))
            .unwrap_or(&value.path)
            .display()
            .to_string();

        #[cfg(windows)]
        let path = path.replace('\\', "/");

        WatchEvent {
            path,
            r#type: value.r#type,
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct WatchEventInternal {
    pub path: PathBuf,
    pub r#type: EventType,
    pub origin: Option<String>,
}

impl From<&Event> for WatchEventInternal {
    fn from(value: &Event) -> Self {
        let path = value.paths().next().expect("there should always be a path");

        let event_kind = value
            .tags
            .iter()
            .find_map(|t| match t {
                Tag::FileEventKind(event_kind) => Some(event_kind),
                _ => None,
            })
            .expect("there should always be a file event kind");

        let path_ref = path.0;
        let event_type = if matches!(path.1, None) && !path_ref.exists() {
            EventType::delete
        } else if cfg!(target_os = "macos") {
            #[cfg(target_os = "macos")]
            {
                use std::fs;
                use std::os::macos::fs::MetadataExt;

                let t = fs::metadata(path_ref).expect("metadata should be available");

                let access_time = t.st_atime();
                let modified_time = t.st_mtime();
                let birth_time = t.st_birthtime();

                // if a file is created and updated near the same time, we always get a create event
                // so we need to check the timestamps to see if it was created or updated
                // if the access_time is the same as the modified_time, and modified time is the same as birth_time
                // then it was created
                if access_time == modified_time && modified_time == birth_time {
                    EventType::create
                } else {
                    EventType::update
                }
            }
        } else {
            match event_kind {
                FileEventKind::Create(_) => EventType::create,
                FileEventKind::Modify(_) => EventType::update,
                _ => EventType::update,
            }
        };

        trace!(?path, ?event_kind, ?event_type, "event kind -> event type");

        WatchEventInternal {
            path: path.0.into(),
            r#type: event_type,
            origin: None,
        }
    }
}
