/* ══════════════════════════════════════════════════════════
   views-map.js — Plano interactivo de la urbanización
   100 lotes · 4 manzanas · avenida principal y garitas
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});

  const Q = [
    { k: 'A', x: 52, y: 52, w: 508, h: 316, calle: 'Av. San Lucas' },
    { k: 'B', x: 620, y: 52, w: 508, h: 316, calle: 'Calle Los Sauces' },
    { k: 'C', x: 52, y: 436, w: 508, h: 312, calle: 'Calle Las Begonias' },
    { k: 'D', x: 620, y: 436, w: 508, h: 312, calle: 'Av. El Mirador' }
  ];

  function housePos() {
    const map = {};
    Q.forEach((q) => {
      const cw = q.w / 5, rh = q.h / 5;
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
          const n = j * 5 + i + 1;
          map[q.k + '-' + String(n).padStart(2, '0')] = {
            x: q.x + i * cw + (cw - 74) / 2,
            y: q.y + j * rh + (rh - 42) / 2,
            w: 74, h: 42
          };
        }
      }
    });
    return map;
  }

  const POS = housePos();

  function svgMap() {
    const casas = DB.state.casas;
    let houses = '';

    casas.forEach((c) => {
      const p = POS[c.id];
      if (!p) return;
      const est = U.casaEstado(c.id);
      const cls = est.key === 'inside' ? 'is-inside' : est.key === 'visit' ? 'is-visit' : '';
      houses += '<g class="house ' + cls + '" data-id="' + c.id + '" style="cursor:pointer">' +
        '<title>' + c.id + ' · ' + U.esc(c.calle) + '</title>' +
        '<rect class="lot" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" width="' + p.w + '" height="' + p.h +
        '" rx="5" fill="#FFFFFF" stroke="#C9D5E4"/>' +
        '<rect x="' + (p.x + 5).toFixed(1) + '" y="' + (p.y + 5).toFixed(1) + '" width="' + (p.w - 10) + '" height="4" rx="2" fill="#E8EEF7"/>' +
        '<text class="map-label" x="' + (p.x + p.w / 2).toFixed(1) + '" y="' + (p.y + p.h - 6).toFixed(1) +
        '" text-anchor="middle" font-size="8.5" fill="#5B6B80">' + c.id + '</text>' +
        (est.dentro ? '<circle cx="' + (p.x + p.w - 8).toFixed(1) + '" cy="' + (p.y + 11).toFixed(1) + '" r="3.4" fill="#0D9488"/>' : '') +
        '</g>';
    });

    // vegetación decorativa sobre la avenida principal
    let trees = '';
    for (let y = 80; y <= 740; y += 54) {
      trees += '<circle cx="562" cy="' + y + '" r="3" fill="#A9D8BF"/><circle cx="618" cy="' + (y + 22) + '" r="3" fill="#A9D8BF"/>';
    }

    return '<svg viewBox="0 0 1180 800" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plano de la urbanización con 100 lotes">' +
      '<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#F5F9FD"/><stop offset="1" stop-color="#EDF3FA"/></linearGradient></defs>' +
      '<rect width="1180" height="800" fill="#E7EEF6"/>' +
      '<rect x="26" y="26" width="1128" height="748" rx="32" fill="url(#ground)" stroke="#C4D2E4" stroke-width="3"/>' +
      '<rect x="34" y="34" width="1112" height="732" rx="26" fill="none" stroke="#DCE6F2" stroke-width="1.2" stroke-dasharray="4 6"/>' +

      // calles
      '<rect x="572" y="30" width="36" height="742" fill="#D9E3EF"/>' +
      '<rect x="30" y="386" width="1120" height="36" fill="#D9E3EF"/>' +
      '<line x1="600" y1="36" x2="600" y2="766" stroke="#CBD7E6" stroke-width="1" stroke-dasharray="12 10"/>' +
      '<line x1="36" y1="404" x2="1146" y2="404" stroke="#CBD7E6" stroke-width="1" stroke-dasharray="12 10"/>' +
      trees +

      // etiquetas de avenidas
      '<text class="map-street" x="600" y="230" transform="rotate(-90 600 230)" text-anchor="middle">AV. PRINCIPAL</text>' +
      '<text class="map-street" x="300" y="410" text-anchor="middle">AV. SAN LUCAS</text>' +
      '<text class="map-street" x="880" y="410" text-anchor="middle">AV. SAN LUCAS</text>' +

      houses +

      // garita principal (sur)
      '<rect x="556" y="762" width="68" height="20" rx="3" fill="#F5F9FD" stroke="#C4D2E4" stroke-width="2"/>' +
      '<rect x="546" y="756" width="14" height="30" rx="3" fill="#0F766E"/>' +
      '<rect x="620" y="756" width="14" height="30" rx="3" fill="#0F766E"/>' +
      '<circle class="pulse-ring" cx="590" cy="772" r="8" fill="none" stroke="#14B8A6" stroke-width="2"/>' +
      '<circle cx="590" cy="772" r="4" fill="#14B8A6"/>' +
      '<text class="map-gate-label" x="590" y="748" text-anchor="middle">INGRESO PRINCIPAL</text>' +

      // garita secundaria (oeste)
      '<rect x="22" y="380" width="14" height="12" rx="2" fill="#0F766E"/>' +
      '<rect x="22" y="416" width="14" height="12" rx="2" fill="#0F766E"/>' +
      '<text class="map-gate-label" x="46" y="376" style="font-size:8.5px">GARITA 2</text>' +

      '</svg>';
  }

  function render() {
    return '<section class="card map-card">' +
      '<div class="map-toolbar">' +
      '<div class="search" style="max-width:300px"><svg><use href="#i-search"/></svg>' +
      '<input class="input" id="mapSearch" placeholder="Buscar lote, residente o placa" autocomplete="off"></div>' +
      '<div class="spacer"></div>' +
      '<div class="map-legend">' +
      '<span><i class="legend-swatch" style="background:#fff"></i>Sin movimiento</span>' +
      '<span><i class="legend-swatch" style="background:#C7F5E4;border-color:#0D9488"></i>Vehículo dentro</span>' +
      '<span><i class="legend-swatch" style="background:#FDE9B8;border-color:#D97706"></i>Visita</span>' +
      '</div></div>' +
      '<div class="map-canvas" id="mapCanvas">' + svgMap() +
      '<div class="map-tip" id="mapTip"></div></div>' +
      '<div class="card-body row-between wrap" style="border-top:1px solid var(--line-2)">' +
      '<span class="hint">Toca un lote para ver residentes, vehículos y últimos accesos.</span>' +
      '<span class="pill pill-gray">100 lotes · 4 manzanas · 2 garitas</span>' +
      '</div></section>' +
      '<div class="stat-strip" style="margin-top:16px">' +
      '<div><strong>' + U.stats().dentro + '</strong><small>Vehículos dentro</small></div>' +
      '<div><strong>' + U.stats().visitasActivas + '</strong><small>Visitas activas</small></div>' +
      '<div><strong>' + DB.state.casas.filter((c) => c.estado !== 'desocupada').length + '</strong><small>Lotes habitados</small></div>' +
      '</div>';
  }

  function bind(root) {
    const canvas = root.querySelector('#mapCanvas');
    const tip = root.querySelector('#mapTip');
    let tipFor = null;

    canvas.addEventListener('mousemove', (e) => {
      const g = e.target.closest('.house');
      if (!g) { tip.classList.remove('is-on'); return; }
      const id = g.dataset.id;
      const casa = U.casa(id);
      if (!casa) return;
      const est = U.casaEstado(id);
      const res = U.residentesDe(id);
      const veh = U.vehiculosDe(id);
      if (tipFor !== id) {
        tipFor = id;
        tip.innerHTML = '<strong>' + id + '</strong> · ' + U.esc(casa.calle) + '<br>' +
          res.length + ' residente' + (res.length === 1 ? '' : 's') + ' · ' + veh.length + ' vehículo' + (veh.length === 1 ? '' : 's') + '<br>' +
          '<span style="opacity:.75">' + U.esc(est.label) + '</span>';
      }
      const r = canvas.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top = (e.clientY - r.top - 6) + 'px';
      tip.classList.add('is-on');
    });
    canvas.addEventListener('mouseleave', () => tip.classList.remove('is-on'));

    canvas.addEventListener('click', (e) => {
      const g = e.target.closest('.house');
      if (g) openHouse(g.dataset.id);
    });

    const search = root.querySelector('#mapSearch');
    search.addEventListener('input', () => {
      const q = U.normPlate(search.value);
      const raw = search.value.trim().toLowerCase();
      let hits = 0;
      canvas.querySelectorAll('.house').forEach((g) => {
        const casa = U.casa(g.dataset.id);
        const res = U.residentesDe(casa.id);
        const veh = U.vehiculosDe(casa.id);
        const match = !raw ||
          casa.id.toLowerCase().includes(raw) ||
          res.some((r) => r.nombre.toLowerCase().includes(raw)) ||
          veh.some((v) => U.normPlate(v.placa).includes(q));
        g.style.opacity = match ? '1' : '.22';
        if (match && raw) hits++;
      });
      tip.classList.remove('is-on');
      search.setAttribute('data-hits', hits);
    });
  }

  function openHouse(id) {
    const casa = U.casa(id);
    if (!casa) return;
    const res = U.residentesDe(id);
    const veh = U.vehiculosDe(id);
    const est = U.casaEstado(id);
    const eventos = DB.state.eventos.filter((e) => e.casaId === id).slice(0, 6);
    const { vehiculos } = U.abiertos();

    const resHtml = res.length ? res.map((r) =>
      '<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line-2)">' +
      '<span class="avatar" style="width:32px;height:32px;border-radius:9px;font-size:11px">' + U.esc(U.initials(r.nombre)) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">' + U.esc(r.nombre) + '</div>' +
      '<div style="font-size:11.5px;color:var(--muted)">' + U.esc(r.rol) +
      (App.role === 'admin' ? ' · ' + U.esc(r.telefono) : '') + '</div></div>' +
      (App.role === 'admin' ? '<span class="pill pill-gray">' + U.esc(r.doc ? 'DNI ' + r.doc.slice(-4) : '—') + '</span>' : '') + '</div>'
    ).join('') : '<p class="hint" style="padding:10px 0">Sin residentes registrados.</p>';

    const vehHtml = veh.length ? veh.map((v) => {
      const open = vehiculos.get('v:' + U.normPlate(v.placa));
      return '<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line-2)">' +
        '<span class="live-ico ' + (open ? 'in' : 'out') + '">' + U.icon(v.tipo === 'moto' ? 'moto' : 'car') + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600" class="mono">' + U.esc(v.placa) + '</div>' +
        '<div style="font-size:11.5px;color:var(--muted)">' + U.esc(v.marca + ' ' + v.modelo + ' · ' + v.color) + '</div></div>' +
        (open
          ? '<div style="text-align:right"><span class="pill pill-green">Dentro</span><div style="font-size:10.5px;color:var(--muted);margin-top:3px">' + U.dur((Date.now() - open.ts) / 60000) + '</div></div>'
          : '<span class="pill pill-gray">Fuera</span>') +
        '</div>';
    }).join('') : '<p class="hint" style="padding:10px 0">Sin vehículos registrados.</p>';

    const evHtml = eventos.length ? eventos.map((e) =>
      '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line-2);gap:9px">' +
      '<span class="live-ico ' + (e.sentido === 'in' ? 'in' : 'out') + '" style="width:26px;height:26px">' +
      U.icon(e.sentido === 'in' ? 'arrow' : 'logout') + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">' +
      U.esc(e.tipo === 'vehiculo' ? e.placa : e.nombre || 'Persona') + '</div>' +
      '<div style="font-size:11px;color:var(--muted)">' + U.esc(e.tipo === 'vehiculo' ? 'Vehículo' : e.tipo === 'visita' ? 'Visita' : 'Peatonal') +
      ' · ' + (e.sentido === 'in' ? 'entrada' : 'salida') + '</div></div>' +
      '<span style="font-size:11px;color:var(--muted-2);text-align:right">' + U.date(e.ts) + '<br>' + U.time(e.ts) + '</span></div>'
    ).join('') : '<p class="hint" style="padding:10px 0">Sin accesos registrados.</p>';

    UI.sheet({
      title: 'Lote ' + casa.id,
      sub: casa.calle + ' · Manzana ' + casa.mz + ' · Lote ' + String(casa.lote).padStart(2, '0'),
      body:
        '<div class="stat-strip" style="margin-bottom:18px">' +
        '<div><strong>' + res.length + '</strong><small>Residentes</small></div>' +
        '<div><strong>' + veh.length + '</strong><small>Vehículos</small></div>' +
        '<div><strong>' + (casa.metros || '—') + '</strong><small>m² de lote</small></div></div>' +
        '<div class="row-between" style="margin-bottom:8px"><h4 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Estado</h4>' +
        '<span class="pill ' + (est.key === 'inside' ? 'pill-green' : est.key === 'visit' ? 'pill-amber' : 'pill-gray') + '">' + U.esc(est.label) + '</span></div>' +
        '<h4 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 2px">Residentes</h4>' + resHtml +
        '<h4 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 2px">Vehículos</h4>' + vehHtml +
        '<h4 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 2px">Últimos accesos</h4>' + evHtml,
      foot: '<button class="btn btn-ghost" data-close>Cerrar</button>' +
        '<div class="spacer"></div>' +
        (App.role === 'guardia'
          ? '<button class="btn btn-soft" data-visita="' + id + '">Registrar visita</button>' +
            '<button class="btn btn-primary" data-house-access="' + id + '">Registrar acceso</button>'
          : '')
    });

    document.querySelectorAll('[data-visita]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.sheet-backdrop, .sheet').forEach((n) => n.remove());
      App.accesoModal({ tipo: 'visita', casaId: id });
    }));
    document.querySelectorAll('[data-house-access]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.sheet-backdrop, .sheet').forEach((n) => n.remove());
      App.accesoModal({ casaId: id });
    }));
  }

  function satelite() {
    const st = U.stats();
    return '<section class="card map-card">' +
      '<div class="card-head"><div><h3>Zona de la urbanización</h3>' +
      '<p>Av. de la Marina · UNFV · Parque Adrián Salas</p></div>' +
      '<div class="spacer"></div><span class="pill pill-green">Calles principales</span></div>' +
      '<div class="sat-wrap"><img class="sat-img" src="assets/img/zona-calles.png?v=2" ' +
      'alt="Vista aérea de la zona de la urbanización con las calles principales resaltadas"></div>' +
      '<div class="card-body row-between wrap" style="border-top:1px solid var(--line-2)">' +
      '<span class="hint">Vista de referencia: Antúnez de Mayolo, Robert Owen, C. Salaverry, C. San Marcos, C. San Lucas y Av. de la Marina.</span>' +
      '<a class="btn btn-ghost btn-sm" href="assets/img/zona-calles.png" target="_blank" rel="noopener">Abrir imagen</a>' +
      '</div></section>' +
      '<div class="stat-strip" style="margin-top:16px">' +
      '<div><strong>' + st.dentro + '</strong><small>Vehículos dentro</small></div>' +
      '<div><strong>' + st.visitasActivas + '</strong><small>Visitas activas</small></div>' +
      '<div><strong>6</strong><small>Calles principales</small></div>' +
      '</div>';
  }

  Views.mapa = function (root) {
    let mode = 'plano';
    root.innerHTML =
      '<div class="row-between wrap" style="margin-bottom:14px">' +
      '<p style="font-size:12.5px;color:var(--muted)">Plano de lotes en tiempo real y vista real de la zona.</p>' +
      '<div class="row wrap" style="gap:10px">' +
      '<div class="segmented" id="mapMode">' +
      '<button data-m="plano" class="is-active">Plano de lotes</button>' +
      '<button data-m="satelite">Zona satelital</button></div>' +
      '<span class="pill pill-green">' + U.stats().dentro + ' dentro</span>' +
      '<span class="pill pill-amber">' + U.stats().visitasActivas + ' visitas</span>' +
      '</div></div>' +
      '<div id="mapHost"></div>';

    const host = root.querySelector('#mapHost');

    function paint() {
      if (mode === 'plano') {
        host.innerHTML = render();
        bind(host);
      } else {
        host.innerHTML = satelite();
      }
      root.querySelectorAll('#mapMode button').forEach((b) => b.classList.toggle('is-active', b.dataset.m === mode));
    }

    root.querySelector('#mapMode').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-m]');
      if (!b) return;
      mode = b.dataset.m;
      paint();
    });

    paint();
  };

  Views.openHouse = openHouse;
})(window);
