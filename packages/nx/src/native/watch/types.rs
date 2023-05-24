use napi::bindgen_prelude::*;
use std::fs::{metadata, Metadata};
use std::path::PathBuf;
use std::time::Duration;
use tracing::trace;
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, Tag};

#[napi(string_enum)]
#[derive(Debug)]
pub enum EventType {
    #[allow(non_camel_case_types)]
    create,
    #[allow(non_camel_case_types)]
    delete,
    #[allow(non_camel_case_types)]
    update,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct WatchEvent {
    pub path: String,
    pub r#type: EventType,
}

impl From<WatchEventInternal> for WatchEvent {
    fn from(value: WatchEventInternal) -> Self {
        let event_type = value.confirm_event_type().unwrap_or(value.r#type);

        let path = value
            .path
            .strip_prefix(&value.origin.expect("origin is available"))
            .unwrap_or(&value.path);
        #[cfg(windows)]
        let path = path.replace('\\', "/");

        WatchEvent {
            path: path.display().to_string(),
            r#type: event_type,
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct WatchEventInternal {
    pub path: PathBuf,
    pub r#type: EventType,
    pub metadata: Option<Metadata>,
    pub origin: Option<String>,
}

impl WatchEventInternal {
    fn confirm_event_type(&self) -> Option<EventType> {
        let Some(metadata) = &self.metadata else {
            trace!(?self.path, "could not retrieve metadata");
            return None
        };

        trace!(?self.path, ?metadata);

        let (Ok(modified_time), Ok(created_time)) = (metadata.modified(), metadata.created()) else {
            trace!(?self.path, "could not retrieve system times");
            return None
        };

        let Ok(duration) = modified_time.duration_since(created_time) else {
            trace!(?self.path, "could not retrieve system times");
            return None
        };

        if duration <= Duration::from_millis(1000) {
            Some(EventType::create)
        } else {
            Some(EventType::update)
        }
    }
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
            match &event_kind {
                FileEventKind::Modify(ModifyKind::Name(_)) => EventType::create,
                FileEventKind::Modify(ModifyKind::Data(_)) => EventType::update,
                FileEventKind::Create(_) => EventType::create,
                FileEventKind::Remove(_) => EventType::delete,
                _ => EventType::update,
            }
        };

        trace!(?path, ?event_kind, ?event_type, "event kind -> event type");

        WatchEventInternal {
            path: path.0.into(),
            r#type: event_type,
            metadata: metadata(path.0).ok(),
            origin: None,
        }
    }
}
