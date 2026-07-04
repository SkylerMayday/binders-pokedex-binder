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
  html += `<div class="changelog-summary">${formatPublishedAt(latest.publishedAt)} &middot; `;
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
    return `<div class="slot"><img loading="lazy" src="${slot.imageUrl}" alt="${escapeHtml(slot.cardName || slot.slotName)}"></div>`;
  }
  return `<div class="slot empty">
    <div class="dex-number">#${slot.dexNumber || ''}</div>
    <div class="slot-name">${escapeHtml(slot.slotName)}</div>
  </div>`;
}

function renderSection(section) {
  const filled = section.slots.filter(s => s.cardId).length;
  const total = section.slots.length;
  let html = `<section class="binder-section">`;
  html += `<h2>${escapeHtml(section.name)}</h2>`;
  html += `<div class="section-bar-wrap">${barHtml(filled, total)}<div class="completion-label">${filled}/${total}</div></div>`;
  html += `<div class="slot-grid">${section.slots.map(renderSlot).join('')}</div>`;
  html += `</section>`;
  return html;
}

function renderBinder(binder) {
  let html = `<div class="binder">`;
  html += binder.sections.map(renderSection).join('');
  html += `</div>`;
  return html;
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
  header.innerHTML = `
    <h1>Pokédex Binder</h1>
    <div class="published-at">Last published ${formatPublishedAt(binderSnapshot.publishedAt)}</div>
    ${barHtml(filled, total)}
    <div class="completion-label">${filled}/${total} complete</div>
  `;

  renderChangelog(changelog);

  const main = document.getElementById('binders');
  main.innerHTML = binderSnapshot.binders.map(renderBinder).join('');

  // If the URL has #latest, scroll to it once rendered.
  if (window.location.hash === '#latest') {
    const el = document.getElementById('latest');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

async function init() {
  const [binderSnapshot, changelog] = await Promise.all([
    loadJson(BINDER_URL, SAMPLE_BINDER_URL),
    loadJson(CHANGELOG_URL, SAMPLE_CHANGELOG_URL)
  ]);

  if (!binderSnapshot) {
    document.getElementById('binders').innerHTML = '<p>Unable to load binder data.</p>';
    return;
  }

  render(binderSnapshot, changelog);
}

init();
