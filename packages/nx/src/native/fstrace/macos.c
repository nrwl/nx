// Injected through DYLD_INSERT_LIBRARIES. Records successful read-opens to $FSTRACE_OUT.
// Binaries dyld would strip the variable from are started as ad-hoc re-signed copies kept
// in $FSTRACE_SIP_DIR, so tracing continues below them.
//
// This is C, not Rust, for two reasons. The copies of Apple's binaries are arm64e, and
// dyld will not load an arm64 library into them, but Rust's arm64e-apple-darwin target is
// tier 3 and builds only on nightly with -Zbuild-std. Hooking open and openat also means
// defining C-variadic functions, which stable Rust cannot do.

#include <errno.h>
#include <fcntl.h>
#include <libkern/OSByteOrder.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <mach-o/fat.h>
#include <mach-o/loader.h>
#include <pthread.h>
#include <spawn.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

#define CS_RESTRICT 0x800
#define CS_REQUIRE_LV 0x2000
#define CS_RUNTIME 0x10000
#define CSMAGIC_EMBEDDED_SIGNATURE 0xfade0cc0
#define CSMAGIC_CODEDIRECTORY 0xfade0c02
#define CSMAGIC_EMBEDDED_ENTITLEMENTS 0xfade7171
#define DYLD_ENTITLEMENT "com.apple.security.cs.allow-dyld-environment-variables"
#define DLV_ENTITLEMENT "com.apple.security.cs.disable-library-validation"

static const char *const CARRIED_VARS[] = {"DYLD_INSERT_LIBRARIES", "FSTRACE_OUT", "FSTRACE_SIP_DIR"};
#define NCARRIED (sizeof CARRIED_VARS / sizeof CARRIED_VARS[0])

static char *g_carried[NCARRIED];
static int g_log = -1;
static const char *g_sip_dir;

// ---------------------------------------------------------------------------------------
// Event log

static void write_line(const char *prefix, const char *path) {
  if (g_log < 0 || !path) return;
  char buf[PATH_MAX * 2 + 32];
  int n = snprintf(buf, sizeof buf, "%s%s\n", prefix, path);
  if (n > 0) write(g_log, buf, (size_t)n < sizeof buf ? (size_t)n : sizeof buf - 1);
}

static void record(int dirfd, const char *path) {
  if (g_log < 0 || !path) return;
  int saved = errno;
  if (path[0] == '/') {
    write_line("", path);
  } else {
    char dir[PATH_MAX], full[PATH_MAX * 2 + 2];
    int ok = dirfd == AT_FDCWD ? getcwd(dir, sizeof dir) != NULL : fcntl(dirfd, F_GETPATH, dir) == 0;
    if (ok) {
      snprintf(full, sizeof full, "%s/%s", dir, path);
      write_line("", full);
    }
  }
  errno = saved;
}

// Marks an exec whose subtree is not traced, so a consumer can distrust the read list.
static void record_untraced(const char *path) {
  int saved = errno;
  write_line("!untraced ", path);
  errno = saved;
}

static int reads(int flags) { return (flags & O_ACCMODE) != O_WRONLY && !(flags & O_DIRECTORY); }

// ---------------------------------------------------------------------------------------
// Code signature: is this a binary dyld strips DYLD_* variables for?

static int read_at(int fd, void *buf, size_t n, off_t off) { return pread(fd, buf, n, off) == (ssize_t)n; }

static cpu_type_t native_cpu(void) {
#if defined(__arm64__)
  return CPU_TYPE_ARM64;
#else
  return CPU_TYPE_X86_64;
#endif
}

// Offset of the slice the kernel would run on this machine, or -1.
static off_t slice_offset(int fd) {
  uint32_t magic;
  if (!read_at(fd, &magic, 4, 0)) return -1;
  if (magic == MH_MAGIC_64) return 0;
  if (magic != FAT_CIGAM && magic != FAT_CIGAM_64) return -1;
  uint32_t count;
  if (!read_at(fd, &count, 4, 4)) return -1;
  count = OSSwapBigToHostInt32(count);
  for (uint32_t i = 0; i < count && i < 16; i++) {
    if (magic == FAT_CIGAM) {
      struct fat_arch a;
      if (!read_at(fd, &a, sizeof a, 8 + i * sizeof a)) return -1;
      if ((cpu_type_t)OSSwapBigToHostInt32(a.cputype) == native_cpu()) return OSSwapBigToHostInt32(a.offset);
    } else {
      struct fat_arch_64 a;
      if (!read_at(fd, &a, sizeof a, 8 + i * sizeof a)) return -1;
      if ((cpu_type_t)OSSwapBigToHostInt32(a.cputype) == native_cpu()) return (off_t)OSSwapBigToHostInt64(a.offset);
    }
  }
  return -1;
}

static int has_bytes(const uint8_t *hay, size_t n, const char *needle) {
  size_t m = strlen(needle);
  for (size_t i = 0; i + m <= n; i++)
    if (memcmp(hay + i, needle, m) == 0) return 1;
  return 0;
}

// 1 when this shim cannot load into `path`. dyld strips DYLD_* for setuid/setgid, Apple
// platform and CS_RESTRICT binaries, and for the hardened runtime without the
// dyld-environment entitlement. The hardened runtime also enforces library validation
// unless disabled, and an inserted library it rejects kills the process at launch.
// Only the signature's index, CodeDirectory header and entitlements are read.
static int is_restricted(const char *path) {
  struct stat st;
  if (stat(path, &st) != 0) return 0;
  if (st.st_mode & (S_ISUID | S_ISGID)) return 1;
  int fd = open(path, O_RDONLY | O_CLOEXEC);
  if (fd < 0) return 0;
  int restricted = 0;
  uint8_t *cmds = NULL, *ents = NULL;
  off_t base = slice_offset(fd);
  struct mach_header_64 mh;
  if (base < 0 || !read_at(fd, &mh, sizeof mh, base) || mh.magic != MH_MAGIC_64) goto done;

  cmds = malloc(mh.sizeofcmds);
  if (!cmds || !read_at(fd, cmds, mh.sizeofcmds, base + sizeof mh)) goto done;
  struct linkedit_data_command sig = {0};
  for (uint32_t i = 0, off = 0; i < mh.ncmds && off + sizeof(struct load_command) <= mh.sizeofcmds; i++) {
    struct load_command *lc = (struct load_command *)(cmds + off);
    if (lc->cmd == LC_CODE_SIGNATURE) sig = *(struct linkedit_data_command *)lc;
    off += lc->cmdsize;
  }
  if (!sig.datasize) goto done;

  off_t sb = base + sig.dataoff;
  uint8_t head[12];
  if (!read_at(fd, head, sizeof head, sb) || OSReadBigInt32(head, 0) != CSMAGIC_EMBEDDED_SIGNATURE) goto done;
  uint32_t count = OSReadBigInt32(head, 8), flags = 0;
  int platform = 0, dyld_entitled = 0, lv_disabled = 0;
  for (uint32_t i = 0; i < count && i < 32; i++) {
    uint8_t idx[8], blob[40];
    if (!read_at(fd, idx, sizeof idx, sb + 12 + i * 8)) goto done;
    uint32_t off = OSReadBigInt32(idx, 4);
    if (off >= sig.datasize || !read_at(fd, blob, 8, sb + off)) continue;
    uint32_t magic = OSReadBigInt32(blob, 0), len = OSReadBigInt32(blob, 4);
    if (magic == CSMAGIC_CODEDIRECTORY && read_at(fd, blob, sizeof blob, sb + off)) {
      flags |= OSReadBigInt32(blob, 12);
      platform |= blob[38];
    } else if (magic == CSMAGIC_EMBEDDED_ENTITLEMENTS && len <= (1 << 20) && (ents = malloc(len)) &&
               read_at(fd, ents, len, sb + off)) {
      dyld_entitled = has_bytes(ents, len, DYLD_ENTITLEMENT);
      lv_disabled = has_bytes(ents, len, DLV_ENTITLEMENT);
    }
    free(ents);
    ents = NULL;
  }
  restricted = platform || (flags & (CS_RESTRICT | CS_REQUIRE_LV)) || ((flags & CS_RUNTIME) && !(dyld_entitled && lv_disabled));
done:
  free(cmds);
  close(fd);
  return restricted;
}

// ---------------------------------------------------------------------------------------
// Re-signed copies

static int run_codesign(const char *file) {
  char *argv[] = {"/usr/bin/codesign", "-s", "-", "-f", (char *)file, NULL};
  char *envp[] = {NULL};
  pid_t pid;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addopen(&fa, 1, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 2, "/dev/null", O_WRONLY, 0);
  int r = posix_spawn(&pid, argv[0], &fa, NULL, argv, envp);
  posix_spawn_file_actions_destroy(&fa);
  if (r != 0) return -1;
  int status;
  while (waitpid(pid, &status, 0) < 0)
    if (errno != EINTR) return -1;
  return WIFEXITED(status) && WEXITSTATUS(status) == 0 ? 0 : -1;
}

// Fills `out` with a traceable copy of `orig`, creating it on first use. Each copy keeps
// its original file name, because multi-call shims (xcrun's, mise's) dispatch on it, inside
// a directory keyed by inode, mtime and size, so a replaced original gets a new copy.
static int sip_copy(const char *orig, char *out, size_t n) {
  struct stat st;
  if (!g_sip_dir || stat(orig, &st) != 0 || !S_ISREG(st.st_mode)) return -1;
  const char *base = strrchr(orig, '/');
  base = base ? base + 1 : orig;
  char dir[PATH_MAX];
  snprintf(dir, sizeof dir, "%s/%llx-%lx-%llx", g_sip_dir, (unsigned long long)st.st_ino, (long)st.st_mtime,
           (unsigned long long)st.st_size);
  snprintf(out, n, "%s/%s", dir, base);

  struct stat cs;
  if (lstat(out, &cs) == 0) return S_ISREG(cs.st_mode) && cs.st_uid == getuid() ? 0 : -1;
  if (mkdir(dir, 0700) != 0 && errno != EEXIST) return -1;
  if (lstat(dir, &cs) != 0 || !S_ISDIR(cs.st_mode) || cs.st_uid != getuid()) return -1;

  char tmp[PATH_MAX];
  snprintf(tmp, sizeof tmp, "%s/.tmp-XXXXXX", dir);
  int dst = mkstemp(tmp);
  if (dst < 0) return -1;
  int src = open(orig, O_RDONLY | O_CLOEXEC);
  int ok = src >= 0;
  char buf[1 << 16];
  ssize_t got = 0;
  while (ok && (got = read(src, buf, sizeof buf)) > 0) ok = write(dst, buf, (size_t)got) == got;
  ok = ok && got == 0 && fchmod(dst, 0700) == 0;
  if (src >= 0) close(src);
  close(dst);
  // rename is atomic, so a concurrent creator of the same copy loses harmlessly.
  if (!ok || run_codesign(tmp) != 0 || rename(tmp, out) != 0) {
    unlink(tmp);
    return -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------------------
// Exec rewrite

// Reads a `#!interp [arg]` line. The remainder after the interpreter is one argument.
static int read_shebang(const char *path, char *interp, size_t in, char *arg, size_t an) {
  int fd = open(path, O_RDONLY | O_CLOEXEC);
  if (fd < 0) return 0;
  char buf[512];
  ssize_t got = read(fd, buf, sizeof buf - 1);
  close(fd);
  if (got < 3 || buf[0] != '#' || buf[1] != '!') return 0;
  buf[got] = 0;
  char *p = buf + 2, *end = strchr(p, '\n');
  if (!end) return 0;
  *end = 0;
  while (*p == ' ' || *p == '\t') p++;
  char *q = p;
  while (*q && *q != ' ' && *q != '\t') q++;
  snprintf(interp, in, "%.*s", (int)(q - p), p);
  while (*q == ' ' || *q == '\t') q++;
  char *t = q + strlen(q);
  while (t > q && (t[-1] == ' ' || t[-1] == '\t' || t[-1] == '\r')) *--t = 0;
  snprintf(arg, an, "%s", q);
  return interp[0] == '/';
}

static size_t argc_of(char *const argv[]) {
  size_t n = 0;
  while (argv && argv[n]) n++;
  return n;
}

// /bin/sh only starts the shell /private/var/select/sh names, so copying that shell instead
// saves a traced process per shell. argv[0] stays `sh`, which is what puts it in sh mode.
static const char *exec_source(const char *path, char *buf, size_t n) {
  if (strcmp(path, "/bin/sh") != 0) return path;
  ssize_t len = readlink("/private/var/select/sh", buf, n - 1);
  if (len <= 0 || buf[0] != '/') return path;
  buf[len] = 0;
  return buf;
}

typedef struct {
  char target[PATH_MAX];
  char interp[PATH_MAX];
  char arg[PATH_MAX];
  char **argv;
} exec_plan;

// Decides what to really exec for `path`. Returns 1 and fills `plan->target` when the exec
// is redirected to a copy; `plan->argv` is set when the argument list changes too.
static int plan_exec(const char *path, char *const argv[], exec_plan *plan) {
  plan->argv = NULL;
  char *interp = plan->interp, *arg = plan->arg, *target = plan->target;
  size_t tn = sizeof plan->target;
  if (read_shebang(path, interp, sizeof plan->interp, arg, sizeof plan->arg)) {
    record(AT_FDCWD, path);
    if (!is_restricted(interp)) return 0;
    char shell[PATH_MAX];
    if (sip_copy(exec_source(interp, shell, sizeof shell), target, tn) != 0) {
      record_untraced(interp);
      return 0;
    }
    record(AT_FDCWD, interp);
    size_t argc = argc_of(argv);
    // The kernel's own shebang convention: interpreter, optional argument, script, rest.
    char **v = calloc(argc + 4, sizeof *v);
    size_t i = 0;
    v[i++] = interp;
    if (arg[0]) v[i++] = arg;
    v[i++] = (char *)path;
    for (size_t j = 1; j < argc; j++) v[i++] = argv[j];
    plan->argv = v;
    return 1;
  }
  if (!is_restricted(path)) return 0;
  struct stat st;
  // A copy drops setuid, which would change what the program does, so it runs untraced.
  char shell[PATH_MAX];
  if (stat(path, &st) != 0 || (st.st_mode & (S_ISUID | S_ISGID)) ||
      sip_copy(exec_source(path, shell, sizeof shell), target, tn) != 0) {
    record_untraced(path);
    return 0;
  }
  record(AT_FDCWD, path);
  return 1;
}

// Returns envp with our variables restored when a caller passed an environment without them.
static char **carry_env(char *const envp[]) {
  size_t n = argc_of(envp);
  char **out = calloc(n + NCARRIED + 1, sizeof *out);
  memcpy(out, envp, n * sizeof *out);
  for (size_t v = 0; v < NCARRIED; v++) {
    if (!g_carried[v]) continue;
    size_t len = strlen(CARRIED_VARS[v]);
    int present = 0;
    for (size_t i = 0; i < n && !present; i++)
      present = strncmp(out[i], CARRIED_VARS[v], len) == 0 && out[i][len] == '=';
    if (!present) out[n++] = g_carried[v];
  }
  return out;
}

static int resolve_in_path(const char *file, char *out, size_t n) {
  if (strchr(file, '/')) return snprintf(out, n, "%s", file) > 0;
  const char *path = getenv("PATH");
  if (!path) path = "/usr/bin:/bin";
  while (*path) {
    const char *colon = strchr(path, ':');
    size_t len = colon ? (size_t)(colon - path) : strlen(path);
    snprintf(out, n, "%.*s/%s", (int)len, len ? path : ".", file);
    if (access(out, X_OK) == 0) return 1;
    path += len + (colon ? 1 : 0);
  }
  return 0;
}

static int my_execve(const char *path, char *const argv[], char *const envp[]) {
  exec_plan plan;
  int redirect = plan_exec(path, argv, &plan);
  char **env = carry_env(envp);
  int r = execve(redirect ? plan.target : path, plan.argv ? plan.argv : argv, env);
  int saved = errno;
  free(env);
  free(plan.argv);
  errno = saved;
  return r;
}

static int spawn_resolved(pid_t *pid, const char *path, const posix_spawn_file_actions_t *fa,
                          const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
  exec_plan plan;
  int redirect = plan_exec(path, argv, &plan);
  char **env = carry_env(envp);
  int r = posix_spawn(pid, redirect ? plan.target : path, fa, attr, plan.argv ? plan.argv : argv, env);
  free(env);
  free(plan.argv);
  return r;
}

static int my_posix_spawn(pid_t *pid, const char *path, const posix_spawn_file_actions_t *fa,
                          const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
  return spawn_resolved(pid, path, fa, attr, argv, envp);
}

// posix_spawnp reaches posix_spawn inside libsystem_kernel, where interposing does not
// apply, so it is resolved here and routed through the same path.
static int my_posix_spawnp(pid_t *pid, const char *file, const posix_spawn_file_actions_t *fa,
                           const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
  char path[PATH_MAX];
  if (!resolve_in_path(file, path, sizeof path)) {
    char **env = carry_env(envp);
    int r = posix_spawnp(pid, file, fa, attr, argv, env);
    free(env);
    return r;
  }
  return spawn_resolved(pid, path, fa, attr, argv, envp);
}

static const char *env_value(char *const envp[], const char *name) {
  size_t len = strlen(name);
  for (size_t i = 0; envp && envp[i]; i++)
    if (strncmp(envp[i], name, len) == 0 && envp[i][len] == '=') return envp[i] + len + 1;
  return NULL;
}

static const char *validated_sip_dir(const char *dir);

// For a launcher that is not traced itself, such as the addon starting the root of a
// tree: starts `file` as a traced process would, with the shim's settings taken from
// `envp`. Serialised, because it borrows the shim's process-wide settings.
__attribute__((visibility("default"))) int fstrace_spawn(pid_t *pid, const char *file, const char *cwd,
                                                         char *const argv[], char *const envp[]) {
  static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
  pthread_mutex_lock(&lock);
  char *saved_carried[NCARRIED];
  memcpy(saved_carried, g_carried, sizeof g_carried);
  int saved_log = g_log;
  const char *saved_sip_dir = g_sip_dir;

  for (size_t v = 0; v < NCARRIED; v++) {
    const char *val = env_value(envp, CARRIED_VARS[v]);
    g_carried[v] = val ? (char *)val - strlen(CARRIED_VARS[v]) - 1 : NULL;
  }
  const char *out = env_value(envp, "FSTRACE_OUT");
  g_log = out ? open(out, O_WRONLY | O_APPEND | O_CLOEXEC) : -1;
  g_sip_dir = validated_sip_dir(env_value(envp, "FSTRACE_SIP_DIR"));

  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  if (cwd) posix_spawn_file_actions_addchdir_np(&fa, cwd);
  int r = my_posix_spawnp(pid, file, &fa, NULL, argv, envp);
  posix_spawn_file_actions_destroy(&fa);

  if (g_log >= 0) close(g_log);
  memcpy(g_carried, saved_carried, sizeof g_carried);
  g_log = saved_log;
  g_sip_dir = saved_sip_dir;
  pthread_mutex_unlock(&lock);
  return r;
}

// ---------------------------------------------------------------------------------------
// Opens

static int my_open(const char *path, int flags, ...) {
  int mode = 0;
  if (flags & O_CREAT) {
    va_list ap;
    va_start(ap, flags);
    mode = va_arg(ap, int);
    va_end(ap);
  }
  int fd = open(path, flags, mode);
  if (fd >= 0 && reads(flags)) record(AT_FDCWD, path);
  return fd;
}

static int my_openat(int dirfd, const char *path, int flags, ...) {
  int mode = 0;
  if (flags & O_CREAT) {
    va_list ap;
    va_start(ap, flags);
    mode = va_arg(ap, int);
    va_end(ap);
  }
  int fd = openat(dirfd, path, flags, mode);
  if (fd >= 0 && reads(flags)) record(dirfd, path);
  return fd;
}

static FILE *my_fopen(const char *path, const char *mode) {
  FILE *f = fopen(path, mode);
  if (f && mode && (mode[0] == 'r' || strchr(mode, '+'))) record(AT_FDCWD, path);
  return f;
}

// ---------------------------------------------------------------------------------------
// Setup

// The copy directory is trusted only if it is still ours and owner-only: anything that can
// write there chooses what traced processes run.
static const char *validated_sip_dir(const char *dir) {
  struct stat st;
  if (!dir || dir[0] != '/' || lstat(dir, &st) != 0) return NULL;
  return S_ISDIR(st.st_mode) && st.st_uid == getuid() && !(st.st_mode & 077) ? dir : NULL;
}

__attribute__((constructor)) static void init(void) {
  for (size_t v = 0; v < NCARRIED; v++) {
    const char *val = getenv(CARRIED_VARS[v]);
    if (!val) continue;
    size_t len = strlen(CARRIED_VARS[v]) + strlen(val) + 2;
    g_carried[v] = malloc(len);
    snprintf(g_carried[v], len, "%s=%s", CARRIED_VARS[v], val);
  }
  const char *out = getenv("FSTRACE_OUT");
  if (out) {
    int fd = open(out, O_WRONLY | O_APPEND | O_CLOEXEC);
    if (fd >= 0) {
      int high = fcntl(fd, F_DUPFD_CLOEXEC, 1000);
      if (high >= 0) {
        close(fd);
        fd = high;
      }
      g_log = fd;
    }
  }
  g_sip_dir = validated_sip_dir(getenv("FSTRACE_SIP_DIR"));

  char exe[PATH_MAX];
  uint32_t size = sizeof exe;
  size_t dlen = g_sip_dir ? strlen(g_sip_dir) : 0;
  // A copy's own path is not an input; plan_exec already recorded the original.
  if (_NSGetExecutablePath(exe, &size) == 0 && !(dlen && strncmp(exe, g_sip_dir, dlen) == 0))
    record(AT_FDCWD, exe);
}

typedef struct {
  const void *replacement;
  const void *original;
} interpose_t;

__attribute__((used, section("__DATA,__interpose"))) static const interpose_t interposers[] = {
    {(const void *)my_open, (const void *)open},
    {(const void *)my_openat, (const void *)openat},
    {(const void *)my_fopen, (const void *)fopen},
    {(const void *)my_execve, (const void *)execve},
    {(const void *)my_posix_spawn, (const void *)posix_spawn},
    {(const void *)my_posix_spawnp, (const void *)posix_spawnp},
};
