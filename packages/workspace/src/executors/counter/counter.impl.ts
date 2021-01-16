async function wait() {
  return new Promise((res) => {
    setTimeout(() => res(), 1000);
  });
}

export default async function* counter(opts: { to: number; result: boolean }) {
  for (let i = 0; i < opts.to; ++i) {
    console.log(i);
    yield { success: false };
    await wait();
  }
  yield { success: opts.result };
}
