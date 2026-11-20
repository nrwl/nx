/// Sent by the shim as `openat`'s unused sixth argument. The launcher's seccomp filter lets
/// opens carrying it through without a notification, because the shim already logged them.
pub const MAGIC: u64 = 0x6673_7472_6163_6521;
