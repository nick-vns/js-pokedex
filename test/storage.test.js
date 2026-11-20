import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readState, writeState, updateEntries, STORAGE_KEY } from '../src/storage.js';

test('round trip favorites, team, recent history, and theme', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const state = readState(storage);
  state.favorites = updateEntries(state, 'favorites', 'pikachu');
  state.team = updateEntries(state, 'team', 'charizard');
  state.recent = updateEntries(state, 'recent', 'eevee');
  state.theme = 'dark';
  assert.equal(writeState(storage, state), true);
  assert.deepEqual(readState(storage), state);
  values.set(STORAGE_KEY, '{');
  assert.deepEqual(readState(storage), { favorites: [], team: [], recent: [], theme: null });
});

test('cap team size and bound recent history without duplicates', () => {
  const names = ['abra', 'ditto', 'mew', 'eevee', 'raichu', 'pikachu', 'pichu', 'psyduck', 'mewtwo'];
  const state = { team: [], recent: [] };
  for (const name of names) {
    state.team = updateEntries(state, 'team', name);
    state.recent = updateEntries(state, 'recent', name);
  }
  assert.deepEqual(state.team, names.slice(0, 6));
  assert.equal(updateEntries(state, 'team', 'mew').includes('mew'), false);
  assert.deepEqual(updateEntries(state, 'recent', 'eevee'), ['eevee', ...state.recent.filter(name => name !== 'eevee')]);
  assert.equal(state.recent.length, 8);
  assert.equal(writeState(undefined, state), false);
});

test('sanitize invalid persisted entries and preferences', () => {
  const state = readState({ getItem: () => JSON.stringify({
    team: ['mew', 'mew', 1, 'mewtwo', '<b>'], favorites: null, recent: ['pikachu'], theme: 'other',
  }) });
  assert.deepEqual(state, { team: ['mew', 'mewtwo'], favorites: [], recent: ['pikachu'], theme: null });
});
