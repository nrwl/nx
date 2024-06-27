mod find_matching_projects;
mod get_mod_time;
mod normalize_trait;
pub mod path;

pub use find_matching_projects::*;
pub use get_mod_time::*;
pub use normalize_trait::Normalize;


#[cfg_attr(not(target_arch = "wasm32"), path = "atomics/default.rs")]
#[cfg_attr(target_arch = "wasm32", path = "atomics/wasm.rs")]
pub mod atomics;

pub use atomics::*;
