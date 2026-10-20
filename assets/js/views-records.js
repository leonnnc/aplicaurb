/* ══════════════════════════════════════════════════════════
   views-records.js — Padrón de vehículos y residentes
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});

  function statStrip(items) {
    return '<div class="stat-strip" style="margin-bottom:14px">' + items.map((i) =>
      '<div><strong>' + i[0] + '</strong><small>' + i[1] + '</small></div>').join('') + '</div>';
  }

  /* ══════════════ VEHÍCULOS ══════════════ */
  Views.vehiculos = function (root) {
    let q = '';
    let filtro = 'todos';

    function rows() {
      const { vehiculos: inside } = U.abiertos();
      const nq = U.normPlate(q);
      const raw = q.toLowerCase();
      return DB.state.vehiculos.filter((v) => {
        const open = inside.get('v:' + U.normPlate(v.placa));
        if (filtro === 'dentro' && !open) return false;
        if (filtro === 'fuera' && open) return false;
        if (!raw) return true;
        return U.normPlate(v.placa).includes(nq) ||
          v.residente.toLowerCase().includes(raw) ||
          v.casaId.toLowerCase().includes(raw) ||
          v.marca.toLowerCase().includes(raw) ||
          v.modelo.toLowerCase().includes(raw);
      });
    }

    function body() {
      const { vehiculos: inside } = U.abiertos();
      const list = rows();
      if (!list.length) return '<tr><td colspan="7">' + UI.empty('car', 'Sin resultados', 'Prueba con otra placa, residente o casa.') + '</td></tr>';
      return list.slice(0, 60).map((v) => {
        const open = inside.get('v:' + U.normPlate(v.placa));
        return '<tr>' +
          '<td><span class="live-plate">' + U.esc(v.placa) + '</span></td>' +
          '<td><span class="pill pill-gray">' + U.tipoLabel(v.tipo) + '</span></td>' +
          '<td class="td-strong">' + U.esc(v.marca) + '<div class="td-sub">' + U.esc(v.modelo) + ' · ' + U.esc(v.color) + '</div></td>' +
          '<td>' + U.esc(v.residente || '—') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" data-house="' + U.esc(v.casaId) + '">' + U.esc(v.casaId) + '</button></td>' +
          '<td>' + (open
            ? '<span class="pill pill-green">Dentro</span><div class="td-sub">' + U.dur((Date.now() - open.ts) / 60000) + '</div>'
            : '<span class="pill pill-gray">Fuera</span>') + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" data-hist="' + U.esc(v.placa) + '">Historial</button> ' +
          (open ? '<button class="btn btn-soft btn-sm" data-out-plate="' + U.esc(v.placa) + '">Salida</button>' : '') +
          (App.role === 'admin' ? ' <button class="icon-btn icon-btn-sm" data-del-veh="' + v.id + '" title="Eliminar">' + U.icon('x') + '</button>' : '') +
          '</td></tr>';
      }).join('');
    }

    root.innerHTML =
      '<div class="row-between wrap" style="margin-bottom:14px">' +
      '<p style="font-size:12.5px;color:var(--muted)">Padrón vehicular de la urbanización y estado de permanencia.</p>' +
      (App.role === 'admin' ? '<button class="btn btn-primary" data-act="nuevo-vehiculo">' + U.icon('plus', 'btn-ico') + 'Nuevo vehículo</button>' : '') + '</div>' +

      statStrip([[DB.state.vehiculos.length, 'Vehículos registrados'],
        [U.abiertos().vehiculos.size, 'Dentro ahora'],
        [U.estancias((t) => !t.abierta && t.entrada >= U.startOfDay(Date.now()) && t.tipo === 'vehiculo').length, 'Estancias hoy']]) +

      (U.stats().temporalesDentro ? '<div class="card temp-card" style="margin-bottom:14px"><div class="card-body row" style="padding:12px 16px;gap:11px">' +
        '<span class="kpi-ico">' + U.icon('clock') + '</span>' +
        '<div style="flex:1"><strong style="font-size:12.5px">' + U.stats().temporalesDentro + ' ingreso' +
        (U.stats().temporalesDentro > 1 ? 's' : '') + ' temporal' + (U.stats().temporalesDentro > 1 ? 'es' : '') + ' dentro</strong>' +
        '<div class="hint">No forman parte del padrón; se controlan por tiempo autorizado en la garita.</div></div>' +
        '<button class="btn btn-ghost btn-sm" data-view="accesos">Ver en garita</button></div></div>' : '') +

      '<section class="card"><div class="card-head" style="gap:10px;flex-wrap:wrap">' +
      '<div class="search" style="max-width:320px"><svg><use href="#i-search"/></svg>' +
      '<input class="input" id="vSearch" placeholder="Placa, residente, casa o marca" value="' + U.esc(q) + '"></div>' +
      '<div class="segmented" id="vFilter"><button class="is-active" data-f="todos">Todos</button>' +
      '<button data-f="dentro">Dentro</button><button data-f="fuera">Fuera</button></div>' +
      '<div class="spacer"></div><span class="pill pill-gray" id="vCount">' + rows().length + ' vehículos</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Placa</th><th>Tipo</th><th>Vehículo</th><th>Residente</th><th>Casa</th><th>Estado</th><th></th></tr></thead>' +
      '<tbody id="vBody">' + body() + '</tbody></table></div></section>';

    const search = root.querySelector('#vSearch');
    const tbody = root.querySelector('#vBody');
    const count = root.querySelector('#vCount');

    function repaint() {
      tbody.innerHTML = body();
      count.textContent = rows().length + ' vehículos';
    }

    search.addEventListener('input', () => { q = search.value; repaint(); });
    root.querySelector('#vFilter').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      filtro = b.dataset.f;
      root.querySelectorAll('#vFilter button').forEach((x) => x.classList.toggle('is-active', x === b));
      repaint();
    });

    root.addEventListener('click', (e) => {
      const h = e.target.closest('[data-hist]');
      if (h) { historial(h.dataset.hist); return; }
      const o = e.target.closest('[data-out-plate]');
      if (o) { salida(o.dataset.outPlate); return; }
      const d = e.target.closest('[data-del-veh]');
      if (d) { eliminarVehiculo(d.dataset.delVeh); return; }
      const hs = e.target.closest('[data-house]');
      if (hs) { Views.openHouse(hs.dataset.house); }
    });
  };

  function salida(placa) {
    Views.registrarSalida(placa);
  }

  function historial(placa) {
    const trips = U.estancias((t) => U.normPlate(t.placa) === U.normPlate(placa)).slice(0, 12);
    const total = trips.filter((t) => !t.abierta).reduce((a, t) => a + t.minutos, 0);
    const v = U.findVehiculo(placa);
    UI.modal({
      title: 'Historial · ' + placa,
      sub: v ? v.marca + ' ' + v.modelo + ' · ' + v.residente + ' · ' + v.casaId : 'Vehículo',
      wide: true,
      body: '<div class="stat-strip" style="margin-bottom:14px">' +
        '<div><strong>' + trips.length + '</strong><small>Estancias recientes</small></div>' +
        '<div><strong>' + U.durShort(total) + '</strong><small>Tiempo acumulado</small></div>' +
        '<div><strong>' + (trips.length ? U.durShort(total / trips.length) : '—') + '</strong><small>Promedio</small></div></div>' +
        (trips.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Entrada</th><th>Salida</th><th>Permanencia</th></tr></thead><tbody>' +
          trips.map((t) => '<tr><td>' + U.dateTime(t.entrada) + '</td><td>' + (t.abierta ? '<span class="pill pill-green">Dentro</span>' : U.dateTime(t.salida)) + '</td>' +
            '<td class="td-strong">' + U.dur(t.minutos) + '</td></tr>').join('') + '</tbody></table></div>'
          : UI.empty('clock', 'Sin historial', 'Aún no hay movimientos para esta placa.')),
      foot: '<button class="btn btn-ghost" data-close>Cerrar</button>'
    });
  }

  function eliminarVehiculo(id) {
    const v = U.vehiculo(id);
    if (!v) return;
    UI.modal({
      title: 'Eliminar vehículo',
      sub: 'Esta acción quita la placa del padrón, no borra el historial.',
      body: '<p style="font-size:13px">¿Confirmas eliminar <strong class="mono">' + U.esc(v.placa) + '</strong> de ' + U.esc(v.residente) + '?</p>',
      foot: '<button class="btn btn-ghost" data-close>Cancelar</button>' +
        '<button class="btn btn-danger" id="confDel">Eliminar</button>',
      onMount(wrap, close) {
        wrap.querySelector('#confDel').addEventListener('click', () => {
          DB.removeVehiculo(id);
          close();
          UI.toast('Vehículo eliminado');
          App.refresh();
        });
      }
    });
  }

  Views.nuevoVehiculo = function () {
    UI.modal({
      title: 'Nuevo vehículo',
      sub: 'Agrega un vehículo al padrón de la urbanización',
      wide: true,
      body: '<form id="nvForm" novalidate><div class="form-grid">' +
        '<div class="field"><label>Placa</label><input class="input mono" id="nvPlaca" maxlength="8" placeholder="ABC-123" style="text-transform:uppercase;letter-spacing:.1em"></div>' +
        '<div class="field"><label>Tipo</label><select class="select" id="nvTipo"><option value="auto">Auto</option><option value="camioneta">Camioneta</option><option value="camion">Camión</option><option value="moto">Moto</option><option value="otro">Otro</option></select></div>' +
        '<div class="field"><label>Marca</label><input class="input" id="nvMarca" placeholder="Toyota"></div>' +
        '<div class="field"><label>Modelo</label><input class="input" id="nvModelo" placeholder="Corolla"></div>' +
        '<div class="field"><label>Color</label><input class="input" id="nvColor" placeholder="Blanco"></div>' +
        '<div class="field"><label>Año</label><input class="input" id="nvAnio" type="number" min="1980" max="2027" placeholder="2022"></div>' +
        '<div class="field"><label>Casa</label><select class="select" id="nvCasa">' + (function () {
          const byMz = {};
          DB.state.casas.forEach((c) => { (byMz[c.mz] = byMz[c.mz] || []).push(c); });
          return Object.keys(byMz).sort().map((k) => '<optgroup label="Manzana ' + k + '">' +
            byMz[k].map((c) => '<option value="' + c.id + '">' + c.id + ' · ' + U.esc(c.calle) + '</option>').join('') + '</optgroup>').join('');
        })() + '</select></div>' +
        '<div class="field"><label>Residente</label><select class="select" id="nvRes"></select></div>' +
        '</div></form>',
      foot: '<button class="btn btn-ghost" data-close>Cancelar</button>' +
        '<button class="btn btn-primary" id="nvSave">Guardar vehículo</button>',
      onMount(wrap, close) {
        const casaSel = wrap.querySelector('#nvCasa');
        const resSel = wrap.querySelector('#nvRes');
        const paintRes = () => {
          const res = U.residentesDe(casaSel.value);
          resSel.innerHTML = res.length
            ? res.map((r) => '<option value="' + r.id + '">' + U.esc(r.nombre) + '</option>').join('')
            : '<option value="">Sin residentes en esta casa</option>';
        };
        casaSel.addEventListener('change', paintRes);
        paintRes();

        wrap.querySelector('#nvSave').addEventListener('click', () => {
          const placa = U.fmtPlate(wrap.querySelector('#nvPlaca').value);
          if (U.normPlate(placa).length < 5) { UI.toast('Placa inválida', true); return; }
          if (U.findVehiculo(placa)) { UI.toast('Esa placa ya está registrada', true); return; }
          const r = U.residente(resSel.value);
          DB.addVehiculo({
            id: 'v-' + Date.now().toString(36),
            placa, tipo: wrap.querySelector('#nvTipo').value,
            marca: wrap.querySelector('#nvMarca').value.trim() || '—',
            modelo: wrap.querySelector('#nvModelo').value.trim() || '—',
            color: wrap.querySelector('#nvColor').value.trim() || '—',
            anio: Number(wrap.querySelector('#nvAnio').value) || null,
            casaId: casaSel.value,
            residenteId: r ? r.id : null,
            residente: r ? r.nombre : 'Sin asignar',
            activo: true, creado: Date.now()
          });
          close();
          UI.toast('Vehículo ' + placa + ' agregado');
          App.refresh();
        });
      }
    });
  };

  /* ══════════════ RESIDENTES ══════════════ */
  Views.residentes = function (root) {
    let q = '';
    let mz = '';

    function list() {
      const raw = q.toLowerCase();
      return DB.state.residentes.filter((r) => {
        if (mz && (U.casa(r.casaId) || {}).mz !== mz) return false;
        if (!raw) return true;
        return r.nombre.toLowerCase().includes(raw) || r.casaId.toLowerCase().includes(raw) ||
          (r.telefono || '').includes(raw);
      });
    }

    function body() {
      const rows = list();
      if (!rows.length) return '<tr><td colspan="7">' + UI.empty('users', 'Sin resultados', 'Ajusta la búsqueda o el filtro de manzana.') + '</td></tr>';
      return rows.slice(0, 70).map((r) => {
        const casa = U.casa(r.casaId);
        const veh = U.vehiculosDe(r.casaId).length;
        return '<tr>' +
          '<td><div class="row" style="gap:9px"><span class="avatar" style="width:28px;height:28px;border-radius:8px;font-size:10px">' + U.esc(U.initials(r.nombre)) + '</span>' +
          '<span class="td-strong">' + U.esc(r.nombre) + '</span></div></td>' +
          '<td><span class="pill ' + (r.rol === 'propietario' ? 'pill-green' : r.rol === 'inquilino' ? 'pill-blue' : 'pill-gray') + '">' + U.esc(r.rol) + '</span></td>' +
          '<td><button class="btn btn-ghost btn-sm" data-house="' + U.esc(r.casaId) + '">' + U.esc(r.casaId) + '</button></td>' +
          '<td class="hide-sm">' + U.esc(casa ? casa.calle : '—') + '</td>' +
          (App.role === 'admin' ? '<td class="num hide-sm">' + U.esc(r.telefono || '—') + '</td>' : '') +
          '<td>' + veh + '</td>' +
          '<td style="text-align:right">' + (App.role === 'admin'
            ? '<button class="icon-btn icon-btn-sm" data-del-res="' + r.id + '" title="Eliminar">' + U.icon('x') + '</button>' : '') + '</td></tr>';
      }).join('');
    }

    root.innerHTML =
      '<div class="row-between wrap" style="margin-bottom:14px">' +
      '<p style="font-size:12.5px;color:var(--muted)">' +
      (App.role === 'admin' ? 'Padrón de personas que viven en la urbanización.' : 'Consulta de residentes: nombre, rol y casa. Los datos de contacto los administra la administración.') +
      '</p>' +
      (App.role === 'admin' ? '<button class="btn btn-primary" data-act="nuevo-residente">' + U.icon('plus', 'btn-ico') + 'Nuevo residente</button>' : '') +
      '</div>' +

      statStrip([[DB.state.casas.filter((c) => c.estado !== 'desocupada').length, 'Casas habitadas'],
        [DB.state.residentes.length, 'Residentes'],
        [DB.state.vehiculos.length, 'Vehículos']]) +

      '<section class="card"><div class="card-head" style="gap:10px;flex-wrap:wrap">' +
      '<div class="search" style="max-width:300px"><svg><use href="#i-search"/></svg>' +
      '<input class="input" id="rSearch" placeholder="Nombre, casa o teléfono"></div>' +
      '<select class="select" id="rMz" style="width:auto"><option value="">Todas las manzanas</option>' +
      ['A', 'B', 'C', 'D'].map((k) => '<option value="' + k + '">Manzana ' + k + '</option>').join('') + '</select>' +
      '<div class="spacer"></div><span class="pill pill-gray" id="rCount">' + list().length + ' personas</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Rol</th><th>Casa</th><th class="hide-sm">Calle</th>' + (App.role === 'admin' ? '<th class="hide-sm">Teléfono</th>' : '') + '<th>Veh.</th><th></th></tr></thead>' +
      '<tbody id="rBody">' + body() + '</tbody></table></div></section>';

    const tbody = root.querySelector('#rBody');
    const count = root.querySelector('#rCount');
    const repaint = () => { tbody.innerHTML = body(); count.textContent = list().length + ' personas'; };

    root.querySelector('#rSearch').addEventListener('input', (e) => { q = e.target.value; repaint(); });
    root.querySelector('#rMz').addEventListener('change', (e) => { mz = e.target.value; repaint(); });

    root.addEventListener('click', (e) => {
      const h = e.target.closest('[data-house]');
      if (h) { Views.openHouse(h.dataset.house); return; }
      const d = e.target.closest('[data-del-res]');
      if (d) {
        const r = U.residente(d.dataset.delRes);
        if (!r) return;
        UI.modal({
          title: 'Eliminar residente',
          sub: 'Se quitará del padrón de la urbanización.',
          body: '<p style="font-size:13px">¿Eliminar a <strong>' + U.esc(r.nombre) + '</strong> del lote ' + U.esc(r.casaId) + '?</p>',
          foot: '<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="delRes">Eliminar</button>',
          onMount(wrap, close) {
            wrap.querySelector('#delRes').addEventListener('click', () => {
              DB.removeResidente(r.id); close(); UI.toast('Residente eliminado'); App.refresh();
            });
          }
        });
      }
    });
  };

  Views.nuevoResidente = function () {
    UI.modal({
      title: 'Nuevo residente',
      sub: 'Registra una persona en el padrón',
      wide: true,
      body: '<form id="nrForm" novalidate><div class="form-grid">' +
        '<div class="field col-2"><label>Nombre completo</label><input class="input" id="nrNombre" placeholder="Nombre y apellidos"></div>' +
        '<div class="field"><label>Documento</label><input class="input" id="nrDoc" placeholder="DNI"></div>' +
        '<div class="field"><label>Teléfono</label><input class="input" id="nrTel" placeholder="9XXXXXXXX"></div>' +
        '<div class="field"><label>Casa</label><select class="select" id="nrCasa">' + (function () {
          const byMz = {};
          DB.state.casas.forEach((c) => { (byMz[c.mz] = byMz[c.mz] || []).push(c); });
          return Object.keys(byMz).sort().map((k) => '<optgroup label="Manzana ' + k + '">' +
            byMz[k].map((c) => '<option value="' + c.id + '">' + c.id + ' · ' + U.esc(c.calle) + '</option>').join('') + '</optgroup>').join('');
        })() + '</select></div>' +
        '<div class="field"><label>Rol</label><select class="select" id="nrRol">' +
        '<option value="propietario">Propietario</option><option value="inquilino">Inquilino</option><option value="familiar">Familiar</option></select></div>' +
        '</div></form>',
      foot: '<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="nrSave">Guardar residente</button>',
      onMount(wrap, close) {
        wrap.querySelector('#nrSave').addEventListener('click', () => {
          const nombre = wrap.querySelector('#nrNombre').value.trim();
          if (!nombre) { UI.toast('Ingresa el nombre', true); return; }
          const casaId = wrap.querySelector('#nrCasa').value;
          DB.addResidente({
            id: 'r-' + Date.now().toString(36),
            nombre, doc: wrap.querySelector('#nrDoc').value.trim(),
            telefono: wrap.querySelector('#nrTel').value.trim(),
            casaId, rol: wrap.querySelector('#nrRol').value,
            email: '', activo: true
          });
          const casa = U.casa(casaId);
          if (casa) casa.estado = 'habitada';
          DB.save();
          close(); UI.toast('Residente agregado a ' + casaId); App.refresh();
        });
      }
    });
  };
})(window);
