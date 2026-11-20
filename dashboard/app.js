// Token Launch Radar — dashboard logic. No network: all data comes from data.js
// (window.RADAR), written by main.ts from the same board.json the gate reads.
(function () {
  var D = window.RADAR;
  if (!D) { document.body.innerHTML = '<p style="padding:24px">Radar data missing: data.js did not load.</p>'; return; }
  var watch = {};
  D.watchlist.forEach(function (s) { watch[s] = true; });
  var maxImplied = D.rows.length ? D.rows[0].implied_value_usd : 1;

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n === null || n === undefined) return '<span class="flat">—</span>';
    var c = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + c + '">' + s + '</span>';
  }
  function ageText(a) {
    if (a === null || a === undefined) return '—';
    if (a < 365) return a + 'd';
    return (a / 365).toFixed(1) + 'y';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- header stats -------------------------------------------------------
  $('stats').innerHTML =
    '<span class="chip">Snapshot <b>' + esc(D.as_of) + '</b></span>' +
    '<span class="chip">Watchlist <b>' + D.watchlist_size + '</b></span>' +
    '<span class="chip">Board <b>' + D.board_size + ' rows</b></span>' +
    '<span class="chip">Early finds <b>' + D.early_size + '</b></span>' +
    '<span class="chip">Live set aside <b>' + D.live_size + '</b></span>';
  $('srcLine').textContent = D.source;
  $('floorLine').textContent = money(D.floor_usd);

  // ---- filter options -----------------------------------------------------
  var cats = {}, chains = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('cat').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('chain').appendChild(o);
  });

  // ---- sandbox state ------------------------------------------------------
  var sandbox = { scale: 1, growthW: 0.6, sizeE: -0.12, on: false };
  function clampN(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function priced(r) {
    if (!sandbox.on) return r.implied_value_usd;
    var size = clampN(Math.pow(r.tvl_usd / 1e9, sandbox.sizeE), 0.6, 1.4);
    var g = r.change_7d === null ? 0 : clampN(r.change_7d, -40, 80);
    var growth = 1 + (g / 100) * sandbox.growthW;
    return Math.max(1, Math.round(r.tvl_usd * r.peer_multiple * sandbox.scale * size * growth * r.maturity_multiplier * r.breadth_multiplier));
  }

  // ---- board --------------------------------------------------------------
  var sortKey = 'rank';
  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('cat').value, ch = $('chain').value;
    var minT = +$('minTvl').value, wo = $('watchOnly').checked;
    var list = D.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (r.tvl_usd < minT) return false;
      if (wo && !watch[r.slug]) return false;
      return true;
    });
    var key = sortKey;
    list.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (key === 'age') return (b.age_days || 0) - (a.age_days || 0);
      if (key === 'implied' || key === 'rank') return priced(b) - priced(a);
      return a.rank - b.rank;
    });
    return list;
  }
  var selected = null;
  function renderBoard() {
    var list = filtered();
    $('countLine').textContent = list.length + ' of ' + D.rows.length + ' protocols' +
      (sandbox.on ? ' — sandbox pricing on (peer ×' + sandbox.scale.toFixed(2) + ', growth weight ' + sandbox.growthW.toFixed(2) + ')' : '') + '.';
    var html = '';
    list.forEach(function (r) {
      var v = priced(r);
      var w = Math.max(2, Math.round((v / maxImplied) * 100));
      html += '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (watch[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') +
        '<div class="bar"><i style="width:' + w + '%"></i></div></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 1).join(', ') || '—') + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(v) + '</b></td>' +
        '<td class="num">' + r.peer_multiple.toFixed(2) + '×</td></tr>';
    });
    $('rows').innerHTML = html || '<tr><td colspan="9">No protocols match the filter.</td></tr>';
  }

  // ---- detail view ----------------------------------------------------------
  function peersInCategory(cat) {
    return D.live.filter(function (p) { return p.category === cat; })
      .sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); }).slice(0, 3);
  }
  function showDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    if (!r) { box.hidden = true; selected = null; renderBoard(); return; }
    selected = slug;
    var peers = peersInCategory(r.category);
    var base = Math.round(r.tvl_usd * r.peer_multiple);
    var steps = (r.farm_steps || []).map(function (s, i) {
      return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(s) + '</li>';
    }).join('');
    var comp = peers.length ? '<h3>Live comparables in ' + esc(r.category || 'this category') + '</h3><p class="body">' +
      peers.map(function (p) {
        return esc(p.name) + ' — mcap ' + money(p.mcap_usd) + ' on TVL ' + money(p.tvl_usd) +
          ' (' + (p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—') + ')';
      }).join('<br>') + '</p>' : '';
    box.innerHTML =
      '<h2>#' + r.rank + ' · ' + esc(r.name) + (watch[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || '—') +
      ' · tracked since ' + esc(r.listed_at || 'unknown') + ' · records no token</p>' +
      '<div class="grid">' +
      '<div class="cell"><div class="k">Implied value</div><div class="v">' + money(priced(r)) + '</div><div class="s">rank #' + r.rank + ' of ' + D.rows.length + '</div></div>' +
      '<div class="cell"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div><div class="s">peer base ' + money(base) + '</div></div>' +
      '<div class="cell"><div class="k">7-day change</div><div class="v">' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</div><div class="s">growth ×' + r.growth_multiplier.toFixed(2) + '</div></div>' +
      '<div class="cell"><div class="k">Age</div><div class="v">' + ageText(r.age_days) + '</div><div class="s">maturity ×' + r.maturity_multiplier.toFixed(2) + '</div></div>' +
      '<div class="cell"><div class="k">Peer multiple</div><div class="v">' + r.peer_multiple.toFixed(2) + '×</div><div class="s">category median, shrunk</div></div>' +
      '<div class="cell"><div class="k">Breadth</div><div class="v">×' + r.breadth_multiplier.toFixed(2) + '</div><div class="s">' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</div></div>' +
      '</div>' +
      '<h3>How the value is built</h3>' +
      '<p class="body">' + money(r.tvl_usd) + ' TVL × ' + r.peer_multiple.toFixed(2) + ' peer multiple = ' + money(base) +
      ' base, then size, growth (×' + r.growth_multiplier.toFixed(2) + '), maturity (×' + r.maturity_multiplier.toFixed(2) +
      ') and breadth (×' + r.breadth_multiplier.toFixed(2) + '). Same function scores every row; no name is special-cased.</p>' +
      comp +
      '<h3>Farm plan — how to position before a launch</h3><ol>' + steps + '</ol>' +
      '<p class="hint">Implied value is this radar\u2019s own claim, not a prediction that a token is issued, or when. Never pay to claim an airdrop.</p>';
    box.hidden = false;
    renderBoard();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  // ---- live view ------------------------------------------------------------
  $('liveRows').innerHTML = D.live.map(function (p) {
    var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—';
    return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td><td>' +
      esc(p.chains.slice(0, 1).join(', ') || '—') + (p.chains.length > 1 ? ' +' + (p.chains.length - 1) : '') + '</td><td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + ratio + '</td><td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- model view -------------------------------------------------------------
  $('peerRows').innerHTML = D.peers.map(function (p) {
    return '<tr><td>' + esc(p.category) + '</td><td class="num">' + p.peer_count + '</td>' +
      '<td class="num">' + p.median_multiple.toFixed(3) + '×</td><td class="num">' + p.shrunk_multiple.toFixed(3) + '×</td></tr>';
  }).join('');

  // ---- tabs -------------------------------------------------------------------
  var views = { board: 'view-board', live: 'view-live', model: 'view-model' };
  function setView(v) {
    Object.keys(views).forEach(function (k) { $(views[k]).hidden = k !== v; });
    var showControls = v === 'board';
    $('controls').style.display = showControls ? '' : 'none';
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
  }
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-view]');
    if (b) setView(b.getAttribute('data-view'));
  });

  // ---- controls -----------------------------------------------------------------
  ['q', 'cat', 'chain', 'minTvl', 'watchOnly'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });
  $('sort').addEventListener('change', function () { sortKey = $('sort').value; renderBoard(); });
  document.querySelectorAll('#board thead th[data-k]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      sortKey = k === 'name' || k === 'category' || k === 'chains' ? 'rank' : k;
      $('sort').value = sortKey;
      renderBoard();
    });
  });

  // ---- sandbox --------------------------------------------------------------------
  function sandboxChanged() {
    sandbox.scale = +$('scale').value;
    sandbox.growthW = +$('growthW').value;
    sandbox.sizeE = +$('sizeE').value;
    sandbox.on = sandbox.scale !== 1 || sandbox.growthW !== 0.6 || sandbox.sizeE !== -0.12;
    $('scaleVal').textContent = sandbox.scale.toFixed(2) + '×';
    $('growthVal').textContent = sandbox.growthW.toFixed(2);
    $('sizeVal').textContent = sandbox.sizeE.toFixed(2);
    renderBoard();
    if (selected) showDetail(selected);
  }
  ['scale', 'growthW', 'sizeE'].forEach(function (id) { $(id).addEventListener('input', sandboxChanged); });
  $('resetSandbox').addEventListener('click', function () {
    $('scale').value = 1; $('growthW').value = 0.6; $('sizeE').value = -0.12;
    sandboxChanged();
  });

  // ---- deep links: #view=live|model, #detail=<slug>, #cat=<category>, #q=<text> -----
  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var parts = {};
    h.split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) parts[kv[0]] = decodeURIComponent(kv[1] || '');
    });
    if (parts.view && views[parts.view]) setView(parts.view);
    if (parts.cat) { $('cat').value = parts.cat; }
    if (parts.q) { $('q').value = parts.q; }
    renderBoard();
    if (parts.detail) showDetail(parts.detail);
  }
  renderBoard();
  applyHash();
})();
