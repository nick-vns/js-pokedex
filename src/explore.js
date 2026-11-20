import { getGeneration, getGenerationList, getType, normalize, resourceId, artwork } from './api.js';
import { displayName, PAGE_SIZE, selectEntries, SORTS, TYPES } from './catalog.js';
import { button, errorNotice, h, link, notice, pathFor, pokemonCard, skeleton } from './ui.js';

const QUICK_TYPES = ['grass', 'fire', 'water', 'electric'];

export function explore(main, app, params) {
  const query = h('input', { type: 'search', placeholder: 'Try Pikachu or #025', 'aria-label': 'Name or Pokédex number',
    maxlength: 80, value: params.get('q')?.slice(0, 80) });
  const type = h('select', { 'aria-label': 'Filter by type' },
    h('option', { value: '' }, 'All types'), TYPES.map(value => h('option', { value }, displayName(value))));
  const generation = h('select', { 'aria-label': 'Filter by generation' }, h('option', { value: '' }, 'All generations'));
  const sort = h('select', { 'aria-label': 'Sort Pokémon' },
    SORTS.map(([value, label]) => h('option', { value }, label)));
  type.value = TYPES.includes(params.get('type')) ? params.get('type') : '';
  sort.value = SORTS.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'number';

  const grid = h('div', { class: 'results' }, skeleton(8));
  const count = h('p', { class: 'result-count', role: 'status' }, 'Loading entries…');
  const recent = h('section', { class: 'recent', hidden: true });
  let filtersVersion = 0;
  let currentPage = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const quick = QUICK_TYPES.map(value => button(displayName(value), () => {
    type.value = type.value === value ? '' : value;
    refresh();
  }, { class: 'quick-type', 'data-type': value, 'aria-pressed': 'false' }));

  const search = h('form', { class: 'hero-search', role: 'search', onsubmit(event) {
    event.preventDefault();
    refresh();
  } }, h('span', { 'aria-hidden': 'true', class: 'search-icon' }, '⌕'), query,
    button('Clear', () => { query.value = ''; query.focus(); refresh(); }, { class: 'clear-search' }));

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-copy' }, h('p', { class: 'eyebrow' }, 'THE NATIONAL POKÉDEX'),
      h('h1', {}, 'Explore the', h('br'), h('em', {}, 'Pokémon world.')),
      h('p', { class: 'hero-description' }, 'Find Pokémon from every generation, discover how they evolve, and build a team of your own.'),
      search, h('div', { class: 'quick-filters', 'aria-label': 'Quick type filters' }, quick)),
    link(pathFor('pikachu'), [
      h('span', { class: 'hero-orbit orbit-one', 'aria-hidden': 'true' }),
      h('span', { class: 'hero-orbit orbit-two', 'aria-hidden': 'true' }),
      h('img', { src: artwork(25), class: 'hero-image', alt: '', width: 440, height: 440 }),
      h('span', { class: 'hero-caption' }, h('span', {}, '#025'), 'Pikachu'),
    ], 'hero-feature'));
  hero.querySelector('.hero-image').addEventListener('error', event => { event.currentTarget.hidden = true; });
  const filters = h('div', { class: 'filters' }, type, generation, sort);
  main.append(hero, h('section', { class: 'catalog', 'aria-labelledby': 'catalog-title' },
    h('div', { class: 'section-top' },
      h('div', {}, h('h2', { id: 'catalog-title' }, 'Pokédex'), count), filters), grid), recent);

  let timer;
  query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  });
  for (const control of [type, generation, sort]) control.addEventListener('change', () => refresh());
  const requested = params.get('generation');
  if (/^\d+$/.test(requested ?? '')) {
    generation.append(h('option', { value: requested }, 'Generation ' + requested));
    generation.value = requested;
  }
  getGenerationList().then(generations => {
    if (!main.contains(hero)) return;
    const selection = generation.value;
    generation.replaceChildren(h('option', { value: '' }, 'All generations'), ...generations.map(entry =>
      h('option', { value: String(resourceId(entry)) }, 'Generation ' + entry.name.split('-').at(-1).toUpperCase())));
    generation.value = selection;
    if (selection && !generation.value) {
      generation.value = '';
      refresh({ keepPage: true });
    }
  }).catch(() => {
    if (main.contains(hero)) filters.append(button('Retry generation filters', app.render, { class: 'action' }));
  });
  app.catalog().then(entries => {
    if (main.contains(hero)) showRecent(entries);
  }).catch(() => {});
  refresh({ keepPage: true });

  function showRecent(entries) {
    const byName = new Map(entries.map(entry => [entry.name, entry]));
    const viewed = app.state.recent.map(name => byName.get(name)).filter(Boolean);
    if (!viewed.length) return;
    recent.hidden = false;
    recent.append(h('h2', {}, 'Recently viewed'),
      h('div', { class: 'recent-grid' }, viewed.map(entry => link(pathFor(entry.name), [
        h('img', { src: artwork(entry.id), width: 48, height: 48, loading: 'lazy', alt: '',
          onerror(event) { event.currentTarget.hidden = true; } }), displayName(entry.name),
      ], 'recent-link'))));
  }

  async function refresh({ keepPage = false, focus = false } = {}) {
    if (!main.contains(hero)) return;
    clearTimeout(timer);
    if (!keepPage) currentPage = 1;
    const version = ++filtersVersion;
    const active = () => main.contains(hero) && version === filtersVersion;
    quick.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.type === type.value)));
    count.textContent = 'Loading entries…';
    if (!grid.querySelector('.skeleton')) grid.replaceChildren(skeleton(8));
    const selected = { query: normalize(query.value), sort: sort.value };
    try {
      const [entries, typeData, generationData] = await Promise.all([
        app.catalog(), type.value && getType(type.value), generation.value && getGeneration(generation.value),
      ]);
      if (!active()) return;
      const ids = typeData && new Set(typeData.pokemon.map(entry => resourceId(entry?.pokemon)));
      const names = generationData && new Set(generationData.pokemon_species.map(entry => entry?.name));
      const matching = selectEntries(entries, { ...selected, generation: names, type: ids });
      const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
      currentPage = Math.min(currentPage, pages);
      const searchParams = new URLSearchParams();
      for (const [key, value] of [['q', query.value.trim()], ['type', type.value], ['generation', generation.value],
        ['sort', sort.value === 'number' ? '' : sort.value], ['page', currentPage === 1 ? '' : currentPage]]) {
        if (value) searchParams.set(key, value);
      }
      history.replaceState(history.state, '', '/' + (searchParams.size ? '?' + searchParams : ''));
      count.textContent = new Intl.NumberFormat('en').format(matching.length) + ' Pokémon found';
      if (!matching.length) {
        grid.replaceChildren(notice('No Pokémon found', 'Try a different name, number, or combination of filters.',
          button('Reset search and filters', () => { query.value = type.value = generation.value = ''; refresh(); },
            { class: 'action' })));
        return;
      }
      const changePage = offset => { currentPage += offset; refresh({ keepPage: true, focus: true }); };
      const shown = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      const cards = h('div', { class: 'grid' }, shown.map(entry => pokemonCard(entry, app)));
      const pagination = h('nav', { class: 'pagination', 'aria-label': 'Pokédex pages' },
        button('Previous', () => changePage(-1), { class: 'action', disabled: currentPage === 1 }),
        h('span', {}, 'Page ' + currentPage + ' of ' + pages),
        button('Next', () => changePage(1), { class: 'action', disabled: currentPage === pages }));
      grid.replaceChildren(cards, pages > 1 ? pagination : '');
      if (focus) cards.querySelector('a')?.focus();
    } catch (error) {
      if (!active()) return;
      count.textContent = '';
      grid.replaceChildren(errorNotice(error, () => refresh({ keepPage: true })));
    }
  }
}
