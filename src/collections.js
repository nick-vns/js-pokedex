import { replaceRoute } from './routes.js';
import { getEntry } from './api.js';
import { TEAM_LIMIT } from './storage.js';
import { STATS } from './catalog.js';
import { entryImage, entryOf, measure, statLabel, statMap } from './detail.js';
import { badges, button, errorNotice, h, link, nameOf, notice, pageIntro, pathFor, picker, pokemonCard, skeleton, typeNames } from './ui.js';

export async function savedPage(main, app, key) {
  const isTeam = key === 'team';
  const page = h('div', {},
    pageIntro(isTeam ? 'Team builder' : 'Favorites', isTeam ?
      'Build a lineup of up to six Pokémon and keep it here for your next visit.' :
      'Keep the Pokémon you want to come back to in one place.'),
    skeleton(4));
  main.append(page);
  if (!isTeam && !app.state.favorites.length) {
    page.lastElementChild.replaceWith(emptyFavorites());
    return;
  }
  try {
    const entries = await app.catalog();
    if (!page.isConnected) return;
    const byName = new Map(entries.map(entry => [entry.name, entry]));
    const grid = h('div', { class: 'grid' });
    const content = h('div', { class: 'saved-content' });
    page.lastElementChild.replaceWith(content);
    if (isTeam) {
      const tools = h('div', { class: 'team-tools' });
      content.append(tools, grid);
      const remove = name => {
        app.toggle(key, name);
        showTeam();
        tools.querySelector('input:not(:disabled)')?.focus();
      };
      function showTeam(focusPicker = false) {
        const team = app.state.team;
        const full = team.length >= TEAM_LIMIT;
        const { select, search, field } = picker(entries, 'Choose a Pokémon for your team', '', team);
        select.disabled = search.disabled = full;
        const add = h('button', { type: 'submit', class: 'action primary', disabled: true }, 'Add Pokémon');
        select.addEventListener('change', () => { add.disabled = !select.value || full; });
        const form = h('form', { class: 'team-form', onsubmit(event) {
          event.preventDefault();
          if (!select.value || app.state.team.includes(select.value)) return;
          app.toggle(key, select.value);
          showTeam(true);
        } }, field, add);
        const clear = button('Clear team', () => {
          app.clearTeam();
          showTeam(true);
        }, { class: 'action', disabled: !team.length });
        tools.replaceChildren(h('p', { class: 'team-count', role: 'status' },
          team.length + ' of ' + TEAM_LIMIT + ' slots filled'), form, clear);
        grid.replaceChildren(...Array.from({ length: TEAM_LIMIT }, (_, index) => {
          const name = team[index];
          const entry = byName.get(name);
          return entry ? pokemonCard(entry, app, { remove }) :
            h('div', { class: 'team-slot' }, name ? [
              'Pokémon unavailable', button('Remove', () => remove(name), { class: 'action' }),
            ] : [h('span', { class: 'ball', 'aria-hidden': 'true' }), 'Open slot']);
        }));
        if (focusPicker) (full ? clear : search).focus();
      }
      showTeam();
    } else {
      content.append(grid);
      grid.append(...app.state.favorites.map(name => {
        const entry = byName.get(name);
        return entry ? pokemonCard(entry, app) : h('div', { class: 'team-slot' }, 'Pokémon unavailable',
          button('Remove ' + name, () => { app.toggle(key, name); app.render(); }, { class: 'action' }));
      }));
      app.onUnfavorite = (_, control) => {
        const card = control.closest('article');
        const next = card.nextElementSibling ?? card.previousElementSibling;
        card.remove();
        if (!grid.childElementCount) content.replaceChildren(emptyFavorites());
        (next?.querySelector('button') ?? content.querySelector('a'))?.focus();
      };
    }
  } catch (error) {
    if (page.isConnected) page.lastElementChild.replaceWith(errorNotice(error, app.render));
  }
}

function emptyFavorites() {
  return notice('No favorites yet', 'Select the heart on any Pokémon to save it here.',
    link('/', 'Explore Pokémon', 'action primary'));
}

export async function compare(main, app, params) {
  const page = h('div', {}, pageIntro('Compare Pokémon', 'Choose two Pokémon to see their measurements and base stats side by side.'), skeleton(2));
  main.append(page);
  try {
    const entries = await app.catalog();
    if (!page.isConnected) return;
    const names = new Set(entries.map(entry => entry.name));
    const selected = key => names.has(params.get(key)) ? params.get(key) : '';
    const first = picker(entries, 'First Pokémon', selected('a'));
    const second = picker(entries, 'Second Pokémon', selected('b'));
    const result = h('div', { class: 'comparison' });
    page.lastElementChild.replaceWith(h('div', { class: 'compare-controls' },
      h('div', {}, h('p', {}, 'First Pokémon'), first.field),
      h('div', {}, h('p', {}, 'Second Pokémon'), second.field)), result);
    let version = 0;
    const update = async () => {
      const current = ++version;
      const keys = [first.select.value, second.select.value];
      const query = new URLSearchParams();
      keys.forEach((name, index) => { if (name) query.set(index ? 'b' : 'a', name); });
      replaceRoute('/compare', query);
      if (keys.some(name => !name) || keys[0] === keys[1]) {
        result.replaceChildren(notice('Choose two different Pokémon', 'Use the selectors above to start a comparison.'));
        return;
      }
      result.replaceChildren(skeleton(2, 'comparison-loading'));
      try {
        const pair = await Promise.all(keys.map(getEntry));
        if (current === version && page.isConnected) result.replaceChildren(comparisonTable(pair));
      } catch (error) {
        if (current === version && page.isConnected) result.replaceChildren(errorNotice(error, update));
      }
    };
    first.select.addEventListener('change', update);
    second.select.addEventListener('change', update);
    update();
  } catch (error) {
    if (page.isConnected) page.lastElementChild.replaceWith(errorNotice(error, app.render));
  }
}

function comparisonTable(pair) {
  const values = pair.map(({ pokemon }) => statMap(pokemon));
  const rows = [
    ['Types', ...pair.map(({ pokemon }) => badges(typeNames(pokemon)))],
    ['Height', ...pair.map(({ pokemon }) => measure(pokemon.height, 'm'))],
    ['Weight', ...pair.map(({ pokemon }) => measure(pokemon.weight, 'kg'))],
    ...STATS.map(key => [statLabel(key), ...values.map(stats => stats.get(key) ?? '—')]),
    ['Total base stats', ...values.map(stats => STATS.every(key => stats.has(key)) ?
      STATS.reduce((total, key) => total + stats.get(key), 0) : '—')],
  ];
  return h('table', { class: 'compare-table' }, h('caption', { class: 'sr-only' }, 'Pokémon comparison'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Attribute'), pair.map(({ species, pokemon }) => {
      const entry = entryOf(species, pokemon);
      return h('th', { scope: 'col' }, link(pathFor(entry.name), [entryImage(entry, pokemon), nameOf(entry)]));
    }))),
    h('tbody', {}, rows.map(([label, left, right]) => h('tr', {}, h('th', { scope: 'row' }, label),
      h('td', {}, left), h('td', {}, right)))));
}
