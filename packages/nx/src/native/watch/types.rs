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

impl From<WatchEventInternal> for WatchEvent {
    fn from(value: WatchEventInternal) -> Self {
        let path = value
            .path
            .strip_prefix(&value.origin.expect("origin is available"))
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
        } else {
            match event_kind {
                FileEventKind::Create(_) => EventType::create,
                FileEventKind::Modify(_) => EventType::update,
                FileEventKind::Remove(_) => EventType::delete,
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
