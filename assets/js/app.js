/* ══════════════════════════════════════════════════════════
   app.js — Arranque, navegación y acciones globales
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const TITLES = {
    panel: ['Panel general', 'Resumen operativo de la urbanización'],
    mapa: ['Mapa de la urbanización', 'Lotes, calles, garitas y estado en vivo'],
    accesos: ['Control de accesos', 'Entradas, salidas y visitas de la garita'],
    vehiculos: ['Vehículos', 'Padrón vehicular y permanencia'],
    residentes: ['Casas y residentes', 'Padrón de personas de la urbanización'],
    reportes: ['Reportes', 'Historial y tiempos de permanencia'],
    ajustes: ['Ajustes', 'Configuración de la urbanización']
  };

  const ADMIN_VIEWS = ['panel', 'mapa', 'accesos', 'vehiculos', 'residentes', 'reportes', 'ajustes'];
  const GUARD_OPTIONAL = ['panel', 'mapa', 'vehiculos', 'residentes'];

  function guardViews() {
    const cfg = (DB.state && DB.state.config) || {};
    const p = Array.isArray(cfg.permisosPorteria) ? cfg.permisosPorteria : ['accesos', 'vehiculos'];
    return ['accesos'].concat(GUARD_OPTIONAL.filter((v) => p.includes(v)));
  }

  function allowedViews(role) {
    return role === 'admin' ? ADMIN_VIEWS.slice() : guardViews();
  }

  const App = {
    view: 'panel',
    role: 'admin',

    init() {
      App.splash();
      DB.load();
      App.bindLogin();
      App.bindGlobal();
      App.bindInstall();
      App.registerSW();
      App.clock();
      setInterval(App.clock, 20000);
      global.App = App;
      // Alias usados por las vistas
      App.accesoModal = function (o) { return Views.accesoModal(o); };
    },

    splash() {
      const el = document.getElementById('splash');
      if (!el) return;
      const param = Number(new URLSearchParams(location.search).get('splash'));
      const secs = Math.min(15, Math.max(1, param || 2));
      document.body.style.overflow = 'hidden';
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.classList.add('is-out');
        document.body.style.overflow = '';
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
      };
      const start = () => setTimeout(finish, secs * 1000);
      const img = el.querySelector('img');
      if (img && !img.complete) {
        img.addEventListener('load', start, { once: true });
        img.addEventListener('error', start, { once: true });
        setTimeout(finish, secs * 1000 + 2000);
      } else {
        start();
      }
    },

    registerSW() {
      if (!('serviceWorker' in navigator)) return;
      const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!secure) return;
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    },

    bindInstall() {
      const btns = Array.from(document.querySelectorAll('[data-install]'));
      if (!btns.length) return;
      const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      if (standalone) { btns.forEach((b) => { b.hidden = true; }); return; }
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isMobile = isIOS || /android/i.test(navigator.userAgent) || window.matchMedia('(max-width: 820px)').matches;
      let deferred = null;
      const show = () => btns.forEach((b) => { b.hidden = false; });
      if (isMobile) show();
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        if (isMobile) show();
      });
      window.addEventListener('appinstalled', () => btns.forEach((b) => { b.hidden = true; }));
      const steps = isIOS
        ? '<ol class="install-steps"><li>Abre esta página en <strong>Safari</strong>.</li><li>Toca <strong>Compartir</strong> (el cuadro con la flecha).</li><li>Elige <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma con <strong>Añadir</strong>.</li></ol>'
        : '<ol class="install-steps"><li>Abre el menú <strong>⋮</strong> de Chrome.</li><li>Toca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma.</li></ol>';
      const showSteps = () => {
        const hasPrompt = !!deferred;
        const foot = '<button class="btn btn-ghost" data-close>Cancelar</button>' +
          (hasPrompt
            ? '<button class="btn btn-primary" id="doInstall">Abrir instalador</button>'
            : '<button class="btn btn-primary" data-close>Entendido</button>');
        const close = UI.modal({
          title: isIOS ? 'Instalar en iPhone' : 'Instalar en el móvil',
          sub: 'Se abre como app, sin la barra del navegador',
          body: steps,
          foot: foot
        });
        const go = document.getElementById('doInstall');
        if (go) {
          go.addEventListener('click', () => {
            close();
            const evt = deferred;
            deferred = null;
            try { if (evt) evt.prompt(); } catch (e) { /* sin diálogo nativo */ }
          });
        }
      };

      btns.forEach((b) => b.addEventListener('click', showSteps));
    },

    bindLogin() {
      const pick = document.getElementById('rolePick');
      pick.addEventListener('click', (e) => {
        const card = e.target.closest('.role-card');
        if (!card) return;
        pick.querySelectorAll('.role-card').forEach((c) => c.classList.toggle('is-active', c === card));
      });
      document.getElementById('loginBtn').addEventListener('click', () => {
        const active = pick.querySelector('.role-card.is-active');
        App.role = active ? active.dataset.role : 'admin';
        App.enter();
      });
    },

    enter() {
      document.getElementById('login').hidden = true;
      document.getElementById('app').hidden = false;
      document.body.style.overflow = '';
      App.applyRole();
      App.go(App.defaultView());
      UI.toast(App.role === 'admin' ? 'Sesión iniciada · Administración' : 'Sesión iniciada · Portería');
    },

    applyRole() {
      const isAdmin = App.role === 'admin';
      const cfg = DB.state.config;
      document.getElementById('userName').textContent = isAdmin ? (cfg.admin || 'Administración') : 'Carlos Méndez';
      document.getElementById('userRole').textContent = isAdmin ? 'Administración' : 'Portería · Garita 1';
      document.getElementById('userAvatar').textContent = U.initials(isAdmin ? (cfg.admin || 'AL') : 'Carlos Méndez');
      const allowed = allowedViews(App.role);
      document.querySelectorAll('#nav .nav-item[data-view], #bottomnav [data-view]').forEach((n) => {
        n.style.display = allowed.includes(n.dataset.view) ? '' : 'none';
      });
      const resNav = document.querySelector('#nav .nav-item[data-view="residentes"] span');
      if (resNav) resNav.textContent = isAdmin ? 'Casas y residentes' : 'Directorio';
      const resBottom = document.querySelector('#bottomnav [data-view="residentes"] span:last-child');
      if (resBottom) resBottom.textContent = isAdmin ? 'Padrón' : 'Directorio';
      const quick = document.querySelectorAll('[data-action="quick-entry"]');
      quick.forEach((b) => { b.style.display = isAdmin ? 'none' : ''; });
      const bn = document.getElementById('bottomnav');
      if (bn) bn.classList.toggle('is-guard', !isAdmin);
    },

    defaultView() {
      return App.role === 'guardia' ? 'accesos' : 'panel';
    },

    go(view) {
      if (!Views[view]) view = App.defaultView();
      if (!allowedViews(App.role).includes(view)) {
        UI.toast('Tu perfil no tiene acceso a esa sección', true);
        view = App.defaultView();
      }
      App.view = view;
      const root = document.getElementById('view');
      root.innerHTML = '';
      try {
        Views[view](root);
      } catch (err) {
        console.error(err);
        root.innerHTML = UI.empty('bell', 'No se pudo cargar la vista', String(err.message || err));
      }
      const t = TITLES[view] || TITLES.panel;
      const soloConsulta = App.role !== 'admin' && view === 'residentes';
      document.getElementById('pageTitle').textContent = soloConsulta ? 'Directorio' : t[0];
      document.getElementById('pageSub').textContent = soloConsulta ? 'Nombres y casa · solo consulta' : t[1];
      document.querySelectorAll('[data-view]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.view === view);
      });
      document.getElementById('app').classList.remove('menu-open');
      document.body.style.overflow = '';
      window.scrollTo(0, 0);
    },

    refresh() {
      const y = window.scrollY;
      App.go(App.view);
      window.scrollTo(0, y);
    },

    clock() {
      const el = document.getElementById('clock');
      if (!el) return;
      const d = new Date();
      el.querySelector('span').textContent =
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      el.title = U.fullDate(d.getTime());
    },

    alertsModal() {
      const st = U.stats();
      const abiertos = U.estancias((t) => t.abierta);
      const limite = (DB.state.config.horasVisita || 4) * 60;
      const items = [];
      abiertos.filter((t) => t.tipo === 'vehiculo' && t.minutos > 8 * 60).forEach((t) => {
        items.push(['car', 'Permanencia extendida', t.placa + ' en ' + t.casaId + ' lleva ' + U.dur(t.minutos) + ' dentro.']);
      });
      abiertos.filter((t) => t.tipo === 'vehiculo' && t.autorizadoMin && t.minutos > t.autorizadoMin).forEach((t) => {
        items.push(['clock', 'Ingreso temporal vencido', t.placa + ' en ' + t.casaId + ' · autorizado ' + U.dur(t.autorizadoMin) + ', lleva ' + U.dur(t.minutos) + '.']);
      });
      abiertos.filter((t) => t.tipo === 'visita' && t.minutos > limite).forEach((t) => {
        items.push(['clock', 'Visita excede el tiempo', (t.nombre || 'Visita') + ' en ' + t.casaId + ' · ' + U.dur(t.minutos) + '.']);
      });
      const desoc = DB.state.casas.filter((c) => c.estado === 'desocupada').length;
      if (desoc) items.push(['home', 'Lotes desocupados', desoc + ' casas sin residentes en el padrón.']);
      if (!items.length) items.push(['shield', 'Todo en orden', 'No hay incidencias que reportar en este momento.']);

      UI.modal({
        title: 'Alertas',
        sub: st.eventosHoy + ' eventos registrados hoy · ' + st.dentro + ' vehículos dentro',
        body: items.map((i) => '<div class="alert-item" style="padding-left:0;padding-right:0">' +
          '<span class="alert-ico">' + U.icon(i[0]) + '</span><div><strong>' + U.esc(i[1]) + '</strong>' +
          '<small>' + U.esc(i[2]) + '</small></div></div>').join(''),
        foot: '<button class="btn btn-ghost" data-close>Cerrar</button>'
      });
    },

    bindGlobal() {
      document.addEventListener('click', (e) => {
        const viewEl = e.target.closest('[data-view]');
        if (viewEl && !e.target.closest('[data-action]')) {
          App.go(viewEl.dataset.view);
          return;
        }

        const actEl = e.target.closest('[data-act], [data-action]');
        if (!actEl) return;
        const act = actEl.dataset.act || actEl.dataset.action;

        switch (act) {
          case 'open-menu':
            document.getElementById('app').classList.add('menu-open');
            break;
          case 'close-menu':
            document.getElementById('app').classList.remove('menu-open');
            break;
          case 'logout':
            document.getElementById('app').hidden = true;
            document.getElementById('login').hidden = false;
            document.getElementById('login').scrollTop = 0;
            break;
          case 'quick-entry':
          case 'entrada-vehiculo':
            Views.accesoModal({ tipo: 'vehiculo' });
            break;
          case 'entrada-persona':
            Views.accesoModal({ tipo: 'persona' });
            break;
          case 'salida':
          case 'salida-modal':
            Views.salidaModal();
            break;
          case 'nuevo-vehiculo':
            Views.nuevoVehiculo();
            break;
          case 'nuevo-residente':
            Views.nuevoResidente();
            break;
          case 'alerts':
            App.alertsModal();
            break;
          default:
            break;
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.getElementById('app').classList.remove('menu-open');
        }
      });
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
