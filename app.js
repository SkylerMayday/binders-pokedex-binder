const BINDER_URL = 'binder.json';
const CHANGELOG_URL = 'changelog.json';
const SAMPLE_BINDER_URL = 'sample-binder.json';
const SAMPLE_CHANGELOG_URL = 'sample-changelog.json';
const POKEDEX_TOTAL = 1025;

async function loadJson(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('not ok');
    return await r.json();
  } catch (e) {
    try {
      const f = await fetch(fallback, { cache: 'no-store' });
      return f.ok ? await f.json() : null;
    } catch (e2) {
      return null;
    }
  }
}

function formatPublishedAt(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

function barHtml(filled, total) {
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  return `<div class="bar"><div class="fill" style="width:${pct}%"></div></div>`;
}

function changeIcon(type) {
  switch (type) {
    case 'ADDED': return { icon: '+', cls: 'change-added' };
    case 'REPLACED': return { icon: '↻', cls: 'change-replaced' }; // ↻
    case 'REMOVED': return { icon: '−', cls: 'change-removed' }; // −
    default: return { icon: '', cls: '' };
  }
}

function renderChangeList(changes) {
  const items = changes.map(c => {
    const { icon, cls } = changeIcon(c.type);
    const setSuffix = c.cardSet ? ` (${c.cardSet})` : '';
    return `<li class="${cls}">${icon} ${escapeHtml(c.slotName)}${escapeHtml(setSuffix)}</li>`;
  }).join('');
  return `<ul class="change-list">${items}</ul>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderChangelog(changelog) {
  const container = document.getElementById('changelog-panel');
  if (!changelog || !changelog.entries || changelog.entries.length === 0) {
    container.innerHTML = '<h2>Recent updates</h2><p>No updates yet.</p>';
    return;
  }

  const [latest, ...older] = changelog.entries;
  const summary = latest.summary;

  let html = '<h2>Recent updates</h2>';
  html += `<div id="latest" class="changelog-entry-latest">`;
  html += `<div class="changelog-summary"><span class="latest-pill">Latest</span>${formatPublishedAt(latest.publishedAt)} &middot; `;
  html += `Added ${summary.added}, Replaced ${summary.replaced}, Removed ${summary.removed} &middot; `;
  html += `Pokédex ${summary.pokedexComplete}/${summary.pokedexTotal}</div>`;
  html += renderChangeList(latest.changes);
  html += `</div>`;

  if (older.length > 0) {
    html += older.map(entry => {
      const s = entry.summary;
      return `<details class="changelog-entry-old"><summary>${formatPublishedAt(entry.publishedAt)} &middot; Added ${s.added}, Replaced ${s.replaced}, Removed ${s.removed} &middot; Pokédex ${s.pokedexComplete}/${s.pokedexTotal}</summary>${renderChangeList(entry.changes)}</details>`;
    }).join('');
  }

  container.innerHTML = html;
}

function renderSlot(slot) {
  if (slot.cardId && slot.imageUrl) {
    return `<div class="slot filled" tabindex="0" role="button" aria-label="View ${escapeHtml(slot.cardName || slot.slotName)} full size" data-image-url="${escapeHtml(slot.imageUrl)}" data-image-alt="${escapeHtml(slot.cardName || slot.slotName)}"><img loading="lazy" src="${slot.imageUrl}" alt="${escapeHtml(slot.cardName || slot.slotName)}"></div>`;
  }
  return `<div class="slot empty">
    <div class="dex-number">#${slot.dexNumber || ''}</div>
    <div class="slot-name">${escapeHtml(slot.slotName)}</div>
  </div>`;
}

function renderSection(section) {
  const filled = section.slots.filter(s => s.cardId).length;
  const total = section.slots.length;
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  let html = `<section class="binder-section">`;
  html += `<div class="section-header-row"><h2>${escapeHtml(section.name)}</h2><span class="section-pct">${pct}%</span></div>`;
  html += `<div class="section-bar-wrap">${barHtml(filled, total)}<div class="completion-label">${filled}/${total}</div></div>`;
  html += `<div class="slot-grid">${section.slots.map(renderSlot).join('')}</div>`;
  html += `</section>`;
  return html;
}

/*
 * Addendum §5.A — client-side display grouping only.
 * Buckets the already-fetched `sections` array (flattened across all snapshot binders)
 * into 5 named binder tiles + a 6th "Other" fallback for any unrecognized section name.
 * This does NOT change binder.json's schema, SECTION_ORDER, or how the JSON is parsed —
 * it only decides which DOM tile a given already-parsed section renders under.
 */
const KNOWN_GENERATION_NAMES = [
  'Generation I', 'Generation II', 'Generation III', 'Generation IV', 'Generation V',
  'Generation VI', 'Generation VII', 'Generation VIII', 'Generation IX'
];
const SECTION_REGIONAL_VARIANTS = 'Regional Variants';
const SECTION_ALTERNATE_FORMS = 'Alternate Forms';
const SECTION_MEGA_EVOLUTIONS = 'Mega Evolutions';
const SECTION_VMAX = 'VMax';

const DISPLAY_BINDER_DEFS = [
  { id: 'display-pokedex', name: 'Pokédex', matches: (name) => KNOWN_GENERATION_NAMES.includes(name) },
  { id: 'display-regional', name: SECTION_REGIONAL_VARIANTS, matches: (name) => name === SECTION_REGIONAL_VARIANTS },
  { id: 'display-alternate', name: SECTION_ALTERNATE_FORMS, matches: (name) => name === SECTION_ALTERNATE_FORMS },
  { id: 'display-mega', name: SECTION_MEGA_EVOLUTIONS, matches: (name) => name === SECTION_MEGA_EVOLUTIONS },
  { id: 'display-vmax', name: SECTION_VMAX, matches: (name) => name === SECTION_VMAX }
];
const OTHER_BINDER_DEF = { id: 'display-other', name: 'Other' };

function bucketSectionsIntoDisplayBinders(binderSnapshot) {
  const allSections = binderSnapshot.binders.flatMap(b => b.sections);
  const buckets = DISPLAY_BINDER_DEFS.map(def => ({ ...def, sections: [] }));
  const otherBucket = { ...OTHER_BINDER_DEF, sections: [] };

  allSections.forEach(section => {
    const match = buckets.find(b => b.matches(section.name));
    if (match) {
      match.sections.push(section);
    } else {
      otherBucket.sections.push(section);
    }
  });

  const result = buckets.filter(b => b.sections.length > 0);
  if (otherBucket.sections.length > 0) result.push(otherBucket);
  return result;
}

function displayBinderCompletion(displayBinder) {
  const slots = displayBinder.sections.flatMap(s => s.slots);
  const filled = slots.filter(s => s.cardId).length;
  const total = slots.length;
  return { filled, total };
}

let binderTileOpenState = Object.create(null);

function renderBinderTile(displayBinder) {
  const { filled, total } = displayBinderCompletion(displayBinder);
  const isOpen = !!binderTileOpenState[displayBinder.id];
  const innerSections = displayBinder.sections.map(renderSection).join('');
  return `<div class="binder-tile${isOpen ? ' open' : ''}" data-binder-id="${displayBinder.id}">
    <button type="button" class="binder-tile-toggle" aria-expanded="${isOpen}" aria-controls="binder-body-${displayBinder.id}">
      <span class="binder-tile-name">${escapeHtml(displayBinder.name)}</span>
      <span class="binder-tile-stats">
        <span class="binder-tile-count">${filled}/${total}</span>
        <span class="binder-tile-chevron" aria-hidden="true"></span>
      </span>
    </button>
    <div class="binder-tile-body" id="binder-body-${displayBinder.id}"${isOpen ? '' : ' hidden'}>
      ${innerSections}
    </div>
  </div>`;
}

function overallCompletion(binderSnapshot) {
  const pokedex = binderSnapshot.binders.find(b => b.id === 'pokedex');
  if (!pokedex) return { filled: 0, total: POKEDEX_TOTAL };
  const filled = pokedex.sections
    .flatMap(s => s.slots)
    .filter(s => s.slotType === 'BASE' && s.cardId).length;
  return { filled, total: POKEDEX_TOTAL };
}

function render(binderSnapshot, changelog) {
  const header = document.getElementById('page-header');
  const { filled, total } = overallCompletion(binderSnapshot);
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  header.innerHTML = `
    <div class="header-inner">
      <div class="header-title-row">
        <span class="pokeball-mark" aria-hidden="true"></span>
        <h1>Pokédex Binder</h1>
      </div>
      <div class="hero-stat-block">
        <div class="hero-stat">${pct}%</div>
        <div class="hero-frac">${filled}/${total} complete</div>
      </div>
      <div class="published-at">Last published ${formatPublishedAt(binderSnapshot.publishedAt)}</div>
      <div class="hero-bar-wrap">${barHtml(filled, total)}</div>
    </div>
  `;

  renderChangelog(changelog);

  const displayBinders = bucketSectionsIntoDisplayBinders(binderSnapshot);
  const main = document.getElementById('binders');
  main.innerHTML = displayBinders.map(renderBinderTile).join('');

  attachBinderTileHandlers(main);
  attachLightboxHandlers(main);
  triggerBarFillAnimations();

  // If the URL has #latest, scroll to it once rendered.
  if (window.location.hash === '#latest') {
    const el = document.getElementById('latest');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

/*
 * Presentational only: toggles a binder tile open/closed. Content for every tile is
 * already rendered in the DOM at initial render (per §5.A, "closed tiles present at
 * first paint") — toggling just flips the `hidden` attribute + `.open` class, no
 * re-render, no refetch.
 */
function attachBinderTileHandlers(container) {
  container.querySelectorAll('.binder-tile-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const tile = btn.closest('.binder-tile');
      const body = tile.querySelector('.binder-tile-body');
      const nowOpen = tile.classList.toggle('open');
      binderTileOpenState[tile.dataset.binderId] = nowOpen;
      btn.setAttribute('aria-expanded', String(nowOpen));
      if (nowOpen) {
        body.removeAttribute('hidden');
      } else {
        body.setAttribute('hidden', '');
      }
    });
  });
}

/*
 * Addendum §5.C — click-to-zoom lightbox. Reuses the imageUrl already present on the
 * slot's rendered dataset (set in renderSlot); no new network fetch, no schema change.
 * Only `.slot.filled` elements get a handler — empty slots have no imageUrl and are
 * never wired up.
 */
function openLightbox(imageUrl, altText) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = imageUrl;
  img.alt = altText || '';
  lightbox.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (lightbox.hasAttribute('hidden')) return;
  lightbox.setAttribute('hidden', '');
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}

function attachLightboxHandlers(container) {
  container.querySelectorAll('.slot.filled').forEach(slot => {
    const open = () => openLightbox(slot.dataset.imageUrl, slot.dataset.imageAlt);
    slot.addEventListener('click', open);
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

function initLightboxChrome() {
  const lightbox = document.getElementById('lightbox');
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

/*
 * Presentational only: barHtml() (untouched) emits the final width inline via
 * style="width:${pct}%". To get a visible 0 -> target fill animation without touching
 * that math, stash each fill's real target width, snap it to 0 (no transition), force
 * a reflow, then restore the target width so the existing `transition: width` animates it.
 */
function triggerBarFillAnimations() {
  const fills = Array.from(document.querySelectorAll('.bar .fill'));
  fills.forEach(fill => {
    fill.dataset.targetWidth = fill.style.width;
    fill.style.transition = 'none';
    fill.style.width = '0%';
  });

  // Force reflow so the 0% width is committed before we restore the target.
  void document.body.offsetHeight;

  requestAnimationFrame(() => {
    fills.forEach(fill => {
      fill.style.transition = '';
      fill.style.width = fill.dataset.targetWidth || fill.style.width;
    });
  });
}

function hideSkeleton() {
  const skeleton = document.getElementById('skeleton-wrap');
  if (skeleton) skeleton.remove();
}

async function init() {
  initLightboxChrome();

  const [binderSnapshot, changelog] = await Promise.all([
    loadJson(BINDER_URL, SAMPLE_BINDER_URL),
    loadJson(CHANGELOG_URL, SAMPLE_CHANGELOG_URL)
  ]);

  hideSkeleton();

  if (!binderSnapshot) {
    document.getElementById('binders').innerHTML = '<p>Unable to load binder data.</p>';
    return;
  }

  render(binderSnapshot, changelog);
}

init();
