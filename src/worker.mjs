import {advanceOffline} from './offline.mjs';
self.onmessage = event => {
  try {
    const { game, now } = event.data;
    const result = advanceOffline(game,now,progress=>self.postMessage({progress}));
    self.postMessage({ game, result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
