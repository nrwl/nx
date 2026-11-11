// Go makes raw syscalls instead of calling libc, so preload shims never see it.
package main

import "os"

func main() {
	if _, err := os.ReadFile(os.Args[1]); err != nil {
		os.Exit(1)
	}
}
