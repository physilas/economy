import { advance } from './engine.mjs';
self.onmessage = event => {
  try {
    const { game, now } = event.data;
    const result = advance(game, now, { offline: true, onProgress: progress => self.postMessage({ progress }) });
    self.postMessage({ game, result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
