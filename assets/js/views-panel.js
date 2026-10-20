/* ══════════════════════════════════════════════════════════
   views-panel.js — Dashboard operativo
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});

  function chart() {
    const bins = U.flujoPorHora();
    const W = 720, H = 180, base = 150, top = 22;
    const max = Math.max(1, ...bins.map((b) => b.in + b.out));
    const gw = 30, bw = 9;
    let bars = '', labels = '', grid = '';
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const y = base - (base - top) * f;
      grid += '<line x1="0" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) +
        '" stroke="#EEF2F8" stroke-width="1"/>';
    });
    bins.forEach((b, i) => {
      const x = 10 + i * gw;
      const hIn = (b.in / max) * (base - top);
      const hOut = (b.out / max) * (base - top);
      const xIn = x, xOut = x + bw + 1;
      bars += '<rect x="' + xIn + '" y="' + (base - hIn) + '" width="' + bw + '" height="' + Math.max(hIn, b.in ? 2 : 0) +
        '" rx="2" fill="#0D9488"><title>' + b.in + ' entradas a las ' + String(i).padStart(2, '0') + ':00</title></rect>';
      bars += '<rect x="' + xOut + '" y="' + (base - hOut) + '" width="' + bw + '" height="' + Math.max(hOut, b.out ? 2 : 0) +
        '" rx="2" fill="#C7D3E3"><title>' + b.out + ' salidas a las ' + String(i).padStart(2, '0') + ':00</title></rect>';
      if (i % 3 === 0) labels += '<text x="' + (x + bw) + '" y="' + (base + 16) + '" text-anchor="middle" font-size="9.5" fill="#8A99AD">' +
        String(i).padStart(2, '0') + ':00</text>';
    });
    return '<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Flujo vehicular por hora">' +
      grid + bars + labels + '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" stroke="#DDE5EF" stroke-width="1"/></svg></div>' +
      '<div class="chart-legend"><span class="legend-item"><i class="legend-dot" style="background:#0D9488"></i>Entradas</span>' +
      '<span class="legend-item"><i class="legend-dot" style="background:#C7D3E3"></i>Salidas</span>' +
      '<span class="legend-item" style="margin-left:auto">' + new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long' }) + '</span></div>';
  }

  function liveFeed() {
    const evs = DB.state.eventos.slice(0, 9);
    if (!evs.length) return UI.empty('clock', 'Sin movimientos', 'Aún no se registran accesos hoy.');
    return '<div class="live-list">' + evs.map((e) => {
      const isIn = e.sentido === 'in';
      const who = e.tipo === 'vehiculo' ? (e.placa || 'Vehículo') : (e.nombre || 'Persona');
      const sub = (e.tipo === 'vehiculo' ? (e.detalle || 'Vehículo') + ' · ' : '') + (e.casaId || '—') +
        (e.tipo === 'visita' ? ' · ' + (e.motivo || 'Visita') : '');
      return '<div class="live-item">' +
        '<span class="live-ico ' + (isIn ? 'in' : 'out') + '">' + U.icon(isIn ? 'arrow' : 'logout') + '</span>' +
        '<div class="live-main"><strong>' + U.esc(who) +
        (e.tipo === 'vehiculo' ? ' <span class="pill pill-gray" style="margin-left:4px">' + U.tipoLabel(e.tipo) + '</span>' : '') +
        '</strong><small>' + U.esc((isIn ? 'Entrada' : 'Salida') + ' · ' + sub) + '</small></div>' +
        '<span class="live-time">' + U.time(e.ts) + '<br>' + U.ago(e.ts) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function manzanas() {
    const { vehiculos } = U.abiertos();
    const rows = ['A', 'B', 'C', 'D'].map((k) => {
      const casas = DB.state.casas.filter((c) => c.mz === k);
      const veh = DB.state.vehiculos.filter((v) => casas.some((c) => c.id === v.casaId));
      const dentro = veh.filter((v) => vehiculos.has('v:' + U.normPlate(v.placa))).length;
      const pct = veh.length ? Math.round((dentro / veh.length) * 100) : 0;
      return { k, casas: casas.length, veh: veh.length, dentro, pct };
    });
    return '<div style="display:grid;gap:13px">' + rows.map((r) =>
      '<div><div class="row-between" style="margin-bottom:5px">' +
      '<span style="font-size:12.5px;font-weight:600">Manzana ' + r.k + '</span>' +
      '<span style="font-size:11.5px;color:var(--muted)">' + r.dentro + '/' + r.veh + ' dentro</span></div>' +
      '<div style="height:6px;border-radius:99px;background:#EEF2F7;overflow:hidden">' +
      '<div style="height:100%;width:' + r.pct + '%;border-radius:99px;background:linear-gradient(90deg,#14B8A6,#0F766E)"></div></div></div>'
    ).join('') + '</div>';
  }

  function alerts() {
    const st = U.stats();
    const list = [];
    const abiertos = U.estancias((t) => t.abierta);

    abiertos.filter((t) => t.tipo === 'vehiculo' && t.minutos > 8 * 60).slice(0, 2).forEach((t) => {
      list.push({ ico: 'car', t: 'Permanencia extendida', s: t.placa + ' · ' + t.casaId + ' lleva ' + U.dur(t.minutos) + ' dentro.' });
    });

    const limite = (DB.state.config.horasVisita || 4) * 60;
    abiertos.filter((t) => t.tipo === 'vehiculo' && t.autorizadoMin && t.minutos > t.autorizadoMin).slice(0, 2).forEach((t) => {
      list.push({ ico: 'clock', t: 'Ingreso temporal vencido', s: t.placa + ' en ' + t.casaId + ' · autorizado ' + U.dur(t.autorizadoMin) + ', lleva ' + U.dur(t.minutos) + '.' });
    });

    abiertos.filter((t) => t.tipo === 'visita' && t.minutos > limite).slice(0, 2).forEach((t) => {
      list.push({ ico: 'clock', t: 'Visita fuera de horario', s: (t.nombre || 'Visita') + ' en ' + t.casaId + ' · ' + U.dur(t.minutos) + '.' });
    });

    const desoc = DB.state.casas.filter((c) => c.estado === 'desocupada').length;
    if (desoc) list.push({ ico: 'home', t: 'Casas desocupadas', s: desoc + ' lotes sin residentes registrados.' });

    if (!list.length) {
      list.push({ ico: 'shield', t: 'Sin alertas', s: 'Todos los accesos están dentro de los parámetros normales.' });
    }
    return '<div>' + list.slice(0, 4).map((a) =>
      '<div class="alert-item"><span class="alert-ico">' + U.icon(a.ico) + '</span>' +
      '<div><strong>' + U.esc(a.t) + '</strong><small>' + U.esc(a.s) + '</small></div></div>'
    ).join('') + '</div>';
  }

  function quickActions() {
    if (App.role === 'guardia') {
      return '<div class="card-head"><div><h3>Acciones rápidas</h3><p>Operación de portería</p></div></div>' +
        '<div class="card-body"><div class="quick-grid">' +
        '<button class="quick-tile" data-act="entrada-vehiculo"><span class="qt-ico">' + U.icon('car') + '</span><strong>Vehículo</strong><small>Cámara + padrón</small></button>' +
        '<button class="quick-tile" data-act="entrada-persona"><span class="qt-ico">' + U.icon('users') + '</span><strong>Peatonal</strong><small>Residente o visita</small></button>' +
        '<button class="quick-tile" data-act="salida"><span class="qt-ico">' + U.icon('logout') + '</span><strong>Salida</strong><small>Buscar por placa</small></button>' +
        '<button class="quick-tile" data-view="mapa"><span class="qt-ico">' + U.icon('map') + '</span><strong>Mapa</strong><small>Calles, lotes y garitas</small></button>' +
        '</div></div>';
    }
    return '<div class="card-head"><div><h3>Acciones de administración</h3><p>Padrón y supervisión</p></div></div>' +
      '<div class="card-body"><div class="quick-grid">' +
      '<button class="quick-tile" data-act="nuevo-vehiculo"><span class="qt-ico">' + U.icon('car') + '</span><strong>Nuevo vehículo</strong><small>Alta en el padrón</small></button>' +
      '<button class="quick-tile" data-act="nuevo-residente"><span class="qt-ico">' + U.icon('users') + '</span><strong>Nuevo residente</strong><small>Alta en el padrón</small></button>' +
      '<button class="quick-tile" data-view="reportes"><span class="qt-ico">' + U.icon('chart') + '</span><strong>Reportes</strong><small>Accesos y permanencia</small></button>' +
      '<button class="quick-tile" data-view="mapa"><span class="qt-ico">' + U.icon('map') + '</span><strong>Mapa</strong><small>Lotes y garitas</small></button>' +
      '</div></div>';
  }

  Views.panel = function (root) {
    const st = U.stats();
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

    root.innerHTML =
      '<div class="row-between wrap" style="margin-bottom:14px">' +
      '<div><p style="font-size:12.5px;color:var(--muted)">' + saludo + ', ' + U.esc((DB.state.config.admin || '').split(' ')[0] || 'admin') + '. ' +
      'Esto es lo que pasa hoy en ' + U.esc(DB.state.config.nombre) + '.</p></div>' +
      '<span class="pill pill-green"><span class="gate-dot" style="width:6px;height:6px"></span>Sistema en línea</span>' +
      '</div>' +

      '<div class="kpi-grid">' +
      '<article class="kpi accent"><div class="kpi-top"><span class="kpi-label">Vehículos dentro</span>' +
      '<span class="kpi-ico">' + U.icon('car') + '</span></div>' +
      '<div class="kpi-value">' + st.dentro + '<small>/ ' + st.vehiculos + '</small></div>' +
      '<div class="kpi-foot">' + st.ocupacion + '% de la flota' +
      (st.temporalesDentro ? ' · ' + st.temporalesDentro + ' temporal' + (st.temporalesDentro > 1 ? 'es' : '') : '') +
      ' · ' + st.entradasHoy + ' entradas hoy</div></article>' +

      '<article class="kpi"><div class="kpi-top"><span class="kpi-label">Personas dentro</span>' +
      '<span class="kpi-ico">' + U.icon('users') + '</span></div>' +
      '<div class="kpi-value">' + st.personasDentro + '</div>' +
      '<div class="kpi-foot">' + st.habitantes + ' residentes registrados</div></article>' +

      '<article class="kpi"><div class="kpi-top"><span class="kpi-label">Visitas activas</span>' +
      '<span class="kpi-ico">' + U.icon('door') + '</span></div>' +
      '<div class="kpi-value">' + st.visitasActivas + '</div>' +
      '<div class="kpi-foot">' + st.eventosHoy + ' eventos registrados hoy</div></article>' +

      '<article class="kpi"><div class="kpi-top"><span class="kpi-label">Permanencia promedio</span>' +
      '<span class="kpi-ico">' + U.icon('time') + '</span></div>' +
      '<div class="kpi-value">' + U.durShort(st.permanencia) + '</div>' +
      '<div class="kpi-foot">Estancias vehiculares cerradas hoy</div></article>' +
      '</div>' +

      '<div class="grid grid-main" style="margin-top:16px">' +
      '<div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Flujo de accesos</h3><p>Entradas y salidas por hora · hoy</p></div>' +
      '<div class="spacer"></div><span class="pill pill-gray">' + st.eventosHoy + ' eventos</span></div>' + chart() + '</section>' +

      '<section class="card"><div class="card-head"><div><h3>Últimos movimientos</h3><p>Registro en vivo de la garita principal</p></div>' +
      '<div class="spacer"></div><button class="btn btn-ghost btn-sm" data-view="accesos">Ver todos</button></div>' +
      liveFeed() + '</section>' +
      '</div>' +

      '<div class="stack">' +
      '<section class="card">' + quickActions() + '</section>' +

      '<section class="card"><div class="card-head"><div><h3>Ocupación por manzana</h3><p>Vehículos dentro vs. registrados</p></div></div>' +
      '<div class="card-body">' + manzanas() + '</div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Alertas</h3><p>Requieren atención</p></div></div>' + alerts() + '</section>' +
      '</div></div>';
  };
})(window);
