export const STORAGE_KEY = 'pokedox:v2';
export const TEAM_LIMIT = 6;
const defaults = { favorites: [], team: [], recent: [], theme: null };

function entries(value, limit) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(name => typeof name === 'string' && /^[a-z0-9-]+$/.test(name)))].slice(0, limit);
}

export function readState(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY));
    return {
      favorites: entries(value?.favorites),
      team: entries(value?.team, TEAM_LIMIT),
      recent: entries(value?.recent, 8),
      theme: ['light', 'dark'].includes(value?.theme) ? value.theme : null,
    };
  } catch {
    return { ...defaults };
  }
}

export function writeState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function updateEntries(state, key, name) {
  const current = state[key];
  if (key === 'recent') return [name, ...current.filter(entry => entry !== name)].slice(0, 8);
  if (current.includes(name)) return current.filter(entry => entry !== name);
  if (key === 'team' && current.length >= TEAM_LIMIT) return current;
  return [...current, name];
}
