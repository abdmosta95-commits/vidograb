let active = 0;
const waiters = [];

export function getActiveCount() {
  return active;
}

export async function withHeavyLimit(fn, max = 1) {
  if (active >= max) {
    await new Promise((resolve) => waiters.push(resolve));
  }

  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}
