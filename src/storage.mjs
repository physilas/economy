import { validateGame } from './engine.mjs';

const PREFIX = 'null-economy:v1:';
export const SLOTS = ['slot1', 'slot2', 'slot3'];

function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function encode(game, now = Date.now()) {
  const data = JSON.stringify(game);
  return JSON.stringify({ format: 'NULL_SAVE', version: 1, saved: now, checksum: checksum(data), data });
}

export function decode(text, now = Date.now()) {
  if (typeof text !== 'string' || text.length > 2500000) throw new Error('Spielstand ist zu groß oder ungültig.');
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiger JSON-Spielstand.'); }
  if (envelope?.format !== 'NULL_SAVE' || envelope.version !== 1 || typeof envelope.data !== 'string') throw new Error('Diese Datei ist kein NULL-Spielstand.');
  if (checksum(envelope.data) !== envelope.checksum) throw new Error('Die Prüfsumme stimmt nicht. Der Spielstand wurde verändert oder beschädigt.');
  try { return { game: validateGame(JSON.parse(envelope.data), now), saved: envelope.saved }; }
  catch (e) { throw new Error(e.message || 'Spielstand konnte nicht gelesen werden.'); }
}

export function save(game, slot = 'auto', storage = localStorage) {
  const key = PREFIX + slot, next = encode(game), previous = storage.getItem(key);
  // Preserve a verified previous snapshot before replacing it.
  if (previous) {
    try { decode(previous); storage.setItem(key + ':backup', previous); } catch { /* Keep the existing recovery copy. */ }
  }
  storage.setItem(key, next);
  if (storage.getItem(key) !== next) throw new Error('Speichern konnte nicht bestätigt werden. Bitte exportiere einen Spielstand.');
  return Date.now();
}

export function load(slot = 'auto', storage = localStorage, now = Date.now()) {
  const key = PREFIX + slot, text = storage.getItem(key);
  let primaryError;
  if (text) { try { return { ...decode(text, now), recovered: false }; } catch (e) { primaryError = e; } }
  const backup = storage.getItem(key + ':backup');
  if (backup) { try { return { ...decode(backup, now), recovered: true }; } catch (e) { primaryError ||= e; } }
  if (primaryError) throw primaryError;
  return null;
}

export function listSaves(storage = localStorage) {
  return ['auto', ...SLOTS].map(slot => {
    try {
      const result = load(slot, storage);
      return result ? { slot, name: result.game.name, saved: result.saved, elapsed: result.game.elapsed, cash: result.game.cash, tier: result.game.tier, recovered: result.recovered } : { slot, empty: true };
    } catch (e) { return { slot, error: e.message }; }
  });
}

export function deleteSave(slot, storage = localStorage) {
  storage.removeItem(PREFIX + slot);
  storage.removeItem(PREFIX + slot + ':backup');
}

export function exportFile(game) {
  const blob = new Blob([encode(game)], { type: 'application/json' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `NULL-${game.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
