/* ══════════════════════════════════════════════════════════
   core.js — Utilidades, selectores derivados y UI base
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const DAY = 86400000;

  /* ---------------- Formato ---------------- */
  const fmtTime = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDate = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' });
  const fmtFull = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  const U = {
    DAY,
    startOfDay,
    now: () => Date.now(),

    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    icon(name, cls) {
      return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
    },
    time(ts) { return fmtTime.format(new Date(ts)); },
    date(ts) { return fmtDate.format(new Date(ts)); },
    fullDate(ts) { return fmtFull.format(new Date(ts)); },
    dayLabel(ts) {
      const d = startOfDay(ts);
      const hoy = startOfDay(Date.now());
      if (d === hoy) return 'Hoy';
      if (d === hoy - DAY) return 'Ayer';
      return U.date(ts);
    },
    dateTime(ts) { return U.dayLabel(ts) + ' · ' + U.time(ts); },
    inputDate(ts) {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    ago(ts) {
      const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
      if (s < 45) return 'ahora';
      if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
      if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
      return 'hace ' + Math.round(s / 86400) + ' d';
    },
    dur(min) {
      if (min == null) return '—';
      const m = Math.max(0, Math.round(min));
      if (m < 60) return m + ' min';
      const h = Math.floor(m / 60);
      const r = m % 60;
      return h + ' h' + (r ? ' ' + r + ' min' : '');
    },
    durShort(min) {
      if (min == null) return '—';
      const m = Math.max(0, Math.round(min));
      if (m < 60) return m + 'm';
      return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    },
    normPlate(p) {
      return String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    },
    fmtPlate(p) {
      const raw = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^[A-Z]{3}[0-9]{3}$/.test(raw)) return raw.slice(0, 3) + '-' + raw.slice(3);
      return raw;
    },
    tipoLabel(t) {
      return t === 'persona' ? 'Peatonal' : t === 'visita' ? 'Visita' : 'Vehículo';
    },
    vehiculoLabel(t) {
      return ({ auto: 'Auto', moto: 'Moto', camioneta: 'Camioneta', camion: 'Camión', otro: 'Otro' })[t] || 'Vehículo';
    },
    iconoVehiculo(t) {
      return t === 'moto' ? 'moto' : (t === 'camion' || t === 'camioneta') ? 'truck' : 'car';
    },
    tipoVehiculoDe(e) {
      if (!e) return '';
      if (e.tipoVehiculo) return e.tipoVehiculo;
      const v = U.findVehiculo(e.placa);
      return v ? v.tipo : '';
    },
    tipoIcon(t) {
      return t === 'moto' ? 'moto' : t === 'persona' ? 'users' : t === 'visita' ? 'door' : 'car';
    },

    /* ------------- Acceso a datos ------------- */
    get s() { return DB.state; },
    casa(id) { return DB.state.casas.find((c) => c.id === id); },
    residente(id) { return DB.state.residentes.find((r) => r.id === id); },
    vehiculo(id) { return DB.state.vehiculos.find((v) => v.id === id); },
    residentesDe(casaId) { return DB.state.residentes.filter((r) => r.casaId === casaId && r.activo !== false); },
    vehiculosDe(casaId) { return DB.state.vehiculos.filter((v) => v.casaId === casaId && v.activo !== false); },

    findVehiculo(placa) {
      const n = U.normPlate(placa);
      if (!n) return null;
      const exact = DB.state.vehiculos.find((v) => U.normPlate(v.placa) === n);
      if (exact) return exact;
      return DB.state.vehiculos.find((v) => U.normPlate(v.placa).endsWith(n) || n.endsWith(U.normPlate(v.placa))) || null;
    },

    /* Estado abierto (dentro de la urb) por placa y por persona */
    abiertos() {
      const evs = DB.state.eventos;
      const key = evs.length + ':' + (evs[0] ? evs[0].id : '');
      if (U._cacheOpen && U._cacheOpen.key === key) return U._cacheOpen.val;
      const insideV = new Map();
      const insideP = new Map();
      const seen = new Set();
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        const k = e.tipo === 'vehiculo' ? 'v:' + U.normPlate(e.placa) : e.tipo === 'persona' ? 'p:' + (e.personaId || e.nombre) : null;
        if (!k || seen.has(k)) continue; // el evento más reciente manda
        seen.add(k);
        if (e.sentido !== 'in') continue;
        const map = e.tipo === 'vehiculo' ? insideV : insideP;
        map.set(k, e);
      }
      U._cacheOpen = { key, val: { vehiculos: insideV, personas: insideP } };
      return U._cacheOpen.val;
    },

    visitasPorCasa() {
      const evs = DB.state.eventos;
      const key = evs.length + ':' + (evs[0] ? evs[0].id : '');
      if (U._cacheVis && U._cacheVis.key === key) return U._cacheVis.val;
      const map = {};
      const seen = new Set();
      for (var i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (e.tipo !== 'visita') continue;
        const k = 'x:' + (e.nombre || '') + '|' + (e.casaId || '');
        if (seen.has(k)) continue;
        seen.add(k);
        if (e.sentido === 'in') map[e.casaId] = (map[e.casaId] || 0) + 1;
      }
      U._cacheVis = { key, val: map };
      return map;
    },

    dentroVehiculo(placa) {
      const { vehiculos } = U.abiertos();
      return vehiculos.get('v:' + U.normPlate(placa)) || null;
    },

    restante(e) {
      if (!e || !e.autorizadoMin) return null;
      const limite = e.ts + e.autorizadoMin * 60000;
      const ms = limite - Date.now();
      return { limite, ms, excedido: ms < 0, min: Math.abs(ms) / 60000 };
    },

    /* Empareja entradas/salidas en "estancias" */
    estancias(filter) {
      const evs = DB.state.eventos.slice().sort((a, b) => a.ts - b.ts);
      const open = new Map();
      const out = [];
      for (const e of evs) {
        const key = e.tipo === 'vehiculo' ? 'v:' + U.normPlate(e.placa)
          : e.tipo === 'persona' ? 'p:' + (e.personaId || e.nombre)
            : 'x:' + (e.nombre || '') + '|' + (e.casaId || '');
        if (e.sentido === 'in') {
          if (open.has(key)) {
            const prev = open.get(key);
            out.push(makeTrip(prev, null, key));
          }
          open.set(key, e);
        } else {
          const ini = open.get(key);
          if (ini) { out.push(makeTrip(ini, e, key)); open.delete(key); }
        }
      }
      open.forEach((ini, key) => out.push(makeTrip(ini, null, key)));

      function makeTrip(ini, fin, key) {
        return {
          key,
          tipo: ini.tipo,
          placa: ini.placa || '',
          nombre: ini.nombre || '',
          casaId: ini.casaId || '',
          motivo: ini.motivo || '',
          entrada: ini.ts,
          salida: fin ? fin.ts : null,
          minutos: fin ? (fin.ts - ini.ts) / 60000 : (Date.now() - ini.ts) / 60000,
          abierta: !fin,
          metodo: ini.metodo,
          temporal: !!ini.temporal,
          autorizadoMin: ini.autorizadoMin || null
        };
      }
      let list = out.sort((a, b) => b.entrada - a.entrada);
      if (filter) list = list.filter(filter);
      return list;
    },

    stats() {
      const s = DB.state;
      const hoy = startOfDay(Date.now());
      const { vehiculos: iv, personas: ip } = U.abiertos();
      const evHoy = s.eventos.filter((e) => e.ts >= hoy);
      const dentro = iv.size;
      const personasDentro = ip.size;
      let temporalesDentro = 0;
      let temporalesExcedidos = 0;
      iv.forEach((e) => {
        if (e.temporal) temporalesDentro++;
        if (e.autorizadoMin && Date.now() > e.ts + e.autorizadoMin * 60000) temporalesExcedidos++;
      });
      const estanciasHoy = U.estancias((t) => !t.abierta && t.entrada >= hoy && t.tipo === 'vehiculo');
      const prom = estanciasHoy.length
        ? estanciasHoy.reduce((a, t) => a + t.minutos, 0) / estanciasHoy.length : 0;
      const visitasActivas = U.estancias((t) => t.abierta && t.tipo === 'visita').length;
      const aforo = s.casas.length;
      return {
        casas: s.casas.length,
        habitantes: s.residentes.filter((r) => r.activo !== false).length,
        vehiculos: s.vehiculos.filter((v) => v.activo !== false).length,
        dentro,
        temporalesDentro,
        temporalesExcedidos,
        personasDentro,
        visitasActivas,
        eventosHoy: evHoy.length,
        entradasHoy: evHoy.filter((e) => e.sentido === 'in').length,
        salidasHoy: evHoy.filter((e) => e.sentido === 'out').length,
        permanencia: prom,
        ocupacion: aforo ? Math.min(100, Math.round((dentro / Math.max(1, s.vehiculos.length)) * 100)) : 0,
        aforo
      };
    },

    flujoPorHora() {
      const hoy = startOfDay(Date.now());
      const bins = Array.from({ length: 24 }, () => ({ in: 0, out: 0 }));
      DB.state.eventos.forEach((e) => {
        if (e.ts < hoy) return;
        const h = new Date(e.ts).getHours();
        if (e.sentido === 'in') bins[h].in++; else bins[h].out++;
      });
      return bins;
    },

    casaEstado(casaId) {
      const { vehiculos } = U.abiertos();
      const vs = U.vehiculosDe(casaId);
      const dentro = vs.filter((v) => vehiculos.has('v:' + U.normPlate(v.placa))).length;
      const visitas = U.visitasPorCasa()[casaId] || 0;
      if (visitas) return { key: 'visit', label: 'Visita en curso', dentro };
      if (dentro) return { key: 'inside', label: dentro + ' vehículo' + (dentro > 1 ? 's' : '') + ' dentro', dentro };
      const c = U.casa(casaId);
      if (c && c.estado === 'desocupada') return { key: 'empty', label: 'Desocupada', dentro: 0 };
      return { key: 'normal', label: 'Sin movimiento', dentro: 0 };
    },

    initials(name) {
      return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    },

    downloadCSV(filename, rows) {
      const csv = rows.map((r) => r.map((c) => {
        const v = String(c == null ? '' : c);
        return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };

  /* ---------------- UI base ---------------- */
  const UI = {
    toast(msg, isErr) {
      const el = document.getElementById('toast');
      el.className = 'toast' + (isErr ? ' err' : '');
      el.innerHTML = U.icon(isErr ? 'x' : 'check') + '<span>' + U.esc(msg) + '</span>';
      el.classList.add('is-on');
      clearTimeout(UI._t);
      UI._t = setTimeout(() => el.classList.remove('is-on'), 2600);
    },

    modal(opts) {
      const root = document.getElementById('modalRoot');
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML =
        '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><div style="flex:1"><h3>' + U.esc(opts.title) + '</h3>' +
        (opts.sub ? '<p>' + U.esc(opts.sub) + '</p>' : '') + '</div>' +
        '<button class="icon-btn" data-close aria-label="Cerrar">' + U.icon('x') + '</button></div>' +
        '<div class="modal-body">' + opts.body + '</div>' +
        (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') +
        '</div>';
      root.appendChild(wrap);
      const close = () => { wrap.remove(); if (opts.onClose) opts.onClose(); };
      wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
      if (opts.onMount) opts.onMount(wrap, close);
      const first = wrap.querySelector('input, select, textarea');
      if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 60);
      return close;
    },

    sheet(opts) {
      const root = document.getElementById('sheetRoot');
      const back = document.createElement('div');
      back.className = 'sheet-backdrop';
      const panel = document.createElement('aside');
      panel.className = 'sheet';
      panel.innerHTML =
        '<div class="sheet-head"><div style="flex:1"><h3>' + U.esc(opts.title) + '</h3>' +
        (opts.sub ? '<p>' + U.esc(opts.sub) + '</p>' : '') + '</div>' +
        '<button class="icon-btn" data-close aria-label="Cerrar">' + U.icon('x') + '</button></div>' +
        '<div class="sheet-body">' + opts.body + '</div>' +
        (opts.foot ? '<div class="sheet-foot">' + opts.foot + '</div>' : '') + '</aside>';
      root.appendChild(back);
      root.appendChild(panel);
      const close = () => { back.remove(); panel.remove(); };
      back.addEventListener('click', close);
      panel.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
      if (opts.onMount) opts.onMount(panel, close);
      return close;
    },

    empty(icon, title, text) {
      return '<div class="empty"><div class="empty-ico">' + U.icon(icon) + '</div>' +
        '<h4>' + U.esc(title) + '</h4><p>' + U.esc(text) + '</p></div>';
    }
  };

  global.U = U;
  global.UI = UI;
})(window);
