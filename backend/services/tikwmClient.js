const TIKWM_API = 'https://www.tikwm.com/api/';
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let queue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleTikwm(fn) {
  queue = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    lastRequestAt = Date.now();
    return fn();
  });
  return queue;
}

function mapTikwmError(msg) {
  if (!msg) return 'Could not fetch the video.';
  if (/free api limit/i.test(msg)) {
    return 'Free API limit: 1 request per second. Please wait a moment and try again.';
  }
  if (/url parsing is failed/i.test(msg)) {
    return 'Could not parse this URL. Make sure it is valid and public.';
  }
  return msg;
}

export async function callTikwm(url, { hd = 1, retries = 2 } = {}) {
  return scheduleTikwm(async () => {
    let lastError = 'Could not fetch the video.';

    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(TIKWM_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url, hd }),
      });

      const json = await response.json();

      if (json.code === 0 && json.data) {
        return json.data;
      }

      lastError = mapTikwmError(json.msg);

      if (/free api limit/i.test(json.msg || '') && attempt < retries) {
        await sleep(1300);
        continue;
      }

      throw new Error(lastError);
    }

    throw new Error(lastError);
  });
}
