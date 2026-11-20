import { artwork, normalize } from './api.js';
import { dexNumber, displayName, selectEntries } from './catalog.js';
import fallback from '../img/icons8-pokeball-48.png';

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false) node.append(child);
  }
  return node;
}

export const link = (href, label, className) => h('a', { href, 'data-route': '', class: className }, label);
export const button = (label, onclick, attrs = {}) => h('button', { type: 'button', onclick, ...attrs }, label);
export const pathFor = name => '/pokemon/' + encodeURIComponent(name);
export const nameOf = entry => displayName(entry.name);
export const typeNames = pokemon => pokemon.types.map(({ type }) => type.name);

export function picture(entry, { eager = false, src, decorative = false } = {}) {
  return h('img', {
    src: src || artwork(entry.id), alt: decorative ? '' : nameOf(entry),
    width: 256, height: 256, loading: eager ? 'eager' : 'lazy', decoding: 'async',
    onerror(event) {
      const img = event.currentTarget;
      if (img.getAttribute('src') !== fallback) {
        img.src = fallback;
        img.classList.add('image-fallback');
      }
    },
  });
}

export const badge = (type, label = displayName(type)) =>
  h('span', { class: 'badge', 'data-type': type }, label);
export const badges = types => h('div', { class: 'badges' }, types.map(type => badge(type)));

export function skeleton(count = 1, className = 'grid') {
  return h('div', { class: className, role: 'status' },
    h('span', { class: 'sr-only' }, 'Loading Pokémon data'),
    Array.from({ length: count }, () => h('div', { class: 'skeleton', 'aria-hidden': 'true' })));
}

export function notice(title, message, action) {
  return h('div', { class: 'notice' }, h('h2', {}, title), h('p', {}, message), action);
}

export function errorNotice(error, retry) {
  if (error?.status === 404) {
    return notice('Pokémon not found', 'Check the name or National Pokédex number and try again.',
      link('/', 'Explore the Pokédex', 'action primary'));
  }
  return notice('Pokémon data is unavailable', 'Check your connection and try again.',
    retry && button('Try again', retry, { class: 'action primary' }));
}

export function favoriteButton(entry, app, compact = false) {
  const name = nameOf(entry);
  const control = button('', () => {
    const saved = app.toggle('favorites', entry.name);
    refresh();
    if (!saved) app.onUnfavorite?.(entry.name, control);
  }, { class: compact ? 'favorite' : 'action favorite-action' });
  function refresh() {
    const saved = app.state.favorites.includes(entry.name);
    const label = saved ? 'Remove ' + name + ' from favorites' : 'Favorite ' + name;
    control.setAttribute('aria-pressed', String(saved));
    control.setAttribute('aria-label', label);
    control.title = label;
    control.textContent = compact ? (saved ? '♥' : '♡') : (saved ? '♥ Favorited' : '♡ Favorite');
  }
  refresh();
  return control;
}

export function pokemonCard(entry, app, { remove } = {}) {
  const art = h('div', { class: 'card-art' }, picture(entry, { decorative: true }));
  const types = h('div', { class: 'badges card-types', 'aria-label': 'Types' },
    h('span', { class: 'type-loading', 'aria-hidden': 'true' }));
  const card = h('article', { class: 'card', 'data-entry': entry.name },
    art, h('div', { class: 'card-copy' },
      h('span', { class: 'number' }, dexNumber(entry.id)),
      h('h3', {}, link(pathFor(entry.name), nameOf(entry), 'card-link')), types),
    remove ? button('Remove', () => remove(entry.name), {
      class: 'remove-card', 'aria-label': 'Remove ' + nameOf(entry) + ' from team',
    }) : favoriteButton(entry, app, true));
  app.loadCard(entry).then(pokemon => {
    art.dataset.type = typeNames(pokemon)[0] ?? '';
    types.replaceChildren(...typeNames(pokemon).map(type => badge(type)));
  }).catch(() => types.replaceChildren(h('span', { class: 'muted' }, 'Types unavailable')));
  return card;
}

export function picker(entries, label, selected = '', excluded = []) {
  const available = entries.filter(entry => !excluded.includes(entry.name));
  const select = h('select', { 'aria-label': label });
  const search = h('input', { type: 'search', placeholder: 'Filter by name or #',
    'aria-label': 'Filter options for ' + label.toLowerCase(), maxlength: 80,
    oninput: () => showOptions(select.value) });
  function showOptions(value) {
    const matching = selectEntries(available, { query: normalize(search.value) });
    const current = available.find(entry => entry.name === value);
    if (current && !matching.includes(current)) matching.unshift(current);
    select.replaceChildren(h('option', { value: '' }, matching.length ? 'Choose a Pokémon' : 'No matching Pokémon'),
      ...matching.map(entry => h('option', { value: entry.name }, dexNumber(entry.id) + ' ' + nameOf(entry))));
    select.value = current?.name ?? '';
  }
  showOptions(selected);
  return { select, search, field: h('div', { class: 'pokemon-picker' }, search, select) };
}

export function pageIntro(title, description) {
  return h('div', { class: 'page-intro' }, h('h1', {}, title), h('p', {}, description));
}
