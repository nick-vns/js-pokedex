export const TYPES = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel fairy'.split(' ');
export const STATS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
export const PAGE_SIZE = 12;
export const SORTS = [
  ['number', 'Number ↑'], ['number-desc', 'Number ↓'], ['name', 'Name A–Z'], ['name-desc', 'Name Z–A'],
];

export const displayName = value => String(value ?? '').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
export const dexNumber = id => '#' + String(id).padStart(3, '0');

export function selectEntries(entries, { query = '', sort = 'number', generation, type } = {}) {
  const numeric = /^\d+$/.test(query);
  const matching = entries.filter(({ id, name }) =>
    (!query || (numeric ? id === Number(query) : name.includes(query))) &&
    (!generation || generation.has(name)) && (!type || type.has(id)));
  if (sort === 'name') return matching.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') return matching.sort((a, b) => b.name.localeCompare(a.name));
  return matching.sort((a, b) => sort === 'number-desc' ? b.id - a.id : a.id - b.id);
}

export function effectiveness(relations) {
  const multipliers = new Map();
  for (const relation of relations) {
    for (const [key, factor] of [['double_damage_from', 2], ['half_damage_from', 0.5], ['no_damage_from', 0]]) {
      for (const type of relation[key] ?? []) {
        multipliers.set(type.name, (multipliers.get(type.name) ?? 1) * factor);
      }
    }
  }
  const entries = [...multipliers];
  return {
    weak: entries.filter(([, value]) => value > 1).sort((a, b) => b[1] - a[1]),
    resistant: entries.filter(([, value]) => value > 0 && value < 1).sort((a, b) => a[1] - b[1]),
    immune: entries.filter(([, value]) => value === 0),
  };
}

const CONDITIONS = {
  min_level: 'Level', min_happiness: 'Friendship', min_affection: 'Affection', min_beauty: 'Beauty',
  item: 'Use', held_item: 'Hold', location: 'At', known_move: 'Knows',
  known_move_type: 'Knows a move of type', party_species: 'In party', party_type: 'Party type',
  trade_species: 'Trade for', time_of_day: 'During', min_move_count: 'Move uses',
  min_steps: 'Steps', min_damage_taken: 'Damage taken',
};

export function evolutionCondition(detail) {
  const conditions = Object.entries(detail ?? {}).flatMap(([key, value]) => {
    if (key === 'trigger' || value == null || value === false || value === '') return [];
    if (key === 'needs_overworld_rain') return ['Rain'];
    if (key === 'turn_upside_down') return ['Turn system upside down'];
    if (key === 'gender') return [value === 1 ? 'Female' : value === 2 ? 'Male' : 'Gender requirement'];
    if (key === 'relative_physical_stats') {
      return [value === 0 ? 'Attack = Defense' : value > 0 ? 'Attack > Defense' : 'Attack < Defense'];
    }
    const condition = typeof value === 'object' ? value.name : value;
    if (condition == null) return [];
    const label = CONDITIONS[key] ?? displayName(key.replaceAll('_', '-'));
    return [value === true ? label : label + ' ' + (typeof condition === 'string' ? displayName(condition) : condition)];
  });
  const trigger = detail?.trigger?.name;
  if (trigger && !['level-up', 'use-item'].includes(trigger)) conditions.unshift(displayName(trigger));
  return conditions.join(' · ') || displayName(trigger) || 'Condition unavailable';
}
