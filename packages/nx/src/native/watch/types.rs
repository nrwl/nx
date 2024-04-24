use napi::bindgen_prelude::*;
use std::fs::read_dir;

use crate::native::utils::Normalize;
use crate::native::walker::nx_walker_sync;
use std::path::{Path, PathBuf};
use tracing::trace;
use watchexec_events::filekind::CreateKind;
use watchexec_events::{Event, Tag};

use crate::native::watch::utils::transform_event;

#[napi(string_enum)]
#[derive(Debug)]
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
            .strip_prefix(&value.origin)
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
    pub origin: String,
}

pub fn transform_event_to_watch_events(
    value: &Event,
    origin: &str,
) -> anyhow::Result<Vec<WatchEventInternal>> {
    let transformed = transform_event(value);
    let value = transformed.as_ref().unwrap_or(value);

    let Some(path) = value.paths().next() else {
        let error_msg = "unable to get path from the event";
        trace!(?value, error_msg);
        anyhow::bail!(error_msg)
    };

    let Some(event_kind) = value.tags.iter().find_map(|t| match t {
        Tag::FileEventKind(event_kind) => Some(event_kind),
        _ => None,
    }) else {
        let error_msg = "unable to get the file event kind";
        trace!(?value, error_msg);
        anyhow::bail!(error_msg)
    };

    let path_ref = path.0;
    if path.1.is_none() && !path_ref.exists() {
        Ok(vec![WatchEventInternal {
            path: path_ref.into(),
            r#type: EventType::delete,
            origin: origin.to_owned(),
        }])
    } else {
        #[cfg(target_os = "macos")]
        {
            use std::fs;
            use std::os::macos::fs::MetadataExt;

            let origin = origin.to_owned();
            let t = fs::metadata(path_ref);
            match t {
                Err(_) => Ok(vec![WatchEventInternal {
                    path: path_ref.into(),
                    r#type: EventType::delete,
                    origin,
                }]),
                Ok(t) => {
                    let modified_time = t.st_mtime();
                    let birth_time = t.st_birthtime();

                    // if a file is created and updated near the same time, we always get a create event
                    // so we need to check the timestamps to see if it was created or updated
                    // if the modified time is the same as birth_time then it was created
                    if modified_time == birth_time {
                        Ok(vec![WatchEventInternal {
                            path: path_ref.into(),
                            r#type: EventType::create,
                            origin,
                        }])
                    } else {
                        Ok(vec![WatchEventInternal {
                            path: path_ref.into(),
                            r#type: EventType::update,
                            origin,
                        }])
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            use watchexec_events::filekind::FileEventKind;
            use watchexec_events::filekind::ModifyKind::Name;
            use watchexec_events::filekind::RenameMode;

            let event_kind = match event_kind {
                FileEventKind::Create(CreateKind::File) => EventType::create,
                FileEventKind::Modify(Name(RenameMode::To)) => EventType::create,
                FileEventKind::Modify(Name(RenameMode::From)) => EventType::delete,
                FileEventKind::Modify(_) => EventType::update,
                _ => EventType::update,
            };

            Ok(vec![WatchEventInternal {
                path: path_ref.into(),
                r#type: event_kind,
                origin: origin.to_owned(),
            }])
        }

        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            use watchexec_events::filekind::FileEventKind;
            use watchexec_events::filekind::ModifyKind::Name;
            use watchexec_events::filekind::RenameMode;

            if matches!(event_kind, FileEventKind::Create(CreateKind::Folder)) {
                let mut result = vec![];

                for path in nx_walker_sync(path_ref, None) {
                    let path = path_ref.join(path);
                    if !path.is_dir() {
                        result.push(WatchEventInternal {
                            path,
                            r#type: EventType::create,
                            origin: origin.to_owned(),
                        });
                    }
                }

                Ok(result)
            } else {
                let event_kind = match event_kind {
                    FileEventKind::Create(CreateKind::File) => EventType::create,
                    FileEventKind::Modify(Name(RenameMode::To)) => EventType::create,
                    FileEventKind::Modify(Name(RenameMode::From)) => EventType::delete,
                    FileEventKind::Modify(_) => EventType::update,
                    _ => EventType::update,
                };

                Ok(vec![WatchEventInternal {
                    path: path_ref.into(),
                    r#type: event_kind,
                    origin: origin.to_owned(),
                }])
            }
        }
    }

    // trace!(?path, ?event_kind, ?event_type, "event kind -> event type");
}
