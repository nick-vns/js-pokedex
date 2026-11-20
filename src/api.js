const BASE = 'https://pokeapi.co/api/v2/';
const requests = new Map();
const validName = value => typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
const named = value => validName(value?.name);

export function resourceId(resource) {
  const url = resource?.url;
  return typeof url === 'string' ? Number(url.match(/\/(\d+)\/?$/)?.[1]) || null : null;
}

export function normalize(value) {
  const query = String(value ?? '').trim().toLowerCase().replace(/^#\s*/, '')
    .normalize('NFD').replace(/[\u0300-\u036f.'’]/g, '')
    .replace(/\s*♀/g, '-f').replace(/\s*♂/g, '-m').replace(/\s+/g, '-');
  return /^\d+$/.test(query) ? String(Number(query)) : query;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function request(path, validate) {
  const url = new URL(path, BASE);
  if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith('/api/v2/')) {
    return Promise.reject(new ApiError('Unexpected PokéAPI resource URL.'));
  }
  if (!requests.has(url.href)) {
    const pending = (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new ApiError('PokéAPI request failed.', response.status);
      const data = await response.json();
      if (!validate(data)) throw new ApiError('PokéAPI returned unexpected data.');
      return data;
    })().catch(error => {
      requests.delete(url.href);
      if (import.meta.env?.DEV) console.warn('PokéAPI request failed', url.pathname, error);
      throw error;
    });
    requests.set(url.href, pending);
  }
  return requests.get(url.href);
}

async function list(resource) {
  const results = [];
  const seen = new Set();
  let next = resource + '/?limit=2000';
  while (next) {
    if (seen.has(next)) throw new ApiError('PokéAPI pagination did not advance.');
    seen.add(next);
    const page = await request(next, data => Array.isArray(data?.results) &&
      data.results.every(entry => named(entry) && resourceId(entry)) &&
      (data.next == null || typeof data.next === 'string'));
    results.push(...page.results);
    next = page.next;
  }
  return results;
}

export const getPokemonList = () => list('pokemon-species');
export const getGenerationList = () => list('generation');
const validPokemon = data => named(data) && Number.isInteger(data.id) && named(data.species) &&
  Array.isArray(data.types) && data.types.every(entry => named(entry?.type)) &&
  Array.isArray(data.stats) && data.stats.every(entry => named(entry?.stat) && Number.isFinite(entry.base_stat));

export function getPokemon(key) {
  if (!validName(key)) return Promise.reject(new ApiError('Invalid Pokémon.', 404));
  return request('pokemon/' + key + '/', validPokemon);
}

export function getPokemonSpecies(key) {
  if (!validName(key)) return Promise.reject(new ApiError('Invalid Pokémon.', 404));
  return request('pokemon-species/' + key + '/', data => named(data) && Array.isArray(data.varieties));
}
export const getEvolutionChain = id => request('evolution-chain/' + id + '/', data => named(data?.chain?.species));
export const getType = type => request('type/' + type + '/',
  data => named(data) && Array.isArray(data.pokemon) &&
    ['double_damage_from', 'half_damage_from', 'no_damage_from'].every(key =>
      Array.isArray(data.damage_relations?.[key]) && data.damage_relations[key].every(named)));
export const getGeneration = id => request('generation/' + id + '/',
  data => named(data) && Array.isArray(data.pokemon_species));

export async function getEntry(key) {
  const species = await getPokemonSpecies(key);
  const variety = species.varieties.find(entry => entry?.is_default)?.pokemon;
  const id = resourceId(variety);
  return { species, pokemon: await getPokemon(id ? String(id) : variety?.name ?? species.name) };
}

export function artwork(id) {
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + id + '.png';
}
