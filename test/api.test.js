import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPokemon, getPokemonList, getType } from '../src/api.js';

test('coalesces identical requests and retries a malformed response', async context => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json(calls === 1 ? { name: 'pikachu' } : {
      name: 'pikachu', id: 25, species: { name: 'pikachu' },
      types: [{ type: { name: 'electric' } }], stats: [{ stat: { name: 'hp' }, base_stat: 35 }],
    });
  });
  const first = getPokemon('25');
  assert.strictEqual(getPokemon('25'), first);
  await assert.rejects(first, /unexpected data/);
  assert.equal((await getPokemon('25')).name, 'pikachu');
  assert.equal((await getPokemon('25')).id, 25);
  assert.equal(calls, 2);
});

test('follows pagination and rejects off-origin resource URLs', async context => {
  const first = 'https://pokeapi.co/api/v2/pokemon-species/1/';
  const second = 'https://pokeapi.co/api/v2/pokemon-species/25/';
  context.mock.method(globalThis, 'fetch', async url => {
    if (url.searchParams.get('offset')) return Response.json({
      results: [{ url: second, name: 'pikachu' }], next: 'https://example.com/',
    });
    return Response.json({
      results: [{ url: first, name: 'bulbasaur' }], next: 'pokemon-species/?limit=1&offset=1',
    });
  });
  await assert.rejects(getPokemonList(), /Unexpected PokéAPI resource URL/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('reports HTTP errors and malformed type interactions', async context => {
  context.mock.method(globalThis, 'fetch', async url => url.pathname.includes('/type/') ?
    Response.json({ name: 'electric', pokemon: [], damage_relations: {} }) :
    new Response(null, { status: 404 }));
  await assert.rejects(getPokemon('does-not-exist'), { status: 404 });
  await assert.rejects(getType('electric'), /unexpected data/);
});
