/* ══════════════════════════════════════════════════════════
   views-reports.js — Reportes, permanencia y ajustes
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});

  /* ══════════════ REPORTES ══════════════ */
  Views.reportes = function (root) {
    if (App.role !== 'admin') {
      root.innerHTML = '<section class="card">' + UI.empty('shield', 'Acceso restringido', 'Los reportes históricos y la exportación son exclusivos de administración.') + '</section>';
      return;
    }
    const hoy = Date.now();
    let desde = U.inputDate(hoy - 6 * U.DAY);
    let hasta = U.inputDate(hoy);
    let tipo = 'todos';
    let texto = '';

    function rangeStart() { return new Date(desde + 'T00:00:00').getTime(); }
    function rangeEnd() { return new Date(hasta + 'T23:59:59').getTime(); }

    function filtered() {
      const a = rangeStart(), b = rangeEnd();
      return U.estancias((t) => {
        if (t.entrada < a || t.entrada > b) return false;
        if (tipo !== 'todos' && t.tipo !== tipo) return false;
        if (texto) {
          const q = texto.toLowerCase();
          if (!(String(t.placa || '').toLowerCase().includes(q) || String(t.nombre || '').toLowerCase().includes(q) ||
            String(t.casaId || '').toLowerCase().includes(q))) return false;
        }
        return true;
      });
    }

    function summary() {
      const list = filtered();
      const cerradas = list.filter((t) => !t.abierta);
      const total = cerradas.reduce((a, t) => a + t.minutos, 0);
      const prom = cerradas.length ? total / cerradas.length : 0;
      const max = cerradas.reduce((a, t) => Math.max(a, t.minutos), 0);
      return { list, cerradas, total, prom, max };
    }

    function body() {
      const list = filtered().slice(0, 120);
      if (!list.length) return '<tr><td colspan="7">' + UI.empty('chart', 'Sin registros', 'No hay movimientos para los filtros seleccionados.') + '</td></tr>';
      return list.map((t) => '<tr>' +
        '<td>' + U.date(t.entrada) + '<div class="td-sub">' + U.time(t.entrada) + '</div></td>' +
        '<td>' + (t.abierta ? '<span class="pill pill-green">En curso</span>' : U.time(t.salida)) + '</td>' +
        '<td class="td-strong">' + (t.abierta ? U.durShort(t.minutos) + ' (en curso)' : U.dur(t.minutos)) +
        (t.autorizadoMin ? '<div class="td-sub">Autorizado ' + U.dur(t.autorizadoMin) + '</div>' : '') + '</td>' +
        '<td>' + (t.temporal ? '<span class="pill pill-amber">Temporal</span>' : '<span class="pill pill-gray">' + U.tipoLabel(t.tipo) + '</span>') + '</td>' +
        '<td class="' + (t.tipo === 'vehiculo' ? 'mono td-strong' : 'td-strong') + '">' + U.esc(t.tipo === 'vehiculo' ? t.placa : t.nombre) + '</td>' +
        '<td>' + U.esc(t.casaId || '—') + '</td>' +
        '<td style="color:var(--muted);font-size:12px">' + U.esc(t.motivo || '—') + '</td></tr>').join('');
    }

    function statsHtml() {
      const s = summary();
      return '<div class="stat-strip" style="margin-bottom:14px">' +
        '<div><strong>' + s.list.length + '</strong><small>Estancias en el rango</small></div>' +
        '<div><strong>' + U.durShort(s.prom) + '</strong><small>Permanencia promedio</small></div>' +
        '<div><strong>' + U.durShort(s.max) + '</strong><small>Permanencia máxima</small></div></div>';
    }

    root.innerHTML =
      '<div class="row-between wrap" style="margin-bottom:14px">' +
      '<p style="font-size:12.5px;color:var(--muted)">Historial de accesos emparejados: entrada, salida y tiempo dentro de la urbanización.</p>' +
      '<button class="btn btn-ghost" data-act="export-csv">' + U.icon('download', 'btn-ico') + 'Exportar CSV</button></div>' +

      '<section class="card" style="margin-bottom:16px"><div class="card-body">' +
      '<div class="row wrap" style="gap:10px;align-items:flex-end">' +
      '<div class="field" style="min-width:140px"><label>Desde</label><input type="date" class="input" id="repFrom" value="' + desde + '"></div>' +
      '<div class="field" style="min-width:140px"><label>Hasta</label><input type="date" class="input" id="repTo" value="' + hasta + '"></div>' +
      '<div class="field" style="min-width:150px"><label>Tipo</label><select class="select" id="repTipo">' +
      '<option value="todos">Todos</option><option value="vehiculo">Vehículos</option><option value="persona">Peatonal</option><option value="visita">Visitas</option></select></div>' +
      '<div class="field" style="flex:1;min-width:180px"><label>Buscar</label><input class="input" id="repQ" placeholder="Placa, persona o casa"></div>' +
      '</div></div></section>' +

      '<div id="repStats">' + statsHtml() + '</div>' +

      '<section class="card"><div class="card-head"><div><h3>Detalle de estancias</h3><p>Máximo 120 registros por consulta</p></div>' +
      '<div class="spacer"></div><span class="pill pill-gray" id="repCount">' + filtered().length + '</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Entrada</th><th>Salida</th><th>Permanencia</th><th>Tipo</th><th>Placa / Persona</th><th>Casa</th><th>Motivo</th></tr></thead>' +
      '<tbody id="repBody">' + body() + '</tbody></table></div></section>';

    const repaint = () => {
      root.querySelector('#repBody').innerHTML = body();
      root.querySelector('#repStats').innerHTML = statsHtml();
      root.querySelector('#repCount').textContent = filtered().length;
    };

    root.querySelector('#repFrom').addEventListener('change', (e) => { desde = e.target.value; repaint(); });
    root.querySelector('#repTo').addEventListener('change', (e) => { hasta = e.target.value; repaint(); });
    root.querySelector('#repTipo').addEventListener('change', (e) => { tipo = e.target.value; repaint(); });
    root.querySelector('#repQ').addEventListener('input', (e) => { texto = e.target.value; repaint(); });

    root.querySelector('[data-act="export-csv"]').addEventListener('click', () => {
      const rows = [['Entrada', 'Salida', 'Minutos', 'Tipo', 'Placa/Persona', 'Casa', 'Motivo', 'Metodo', 'Temporal', 'Autorizado (min)']];
      filtered().forEach((t) => rows.push([
        new Date(t.entrada).toLocaleString('es-PE'),
        t.abierta ? 'En curso' : new Date(t.salida).toLocaleString('es-PE'),
        t.abierta ? '' : Math.round(t.minutos),
        U.tipoLabel(t.tipo), t.placa || t.nombre, t.casaId, t.motivo || '', t.metodo || '',
        t.temporal ? 'SI' : 'NO', t.autorizadoMin || ''
      ]));
      U.downloadCSV('reporte-accesos-' + desde + '_' + hasta + '.csv', rows);
      UI.toast('CSV exportado');
    });
  };

  /* ══════════════ AJUSTES ══════════════ */
  Views.ajustes = function (root) {
    if (App.role !== 'admin') {
      root.innerHTML = '<section class="card">' + UI.empty('shield', 'Acceso restringido', 'Solo el perfil de administración puede cambiar la configuración.') + '</section>';
      return;
    }
    const c = DB.state.config;

    const perms = Array.isArray(c.permisosPorteria) ? c.permisosPorteria.slice() : ['accesos', 'vehiculos'];
    const OPT = ['panel', 'mapa', 'vehiculos', 'residentes'];
    const NOMBRE = { panel: 'Panel', mapa: 'Mapa', vehiculos: 'Vehículos', residentes: 'Directorio' };
    const activos = () => ['accesos'].concat(OPT.filter((v) => perms.includes(v)));
    const chips = () => activos().map((v) => '<span class="pill pill-gray">' + (NOMBRE[v] || 'Accesos') + '</span>').join(' ');
    const row = (v, ico, title, desc) =>
      '<label class="perm-row"><span class="perm-ico">' + U.icon(ico) + '</span>' +
      '<div><strong>' + title + '</strong><small>' + desc + '</small></div>' +
      '<input type="checkbox" class="switch" data-permiso="' + v + '"' + (perms.includes(v) ? ' checked' : '') + '></label>';

    root.innerHTML =
      '<section class="card" style="margin-bottom:16px"><div class="card-head">' +
      '<div><h3>Accesos de portería</h3><p>Activa o desactiva las secciones que ve el perfil de garita</p></div>' +
      '<div class="spacer"></div><span class="pill pill-green" id="permCount">' + activos().length + ' de 5</span></div>' +
      '<div class="card-body"><div class="perm-list">' +
      '<div class="perm-row is-locked"><span class="perm-ico">' + U.icon('door') + '</span>' +
      '<div><strong>Accesos</strong><small>Registro de entradas, salidas y visitas. Siempre habilitado.</small></div>' +
      '<span class="pill pill-green">Obligatorio</span></div>' +
      row('panel', 'panel', 'Panel general', 'Resumen, métricas y alertas de la urbanización.') +
      row('mapa', 'map', 'Mapa de la urbanización', 'Lotes, calles, garitas y fichas por casa.') +
      row('vehiculos', 'car', 'Vehículos', 'Consulta del padrón vehicular y permanencias.') +
      row('residentes', 'users', 'Directorio', 'Nombres, rol y casa. Sin teléfonos ni documentos.') +
      '<div class="perm-row is-locked"><span class="perm-ico">' + U.icon('chart') + '</span>' +
      '<div><strong>Reportes y ajustes</strong><small>Reservados a la administración.</small></div>' +
      '<span class="pill pill-gray">Bloqueado</span></div>' +
      '</div>' +
      '<div class="row-between wrap" style="margin-top:12px;gap:8px"><span class="hint">Vista de portería:</span>' +
      '<div class="row" id="permPreview" style="gap:6px">' + chips() + '</div></div>' +
      '<p class="hint" style="margin-top:8px">Los cambios se aplican al iniciar sesión como portería.</p>' +
      '</div></section>' +
      '<div class="grid grid-main"><div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Datos de la urbanización</h3><p>Se usan en el panel y en los reportes</p></div></div>' +
      '<div class="card-body"><form id="cfgForm">' +
      '<div class="form-grid">' +
      '<div class="field col-2"><label>Nombre</label><input class="input" id="cfgNombre" value="' + U.esc(c.nombre) + '"></div>' +
      '<div class="field col-2"><label>Dirección</label><input class="input" id="cfgDir" value="' + U.esc(c.direccion || '') + '"></div>' +
      '<div class="field"><label>Administrador</label><input class="input" id="cfgAdmin" value="' + U.esc(c.admin || '') + '"></div>' +
      '<div class="field"><label>Teléfono</label><input class="input" id="cfgTel" value="' + U.esc(c.telefono || '') + '"></div>' +
      '<div class="field"><label>Horas máximas de visita</label><input type="number" min="1" max="24" class="input" id="cfgHoras" value="' + (c.horasVisita || 4) + '"></div>' +
      '<div class="field"><label>Patrón de placa (regex)</label><input class="input mono" id="cfgPatron" value="' + U.esc(c.patronPlaca || '') + '"></div>' +
      '</div>' +
      '<button class="btn btn-primary" type="submit" style="margin-top:16px">' + U.icon('check', 'btn-ico') + 'Guardar cambios</button>' +
      '</form></div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Datos y respaldo</h3><p>El demo guarda todo en este navegador</p></div></div>' +
      '<div class="card-body stack" style="gap:10px">' +
      '<div class="row-between"><div><strong style="font-size:13px">Exportar respaldo</strong><div class="hint">Casas, residentes, vehículos y accesos en JSON.</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="export-json">Descargar</button></div>' +
      '<div class="row-between"><div><strong style="font-size:13px">Restaurar demo</strong><div class="hint">Vuelve a generar 100 casas y 3 días de movimientos.</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="reset-demo">Restaurar</button></div>' +
      '<div class="row-between"><div><strong style="font-size:13px">Empezar de cero</strong><div class="hint">Deja el padrón vacío para cargar datos reales.</div></div>' +
      '<button class="btn btn-danger btn-sm" data-act="reset-empty">Vaciar</button></div>' +
      '</div></section>' +
      '</div>' +

      '<div class="stack">' +
      '<section class="card"><div class="card-head"><div><h3>Estado del sistema</h3><p>Entorno de demostración</p></div></div>' +
      '<div class="card-body">' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Almacenamiento</span><span class="pill ' + (DB.available ? 'pill-green' : 'pill-red') + '">' + (DB.available ? 'localStorage' : 'memoria') + '</span></div>' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Casas</span><strong>' + DB.state.casas.length + '</strong></div>' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Residentes</span><strong>' + DB.state.residentes.length + '</strong></div>' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Vehículos</span><strong>' + DB.state.vehiculos.length + '</strong></div>' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Eventos</span><strong>' + DB.state.eventos.length + '</strong></div>' +
      '<div class="row-between" style="padding:8px 0"><span class="hint">Versión</span><strong>1.7 · demo</strong></div>' +
      '</div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Sobre el proyecto</h3><p>URB San Lucas · control de accesos</p></div></div>' +
      '<div class="card-body"><p style="font-size:12.5px;line-height:1.6;color:var(--muted)">Prototipo funcional en HTML5, CSS3 y JavaScript sin dependencias. ' +
      'La captura de placa usa la cámara del dispositivo y OCR opcional. Para producción se recomienda PWA + backend con base de datos, ' +
      'autenticación por roles y respaldo de evidencias.</p></div></section>' +
      '</div></div>';

    root.querySelectorAll('[data-permiso]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const v = inp.dataset.permiso;
        if (inp.checked) { if (!perms.includes(v)) perms.push(v); }
        else { const i = perms.indexOf(v); if (i >= 0) perms.splice(i, 1); }
        const next = ['accesos'].concat(OPT.filter((x) => perms.includes(x)));
        DB.updateConfig({ permisosPorteria: next });
        perms.length = 0;
        next.forEach((x) => perms.push(x));
        root.querySelector('#permCount').textContent = next.length + ' de 5';
        root.querySelector('#permPreview').innerHTML = chips();
        App.applyRole();
        UI.toast('Permisos de portería · ' + next.length + ' secciones');
      });
    });

    root.querySelector('#cfgForm').addEventListener('submit', (e) => {
      e.preventDefault();
      DB.updateConfig({
        nombre: root.querySelector('#cfgNombre').value.trim() || 'Mi urbanización',
        direccion: root.querySelector('#cfgDir').value.trim(),
        admin: root.querySelector('#cfgAdmin').value.trim(),
        telefono: root.querySelector('#cfgTel').value.trim(),
        horasVisita: Number(root.querySelector('#cfgHoras').value) || 4,
        patronPlaca: root.querySelector('#cfgPatron').value.trim()
      });
      UI.toast('Configuración guardada');
      App.refresh();
    });

    root.querySelector('[data-act="export-json"]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(DB.state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'urb-san-lucas-respaldo-' + U.inputDate(Date.now()) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      UI.toast('Respaldo descargado');
    });

    root.querySelector('[data-act="reset-demo"]').addEventListener('click', () => {
      UI.modal({
        title: 'Restaurar datos demo',
        body: '<p style="font-size:13px">Se reemplazará toda la información actual por el padrón de ejemplo de 100 casas.</p>',
        foot: '<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="okReset">Restaurar</button>',
        onMount(wrap, close) {
          wrap.querySelector('#okReset').addEventListener('click', () => {
            DB.reset(true); close(); UI.toast('Datos demo restaurados'); App.refresh();
          });
        }
      });
    });

    root.querySelector('[data-act="reset-empty"]').addEventListener('click', () => {
      UI.modal({
        title: 'Empezar de cero',
        body: '<p style="font-size:13px">Se borrarán casas, residentes, vehículos y accesos de este navegador.</p>',
        foot: '<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="okEmpty">Vaciar todo</button>',
        onMount(wrap, close) {
          wrap.querySelector('#okEmpty').addEventListener('click', () => {
            DB.reset(false); close(); UI.toast('Padrón vacío'); App.refresh();
          });
        }
      });
    });
  };
})(window);
