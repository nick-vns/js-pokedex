import './styles.css';
import { getPokemon, getPokemonList, resourceId } from './api.js';
import { displayName } from './catalog.js';
import { readState, writeState, updateEntries } from './storage.js';
import { explore } from './explore.js';
import { detail } from './detail.js';
import { compare, savedPage } from './collections.js';
import { link, notice } from './ui.js';

const main = document.querySelector('main');
const theme = document.querySelector('#theme');
const announcement = document.querySelector('#announcement');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let storage;
try { storage = window.localStorage; } catch { /* Storage can be blocked in private contexts. */ }

let catalogRequest;
const app = {
  state: readState(storage),
  catalog() {
    catalogRequest ??= getPokemonList().then(results =>
      results.map(entry => ({ name: entry.name, id: resourceId(entry) })).sort((a, b) => a.id - b.id))
      .catch(error => { catalogRequest = undefined; throw error; });
    return catalogRequest;
  },
  loadCard(entry) {
    return getPokemon(String(entry.id));
  },
  toggle(key, name) {
    const old = this.state[key];
    const next = updateEntries(this.state, key, name);
    const saved = next.includes(name);
    if (old !== next) {
      this.state[key] = next;
      persist(displayName(name) + (saved ? ' added to ' : ' removed from ') + (key === 'team' ? 'your team.' : 'favorites.'));
    }
    return saved;
  },
  clearTeam() {
    this.state.team = [];
    persist('Team cleared.');
  },
  view(name) {
    this.state.recent = updateEntries(this.state, 'recent', name);
    writeState(storage, this.state);
  },
  render,
};

function persist(message) {
  const saved = writeState(storage, app.state);
  announcement.textContent = message + (saved ? '' : ' Browser storage is unavailable. Changes last for this visit.');
}

function applyTheme() {
  const dark = app.state.theme ? app.state.theme === 'dark' : systemTheme.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.textContent = dark ? '☀' : '☾';
  theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  theme.title = theme.getAttribute('aria-label');
}

theme.addEventListener('click', () => {
  app.state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  persist(displayName(app.state.theme) + ' mode selected.');
});
systemTheme.addEventListener('change', applyTheme);
applyTheme();

function render() {
  const route = location.pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(location.search);
  const activeRoute = route.startsWith('/pokemon/') ? '/' : route;
  for (const nav of document.querySelectorAll('.top nav a')) {
    if (nav.getAttribute('href') === activeRoute) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  document.title = route === '/' ? 'PokeDox — The National Pokédex' : 'PokeDox';
  main.replaceChildren();
  app.onUnfavorite = undefined;
  if (route === '/') return explore(main, app, params);
  if (route === '/favorites' || route === '/team') return savedPage(main, app, route.slice(1));
  if (route === '/compare') return compare(main, app, params);
  if (/^\/pokemon\/[a-z0-9-]+$/i.test(route)) return detail(main, app, route.split('/').at(-1));
  main.append(notice('Page not found', 'This address is outside the Pokédex.', link('/', 'Explore Pokémon', 'action primary')));
}

function navigate(url) {
  if (url.pathname + url.search !== location.pathname + location.search) history.pushState(null, '', url);
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

document.addEventListener('click', event => {
  const anchor = event.target.closest('a[data-route]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(new URL(anchor.href));
});
document.querySelector('#header-search').addEventListener('submit', event => {
  event.preventDefault();
  const input = event.currentTarget.elements.q;
  const params = new URLSearchParams();
  if (input.value.trim()) params.set('q', input.value.trim());
  input.value = '';
  navigate(new URL('/' + (params.size ? '?' + params : ''), location.origin));
  main.querySelector('.hero-search input')?.focus();
});
window.addEventListener('popstate', render);
render();
