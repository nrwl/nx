// Prints the shim's verdict for each path: `cc check-restricted.c && ./a.out /bin/sh ...`.
#include "fstrace.c"

int main(int argc, char **argv) {
  for (int i = 1; i < argc; i++) printf("%-70s %s\n", argv[i], is_restricted(argv[i]) ? "restricted" : "ok");
  return 0;
}
