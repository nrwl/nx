// Opens argv[1] argv[2] times through libc. Built dynamic and static.
#include <fcntl.h>
#include <stdlib.h>
#include <unistd.h>
int main(int argc, char **argv) {
  int n = atoi(argv[2]);
  for (int i = 0; i < n; i++) {
    int fd = open(argv[1], O_RDONLY);
    if (fd < 0) return 1;
    close(fd);
  }
  return 0;
}
