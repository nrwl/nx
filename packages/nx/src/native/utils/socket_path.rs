//! Where the daemon, forked task processes, plugin workers and Nx Console put
//! their sockets.
//!
//! Not the OS temp dir, and not one location: the root is a literal `/tmp/.nx`
//! so a sandbox can allowlist it once, and resolution walks an ordered chain —
//! `$NX_SOCKET_DIR`, then `/tmp/.nx/<uid>/sockets`, then `~/.nx/sockets`, then
//! the workspace data dir. Each tier establishes its own containment before it
//! can be used, so the winning root is chosen at runtime and a second
//! derivation cannot track it — which is why this module is the only place that
//! answers the question, and `daemon/tmp-dir.ts` calls in rather than
//! recomputing.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use itertools::Itertools;
use sha2::{Digest, Sha256};

use crate::native::utils::owned_dir::{
    DirRefusal, canonical_dir, describe_refusal, ensure_owned_private_dir, ensure_safe_shared_root,
    is_peer_writable, not_created, remedy_for, resolve_path, user_segment,
};

/// Why a directory may not *be* the socket directory. Named rather than a
/// boolean so a table entry reads as its own reason: picking the wrong one tells
/// a user their private directory is a code-execution risk, which is the one
/// claim here that most needs to be true.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SocketDirRefusal {
    SharedWithOtherUsers,
    NxManaged,
    OsTempRoot,
}

/// A resolution that cannot be recovered from. Invalid configuration, or no
/// directory left to fall to.
#[derive(Debug, Clone)]
pub(crate) enum SocketDirError {
    InvalidConfigured {
        dir: PathBuf,
        reason: SocketDirRefusal,
    },
    NothingEstablishable {
        refusal: DirRefusal,
    },
}

/// How a resolution ended. The caller renders and latches the warnings — this
/// module decides only what is true.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SocketDirOutcome {
    /// Under `$NX_SOCKET_DIR`, which was accepted.
    Configured,
    /// Under the preferred root.
    Preferred,
    /// Under a later tier, naming the one that was skipped.
    Demoted { preferred: PathBuf },
    /// The workspace data dir, because no default root could be established.
    WorkspaceFallback { attempted: Option<PathBuf> },
    /// The workspace data dir, because `$NX_SOCKET_DIR` was refused.
    ConfiguredRefused { configured: PathBuf, error: String },
}

/// A directory the tier chain established, before the socket's own name is
/// known. Internal: `resolve_socket_path` turns one of these into a resolution.
struct EstablishedDir {
    dir: PathBuf,
    outcome: SocketDirOutcome,
    refusals: Vec<DirRefusal>,
}

/// A resolved socket, plus everything the caller needs to explain it.
#[derive(Debug, Clone)]
pub(crate) struct SocketDirResolution {
    /// The established directory. Always a real directory, on every platform.
    pub(crate) dir: PathBuf,
    /// The socket itself — on Windows the `\\.\pipe\nx\` name, which is not a
    /// filesystem path at all.
    pub(crate) path: PathBuf,
    /// Whether the path, before the Windows pipe prefix, exceeds
    /// `MAX_SOCKET_PATH`. Reported rather than thrown: the caller composes the
    /// sentence, and which advice is correct depends on `outcome`.
    pub(crate) too_long: bool,
    pub(crate) outcome: SocketDirOutcome,
    /// Why the tiers above this one were skipped. Can name any directory a tier
    /// establishes, so it is not always the tier root itself.
    pub(crate) refusals: Vec<DirRefusal>,
}

impl SocketDirResolution {
    fn describe_refusals(&self) -> String {
        self.refusals.iter().map(describe_refusal).join("; ")
    }

    /// Deduplicated advice for the refusals, in the order they were collected.
    fn remedies(&self) -> Vec<String> {
        self.refusals
            .iter()
            .filter_map(remedy_for)
            .unique()
            .collect()
    }
}

fn var(env: Option<&HashMap<String, String>>, key: &str) -> Option<String> {
    match env {
        Some(overrides) => overrides.get(key).cloned(),
        None => std::env::var(key).ok(),
    }
    // An empty value means unset. `NX_SOCKET_DIR=` with no value is ordinary in
    // a .env file or a compose environment list, and an empty string resolves to
    // the working directory — which `removeSocketDir` then deletes recursively.
    .filter(|value| !value.is_empty())
}

fn system_tmp_dir() -> PathBuf {
    resolve_path(&std::env::temp_dir())
}

/// Stable root for Nx runtime artifacts that need an OS tmp location. On POSIX a
/// literal `/tmp`, not the OS temp dir, which honours `$TMPDIR` — per-user on
/// macOS, rewritten by sandboxes, stripped from the daemon env, so client and
/// daemon would disagree.
pub(crate) fn nx_tmp_dir() -> PathBuf {
    if cfg!(windows) {
        system_tmp_dir().join(".nx")
    } else {
        PathBuf::from("/tmp/.nx")
    }
}

/// Owner-only runtime root for the current user. No user segment on Windows —
/// `%TMP%` is already per-account, and the segment would only cost path length.
pub(crate) fn nx_user_tmp_dir() -> PathBuf {
    if cfg!(windows) {
        nx_tmp_dir()
    } else {
        nx_tmp_dir().join(user_segment())
    }
}

/// Path of the current user's native binary cache. Refused *as* a socket
/// directory, since Nx manages what lives there.
fn native_cache_root() -> PathBuf {
    nx_user_tmp_dir().join("native-cache")
}

/// Runtime root under the user's home, used when the shared container cannot be
/// established.
///
/// Absolute, not merely non-empty: a relative `$HOME` would put sockets under
/// the working directory and aim a recursive delete at it. A rootless container
/// has no `$HOME` and no passwd entry, so this can legitimately be `None`.
#[cfg(all(not(windows), not(target_family = "wasm")))]
fn nx_home_tmp_dir() -> Option<&'static Path> {
    static HOME: OnceLock<Option<PathBuf>> = OnceLock::new();
    HOME.get_or_init(resolve_home_tmp_dir).as_deref()
}

#[cfg(all(not(windows), not(target_family = "wasm")))]
fn resolve_home_tmp_dir() -> Option<PathBuf> {
    let home = match std::env::var("HOME") {
        Ok(home) if !home.is_empty() => PathBuf::from(home),
        _ => {
            nix::unistd::User::from_uid(nix::unistd::getuid())
                .ok()
                .flatten()?
                .dir
        }
    };
    home.is_absolute().then(|| home.join(".nx"))
}

#[cfg(any(windows, target_family = "wasm"))]
fn nx_home_tmp_dir() -> Option<&'static Path> {
    None
}

/// One short root beneath the current user's owner-only runtime directory. No
/// extra segment on Windows: `%TMP%` is already per-user and already contains
/// the username, so `\.nx\sockets` would spend 12 characters of the 95-char
/// socket budget and newly overrun it for long account names.
fn default_socket_root() -> PathBuf {
    if cfg!(windows) {
        system_tmp_dir()
    } else {
        nx_user_tmp_dir().join("sockets")
    }
}

fn home_socket_root() -> Option<PathBuf> {
    nx_home_tmp_dir().map(|home| home.join("sockets"))
}

/// Whether `~/.nx` is somewhere other than the shared container. With
/// `HOME=/tmp` they are the same path, and offering it as a second tier would
/// point the private-directory guard at `/tmp/.nx` itself — which, when the
/// container is already ours (or Nx runs as root), takes a `1777` container to
/// `0700` and undoes the documented provisioning, with nothing to put it back.
fn home_tier_is_distinct() -> bool {
    static DISTINCT: OnceLock<bool> = OnceLock::new();
    *DISTINCT.get_or_init(|| {
        let Some(home) = nx_home_tmp_dir() else {
            return false;
        };
        let home = canonical_dir(home);
        ![
            system_tmp_dir(),
            nx_tmp_dir(),
            nx_user_tmp_dir(),
            default_socket_root(),
            native_cache_root(),
        ]
        .iter()
        .any(|shared| canonical_dir(shared) == home)
    })
}

#[derive(Clone, Copy)]
enum Guard {
    SharedRoot,
    PrivateDir,
}

/// A socket root and the directories that must be established before it is
/// usable, outermost first.
struct Tier {
    root: PathBuf,
    guards: Vec<(PathBuf, Guard)>,
}

impl Tier {
    /// Stops at the first refusal and records it: once the shared container is
    /// unusable, whether the directories beneath it would also have failed says
    /// nothing the user can act on.
    fn establish(&self, refusals: &mut Vec<DirRefusal>) -> bool {
        for (dir, guard) in &self.guards {
            let refusal = match guard {
                Guard::SharedRoot => ensure_safe_shared_root(dir).err(),
                Guard::PrivateDir => ensure_owned_private_dir(dir).err(),
            };
            if let Some(refusal) = refusal {
                refusals.push(refusal);
                return false;
            }
        }
        true
    }
}

/// Socket roots to try, best first. The first that succeeds wins, and the
/// workspace data dir is the last resort when none does.
///
/// `/tmp` first because it is the shortest path — the socket budget is 95
/// characters. Home second because it needs no administrator. Windows has one
/// tier: named pipes are not filesystem objects, so there is nothing to
/// establish.
fn socket_root_tiers() -> Vec<Tier> {
    if cfg!(windows) {
        return vec![Tier {
            root: system_tmp_dir(),
            guards: Vec::new(),
        }];
    }

    let mut tiers = vec![Tier {
        root: default_socket_root(),
        guards: vec![
            (nx_tmp_dir(), Guard::SharedRoot),
            (nx_user_tmp_dir(), Guard::PrivateDir),
            (default_socket_root(), Guard::PrivateDir),
        ],
    }];

    // Omitted entirely when there is no home directory to use, or when it is the
    // shared container under another name, rather than offered and then damaging
    // what it lands on.
    if let Some(home) = nx_home_tmp_dir().filter(|_| home_tier_is_distinct()) {
        let root = home.join("sockets");
        tiers.push(Tier {
            root: root.clone(),
            // No shared level to verify: the home directory is the user's own,
            // so there is no container another user could have created first.
            guards: vec![
                (home.to_path_buf(), Guard::PrivateDir),
                (root, Guard::PrivateDir),
            ],
        });
    }

    tiers
}

/// Directories that may not *be* the socket directory, and why.
fn dirs_unusable_as_socket_dir() -> Vec<(PathBuf, SocketDirRefusal)> {
    let system_tmp = system_tmp_dir();
    let nx_tmp = nx_tmp_dir();

    let mut dirs = vec![
        // Refused even when no peer can reach it: a configured directory becomes
        // the socket directory itself, and it is deleted recursively — here, the
        // user's whole temp directory.
        (
            system_tmp.clone(),
            if is_peer_writable(&system_tmp) {
                SocketDirRefusal::SharedWithOtherUsers
            } else {
                SocketDirRefusal::OsTempRoot
            },
        ),
        (
            nx_tmp.clone(),
            if is_peer_writable(&nx_tmp) {
                SocketDirRefusal::SharedWithOtherUsers
            } else {
                SocketDirRefusal::NxManaged
            },
        ),
        (nx_user_tmp_dir(), SocketDirRefusal::NxManaged),
        (default_socket_root(), SocketDirRefusal::NxManaged),
    ];

    // Skipped on Windows, where the home tier is never offered.
    if !cfg!(windows) {
        dirs.extend(
            nx_home_tmp_dir()
                .map(Path::to_path_buf)
                .into_iter()
                .chain(home_socket_root())
                .map(|dir| (dir, SocketDirRefusal::NxManaged)),
        );
    }

    dirs.push((native_cache_root(), SocketDirRefusal::NxManaged));
    dirs
}

/// The configured socket dir, normalized. Normalizing strips a trailing
/// separator, which would otherwise defeat the `O_NOFOLLOW` guard downstream —
/// this is the one socket path built from user input rather than by joining.
fn configured_socket_dir(env: Option<&HashMap<String, String>>) -> Option<PathBuf> {
    var(env, "NX_SOCKET_DIR")
        .or_else(|| var(env, "NX_DAEMON_SOCKET_DIR"))
        .map(|dir| resolve_path(Path::new(&dir)))
}

/// `length` is in hex characters and must be even; both callers pass one.
fn short_hash(parts: &[&str], length: usize) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
    }
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(length);
    for byte in digest.iter().take(length / 2) {
        let _ = write!(hex, "{byte:02x}");
    }
    hex
}

fn daemon_socket_dir_name(root: &Path, workspace_root: &str) -> PathBuf {
    let pid = std::process::id().to_string();
    root.join(short_hash(&[&workspace_root.to_lowercase(), &pid], 20))
}

/// Short so the socket file name still fits under the 95-character limit.
fn plugin_socket_dir_name(root: &Path, workspace_root: &str) -> PathBuf {
    root.join(short_hash(&[&workspace_root.to_lowercase()], 8))
}

/// No pid, unlike the daemon's: Nx Console binds this socket when the editor
/// activates, long before any Nx process exists, so a per-process name could
/// never be agreed on. Discriminated from `plugin_socket_dir_name`, which hashes
/// the same root, so the two never collide.
fn nx_console_socket_dir_name(root: &Path, workspace_root: &str) -> PathBuf {
    root.join(short_hash(
        &[&workspace_root.to_lowercase(), "nx-console"],
        8,
    ))
}

fn absolute_under(root: &str, path: &str) -> PathBuf {
    let path = Path::new(path);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        Path::new(root).join(path)
    }
}

/// Where Nx keeps per-workspace runtime state. Mirrors
/// `utils/cache-directory.ts` — a Lerna repo that has not adopted `nx.json` is
/// special-cased away from `.nx` so the directory does not appear unasked.
fn workspace_data_directory(
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> PathBuf {
    if let Some(configured) = var(env, "NX_WORKSPACE_DATA_DIRECTORY")
        .or_else(|| var(env, "NX_PROJECT_GRAPH_CACHE_DIRECTORY"))
    {
        return absolute_under(workspace_root, &configured);
    }

    let root = Path::new(workspace_root);
    if root.join("lerna.json").exists() && !root.join("nx.json").exists() {
        root.join("node_modules")
            .join(".cache")
            .join("nx-workspace-data")
    } else {
        root.join(".nx").join("workspace-data")
    }
}

/// The last-resort socket directory for a workspace. Resolving for someone
/// else's workspace is only meaningful if the last resort honours it too.
fn workspace_socket_dir(workspace_root: &str, env: Option<&HashMap<String, String>>) -> PathBuf {
    workspace_data_directory(workspace_root, env).join("d")
}

/// The longest socket path the platform will accept. A `sun_path` is 104 bytes
/// on macOS and 108 on Linux; 95 leaves room for the longest leaf below.
pub(crate) const MAX_SOCKET_PATH: usize = 95;

/// Which socket is being resolved. Each variant knows both the directory it
/// belongs in and what it is called, so the whole path is built in one place
/// and measured against `MAX_SOCKET_PATH` before anything tries to bind it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SocketKind {
    Daemon,
    /// A forked task process, which shares the daemon's per-run directory.
    ForkedProcess(String),
    Plugin(String),
    NxConsole,
}

impl SocketKind {
    fn dir_for(&self, root: &Path, workspace_root: &str) -> PathBuf {
        match self {
            SocketKind::Daemon | SocketKind::ForkedProcess(_) => {
                daemon_socket_dir_name(root, workspace_root)
            }
            SocketKind::Plugin(_) => plugin_socket_dir_name(root, workspace_root),
            SocketKind::NxConsole => nx_console_socket_dir_name(root, workspace_root),
        }
    }

    /// Kept short, and readable rather than hashed: `pid` and counter identify a
    /// worker at a glance, and the whole path has only `MAX_SOCKET_PATH`
    /// characters to spend.
    fn file_name(&self) -> String {
        match self {
            SocketKind::Daemon => "d.sock".to_string(),
            SocketKind::ForkedProcess(id) => format!("fp{id}.sock"),
            SocketKind::Plugin(id) => format!("p{id}.sock"),
            SocketKind::NxConsole => "nx-console.sock".to_string(),
        }
    }
}

/// Refuse a configured directory that may not *be* the socket directory.
///
/// Only reachable for `$NX_SOCKET_DIR`: every default-root candidate is
/// `<root>/<hash>`, and every entry in the list is a bare root, so the scan
/// there could only ever prove a `None` — at the cost of canonicalizing each
/// entry. Exact matches only, so the per-user directories under those roots
/// never trip it.
fn refuse_unusable_socket_dir(dir: &Path) -> Result<(), SocketDirError> {
    let canonical = canonical_dir(dir);
    match dirs_unusable_as_socket_dir()
        .into_iter()
        .find(|(unusable, _)| canonical_dir(unusable) == canonical)
    {
        Some((_, reason)) => Err(SocketDirError::InvalidConfigured {
            dir: dir.to_path_buf(),
            reason,
        }),
        None => Ok(()),
    }
}

/// Whether the leaf sits under a default root the tier chain already
/// established, or under `$NX_SOCKET_DIR`, which is the user's to create.
#[derive(Debug, Clone)]
enum Placement {
    DefaultRoot { preferred: Option<PathBuf> },
    Configured,
}

/// The socket directory for `kind`, under the first root whose containment could
/// be established. Establishing rather than pure: each level is created
/// non-recursively at `0700` with its ownership re-checked, so a caller that
/// created the directory itself would leave an intermediate at the ambient
/// umask, which the next run refuses.
/// The socket for `kind`: the first root whose containment could be
/// established, the leaf directory for the workspace, and the socket's own
/// name — built and measured in one place so no caller can produce a path the
/// platform will refuse to bind.
pub(crate) fn resolve_socket_path(
    kind: SocketKind,
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> Result<SocketDirResolution, SocketDirError> {
    let established = resolve_socket_dir(&kind, workspace_root, env)?;
    let path = established.dir.join(kind.file_name());
    Ok(SocketDirResolution {
        // Measured before the Windows prefix: the limit is on the filesystem
        // path, and a pipe name is not one.
        too_long: path.as_os_str().len() > MAX_SOCKET_PATH,
        path: to_socket_path(&path),
        dir: established.dir,
        outcome: established.outcome,
        refusals: established.refusals,
    })
}

fn resolve_socket_dir(
    kind: &SocketKind,
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> Result<EstablishedDir, SocketDirError> {
    if let Some(configured) = configured_socket_dir(env) {
        return establish_socket_dir(
            &configured,
            Placement::Configured,
            Vec::new(),
            workspace_root,
            env,
        );
    }

    let tiers = socket_root_tiers();
    let mut refusals = Vec::new();
    let established = tiers.iter().position(|tier| tier.establish(&mut refusals));

    let Some(index) = established else {
        return fall_back_to_workspace(None, refusals, workspace_root, env);
    };

    establish_socket_dir(
        &kind.dir_for(&tiers[index].root, workspace_root),
        Placement::DefaultRoot {
            // Set only on a demotion, and names the tier that was skipped, so a
            // later length failure can say the path was not the one Nx wanted.
            preferred: (index > 0).then(|| tiers[0].root.clone()),
        },
        refusals,
        workspace_root,
        env,
    )
}

fn establish_socket_dir(
    dir: &Path,
    placement: Placement,
    mut refusals: Vec<DirRefusal>,
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> Result<EstablishedDir, SocketDirError> {
    // A default root has already had its containment established by the tier it
    // came from; a configured one is the user's to create. Its parents are made
    // separately from the leaf: creating and locking down in one step would
    // adopt a pre-planted symlink, which `mkdir` does not fail on.
    let parents = match placement {
        Placement::Configured => {
            refuse_unusable_socket_dir(dir)?;
            dir.parent()
                .and_then(|parent| std::fs::create_dir_all(parent).err())
                .map(|e| not_created(dir, &e))
        }
        Placement::DefaultRoot { .. } => None,
    };

    match parents.or_else(|| ensure_owned_private_dir(dir).err()) {
        None => Ok(EstablishedDir {
            dir: dir.to_path_buf(),
            outcome: match placement {
                Placement::Configured => SocketDirOutcome::Configured,
                Placement::DefaultRoot {
                    preferred: Some(preferred),
                } => SocketDirOutcome::Demoted { preferred },
                Placement::DefaultRoot { preferred: None } => SocketDirOutcome::Preferred,
            },
            refusals,
        }),
        Some(refusal) => {
            let error = describe_refusal(&refusal);
            refusals.push(refusal);
            match placement {
                // Recoverable: fall back to the owner-controlled workspace data
                // dir.
                Placement::DefaultRoot { .. } => {
                    fall_back_to_workspace(Some(dir.to_path_buf()), refusals, workspace_root, env)
                }
                // Never swap out a configured directory silently — the
                // substitute is longer and would resurface as a length
                // complaint about a path the user never set.
                Placement::Configured => Ok(EstablishedDir {
                    dir: establish_workspace_socket_dir(workspace_root, env)?,
                    outcome: SocketDirOutcome::ConfiguredRefused {
                        configured: dir.to_path_buf(),
                        error,
                    },
                    refusals,
                }),
            }
        }
    }
}

/// The last resort once no default root could be used.
fn fall_back_to_workspace(
    attempted: Option<PathBuf>,
    refusals: Vec<DirRefusal>,
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> Result<EstablishedDir, SocketDirError> {
    Ok(EstablishedDir {
        dir: establish_workspace_socket_dir(workspace_root, env)?,
        outcome: SocketDirOutcome::WorkspaceFallback { attempted },
        refusals,
    })
}

/// The fallback is only safe if it passes the same checks the primary did, and
/// there is nowhere left to fall when it does not.
fn establish_workspace_socket_dir(
    workspace_root: &str,
    env: Option<&HashMap<String, String>>,
) -> Result<PathBuf, SocketDirError> {
    let dir = workspace_socket_dir(workspace_root, env);
    if let Some(parent) = dir.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(SocketDirError::NothingEstablishable {
                refusal: not_created(&dir, &e),
            });
        }
    }
    ensure_owned_private_dir(&dir)
        .map(|()| dir)
        .map_err(|refusal| SocketDirError::NothingEstablishable { refusal })
}

/// What both ends derived for themselves before the resolver owned the answer.
///
/// Dialed as a retry while released extensions are still listening there. Nx is
/// the client, so without it a connect failure is indistinguishable from no IDE
/// being present and the integration would just go quiet. Remove this, and its
/// only caller, once the supported extension floor uses the resolver.
pub(crate) fn legacy_nx_console_socket_path(workspace_root: &str) -> PathBuf {
    let dir = configured_socket_dir(None).unwrap_or_else(|| {
        let hash = crate::native::hasher::hash(
            format!("{},nx-console", workspace_root.to_lowercase()).as_bytes(),
        );
        std::env::temp_dir().join(hash)
    });
    to_socket_path(&dir.join("nx-console.sock"))
}

fn to_socket_path(path: &Path) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(format!(r"\\.\pipe\nx\{}", path.to_string_lossy()))
    } else {
        path.to_path_buf()
    }
}

/// One resolved socket location, and everything `daemon/tmp-dir.ts` needs to
/// explain it. Every user-facing sentence is rendered on the TypeScript side,
/// so this carries facts rather than prose.
#[napi(object)]
#[derive(Default)]
pub struct SocketDirDetails {
    /// The socket itself — on Windows its `\\.\pipe\nx\` name.
    pub path: String,
    /// The directory holding it, for the caller that deletes it on shutdown.
    pub dir: String,
    /// Whether `path` exceeds what the platform will bind. Reported rather than
    /// thrown because which advice is correct depends on the other fields.
    pub too_long: bool,
    /// Set when `path` is a directory Nx refuses to *be* the socket directory:
    /// `shared-with-other-users`, `nx-managed`, or `os-temp-root`. The caller
    /// throws on it rather than using `path`.
    pub invalid_reason: Option<String>,
    /// The preferred root that was skipped, when a later tier was used.
    pub demoted_from: Option<String>,
    /// The default-root directory Nx tried before falling back, when there was
    /// one.
    pub attempted_dir: Option<String>,
    /// The `NX_SOCKET_DIR` that was refused, when that is why this is a
    /// fallback. Tracked apart from the other reasons so a later length error
    /// stops telling someone to shorten a directory refused for another one.
    pub refused_configured_dir: Option<String>,
    /// Why that configured directory was refused.
    pub refusal_error: Option<String>,
    /// Whether this landed in the workspace data dir, which the caller warns
    /// about once per process.
    pub used_workspace_fallback: bool,
    /// Deduplicated advice for the refusals collected along the way.
    pub remedies: Vec<String>,
    /// Every refusal as one sentence, for `--verbose`.
    pub refusal_details: Option<String>,
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn to_details(resolution: SocketDirResolution) -> SocketDirDetails {
    let mut details = SocketDirDetails {
        path: display(&resolution.path),
        dir: display(&resolution.dir),
        too_long: resolution.too_long,
        refusal_details: (!resolution.refusals.is_empty()).then(|| resolution.describe_refusals()),
        remedies: resolution.remedies(),
        ..Default::default()
    };

    match resolution.outcome {
        SocketDirOutcome::Demoted { preferred } => {
            details.demoted_from = Some(display(&preferred));
        }
        SocketDirOutcome::WorkspaceFallback { attempted } => {
            details.used_workspace_fallback = true;
            details.attempted_dir = attempted.as_deref().map(display);
        }
        SocketDirOutcome::ConfiguredRefused { configured, error } => {
            details.used_workspace_fallback = true;
            details.refused_configured_dir = Some(display(&configured));
            details.refusal_error = Some(error);
        }
        SocketDirOutcome::Configured | SocketDirOutcome::Preferred => {}
    }

    details
}

fn into_details(
    result: Result<SocketDirResolution, SocketDirError>,
) -> napi::Result<SocketDirDetails> {
    match result {
        Ok(resolution) => Ok(to_details(resolution)),
        Err(SocketDirError::InvalidConfigured { dir, reason }) => Ok(SocketDirDetails {
            path: display(&dir),
            invalid_reason: Some(
                match reason {
                    SocketDirRefusal::SharedWithOtherUsers => "shared-with-other-users",
                    SocketDirRefusal::NxManaged => "nx-managed",
                    SocketDirRefusal::OsTempRoot => "os-temp-root",
                }
                .to_string(),
            ),
            ..Default::default()
        }),
        // The one refusal path with nowhere left to fall, so it carries the
        // remedy: it is where the user most needs it and cannot reach the
        // warning's copy.
        Err(SocketDirError::NothingEstablishable { refusal }) => {
            let remedy = remedy_for(&refusal)
                .map(|r| format!(" {r}"))
                .unwrap_or_default();
            Err(napi::Error::from_reason(format!(
                "Nx could not establish a socket directory: {}.{remedy}",
                describe_refusal(&refusal)
            )))
        }
    }
}

/// The daemon's own socket. Per run — the directory name hashes the pid, and
/// clients read the daemon's path back out of the process cache rather than
/// deriving it.
#[napi]
pub fn resolve_daemon_socket_path(
    workspace_root: String,
    env: Option<HashMap<String, String>>,
) -> napi::Result<SocketDirDetails> {
    into_details(resolve_socket_path(
        SocketKind::Daemon,
        &workspace_root,
        env.as_ref(),
    ))
}

/// A forked task process's socket, in the daemon's per-run directory.
#[napi]
pub fn resolve_forked_process_socket_path(
    workspace_root: String,
    id: String,
    env: Option<HashMap<String, String>>,
) -> napi::Result<SocketDirDetails> {
    into_details(resolve_socket_path(
        SocketKind::ForkedProcess(id),
        &workspace_root,
        env.as_ref(),
    ))
}

/// Plugin worker sockets get their own workspace-scoped directory rather than
/// sitting in the shared system temp dir, which cannot be locked down.
#[napi]
pub fn resolve_plugin_socket_path(
    workspace_root: String,
    id: String,
    env: Option<HashMap<String, String>>,
) -> napi::Result<SocketDirDetails> {
    into_details(resolve_socket_path(
        SocketKind::Plugin(id),
        &workspace_root,
        env.as_ref(),
    ))
}

/// Where the Nx Console socket lives, for whoever binds or connects to it.
///
/// `env` is for callers that load a workspace `.env` into a copy rather than
/// into their own environment, and `workspaceRoot` for callers that do not run
/// inside the workspace — Nx Console is both, since it runs in the editor's
/// extension host.
#[napi]
pub fn resolve_nx_console_socket_path(
    workspace_root: String,
    env: Option<HashMap<String, String>>,
) -> napi::Result<SocketDirDetails> {
    into_details(resolve_socket_path(
        SocketKind::NxConsole,
        &workspace_root,
        env.as_ref(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn env_with(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        std::fs::write(temp.path().join("nx.json"), "{}").unwrap();
        temp
    }

    fn root_of(temp: &TempDir) -> String {
        temp.path().to_string_lossy().into_owned()
    }

    /// Vectors from `createHash('sha256')`, not from this implementation. Two
    /// things depend on the spelling and neither would fail loudly: every
    /// directory already on a user's disk, and Nx Console, which derives the
    /// console path itself until it adopts the resolver.
    #[test]
    fn leaf_names_hash_the_way_the_typescript_side_does() {
        assert_eq!(short_hash(&["/workspace/one"], 8), "a030d115");
        assert_eq!(short_hash(&["/workspace/one", "nx-console"], 8), "2111fad3");
        assert_eq!(
            short_hash(&["/workspace/one", "1234"], 20),
            "e26151583e05690e0e3e"
        );
    }

    #[test]
    fn leaf_names_are_case_insensitive_in_the_workspace_root() {
        let root = PathBuf::from("/tmp/sockets");
        assert_eq!(
            plugin_socket_dir_name(&root, "/Workspace/One"),
            plugin_socket_dir_name(&root, "/workspace/one")
        );
    }

    /// The console and plugin leaves hash the same root, so a collision would
    /// put an editor's socket in the plugin workers' directory.
    #[test]
    fn the_console_leaf_never_collides_with_the_plugin_leaf() {
        let root = PathBuf::from("/tmp/sockets");
        assert_ne!(
            nx_console_socket_dir_name(&root, "/workspace/one"),
            plugin_socket_dir_name(&root, "/workspace/one")
        );
    }

    /// Forked task processes deliberately share the daemon's per-run directory.
    #[test]
    fn every_kind_names_its_own_socket() {
        assert_eq!(SocketKind::Daemon.file_name(), "d.sock");
        assert_eq!(
            SocketKind::ForkedProcess("1-0-ab".into()).file_name(),
            "fp1-0-ab.sock"
        );
        assert_eq!(
            SocketKind::Plugin("123-0-12345678".into()).file_name(),
            "p123-0-12345678.sock"
        );
        assert_eq!(SocketKind::NxConsole.file_name(), "nx-console.sock");

        let root = PathBuf::from("/tmp/sockets");
        assert_eq!(
            SocketKind::ForkedProcess("1-0-ab".into()).dir_for(&root, "/workspace/one"),
            SocketKind::Daemon.dir_for(&root, "/workspace/one")
        );
    }

    /// The longest leaf, under the deepest default root, for the longest Windows
    /// account name we budget for. Pins the headroom the file names are chosen
    /// against; the check itself is on the whole path at resolution time.
    #[test]
    fn the_longest_plugin_socket_still_fits_the_budget() {
        let windows_temp = format!("C:\\Users\\{}\\AppData\\Local\\Temp", "u".repeat(18));
        let path = format!(
            "{windows_temp}\\{}\\{}",
            "f".repeat(8),
            SocketKind::Plugin("9999999999-z-ffffffff".into()).file_name()
        );

        assert_eq!(path.len(), 83);
        assert!(path.len() <= MAX_SOCKET_PATH);
    }

    #[test]
    fn a_path_over_the_budget_is_reported_rather_than_thrown() {
        let ws = workspace();
        let configured = std::env::temp_dir().join("nx-len").join("a".repeat(90));
        let env = env_with(&[("NX_SOCKET_DIR", &configured.to_string_lossy())]);

        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should resolve");

        assert!(resolved.too_long);
        // Still handed back: the caller decides which advice the length failure
        // should carry, and that turns on why the path is what it is.
        assert!(resolved.path.ends_with("d.sock"));
    }

    #[test]
    fn a_configured_socket_dir_is_used_and_locked_down() {
        let temp = TempDir::new().unwrap();
        let ws = workspace();
        let configured = temp.path().join("sockets");
        let env = env_with(&[("NX_SOCKET_DIR", &configured.to_string_lossy())]);

        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should resolve");

        assert_eq!(resolved.dir, configured);
        assert_eq!(resolved.outcome, SocketDirOutcome::Configured);
        assert!(configured.is_dir());
    }

    /// The resolver reads the environment it is handed, not `std::env`. Nx
    /// Console loads a workspace `.env` into a copy, so a resolver that only
    /// consulted the process environment would disagree with the extension
    /// exactly when the workspace configures a socket dir.
    #[test]
    fn an_empty_configured_value_counts_as_unset() {
        let ws = workspace();
        let env = env_with(&[("NX_SOCKET_DIR", "")]);

        assert!(configured_socket_dir(Some(&env)).is_none());
        // And the resolution does not land on the working directory.
        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should resolve");
        assert_ne!(resolved.dir, std::env::current_dir().unwrap());
    }

    #[test]
    fn the_os_temp_root_is_refused_as_the_socket_dir_itself() {
        let ws = workspace();
        let env = env_with(&[("NX_SOCKET_DIR", &system_tmp_dir().to_string_lossy())]);

        let error = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect_err("should refuse");

        assert!(matches!(
            error,
            SocketDirError::InvalidConfigured {
                reason: SocketDirRefusal::OsTempRoot | SocketDirRefusal::SharedWithOtherUsers,
                ..
            }
        ));
    }

    #[test]
    fn a_root_nx_manages_is_refused_as_the_socket_dir_itself() {
        let ws = workspace();
        let env = env_with(&[("NX_SOCKET_DIR", &nx_user_tmp_dir().to_string_lossy())]);

        let error = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect_err("should refuse");

        assert!(matches!(
            error,
            SocketDirError::InvalidConfigured {
                reason: SocketDirRefusal::NxManaged,
                ..
            }
        ));
    }

    /// A configured directory is never swapped out silently -- the substitute is
    /// longer and would resurface as a length complaint about a path the user
    /// never set.
    #[test]
    fn a_refused_configured_dir_falls_to_the_workspace_and_says_so() {
        let temp = TempDir::new().unwrap();
        let ws = workspace();
        let blocker = temp.path().join("not-a-dir");
        std::fs::write(&blocker, "").unwrap();
        let env = env_with(&[("NX_SOCKET_DIR", &blocker.to_string_lossy())]);

        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should fall back");

        assert_eq!(resolved.dir, ws.path().join(".nx/workspace-data/d"));
        assert!(
            matches!(resolved.outcome, SocketDirOutcome::ConfiguredRefused { configured, .. } if configured == blocker)
        );
    }

    #[test]
    fn the_workspace_fallback_honours_a_configured_workspace_data_directory() {
        let temp = TempDir::new().unwrap();
        let ws = workspace();
        let blocker = temp.path().join("not-a-dir");
        std::fs::write(&blocker, "").unwrap();
        let data_dir = temp.path().join("elsewhere");
        let env = env_with(&[
            ("NX_SOCKET_DIR", &blocker.to_string_lossy()),
            ("NX_WORKSPACE_DATA_DIRECTORY", &data_dir.to_string_lossy()),
        ]);

        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should fall back");

        assert_eq!(resolved.dir, data_dir.join("d"));
    }

    /// A Lerna repo that has not adopted `nx.json` is kept out of `.nx`, so the
    /// directory does not appear unasked.
    #[test]
    fn a_lerna_repo_without_nx_json_keeps_its_data_under_node_modules() {
        let temp = TempDir::new().unwrap();
        std::fs::write(temp.path().join("lerna.json"), "{}").unwrap();

        assert_eq!(
            workspace_data_directory(&temp.path().to_string_lossy(), None),
            temp.path().join("node_modules/.cache/nx-workspace-data")
        );
    }

    #[test]
    fn the_console_socket_is_named_and_resolves_per_workspace() {
        let one = workspace();
        let two = workspace();

        let first = resolve_socket_path(SocketKind::NxConsole, &root_of(&one), None)
            .expect("should resolve");
        let second = resolve_socket_path(SocketKind::NxConsole, &root_of(&two), None)
            .expect("should resolve");

        assert!(first.path.ends_with("nx-console.sock"));
        assert_ne!(first.path, second.path);
    }

    /// Nx Console binds at editor activation, when no Nx process exists to agree
    /// with, so the name cannot depend on one the way the daemon's does.
    #[test]
    fn the_console_socket_is_stable_across_calls() {
        let ws = workspace();

        let first = resolve_socket_path(SocketKind::NxConsole, &root_of(&ws), None)
            .expect("should resolve");
        let second = resolve_socket_path(SocketKind::NxConsole, &root_of(&ws), None)
            .expect("should resolve");

        assert_eq!(first.path, second.path);
    }

    #[test]
    fn the_legacy_console_path_is_the_derivation_released_extensions_listen_on() {
        let legacy = legacy_nx_console_socket_path("/workspace/one");

        assert_eq!(
            legacy,
            std::env::temp_dir()
                .join(crate::native::hasher::hash(b"/workspace/one,nx-console"))
                .join("nx-console.sock")
        );
    }

    /// A configured directory is the one socket path built from user input, so
    /// it is where a pre-planted symlink can be aimed. The trailing separator
    /// matters: without normalizing it away, an `lstat` reports the target
    /// rather than the link and `O_NOFOLLOW` opens the victim.
    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn a_socket_dir_pre_planted_as_a_symlink_is_never_adopted() {
        let temp = TempDir::new().unwrap();
        let ws = workspace();
        let victim = temp.path().join("victim");
        std::fs::create_dir(&victim).unwrap();
        crate::native::utils::owned_dir::chmod_real_directory_for_testing(&victim, 0o755);
        let squatted = temp.path().join("squatted");
        std::os::unix::fs::symlink(&victim, &squatted).unwrap();
        let env = env_with(&[("NX_SOCKET_DIR", &format!("{}/", squatted.display()))]);

        let resolved = resolve_socket_path(SocketKind::Daemon, &root_of(&ws), Some(&env))
            .expect("should fall back");

        assert_ne!(resolved.dir, squatted);
        assert_ne!(resolved.dir, victim);
        use std::os::unix::fs::MetadataExt;
        assert_eq!(
            std::fs::symlink_metadata(&victim).unwrap().mode() & 0o777,
            0o755
        );
    }

    #[test]
    fn remedies_are_deduplicated_in_the_order_they_were_collected() {
        let resolution = SocketDirResolution {
            dir: PathBuf::from("/tmp/x"),
            path: PathBuf::from("/tmp/x/d.sock"),
            too_long: false,
            outcome: SocketDirOutcome::Preferred,
            refusals: vec![
                DirRefusal::NotTightenable {
                    dir: PathBuf::from("/tmp/.nx"),
                    mode: 0o40755,
                },
                DirRefusal::NotTightenable {
                    dir: PathBuf::from("/tmp/.nx"),
                    mode: 0o40755,
                },
                DirRefusal::ForeignOwner {
                    dir: PathBuf::from("/tmp/.nx/501"),
                    uid: 0,
                },
            ],
        };

        let remedies = resolution.remedies();

        assert_eq!(remedies.len(), 2);
        assert!(remedies[0].contains("chmod 0700"));
    }
}
