/* ══════════════════════════════════════════════════════════
   views-access.js — Garita: entradas, salidas y visitas
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});

  function casaOptions(selected) {
    const byMz = {};
    DB.state.casas.forEach((c) => { (byMz[c.mz] = byMz[c.mz] || []).push(c); });
    return Object.keys(byMz).sort().map((k) =>
      '<optgroup label="Manzana ' + k + '">' + byMz[k].map((c) =>
        '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + c.id + ' · ' + U.esc(c.calle) + '</option>'
      ).join('') + '</optgroup>'
    ).join('');
  }

  function residentOptions(selected) {
    return DB.state.residentes.filter((r) => r.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((r) => '<option value="' + r.id + '"' + (r.id === selected ? ' selected' : '') + '>' +
        U.esc(r.nombre) + ' — ' + r.casaId + '</option>').join('');
  }

  /* ---------- Helpers de tiempo autorizado ---------- */
  function restante(e) {
    const limite = e.ts + e.autorizadoMin * 60000;
    const ms = limite - Date.now();
    return { limite, ms, excedido: ms < 0, min: Math.abs(ms) / 60000 };
  }

  function registrarSalida(placa) {
    const open = U.dentroVehiculo(placa);
    if (!open) { UI.toast('El vehículo no está dentro', true); return; }
    const v = U.findVehiculo(placa);
    const min = (Date.now() - open.ts) / 60000;
    DB.addEvento({
      ts: Date.now(), sentido: 'out', tipo: 'vehiculo', placa,
      vehiculoId: v ? v.id : null,
      casaId: open.casaId || (v ? v.casaId : ''),
      nombre: v ? v.residente : open.nombre,
      metodo: 'manual', temporal: !!open.temporal,
      detalle: v ? v.marca + ' ' + v.modelo : 'Ingreso temporal'
    });
    let msg = 'Salida · permanencia ' + U.dur(min);
    if (open.autorizadoMin) {
      const diff = min - open.autorizadoMin;
      msg += diff > 0 ? ' · excedió ' + U.dur(diff) : ' · dentro de lo autorizado';
    }
    UI.toast(msg);
    App.refresh();
  }

  /* ---------- Formulario: vehículo ---------- */
  function formVehiculo(host, pre) {
    pre = pre || {};
    const isTaxi = !!pre.taxi;
    let metodo = 'manual';
    let foto = null;

    host.innerHTML =
      '<form id="fVeh" novalidate>' +
      '<button type="button" class="scan-btn" id="fCam">' +
      '<span class="scan-ico">' + U.icon('scan') + '</span>' +
      '<span class="scan-text"><strong>Escanear placa del vehículo</strong>' +
      '<small>Foto automática · lectura OCR · cotejo con el padrón</small></span>' +
      '<span class="scan-arrow">' + U.icon('arrow') + '</span>' +
      '</button>' +
      '<div class="or-line"><span>o escribe la placa</span></div>' +
      '<input class="input mono plate-input" id="fPlaca" maxlength="8" placeholder="ABC-123" autocomplete="off" spellcheck="false" value="' + U.esc(pre.placa || '') + '">' +
      '<div id="fotoBox" class="foto-prev" hidden></div>' +
      '<div id="matchBox" style="margin-top:12px"></div>' +
      '<div id="extraBox" style="margin-top:12px"></div>' +
      '<div id="submitBox" style="margin-top:16px"></div>' +
      '</form>';

    const input = host.querySelector('#fPlaca');
    const matchBox = host.querySelector('#matchBox');
    const extraBox = host.querySelector('#extraBox');
    const submitBox = host.querySelector('#submitBox');
    let current = { val: '', match: null, abierto: null };

    function paintFoto() {
      const box = host.querySelector('#fotoBox');
      if (!box) return;
      if (!foto) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      box.innerHTML = '<img src="' + foto + '" alt="Captura del vehículo">' +
        '<div style="flex:1;min-width:0"><strong>Foto capturada</strong>' +
        '<small>Se adjunta al movimiento</small></div>' +
        '<button type="button" class="icon-btn" id="fotoX" aria-label="Quitar foto">' + U.icon('x') + '</button>';
      box.querySelector('#fotoX').addEventListener('click', () => { foto = null; paintFoto(); });
    }

    function tempForm() {
      return '<div class="form-grid">' +
        '<div class="field"><label>Casa destino</label><select class="select" id="fCasa">' + casaOptions(pre.casaId) + '</select></div>' +
        '<div class="field"><label>Motivo</label><select class="select" id="fMotivo">' +
        ['Delivery', 'Visita', 'Servicio técnico', 'Proveedor', 'Otro']
          .map((m) => '<option>' + m + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Tipo de vehículo</label><select class="select" id="fTipo">' +
        '<option value="auto">Auto</option>' +
        '<option value="moto">Moto</option>' +
        '<option value="camioneta">Camioneta</option>' +
        '<option value="camion">Camión</option>' +
        '<option value="otro">Otro</option>' +
        '</select></div>' +
        '<div class="field"><label>Tiempo autorizado</label><select class="select" id="fTiempo">' +
        '<option value="30">30 minutos</option>' +
        '<option value="60" selected>1 hora</option>' +
        '<option value="120">2 horas</option>' +
        '<option value="240">4 horas</option>' +
        '<option value="480">8 horas</option>' +
        '</select></div>' +
        '<div class="field"><label>Referencia</label><input class="input" id="fNombre" placeholder="Nombre o empresa (opcional)"></div>' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">Se registra como <strong>temporal</strong>: no se agrega al padrón y se controla por tiempo autorizado.</p>';
    }

    function taxiForm() {
      return '<div class="taxi-note">' + U.icon('car') +
        '<div><strong>Ingreso de taxi</strong><small>Estancia máxima 30 min · mínimo 10 min</small></div></div>' +
        '<div class="form-grid" style="margin-top:12px">' +
        '<div class="field"><label>Casa destino</label><select class="select" id="fCasa">' + casaOptions(pre.casaId) + '</select></div>' +
        '<div class="field"><label>Referencia</label><input class="input" id="fNombre" placeholder="Empresa o conductor (opcional)"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px"><label>Tiempo autorizado <span class="range-val" id="fTiempoVal">20 min</span></label>' +
        '<input type="range" class="range" id="fTiempo" min="10" max="30" step="5" value="20">' +
        '<div class="range-scale"><span>10 min</span><span>30 min</span></div></div>';
    }

    function paint() {
      const val = U.fmtPlate(input.value);
      const match = (!isTaxi && val.length >= 4) ? U.findVehiculo(val) : null;
      const abierto = val.length >= 4 ? U.dentroVehiculo(val) : null;
      current = { val, match, abierto };

      if (match) {
        const casa = U.casa(match.casaId);
        matchBox.innerHTML =
          '<div class="card" style="border-color:' + (abierto ? '#FCD9A4' : '#C7F0E6') + ';background:' + (abierto ? '#FFFAF0' : '#F7FEFC') + '">' +
          '<div class="card-body" style="display:flex;gap:12px;align-items:center;padding:13px 14px">' +
          '<span class="live-ico ' + (abierto ? 'out' : 'in') + '">' + U.icon(U.iconoVehiculo(match.tipo)) + '</span>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:14px" class="mono">' + U.esc(match.placa) + '</div>' +
          '<div style="font-size:12px;color:var(--muted)">' + U.esc(match.marca + ' ' + match.modelo + ' · ' + match.color) + '</div>' +
          '<div style="font-size:12px;color:var(--ink-2);margin-top:2px"><strong>' + U.esc(match.residente) + '</strong> · ' + U.esc(casa ? casa.id + ' ' + casa.calle : match.casaId) + '</div>' +
          '</div>' +
          (abierto
            ? '<div style="text-align:right"><span class="pill pill-amber">Dentro</span><div style="font-size:11px;color:var(--muted);margin-top:3px">' + U.dur((Date.now() - abierto.ts) / 60000) + '</div></div>'
            : '<span class="pill pill-green">Padrón</span>') +
          '</div></div>';
        extraBox.innerHTML = '';
        submitBox.innerHTML = '<button class="btn ' + (abierto ? 'btn-ghost' : 'btn-primary') + ' btn-xl btn-block" type="submit">' +
          (abierto ? 'Registrar salida' : 'Registrar entrada') + '</button>';
        return;
      }

      if (abierto) {
        const r = restante(abierto);
        const late = r && r.excedido;
        matchBox.innerHTML =
          '<div class="card temp-card">' +
          '<div class="card-body" style="display:flex;gap:12px;align-items:center;padding:13px 14px">' +
          '<span class="live-ico out">' + U.icon('clock') + '</span>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:14px" class="mono">' + U.esc(abierto.placa) + '</div>' +
          '<div style="font-size:12px;color:var(--muted)">' + U.esc(abierto.nombre || 'Ingreso temporal') + ' · ' + U.esc(abierto.motivo || 'Temporal') + '</div>' +
          '<div style="font-size:12px;color:var(--ink-2);margin-top:2px">Casa ' + U.esc(abierto.casaId || '—') + ' · autorizado ' + U.dur(abierto.autorizadoMin) + '</div>' +
          '</div>' +
          '<div style="text-align:right"><span class="pill ' + (late ? 'pill-red' : 'pill-amber') + '">' +
          (late ? 'Excedido ' + U.dur(r.min) : 'Quedan ' + U.dur(r ? r.min : 0)) + '</span>' +
          '<div style="font-size:10.5px;color:var(--muted);margin-top:3px">desde ' + U.time(abierto.ts) + '</div></div>' +
          '</div></div>';
        extraBox.innerHTML = '';
        submitBox.innerHTML = '<button class="btn btn-ghost btn-xl btn-block" type="submit">Registrar salida</button>';
        return;
      }

      if (val.length >= 4) {
        matchBox.innerHTML = isTaxi
          ? ''
          : '<div class="card temp-card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;align-items:center">' +
            '<span class="alert-ico">' + U.icon('bell') + '</span>' + '<div><strong style="font-size:12.5px">Vehículo no registrado en el padrón</strong>' +
            '<div style="font-size:11.5px;color:var(--muted)">Registra un ingreso temporal con tiempo autorizado.</div></div></div></div>';
        extraBox.innerHTML = isTaxi ? taxiForm() : tempForm();
        const range = extraBox.querySelector('#fTiempo');
        if (range) {
          range.addEventListener('input', () => {
            const lbl = extraBox.querySelector('#fTiempoVal');
            if (lbl) lbl.textContent = range.value + ' min';
          });
        }
        submitBox.innerHTML = '<button class="btn btn-temp btn-xl btn-block" type="submit">' +
          U.icon('clock', 'btn-ico') + (isTaxi ? 'Registrar ingreso de taxi' : 'Registrar ingreso temporal') + '</button>';
        return;
      }

      matchBox.innerHTML = '';
      extraBox.innerHTML = '';
      submitBox.innerHTML = '';
    }

    input.addEventListener('input', () => {
      metodo = 'manual';
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      input.setSelectionRange(pos, pos);
      paint();
    });
    input.addEventListener('blur', () => { input.value = U.fmtPlate(input.value); paint(); });

    host.querySelector('#fCam').addEventListener('click', () => {
      Camera.open({
        auto: true,
        onResult: (placa, meta) => {
          metodo = 'camara';
          foto = (meta && meta.foto) || null;
          input.value = placa;
          paint();
          paintFoto();
          input.focus();
        }
      });
    });

    host.querySelector('#fVeh').addEventListener('submit', (e) => {
      e.preventDefault();
      const st = current;
      if (U.normPlate(st.val).length < 5) {
        UI.toast('Ingresa una placa válida', true);
        input.focus();
        return;
      }

      if (st.abierto) { registrarSalida(st.val); return; }

      if (st.match) {
        DB.addEvento({
          ts: Date.now(), sentido: 'in', tipo: 'vehiculo',
          placa: st.match.placa, vehiculoId: st.match.id, casaId: st.match.casaId,
          nombre: st.match.residente, metodo,
          tipoVehiculo: st.match.tipo,
          foto: foto || null,
          detalle: st.match.marca + ' ' + st.match.modelo
        });
        UI.toast('Entrada registrada · ' + st.match.placa + ' · ' + st.match.casaId);
        App.refresh();
        return;
      }

      const casaSel = host.querySelector('#fCasa');
      const motivoSel = host.querySelector('#fMotivo');
      const tipoSel = host.querySelector('#fTipo');
      const tiempoSel = host.querySelector('#fTiempo');
      const nombreInp = host.querySelector('#fNombre');
      if (!casaSel || !casaSel.value) { UI.toast('Selecciona la casa destino', true); return; }

      const autorizadoMin = isTaxi
        ? Math.min(30, Math.max(10, Number(tiempoSel.value) || 20))
        : (Number(tiempoSel.value) || 60);
      const motivo = isTaxi ? 'Taxi' : (motivoSel ? motivoSel.value : 'Temporal');
      DB.addEvento({
        ts: Date.now(), sentido: 'in', tipo: 'vehiculo',
        placa: st.val, vehiculoId: null, casaId: casaSel.value,
        nombre: (nombreInp && nombreInp.value.trim()) || (isTaxi ? 'Taxi' : 'Sin identificar'),
        metodo, temporal: true, autorizadoMin,
        tipoVehiculo: isTaxi ? 'auto' : (tipoSel ? tipoSel.value : 'auto'),
        foto: foto || null,
        motivo,
        detalle: (isTaxi ? 'Taxi · ' : 'Temporal · ') + motivo
      });
      UI.toast('Ingreso temporal · ' + U.dur(autorizadoMin) + ' autorizados');
      App.refresh();
    });

    paint();
  }

  /* ---------- Formulario: residente ---------- */
  function formPersona(host) {
    host.innerHTML =
      '<form id="fPer" novalidate>' +
      '<div class="field"><label>Residente</label><select class="select" id="pSel">' +
      '<option value="">Buscar residente del padrón…</option>' + residentOptions() + '</select></div>' +
      '<div id="pInfo" style="margin-top:12px"></div>' +
      '<div class="segmented" style="margin-top:14px" id="pSentido">' +
      '<button type="button" class="is-active" data-v="in">Entrada</button>' +
      '<button type="button" data-v="out">Salida</button></div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit" style="margin-top:16px">' + U.icon('check', 'btn-ico') + 'Registrar movimiento</button>' +
      '</form>';

    let sentido = 'in';
    const sel = host.querySelector('#pSel');
    const info = host.querySelector('#pInfo');

    function paint() {
      const r = U.residente(sel.value);
      if (!r) { info.innerHTML = ''; return; }
      const casa = U.casa(r.casaId);
      const open = U.abiertos().personas.get('p:' + r.id);
      info.innerHTML = '<div class="card" style="background:#F8FBFE"><div class="card-body" style="padding:12px 14px;display:flex;gap:11px;align-items:center">' +
        '<span class="avatar" style="width:34px;height:34px;border-radius:10px">' + U.esc(U.initials(r.nombre)) + '</span>' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + U.esc(r.nombre) + '</div>' +
        '<div style="font-size:11.5px;color:var(--muted)">' + U.esc(r.rol) + ' · ' + U.esc(casa ? casa.id + ' ' + casa.calle : r.casaId) + '</div></div>' +
        (open ? '<span class="pill pill-amber">Dentro</span>' : '<span class="pill pill-gray">Fuera</span>') +
        '</div></div>';
    }

    sel.addEventListener('change', paint);
    host.querySelector('#pSentido').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      sentido = b.dataset.v;
      host.querySelectorAll('#pSentido button').forEach((x) => x.classList.toggle('is-active', x === b));
    });

    host.querySelector('#fPer').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = U.residente(sel.value);
      if (!r) { UI.toast('Selecciona un residente', true); return; }
      DB.addEvento({
        ts: Date.now(), sentido, tipo: 'persona', nombre: r.nombre,
        personaId: r.id, casaId: r.casaId, metodo: 'manual', detalle: 'Residente · ' + r.rol
      });
      UI.toast((sentido === 'in' ? 'Entrada' : 'Salida') + ' registrada · ' + r.nombre);
      App.refresh();
    });
  }

  /* ---------- Formulario: visita ---------- */
  function formVisita(host, pre) {
    pre = pre || {};
    host.innerHTML =
      '<form id="fVis" novalidate>' +
      '<div class="form-grid">' +
      '<div class="field col-2"><label>Nombre del visitante</label><input class="input" id="vNombre" placeholder="Nombre y apellido"></div>' +
      '<div class="field"><label>Casa destino</label><select class="select" id="vCasa">' + casaOptions(pre.casaId) + '</select></div>' +
      '<div class="field"><label>Motivo</label><select class="select" id="vMotivo">' +
      ['Visita familiar', 'Delivery', 'Servicio técnico', 'Visita a residente', 'Proveedor', 'Taxi / app']
        .map((m) => '<option>' + m + '</option>').join('') + '</select></div>' +
      '<div class="field col-2"><label>Placa (opcional)</label>' +
      '<div class="row" style="gap:8px"><input class="input mono" id="vPlaca" maxlength="8" placeholder="ABC-123" style="text-transform:uppercase;letter-spacing:.1em">' +
      '<button type="button" class="btn btn-ghost" id="vCam" style="height:42px;flex:none">' + U.icon('camera', 'btn-ico') + '</button></div></div>' +
      '<div class="field col-2"><label>Observación</label><input class="input" id="vNota" placeholder="Opcional"></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit" style="margin-top:16px">' + U.icon('arrow', 'btn-ico') + 'Registrar ingreso de visita</button>' +
      '<p class="hint" style="margin-top:8px">Las visitas se controlan por tiempo máximo de ' + (DB.state.config.horasVisita || 4) + ' horas.</p>' +
      '</form>';

    host.querySelector('#vCam').addEventListener('click', () => {
      Camera.open({ onResult: (p) => { host.querySelector('#vPlaca').value = p; } });
    });

    host.querySelector('#fVis').addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = host.querySelector('#vNombre').value.trim();
      const casaId = host.querySelector('#vCasa').value;
      const motivo = host.querySelector('#vMotivo').value;
      const placa = U.fmtPlate(host.querySelector('#vPlaca').value);
      if (!nombre) { UI.toast('Ingresa el nombre del visitante', true); return; }
      if (!casaId) { UI.toast('Selecciona la casa destino', true); return; }

      DB.addEvento({
        ts: Date.now(), sentido: 'in', tipo: 'visita', nombre, casaId,
        placa, motivo, metodo: placa ? 'placa' : 'manual', detalle: motivo,
        nota: host.querySelector('#vNota').value.trim()
      });
      UI.toast('Visita registrada · ' + nombre + ' → ' + casaId);
      App.refresh();
    });
  }

  /* ---------- Modal de acceso (desde panel o mapa) ---------- */
  function accesoModal(opts) {
    opts = opts || {};
    const tab = opts.tipo === 'visita' ? 'visita' : opts.tipo === 'persona' ? 'persona' : opts.tipo === 'taxi' ? 'taxi' : 'vehiculo';
    let current = tab;

    const close = UI.modal({
      title: 'Registrar acceso',
      sub: opts.casaId ? 'Lote ' + opts.casaId + ' · garita principal' : 'Garita principal · ' + U.esc(DB.state.config.nombre),
      wide: true,
      body: '<div class="segmented" id="accTabsModal" style="margin-bottom:16px">' +
        '<button data-t="vehiculo"' + (tab === 'vehiculo' ? ' class="is-active"' : '') + '>Vehículo</button>' +
        '<button data-t="taxi"' + (tab === 'taxi' ? ' class="is-active"' : '') + '>Taxi</button>' +
        '<button data-t="persona"' + (tab === 'persona' ? ' class="is-active"' : '') + '>Residente</button>' +
        '<button data-t="visita"' + (tab === 'visita' ? ' class="is-active"' : '') + '>Visita</button></div>' +
        '<div id="accHost"></div>',
      onMount(wrap, closeFn) {
        const host = wrap.querySelector('#accHost');
        const paint = () => {
          if (current === 'vehiculo') formVehiculo(host, { casaId: opts.casaId });
          if (current === 'taxi') formVehiculo(host, { casaId: opts.casaId, taxi: true });
          if (current === 'persona') formPersona(host);
          if (current === 'visita') formVisita(host, { casaId: opts.casaId });
        };
        paint();
        wrap.querySelector('#accTabsModal').addEventListener('click', (e) => {
          const b = e.target.closest('button[data-t]');
          if (!b) return;
          current = b.dataset.t;
          wrap.querySelectorAll('#accTabsModal button').forEach((x) => x.classList.toggle('is-active', x === b));
          paint();
        });
        void closeFn;
      }
    });
    void close;
  }

  /* ---------- Modal de salida rápida ---------- */
  function salidaModal() {
    const evs = [];
    U.abiertos().vehiculos.forEach((e) => evs.push(e));
    evs.sort((x, y) => x.ts - y.ts);

    const rows = evs.length ? evs.map((e) => {
      const v = U.findVehiculo(e.placa);
      const temporal = !v || e.temporal;
      const r = e.autorizadoMin ? restante(e) : null;
      const late = r && r.excedido;
      return '<button class="row" data-out="' + U.esc(e.placa) + '" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-2);padding:11px 4px;cursor:pointer;text-align:left">' +
        '<span class="live-ico ' + (temporal ? 'out' : 'in') + '">' + U.icon(U.iconoVehiculo(v ? v.tipo : (e.tipoVehiculo || ''))) + '</span>' +
        '<div style="flex:1"><div style="font-weight:600;font-size:13px" class="mono">' + U.esc(e.placa) + '</div>' +
        '<div style="font-size:11.5px;color:var(--muted)">' + U.esc(v ? v.residente : e.nombre || 'Temporal') + ' · ' + U.esc(e.casaId || '—') +
        (temporal ? ' · Temporal' : '') + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:12px;font-weight:600">' + U.dur((Date.now() - e.ts) / 60000) + '</div>' +
        '<div style="font-size:10.5px;color:' + (late ? 'var(--red)' : 'var(--muted)') + '">' +
        (late ? 'Excedido ' + U.dur(r.min) : r ? 'Quedan ' + U.dur(r.min) : U.time(e.ts)) + '</div></div>' +
        '<span class="btn btn-soft btn-sm" style="margin-left:6px">Salida</span></button>';
    }).join('') : UI.empty('car', 'No hay vehículos dentro', 'Todos los vehículos registrados están fuera de la urbanización.');

    UI.modal({
      title: 'Registrar salida',
      sub: 'Vehículos dentro de la urbanización ahora',
      wide: true,
      body: '<div class="search" style="max-width:100%;margin-bottom:10px"><svg><use href="#i-search"/></svg>' +
        '<input class="input" id="outSearch" placeholder="Buscar placa, residente o casa"></div><div id="outList">' + rows + '</div>',
      onMount(wrap, close) {
        wrap.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-out]');
          if (!btn) return;
          const placa = btn.dataset.out;
          close();
          registrarSalida(placa);
        });
        wrap.querySelector('#outSearch').addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase();
          wrap.querySelectorAll('[data-out]').forEach((btn) => {
            btn.style.display = btn.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        });
      }
    });
  }

  function soloLectura() {
    const st = U.stats();
    return '<section class="card" style="margin-bottom:16px"><div class="card-body row" style="gap:12px">' +
      '<span class="kpi-ico">' + U.icon('shield') + '</span>' +
      '<div><strong style="font-size:13.5px">Registro exclusivo de portería</strong>' +
      '<div class="hint">La administración supervisa los movimientos, pero no registra accesos. Ingresa como Portería para operar la garita.</div></div>' +
      '</div></section>' +
      '<div class="grid grid-main"><div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Movimientos recientes</h3><p>Últimos 12 registros de la garita</p></div>' +
      '<div class="spacer"></div><button class="btn btn-ghost btn-sm" data-view="reportes">Reporte completo</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Hora</th><th class="hide-sm">Tipo</th><th>Placa / Persona</th><th>Casa</th><th>Sentido</th></tr></thead><tbody>' +
      DB.state.eventos.slice(0, 12).map((e) =>
        '<tr><td class="num">' + U.time(e.ts) + '<div class="td-sub">' + U.dayLabel(e.ts) + '</div></td>' +
        '<td class="hide-sm">' + (e.tipo === 'vehiculo' ? U.vehiculoLabel(U.tipoVehiculoDe(e)) : U.tipoLabel(e.tipo)) + '</td>' +
        '<td class="td-strong' + (e.tipo === 'vehiculo' ? ' mono' : '') + '">' +
        (e.foto ? '<img class="ev-thumb" src="' + e.foto + '" alt="Evidencia">' : '') +
        U.esc(e.tipo === 'vehiculo' ? e.placa : e.nombre) + '</td>' +
        '<td>' + U.esc(e.casaId || '—') + '</td>' +
        '<td><span class="pill ' + (e.sentido === 'in' ? 'pill-green' : 'pill-gray') + '">' + (e.sentido === 'in' ? 'Entrada' : 'Salida') + '</span></td></tr>'
      ).join('') + '</tbody></table></div></section>' +
      '</div><div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Dentro ahora</h3><p>' + st.dentro + ' vehículos · ' +
      st.temporalesDentro + ' temporales</p></div></div><div class="card-body" style="padding-top:6px">' + insideList() + '</div></section>' +
      '<section class="card"><div class="card-head"><div><h3>Visitas en curso</h3><p>Control de tiempo máximo</p></div></div>' +
      '<div class="card-body" style="padding-top:6px">' + visitasList() + '</div></section>' +
      '</div></div>';
  }

  /* ---------- Vista ---------- */
  Views.accesos = function (root) {
    if (!DB.state.casas.length) {
      root.innerHTML = '<section class="card"><div class="card-body" style="text-align:center;padding:36px 22px">' +
        '<div class="kpi-ico" style="margin:0 auto 12px">' + U.icon('home') + '</div>' +
        '<h3 style="font-size:16px">Sin casas configuradas</h3>' +
        '<p class="hint" style="max-width:420px;margin:6px auto 0">' +
        (App.role === 'admin'
          ? 'Genera el padrón de casas en Ajustes para habilitar el registro de accesos.'
          : 'El administrador debe generar el padrón de casas antes de registrar accesos.') +
        '</p>' +
        (App.role === 'admin' ? '<button class="btn btn-primary" style="margin-top:16px" data-view="ajustes">Ir a Ajustes</button>' : '') +
        '</div></section>';
      return;
    }
    if (App.role !== 'guardia') {
      root.innerHTML = soloLectura();
      return;
    }
    const st = U.stats();
    let tab = 'vehiculo';

    root.innerHTML =
      '<div class="grid grid-main">' +
      '<div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Registrar acceso</h3><p>Garita principal · ' + U.fullDate(Date.now()) + '</p></div>' +
      '<div class="spacer"></div><span class="pill pill-green">' + st.dentro + ' dentro</span></div>' +
      '<div class="card-body">' +
      '<div class="segmented" id="accTabs" style="margin-bottom:16px">' +
      '<button data-t="vehiculo" class="is-active">Vehículo</button>' +
      '<button data-t="taxi">Taxi</button>' +
      '<button data-t="persona">Residente</button>' +
      '<button data-t="visita">Visita</button></div>' +
      '<div id="accHost"></div></div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Movimientos recientes</h3><p>Últimos 12 registros de la garita</p></div>' +
      '<div class="spacer"></div><button class="btn btn-ghost btn-sm" data-view="reportes">Reporte completo</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Hora</th><th class="hide-sm">Tipo</th><th>Placa / Persona</th><th>Casa</th><th>Sentido</th><th class="hide-sm">Método</th></tr></thead><tbody>' +
      DB.state.eventos.slice(0, 12).map((e) =>
        '<tr><td class="num">' + U.time(e.ts) + '<div class="td-sub">' + U.dayLabel(e.ts) + '</div></td>' +
        '<td class="hide-sm">' + (e.tipo === 'vehiculo' ? U.vehiculoLabel(U.tipoVehiculoDe(e)) : U.tipoLabel(e.tipo)) + '</td>' +
        '<td class="td-strong' + (e.tipo === 'vehiculo' ? ' mono' : '') + '">' +
        (e.foto ? '<img class="ev-thumb" src="' + e.foto + '" alt="Evidencia">' : '') +
        U.esc(e.tipo === 'vehiculo' ? e.placa : e.nombre) + '</td>' +
        '<td>' + U.esc(e.casaId || '—') + '</td>' +
        '<td><span class="pill ' + (e.sentido === 'in' ? 'pill-green' : 'pill-gray') + '">' + (e.sentido === 'in' ? 'Entrada' : 'Salida') + '</span></td>' +
        '<td class="hide-sm" style="color:var(--muted);font-size:12px">' + U.esc(e.metodo === 'placa' ? 'Placa' : e.metodo === 'qr' ? 'QR' : 'Manual') + '</td></tr>'
      ).join('') + '</tbody></table></div></section>' +
      '</div>' +

      '<div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Dentro ahora</h3><p>Vehículos con entrada sin salida</p></div>' +
      '<div class="spacer"></div><button class="btn btn-ghost btn-sm" data-act="salida-modal">Salida</button></div>' +
      '<div class="card-body" style="padding-top:6px">' + insideList() + '</div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Visitas en curso</h3><p>Control de tiempo máximo</p></div></div>' +
      '<div class="card-body" style="padding-top:6px">' + visitasList() + '</div></section>' +
      '</div></div>';

    const host = root.querySelector('#accHost');
    const paint = () => {
      if (tab === 'vehiculo') formVehiculo(host, {});
      if (tab === 'taxi') formVehiculo(host, { taxi: true });
      if (tab === 'persona') formPersona(host);
      if (tab === 'visita') formVisita(host, {});
    };
    paint();
    root.querySelector('#accTabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      tab = b.dataset.t;
      root.querySelectorAll('#accTabs button').forEach((x) => x.classList.toggle('is-active', x === b));
      paint();
    });
  };

  function insideList() {
    const evs = [];
    U.abiertos().vehiculos.forEach((e) => evs.push(e));
    evs.sort((x, y) => x.ts - y.ts);
    if (!evs.length) return '<p class="hint" style="padding:14px 0">No hay vehículos dentro.</p>';

    return evs.slice(0, 7).map((e) => {
      const v = U.findVehiculo(e.placa);
      const temporal = !v || e.temporal;
      const r = e.autorizadoMin ? restante(e) : null;
      const late = r && r.excedido;
      const mins = (Date.now() - e.ts) / 60000;
      return '<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line-2);gap:10px">' +
        '<span class="live-ico ' + (temporal ? 'out' : 'in') + '" style="width:30px;height:30px">' +
        U.icon(U.iconoVehiculo(v ? v.tipo : (e.tipoVehiculo || ''))) + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px" class="mono">' + U.esc(e.placa) + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + (temporal ? 'Temporal · ' : '') +
        U.esc(e.casaId || '—') + ' · desde ' + U.time(e.ts) + '</div></div>' +
        '<span class="pill ' + (late ? 'pill-red' : temporal ? 'pill-amber' : 'pill-gray') + '">' +
        (late ? 'Excedido ' + U.dur(r.min) : temporal && r ? 'Quedan ' + U.dur(r.min) : U.dur(mins)) +
        '</span></div>';
    }).join('');
  }

  function visitasList() {
    const vs = U.estancias((t) => t.abierta && t.tipo === 'visita');
    if (!vs.length) return '<p class="hint" style="padding:14px 0">Sin visitas activas.</p>';
    const limite = (DB.state.config.horasVisita || 4) * 60;
    return vs.slice(0, 5).map((t) =>
      '<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line-2);gap:10px">' +
      '<span class="live-ico ' + (t.minutos > limite ? 'out' : 'in') + '" style="width:30px;height:30px">' + U.icon('users') + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px">' + U.esc(t.nombre) + '</div>' +
      '<div style="font-size:11px;color:var(--muted)">' + U.esc(t.casaId) + ' · ' + U.esc(t.motivo || 'Visita') + '</div></div>' +
      '<span class="pill ' + (t.minutos > limite ? 'pill-red' : 'pill-gray') + '">' + U.dur(t.minutos) + '</span></div>'
    ).join('');
  }

  Views.accesoModal = accesoModal;
  Views.registrarSalida = registrarSalida;
  Views.salidaModal = salidaModal;
})(window);
