pub const TRACKING_ID_PROD: &str = "G-BGPKPJK4PY";
pub const GA_ENDPOINT: &str = "https://www.google-analytics.com/g/collect";
pub const BATCH_INTERVAL_MS: u64 = 50;

// Google Analytics Measurement Protocol limits
pub const MAX_EVENT_NAME_LENGTH: usize = 40;
pub const MAX_PARAM_NAME_LENGTH: usize = 40;
pub const MAX_PARAM_VALUE_LENGTH: usize = 100;
pub const MAX_URL_PARAM_VALUE_LENGTH: usize = 500;
pub const MAX_EVENTS_PER_BATCH: usize = 25;
pub const MAX_CUSTOM_PARAMS: usize = 25;

/// GA4 request-level parameters (sent in the URL query string)
pub mod request_param {
    pub const PROTOCOL_VERSION: &str = "v";
    pub const CLIENT_ID: &str = "cid";
    pub const USER_ID: &str = "uid";
    pub const TRACKING_ID: &str = "tid";
    pub const SESSION_ID: &str = "sid";
    pub const USER_AGENT_ARCHITECTURE: &str = "uaa";
    pub const USER_AGENT_PLATFORM: &str = "uap";
    pub const USER_AGENT_PLATFORM_VERSION: &str = "uapv";
    pub const USER_AGENT_MOBILE: &str = "uamb";
    pub const SESSION_ENGAGED: &str = "seg";
    pub const USER_AGENT_FULL_VERSION_LIST: &str = "uafvl";
    pub const DEBUG_VIEW: &str = "_dbg";
}

/// GA4 event-level parameters (sent in the POST body)
pub mod event_param {
    pub const EVENT_NAME: &str = "en";
    pub const DOCUMENT_TITLE: &str = "dt";
    pub const DOCUMENT_LOCATION: &str = "dl";
}

/// User-scoped custom dimensions (up.* = user property)
pub mod user_dimension {
    pub const OS_ARCHITECTURE: &str = "up.os_architecture";
    pub const USER_ID: &str = "up.user_id";
    pub const NODE_VERSION: &str = "up.node_version";
    pub const PACKAGE_MANAGER: &str = "up.package_manager";
    pub const PACKAGE_MANAGER_VERSION: &str = "up.package_manager_version";
    pub const NX_VERSION: &str = "up.nx_version";
    pub const IS_CI: &str = "up.is_ci";
}

/// Event-scoped custom dimensions (ep.* = event parameter string, epn.* = number)
/// These are the source of truth — TypeScript imports them via get_event_dimensions().
pub mod event_dimension {
    pub const IS_AI_AGENT: &str = "ep.is_ai_agent";
    pub const COMMAND: &str = "ep.nx_command";
    pub const GENERATOR_NAME: &str = "ep.generator_name";
    pub const PACKAGE_NAME: &str = "ep.package_name";
    pub const PACKAGE_VERSION: &str = "ep.package_version";
    pub const CREATE_PROJECT_GRAPH: &str = "ep.create_project_graph";
    pub const DURATION: &str = "epn.duration";
}
