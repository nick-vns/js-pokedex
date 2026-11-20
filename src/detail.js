import { getEntry, getEvolutionChain, getType, normalize, resourceId } from './api.js';
import { dexNumber, displayName, effectiveness, evolutionCondition, STATS } from './catalog.js';
import { TEAM_LIMIT } from './storage.js';
import { badge, badges, button, errorNotice, favoriteButton, h, link, nameOf, pathFor, picture, skeleton, typeNames } from './ui.js';

export const statMap = pokemon => new Map(pokemon.stats.map(({ stat, base_stat }) => [stat.name, base_stat]));
export const statLabel = key => key === 'hp' ? 'HP' : displayName(key);
export const measure = (value, unit) => Number.isFinite(value) ? value / 10 + ' ' + unit : '—';
export const entryOf = (species, pokemon) => ({ name: species.name, id: species.id ?? pokemon.id });

export function entryImage(entry, pokemon, eager = false) {
  return picture({ ...entry, id: pokemon.id }, {
    eager, src: pokemon.sprites?.other?.['official-artwork']?.front_default || pokemon.sprites?.front_default,
  });
}

function statPanel(pokemon) {
  const values = statMap(pokemon);
  return h('section', { class: 'panel' }, h('h2', {}, 'Base stats'),
    h('div', { class: 'stats' }, STATS.map(key => {
      const value = values.get(key);
      return h('div', { class: 'stat' }, h('span', {}, statLabel(key)), h('strong', {}, value ?? '—'),
        Number.isFinite(value) ? h('meter', { min: 0, max: 255, value, 'aria-label': statLabel(key) }) : h('span'));
    })));
}

function familyNode(node, current, root = false) {
  const species = node?.species;
  if (!species?.name) return null;
  const conditions = Array.isArray(node.evolution_details) ? node.evolution_details.map(evolutionCondition) : [];
  const children = Array.isArray(node.evolves_to) ? node.evolves_to.map(child => familyNode(child, current)).filter(Boolean) : [];
  return h('li', { class: 'family-node' },
    root ? null : h('span', { class: 'evo-condition' }, '↓ ', [...new Set(conditions)].join(' or ') || 'Condition unavailable'),
    h('a', { href: pathFor(species.name), 'data-route': '', class: 'evo-entry',
      'aria-current': species.name === current ? 'page' : null },
    picture({ name: species.name, id: resourceId(species) }, { decorative: true }), nameOf(species)),
    children.length ? h('ul', { class: 'family' }, children) : null);
}

function fillSection(section, load) {
  const content = section.querySelector('.panel-content');
  const update = () => {
    content.replaceChildren(skeleton(1, 'section-loading'));
    load().then(result => content.replaceChildren(result))
      .catch(error => content.replaceChildren(errorNotice(error, update)));
  };
  update();
}

export async function detail(main, app, key) {
  const frame = h('div', { class: 'detail-page' },
    link('/', 'Explore the Pokédex', 'back-link'), skeleton(1, 'detail-loading'));
  main.append(frame);
  try {
    const { species, pokemon } = await getEntry(normalize(key));
    if (!frame.isConnected) return;
    const entry = entryOf(species, pokemon);
    app.view(entry.name);
    document.title = nameOf(entry) + ' | PokeDox';
    const types = typeNames(pokemon);
    const genus = Array.isArray(species.genera) && species.genera.find(item => item?.language?.name === 'en')?.genus;
    const flavor = Array.isArray(species.flavor_text_entries) &&
      species.flavor_text_entries.find(item => item?.language?.name === 'en')?.flavor_text;
    const generation = species.generation?.name?.split('-').at(-1)?.toUpperCase();
    const team = button('', () => {
      app.toggle('team', entry.name);
      syncTeam();
    }, { class: 'action primary' });
    function syncTeam() {
      const saved = app.state.team.includes(entry.name);
      team.disabled = !saved && app.state.team.length >= TEAM_LIMIT;
      team.textContent = saved ? 'Remove from team' : team.disabled ? 'Team is full' : 'Add to team';
    }
    syncTeam();
    const facts = [
      ['Height', measure(pokemon.height, 'm')], ['Weight', measure(pokemon.weight, 'kg')],
      ['Base experience', pokemon.base_experience ?? '—'],
    ];
    const abilities = Array.isArray(pokemon.abilities) ? pokemon.abilities.filter(item => item?.ability?.name) : [];
    const overview = h('section', { class: 'detail-hero' },
      h('div', { class: 'detail-art', 'data-type': types[0] }, entryImage(entry, pokemon, true)),
      h('div', { class: 'detail-copy' },
        h('p', { class: 'number' }, [dexNumber(entry.id), generation && 'Generation ' + generation,
          species.is_legendary ? 'Legendary' : species.is_mythical ? 'Mythical' : ''].filter(Boolean).join('  ·  ')),
        h('h1', {}, nameOf(entry)), genus && h('p', { class: 'genus' }, genus), badges(types),
        h('p', { class: 'flavor' }, typeof flavor === 'string' ? flavor.replace(/\s+/g, ' ').trim() : 'No Pokédex description available.'),
        h('dl', { class: 'facts' }, facts.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value)))),
        h('div', { class: 'detail-actions' }, team, favoriteButton(entry, app),
          link('/compare?a=' + encodeURIComponent(entry.name), 'Compare', 'action'))));
    const abilityPanel = h('section', { class: 'panel' }, h('h2', {}, 'Abilities'),
      abilities.length ? h('ul', { class: 'ability-list' }, abilities.map(item =>
        h('li', {}, displayName(item.ability.name), item.is_hidden && h('span', { class: 'muted' }, 'Hidden'))))
        : h('p', {}, 'No abilities listed.'));
    const interactions = h('section', { class: 'panel' }, h('h2', {}, 'Type effectiveness'), h('div', { class: 'panel-content' }));
    const evolutions = h('section', { class: 'panel evolutions' }, h('h2', {}, 'Evolution family'), h('div', { class: 'panel-content' }));
    frame.replaceChildren(link('/', 'Explore the Pokédex', 'back-link'), overview,
      h('div', { class: 'detail-grid' }, statPanel(pokemon), abilityPanel, interactions), evolutions);
    fillSection(interactions, async () => {
      const resources = await Promise.all(types.map(getType));
      const groups = effectiveness(resources.map(data => data.damage_relations));
      return h('dl', { class: 'effective' }, [['Weak to', groups.weak], ['Resistant to', groups.resistant],
        ['Immune to', groups.immune]].map(([label, entries]) => h('div', {}, h('dt', {}, label), h('dd', {},
        entries.length ? h('div', { class: 'badges' }, entries.map(([name, factor]) =>
          badge(name, displayName(name) + ' ' + factor + '×'))) : 'None'))));
    });
    fillSection(evolutions, async () => {
      const id = resourceId(species.evolution_chain);
      if (!id) return h('p', {}, 'No evolution data available.');
      const { chain } = await getEvolutionChain(id);
      const family = familyNode(chain, entry.name, true);
      return h('div', {}, h('ul', { class: 'family' }, family),
        !chain.evolves_to?.length && h('p', { class: 'muted' }, 'This Pokémon does not evolve.'));
    });
  } catch (error) {
    if (frame.isConnected) frame.replaceChildren(errorNotice(error, app.render));
  }
}
