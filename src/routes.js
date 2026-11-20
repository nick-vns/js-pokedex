const hashRouting = import.meta.env.MODE === 'github-pages';

export function routeUrl(path) {
  return hashRouting ? import.meta.env.BASE_URL + '#' + path : path;
}

export function readRoute(url = new URL(location.href)) {
  const route = hashRouting
    ? new URL(url.hash.startsWith('#/') ? url.hash.slice(1) : '/', url.origin)
    : url;
  return { pathname: route.pathname.replace(/\/$/, '') || '/', params: route.searchParams };
}

export function replaceRoute(path, params) {
  history.replaceState(history.state, '', routeUrl(path + (params.size ? '?' + params : '')));
}
