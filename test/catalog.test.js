import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize } from '../src/api.js';
import { selectEntries, effectiveness, evolutionCondition } from '../src/catalog.js';

const entries = [
  { id: 25, name: 'pikachu' }, { id: 4, name: 'charmander' },
  { id: 1, name: 'bulbasaur' }, { id: 172, name: 'pichu' },
];

test('normalize Pokédex numbers and punctuated names', () => {
  assert.equal(normalize('  #025  '), '25');
  assert.equal(normalize('Mr. Mime'), 'mr-mime');
  assert.equal(normalize('Flabébé'), 'flabebe');
  assert.equal(normalize('Nidoran♀'), 'nidoran-f');
});

test('search and combine catalog filters without changing the original order', () => {
  assert.deepEqual(selectEntries(entries, { query: '25' }).map(entry => entry.name), ['pikachu']);
  assert.deepEqual(selectEntries(entries, { query: 'chu', type: new Set([25, 172]),
    generation: new Set(['pikachu', 'bulbasaur']) }).map(entry => entry.name), ['pikachu']);
  assert.deepEqual(selectEntries(entries, { query: 'missing' }), []);
  assert.equal(entries[0].id, 25);
});

test('supports both directions for number and name sorting', () => {
  const ids = sort => selectEntries(entries, { sort }).map(entry => entry.id);
  assert.deepEqual(ids('number'), [1, 4, 25, 172]);
  assert.deepEqual(ids('number-desc'), [172, 25, 4, 1]);
  assert.deepEqual(ids('name'), [1, 4, 172, 25]);
  assert.deepEqual(ids('name-desc'), [25, 172, 4, 1]);
});

test('multiply dual type interactions, including cancellation and immunity', () => {
  const types = (...names) => names.map(name => ({ name }));
  const result = effectiveness([
    { double_damage_from: types('rock', 'water', 'ground'), half_damage_from: types('grass', 'electric') },
    { double_damage_from: types('rock', 'electric'), half_damage_from: types('grass'), no_damage_from: types('ground') },
  ]);
  assert.deepEqual(result.weak, [['rock', 4], ['water', 2]]);
  assert.deepEqual(result.resistant, [['grass', 0.25]]);
  assert.deepEqual(result.immune, [['ground', 0]]);
});

test('explain trade, stat parity, and environmental evolution conditions', () => {
  assert.equal(evolutionCondition({ trigger: { name: 'trade' }, held_item: { name: 'metal-coat' } }), 'Trade · Hold Metal Coat');
  assert.equal(evolutionCondition({ trigger: { name: 'level-up' }, min_level: 20, relative_physical_stats: 0 }), 'Level 20 · Attack = Defense');
  assert.equal(evolutionCondition({ needs_overworld_rain: true, min_level: 50, turn_upside_down: false }), 'Rain · Level 50');
});
