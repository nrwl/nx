//! Directory guards for Nx's runtime state: create a directory only when it is
//! ours and unreachable by other users on this machine, and say why when it is
//! not.
//!
//! `src/utils/owned-private-dir.ts` implements the same rules and must change
//! with this file. That copy is not redundant — the native binding loader has
//! to place and lock down the `.node` before anything here can be called, so it
//! is the one caller that cannot reach this module. The parity is in the rules,
//! not the surface: that copy also carries the guards only the loader needs.

use std::ffi::OsString;
use std::io;
use std::path::{Component, Path, PathBuf};

/// Sticky. Restricts rename and unlink in a writable directory to the owner of
/// each entry — plus the directory's own owner, which is why the ownership
/// check below is not redundant with this one.
const S_ISVTX: u32 = 0o1000;

/// Group and other bits. Read and search alone reach a socket inside a
/// directory, so `0755` is re-locked rather than accepted.
const PEER_BITS: u32 = 0o077;

const PEER_WRITE_BITS: u32 = 0o022;

/// Why a guard refused a directory. Data, not a sentence: `remedy_for` decides
/// on it.
///
/// `ForeignOwner` and `ForeignSharedContainer` are separate variants rather
/// than one carrying a flag, because which advice is correct turns on which was
/// refused: root can take over the shared container, and cannot help with a
/// per-user directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DirRefusal {
    NotCreated { dir: PathBuf, code: Option<String> },
    NotInspectable { dir: PathBuf, code: Option<String> },
    NotADirectory { dir: PathBuf, symlink: bool },
    ForeignOwner { dir: PathBuf, uid: u32 },
    ForeignSharedContainer { dir: PathBuf, uid: u32 },
    NotTightenable { dir: PathBuf, mode: u32 },
    PeerWritableNotSticky { dir: PathBuf, mode: u32 },
}

pub type GuardResult<T> = Result<T, DirRefusal>;

/// Four octal digits, so a sticky container reads `1777` and a plain directory
/// `0755` — the notation `chmod` and `ls` use.
fn as_mode(mode: u32) -> String {
    format!("{:04o}", mode & 0o7777)
}

/// The user-facing sentence for a refusal. The only place wording is decided.
pub fn describe_refusal(refusal: &DirRefusal) -> String {
    match refusal {
        DirRefusal::NotCreated { dir, code } => {
            format!(
                "{} could not be created{}",
                dir.display(),
                parenthesized(code)
            )
        }
        DirRefusal::NotInspectable { dir, code } => {
            format!(
                "{} could not be inspected{}",
                dir.display(),
                parenthesized(code)
            )
        }
        DirRefusal::NotADirectory { dir, symlink: true } => format!(
            "{} is a symlink, not a real directory — something replaced the path Nx expected to create",
            dir.display()
        ),
        DirRefusal::NotADirectory {
            dir,
            symlink: false,
        } => {
            format!("{} exists and is not a directory", dir.display())
        }
        DirRefusal::ForeignOwner { dir, uid } => {
            format!("{} is owned by uid {}, not by you", dir.display(), uid)
        }
        DirRefusal::ForeignSharedContainer { dir, uid } => format!(
            "{} belongs to another user (uid {}) rather than to you or to root",
            dir.display(),
            uid
        ),
        DirRefusal::NotTightenable { dir, mode } => format!(
            "{} is reachable by other users (mode {}) and could not be tightened to 0700",
            dir.display(),
            as_mode(*mode)
        ),
        DirRefusal::PeerWritableNotSticky { dir, mode } => format!(
            "{} is writable by other users but not sticky (mode {}), so a peer could replace directories inside it",
            dir.display(),
            as_mode(*mode)
        ),
    }
}

fn parenthesized(code: &Option<String>) -> String {
    code.as_ref().map(|c| format!(" ({c})")).unwrap_or_default()
}

/// Single-quoted for a shell, so a path with a space or quote survives a paste.
fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.display().to_string().replace('\'', r"'\''"))
}

/// What the user can do about a refusal, or `None` when there is nothing.
pub fn remedy_for(refusal: &DirRefusal) -> Option<String> {
    match refusal {
        DirRefusal::NotADirectory { dir, symlink: true } => Some(format!(
            "{} is a symlink where Nx expects a directory. If you did not create it, treat it as hostile: remove the link itself (not what it points at) and run the command again.",
            dir.display()
        )),
        DirRefusal::ForeignOwner { dir, .. } => Some(format!(
            "{} belongs to another user on this machine, so Nx cannot keep its own directory there. Set NX_SOCKET_DIR to a short directory your user owns, or move it aside — which you can do yourself if you own the directory it sits in, and otherwise needs an administrator.",
            dir.display()
        )),
        // Both producers reach here having already established that the
        // directory is ours, so `chmod` is the user's to run. Names no cause:
        // one producer is a mount that discards the mode, the other is any
        // `chmod` failure.
        DirRefusal::NotTightenable { dir, mode } => Some(format!(
            "{} is reachable by other users (mode {}) and Nx could not restrict it. Run `chmod 0700 {}` and try again; if the mode does not stick, set NX_SOCKET_DIR to a short directory on a filesystem that keeps POSIX permissions.",
            dir.display(),
            as_mode(*mode),
            shell_quote(dir)
        )),
        // Unreachable while `is_safe_shared_root` denies with this variant only
        // for a non-root owner, kept so a future producer cannot ship it
        // unadvised.
        DirRefusal::ForeignSharedContainer { dir, uid } if *uid != 0 => {
            let quoted = shell_quote(dir);
            Some(format!(
                "{} belongs to another user on this machine, so Nx cannot keep a private directory beneath it. Ask an administrator to hand it to root with `sudo chown root {quoted} && sudo chmod 1777 {quoted}`; every user can then keep their own directory under it.",
                dir.display()
            ))
        }
        DirRefusal::ForeignSharedContainer { .. }
        | DirRefusal::NotADirectory { symlink: false, .. }
        | DirRefusal::NotCreated { .. }
        | DirRefusal::NotInspectable { .. }
        | DirRefusal::PeerWritableNotSticky { .. } => None,
    }
}

/// Absolute and lexically normalized, without touching the filesystem.
///
/// `..` is resolved here rather than left for `canonicalize`: this is the one
/// path built from user input (`NX_SOCKET_DIR`), and a trailing separator would
/// otherwise defeat the `O_NOFOLLOW` guard downstream — an `lstat` on a path
/// ending in `/` reports the symlink's target rather than the symlink.
pub fn resolve_path(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };

    let mut out = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                // Popping past the root leaves the root, which is what a
                // filesystem does with `/..`.
                if !matches!(
                    out.components().next_back(),
                    Some(Component::RootDir) | None
                ) {
                    out.pop();
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// The spelling to compare a directory by. `resolve_path` does not dereference
/// symlinks, and on macOS `/tmp` is a symlink to `/private/tmp`, so an
/// exact-match list would wave through an alias of a root it means to refuse.
///
/// Resolves the longest ancestor that exists and re-appends the rest: Nx's own
/// roots are absent before its first run, and canonicalizing whole paths only
/// would degrade this to a string match on exactly a fresh machine.
///
/// Only `NotFound` walks up — any other error means the path exists and cannot
/// be read through, which `ensure_owned_private_dir` cannot establish either.
///
/// `dunce`, not std, as in `worktree.rs`: std returns a `\\?\` verbatim path on
/// Windows, and the error arms here return the path uncanonicalized, so the two
/// spellings would never compare equal and a refusal would be missed.
pub fn canonical_dir(dir: &Path) -> PathBuf {
    let resolved = resolve_path(dir);
    let mut missing: Vec<OsString> = Vec::new();
    let mut candidate = resolved.clone();

    loop {
        match dunce::canonicalize(&candidate) {
            Ok(real) => {
                let mut out = real;
                out.extend(missing.iter().rev());
                return out;
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                let (Some(parent), Some(name)) = (candidate.parent(), candidate.file_name()) else {
                    return resolved;
                };
                if parent == candidate {
                    return resolved;
                }
                missing.push(name.to_os_string());
                candidate = parent.to_path_buf();
            }
            Err(_) => return resolved,
        }
    }
}

#[cfg(all(not(windows), not(target_family = "wasm")))]
mod imp {
    use super::*;
    use nix::errno::Errno;
    use nix::libc;
    use nix::sys::stat::{Mode, fchmod};
    use std::fs::{DirBuilder, Metadata, OpenOptions};
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt};

    pub(super) fn error_code(e: &io::Error) -> Option<String> {
        e.raw_os_error()
            .map(|raw| format!("{:?}", Errno::from_raw(raw)))
    }

    pub(super) fn current_uid() -> u32 {
        nix::unistd::getuid().as_raw()
    }

    /// The path segment separating one user's Nx runtime state from another's.
    pub fn user_segment() -> String {
        current_uid().to_string()
    }

    /// chmod a path only if it is a real directory, never following a symlink at
    /// its final component — a plain `chmod` follows them, retargeting the mode
    /// change. The directory check is on the descriptor, not the errno: a
    /// deny-list fails *open* on codes it does not know. `O_NONBLOCK` stops a
    /// planted FIFO blocking the open.
    pub(super) fn chmod_real_directory(path: &Path, mode: u32) -> bool {
        let Ok(file) = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
            .open(path)
        else {
            return false;
        };
        match file.metadata() {
            Ok(metadata) if metadata.is_dir() => {}
            _ => return false,
        }
        fchmod(&file, Mode::from_bits_truncate(mode as libc::mode_t)).is_ok()
    }

    pub(super) fn mkdir(dir: &Path, mode: u32, recursive: bool) -> io::Result<()> {
        DirBuilder::new()
            .recursive(recursive)
            .mode(mode)
            .create(dir)
    }

    pub(super) fn uid_of(metadata: &Metadata) -> u32 {
        metadata.uid()
    }

    pub(super) fn mode_of(metadata: &Metadata) -> u32 {
        metadata.mode()
    }

    /// Whether this platform can tell one user's directories from another's.
    pub(super) const HAS_OWNERSHIP: bool = true;
}

#[cfg(any(windows, target_family = "wasm"))]
mod imp {
    use super::*;
    use std::fs::{DirBuilder, Metadata};

    pub(super) fn error_code(e: &io::Error) -> Option<String> {
        Some(format!("{:?}", e.kind()))
    }

    pub(super) fn current_uid() -> u32 {
        0
    }

    /// No uid to key on, and the roots used here are already per-account, so
    /// the segment would only cost path length. Kept for callers that build a
    /// path unconditionally.
    pub fn user_segment() -> String {
        std::env::var("USERNAME")
            .or_else(|_| std::env::var("USER"))
            .unwrap_or_else(|_| "unknown".to_string())
    }

    pub(super) fn chmod_real_directory(_path: &Path, _mode: u32) -> bool {
        true
    }

    pub(super) fn mkdir(dir: &Path, _mode: u32, recursive: bool) -> io::Result<()> {
        DirBuilder::new().recursive(recursive).create(dir)
    }

    pub(super) fn uid_of(_metadata: &Metadata) -> u32 {
        0
    }

    pub(super) fn mode_of(_metadata: &Metadata) -> u32 {
        0
    }

    pub(super) const HAS_OWNERSHIP: bool = false;
}

pub use imp::user_segment;
use imp::{HAS_OWNERSHIP, chmod_real_directory, current_uid, error_code, mkdir, mode_of, uid_of};

/// A filesystem error that stopped a directory being created, as a refusal.
pub fn not_created(dir: &Path, e: &io::Error) -> DirRefusal {
    DirRefusal::NotCreated {
        dir: dir.to_path_buf(),
        code: error_code(e),
    }
}

/// Test seam for staging a directory at a mode this module would refuse.
#[cfg(test)]
pub fn chmod_real_directory_for_testing(path: &Path, mode: u32) -> bool {
    chmod_real_directory(path, mode)
}

fn not_a_directory(dir: &Path, metadata: &std::fs::Metadata) -> DirRefusal {
    DirRefusal::NotADirectory {
        dir: dir.to_path_buf(),
        symlink: metadata.file_type().is_symlink(),
    }
}

/// Whether a shared container is safe to keep an owner-only directory under.
///
/// On POSIX, a container writable by other users must be sticky, and it must be
/// owned by either root or the current user. Elsewhere this short-circuits after
/// the directory test — the roots there are already scoped to one account, so
/// there is no shared level whose ownership could matter.
///
/// Sticky directories still let the directory's own owner rename entries, so a
/// container owned by another unprivileged user could replace a previously
/// verified private directory beneath it.
fn is_safe_shared_root(dir: &Path) -> GuardResult<()> {
    let metadata = std::fs::symlink_metadata(dir).map_err(|e| DirRefusal::NotInspectable {
        dir: dir.to_path_buf(),
        code: error_code(&e),
    })?;
    if !metadata.is_dir() {
        return Err(not_a_directory(dir, &metadata));
    }
    if !HAS_OWNERSHIP {
        return Ok(());
    }

    let uid = uid_of(&metadata);
    if uid != current_uid() && uid != 0 {
        return Err(DirRefusal::ForeignSharedContainer {
            dir: dir.to_path_buf(),
            uid,
        });
    }

    let mode = mode_of(&metadata);
    if mode & PEER_WRITE_BITS == 0 || mode & S_ISVTX != 0 {
        Ok(())
    } else {
        Err(DirRefusal::PeerWritableNotSticky {
            dir: dir.to_path_buf(),
            mode,
        })
    }
}

/// Whether other users on this machine can write into `dir`. Gates whether a
/// refusal message may cite other users, so it must not over-report: `false`
/// wherever ownership is unknowable, and `false` on a path that cannot be
/// inspected.
///
/// Follows symlinks, unlike the guards: the question is about the directory
/// that will be used, not the link pointing at it. Nothing here decides whether
/// a path is accepted.
pub fn is_peer_writable(dir: &Path) -> bool {
    if !HAS_OWNERSHIP {
        return false;
    }
    std::fs::metadata(dir)
        .map(|m| mode_of(&m) & PEER_WRITE_BITS != 0)
        .unwrap_or(false)
}

/// Create a shared container as sticky + world-writable if it does not exist,
/// and report whether the resulting path is safe for the current user.
///
/// **A container that already exists is never modified — only judged.** Do not
/// chmod before deciding trust: `CAP_FOWNER` (root's default in Docker and most
/// CI images) can chmod a directory it does not own, so a peer-owned root would
/// be widened to `1777` and then refused, and an operator who deliberately
/// tightened this root would have it re-widened on every `nx` process.
pub fn ensure_safe_shared_root(dir: &Path) -> GuardResult<()> {
    match mkdir(dir, 0o1777, !HAS_OWNERSHIP) {
        // Ours, created a statement ago. Load-bearing on macOS: XNU strips
        // S_ISVTX at mkdir, so the sticky bit exists solely because of this.
        Ok(()) => {
            chmod_real_directory(dir, 0o1777);
        }
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {}
        Err(e) => {
            return Err(DirRefusal::NotCreated {
                dir: dir.to_path_buf(),
                code: error_code(&e),
            });
        }
    }

    // One verdict for both branches: the chmod above can fail and leave a
    // peer-writable non-sticky container, which trusting the creation would
    // brand safe.
    is_safe_shared_root(dir)
}

/// Ensure `dir` exists, is a real directory owned by us, and carries no group
/// or other bits at all. A refusal carries which check said no — usually
/// `ForeignOwner` for a directory another user planted, but also `NotCreated` /
/// `NotInspectable` for a filesystem error, `NotADirectory`, or
/// `NotTightenable` when the re-lock did not land.
pub fn ensure_owned_private_dir(dir: &Path) -> GuardResult<()> {
    match mkdir(dir, 0o700, false) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {}
        Err(e) => {
            return Err(DirRefusal::NotCreated {
                dir: dir.to_path_buf(),
                code: error_code(&e),
            });
        }
    }

    // One verdict for both branches, as in `ensure_safe_shared_root`: mounts
    // that ignore the mode argument can land a directory Nx asked for at 0700
    // on 0777, so the creation path is judged like any other.
    let metadata = std::fs::symlink_metadata(dir).map_err(|e| DirRefusal::NotInspectable {
        dir: dir.to_path_buf(),
        code: error_code(&e),
    })?;
    // Before the ownership short-circuit: "is a real directory" holds on every
    // platform.
    if !metadata.is_dir() {
        return Err(not_a_directory(dir, &metadata));
    }
    if !HAS_OWNERSHIP {
        return Ok(());
    }

    let uid = uid_of(&metadata);
    if uid != current_uid() {
        return Err(DirRefusal::ForeignOwner {
            dir: dir.to_path_buf(),
            uid,
        });
    }

    let mode = mode_of(&metadata);
    if mode & PEER_BITS != 0 {
        if !chmod_real_directory(dir, 0o700) {
            return Err(DirRefusal::NotTightenable {
                dir: dir.to_path_buf(),
                mode,
            });
        }
        // Read the mode back rather than trusting the chmod's return: mounts
        // that ignore modes report success and change nothing.
        let after = std::fs::symlink_metadata(dir).map_err(|e| DirRefusal::NotInspectable {
            dir: dir.to_path_buf(),
            code: error_code(&e),
        })?;
        let after_mode = mode_of(&after);
        if after_mode & PEER_BITS != 0 {
            return Err(DirRefusal::NotTightenable {
                dir: dir.to_path_buf(),
                mode: after_mode,
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[cfg(all(not(windows), not(target_family = "wasm")))]
    fn mode_bits(dir: &Path) -> u32 {
        use std::os::unix::fs::MetadataExt;
        std::fs::symlink_metadata(dir).unwrap().mode() & 0o7777
    }

    #[test]
    fn resolve_path_normalizes_dot_segments() {
        let resolved = resolve_path(Path::new("/tmp/a/./b/../c"));
        assert_eq!(resolved, PathBuf::from("/tmp/a/c"));
    }

    #[test]
    fn resolve_path_strips_a_trailing_separator() {
        assert_eq!(resolve_path(Path::new("/tmp/a/")), PathBuf::from("/tmp/a"));
    }

    #[test]
    fn resolve_path_cannot_escape_the_root() {
        assert_eq!(resolve_path(Path::new("/../../..")), PathBuf::from("/"));
    }

    #[test]
    fn canonical_dir_re_appends_components_that_do_not_exist_yet() {
        let temp = TempDir::new().unwrap();
        let missing = temp.path().join("not-yet").join("either");

        let canonical = canonical_dir(&missing);

        assert!(canonical.ends_with("not-yet/either"));
        assert!(canonical.starts_with(std::fs::canonicalize(temp.path()).unwrap()));
    }

    #[test]
    fn ensure_owned_private_dir_creates_the_directory() {
        let temp = TempDir::new().unwrap();
        let dir = temp.path().join("private");

        ensure_owned_private_dir(&dir).expect("should establish");

        assert!(dir.is_dir());
    }

    #[test]
    fn ensure_owned_private_dir_refuses_a_file() {
        let temp = TempDir::new().unwrap();
        let file = temp.path().join("a-file");
        std::fs::write(&file, "").unwrap();

        let refusal = ensure_owned_private_dir(&file).expect_err("should refuse");

        assert!(matches!(
            refusal,
            DirRefusal::NotADirectory { symlink: false, .. }
        ));
    }

    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_owned_private_dir_locks_the_directory_to_the_owner() {
        let temp = TempDir::new().unwrap();
        let dir = temp.path().join("private");

        ensure_owned_private_dir(&dir).expect("should establish");

        assert_eq!(mode_bits(&dir), 0o700);
    }

    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_owned_private_dir_re_locks_a_directory_left_readable() {
        let temp = TempDir::new().unwrap();
        let dir = temp.path().join("loose");
        std::fs::create_dir(&dir).unwrap();
        chmod_real_directory(&dir, 0o755);
        assert_eq!(mode_bits(&dir), 0o755);

        ensure_owned_private_dir(&dir).expect("should establish");

        assert_eq!(mode_bits(&dir), 0o700);
    }

    /// A symlink is refused rather than adopted: `mkdir` does not fail on a
    /// pre-planted one, so creating and locking down in one step would chmod
    /// whatever it points at.
    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_owned_private_dir_refuses_a_symlink_to_a_real_directory() {
        let temp = TempDir::new().unwrap();
        let target = temp.path().join("target");
        std::fs::create_dir(&target).unwrap();
        let link = temp.path().join("link");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        let refusal = ensure_owned_private_dir(&link).expect_err("should refuse");

        assert!(matches!(
            refusal,
            DirRefusal::NotADirectory { symlink: true, .. }
        ));
    }

    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_safe_shared_root_creates_a_sticky_container() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("shared");

        ensure_safe_shared_root(&root).expect("should establish");

        assert_eq!(mode_bits(&root), 0o1777);
    }

    /// The container is judged, never repaired: a root an operator deliberately
    /// tightened must survive an `nx` process rather than be re-widened.
    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_safe_shared_root_leaves_an_existing_container_alone() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("shared");
        std::fs::create_dir(&root).unwrap();
        chmod_real_directory(&root, 0o700);

        ensure_safe_shared_root(&root).expect("should accept a tightened container");

        assert_eq!(mode_bits(&root), 0o700);
    }

    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn ensure_safe_shared_root_refuses_a_peer_writable_container_without_the_sticky_bit() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("shared");
        std::fs::create_dir(&root).unwrap();
        chmod_real_directory(&root, 0o777);

        let refusal = ensure_safe_shared_root(&root).expect_err("should refuse");

        assert!(matches!(refusal, DirRefusal::PeerWritableNotSticky { .. }));
    }

    #[test]
    fn describe_refusal_reports_the_mode_the_way_chmod_writes_it() {
        let refusal = DirRefusal::PeerWritableNotSticky {
            dir: PathBuf::from("/tmp/shared"),
            mode: 0o40777,
        };

        assert!(describe_refusal(&refusal).contains("mode 0777"));
    }

    /// The uid-0 exemption belongs to the shared container: root owning it is
    /// the provisioned state, not a problem to report.
    #[test]
    fn remedy_for_says_nothing_about_a_container_root_already_owns() {
        assert!(
            remedy_for(&DirRefusal::ForeignSharedContainer {
                dir: PathBuf::from("/tmp/.nx"),
                uid: 0,
            })
            .is_none()
        );
    }

    #[test]
    fn remedy_for_offers_the_chown_only_for_the_shared_container() {
        let remedy = remedy_for(&DirRefusal::ForeignSharedContainer {
            dir: PathBuf::from("/tmp/.nx"),
            uid: 1002,
        })
        .expect("should advise");

        assert!(remedy.contains("sudo chown root '/tmp/.nx' && sudo chmod 1777 '/tmp/.nx'"));
    }

    /// Handing a per-user directory to root cannot help: unlike the shared
    /// container, `ensure_owned_private_dir` has no uid-0 exemption.
    #[test]
    fn remedy_for_never_offers_the_chown_for_a_per_user_directory() {
        let remedy = remedy_for(&DirRefusal::ForeignOwner {
            dir: PathBuf::from("/tmp/.nx/501/sockets"),
            uid: 1002,
        })
        .expect("should advise");

        assert!(!remedy.contains("chown"));
        assert!(!remedy.contains("1777"));
        // The refusal carries no mode -- the ownership check precedes the mode
        // check -- so `rm` is not advice this arm can give.
        assert!(!remedy.to_lowercase().contains("remove it"));
        // Positive too: the negatives alone survive replacing the whole sentence
        // with one that drops both the path and the escape hatch, which is the
        // only lever this user reliably has.
        assert!(remedy.contains("/tmp/.nx/501/sockets"));
        assert!(remedy.contains("NX_SOCKET_DIR"));
        // Both halves: who can clear the directory depends on who owns its
        // parent, and dropping either half survives every other assertion here.
        assert!(remedy.contains("yourself"));
        assert!(remedy.contains("administrator"));
    }

    /// Reachable after one `sudo nx` that kept your HOME, or in a
    /// root-provisioned image run as a non-root user.
    #[test]
    fn remedy_for_still_advises_a_per_user_directory_root_owns() {
        assert!(
            remedy_for(&DirRefusal::ForeignOwner {
                dir: PathBuf::from("/home/me/.nx"),
                uid: 0,
            })
            .is_some_and(|r| r.contains("NX_SOCKET_DIR"))
        );
    }

    #[test]
    fn remedy_for_offers_the_chmod_the_owner_can_actually_run() {
        let remedy = remedy_for(&DirRefusal::NotTightenable {
            dir: PathBuf::from("/tmp/.nx/501/sockets"),
            mode: 0o40777,
        })
        .expect("should advise");

        // The action, not just the path: ownership is established before this
        // variant can be produced, so `chmod` is the user's to run -- and the
        // relocation is the fallback for when the mode does not stick.
        assert!(remedy.contains("chmod 0700 '/tmp/.nx/501/sockets'"));
        assert!(remedy.contains("0777"));
        assert!(remedy.contains("NX_SOCKET_DIR"));
        // Never the shared-container advice: it names an owner who cannot help.
        assert!(!remedy.contains("chown"));
        assert!(!remedy.contains("1777"));
        assert!(!remedy.contains("belongs to another user"));
    }

    #[test]
    fn remedy_for_treats_a_planted_symlink_as_hostile() {
        assert!(
            remedy_for(&DirRefusal::NotADirectory {
                dir: PathBuf::from("/tmp/.nx/501/sockets"),
                symlink: true,
            })
            .is_some_and(|r| r.contains("remove the link"))
        );
    }

    #[test]
    fn remedy_for_quotes_a_path_so_it_survives_a_paste() {
        assert!(
            remedy_for(&DirRefusal::ForeignSharedContainer {
                dir: PathBuf::from("/home/some user/.nx"),
                uid: 1002,
            })
            .is_some_and(|r| r.contains("sudo chown root '/home/some user/.nx'"))
        );

        assert!(
            remedy_for(&DirRefusal::ForeignSharedContainer {
                dir: PathBuf::from("/home/o'brien/.nx"),
                uid: 1002,
            })
            .is_some_and(|r| r.contains(r"sudo chown root '/home/o'\''brien/.nx'"))
        );
    }

    #[test]
    fn remedy_for_says_nothing_about_a_directory_that_is_simply_absent() {
        assert!(
            remedy_for(&DirRefusal::NotInspectable {
                dir: PathBuf::from("/tmp/.nx"),
                code: Some("ENOENT".to_string()),
            })
            .is_none()
        );
        assert!(
            remedy_for(&DirRefusal::NotCreated {
                dir: PathBuf::from("/tmp/.nx"),
                code: Some("EACCES".to_string()),
            })
            .is_none()
        );
    }

    /// The alarming refusal message is gated on this, so it has to answer about
    /// the directory rather than the platform: the OS temp dir is a
    /// world-writable `/tmp` on Linux but a private `0700 /var/folders/...` on
    /// macOS.
    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn is_peer_writable_answers_from_the_mode() {
        let temp = TempDir::new().unwrap();

        for (mode, expected) in [
            (0o1777, true),
            (0o777, true),
            (0o770, true),
            (0o702, true),
            (0o700, false),
            (0o755, false),
            (0o750, false),
        ] {
            let dir = temp.path().join(format!("mode-{mode:o}"));
            std::fs::create_dir(&dir).unwrap();
            chmod_real_directory(&dir, mode);

            assert_eq!(is_peer_writable(&dir), expected, "mode {mode:o}");
        }
    }

    /// This gates the claim that another local user can execute code, so a path
    /// that cannot be inspected must not be reported as shared.
    #[test]
    fn is_peer_writable_does_not_guess_about_a_path_it_cannot_inspect() {
        let temp = TempDir::new().unwrap();

        assert!(!is_peer_writable(&temp.path().join("missing")));
    }

    /// Linux creates symlinks `0777`, so an `lstat` would report a private
    /// target as peer-writable. The inverse holds on macOS, where the link takes
    /// the umask and a `0755` link hides a world-writable target.
    #[cfg(all(not(windows), not(target_family = "wasm")))]
    #[test]
    fn is_peer_writable_answers_for_the_directory_a_link_points_at() {
        let temp = TempDir::new().unwrap();
        let target = temp.path().join("target");
        std::fs::create_dir(&target).unwrap();
        chmod_real_directory(&target, 0o700);
        let link = temp.path().join("link");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        assert!(!is_peer_writable(&link));
    }
}
