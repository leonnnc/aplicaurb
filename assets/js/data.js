/* ══════════════════════════════════════════════════════════
   data.js — Modelo de datos + generador de padrón demo
   Todo vive en localStorage. No requiere servidor.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const KEY = 'urb.residencial.v1';
  const SCHEMA = 1;

  /* ---------- PRNG determinista (mismo demo en cada reset) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const NOMBRES = ['Ana', 'Luis', 'María', 'Jorge', 'Rosa', 'Carlos', 'Carmen', 'Miguel', 'Lucía', 'Pedro',
    'Elena', 'José', 'Patricia', 'Diego', 'Silvia', 'Fernando', 'Gabriela', 'Ricardo', 'Verónica', 'Marco',
    'Claudia', 'Andrés', 'Sofía', 'Raúl', 'Mónica', 'César', 'Isabel', 'Hugo', 'Daniela', 'Álvaro',
    'Teresa', 'Óscar', 'Natalia', 'Eduardo', 'Paola', 'Sergio', 'Karina', 'Julio', 'Alicia', 'Renzo',
    'Fiorella', 'Gonzalo', 'Milagros', 'Bruno', 'Camila', 'Iván', 'Rocío', 'Alonso', 'Fátima', 'Sebastián'];

  const APELLIDOS = ['Quispe', 'Flores', 'Rojas', 'Huamán', 'García', 'Rodríguez', 'Torres', 'Ramírez',
    'Chávez', 'Mendoza', 'Salazar', 'Vargas', 'Castro', 'Ríos', 'Paredes', 'Espinoza', 'Gutiérrez',
    'Herrera', 'Campos', 'Silva', 'Reyes', 'Aguilar', 'Ponce', 'Cabrera', 'Núñez', 'Delgado',
    'Cárdenas', 'León', 'Fuentes', 'Zamora', 'Bravo', 'Córdova', 'Palacios', 'Medina', 'Acosta',
    'Valdivia', 'Sotomayor', 'Rivera', 'Guevara', 'Ticona'];

  const COLORES = ['Blanco', 'Negro', 'Plata', 'Gris', 'Rojo', 'Azul', 'Verde', 'Beige'];
  const MARCAS = {
    auto: [['Toyota', 'Corolla'], ['Kia', 'Rio'], ['Hyundai', 'Accent'], ['Nissan', 'Sentra'], ['Chevrolet', 'Sail'],
      ['Suzuki', 'Swift'], ['Honda', 'Civic'], ['Mazda', 'Mazda 3'], ['Mitsubishi', 'Lancer'], ['Volkswagen', 'Gol']],
    camioneta: [['Toyota', 'Hilux'], ['Ford', 'Ranger'], ['Isuzu', 'D-Max'], ['Nissan', 'Frontier'], ['Mitsubishi', 'Montero']],
    moto: [['Bajaj', 'Pulsar 180'], ['Yamaha', 'FZ 2.0'], ['Honda', 'XR 150'], ['Suzuki', 'GL 150'], ['Bajaj', 'Boxer 150']]
  };

  const MANZANAS = [
    { k: 'A', calle: 'Av. San Lucas', etapa: 1 },
    { k: 'B', calle: 'Calle Los Sauces', etapa: 1 },
    { k: 'C', calle: 'Calle Las Begonias', etapa: 2 },
    { k: 'D', calle: 'Av. El Mirador', etapa: 2 }
  ];

  const MOTIVOS = ['Visita familiar', 'Delivery', 'Servicio técnico', 'Visita a residente', 'Proveedor', 'Taxi / app'];

  function pad(n, l) { return String(n).padStart(l || 2, '0'); }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function randInt(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  function plate(r, used) {
    const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let p;
    do {
      p = L[randInt(r, 0, L.length - 1)] + L[randInt(r, 0, L.length - 1)] + L[randInt(r, 0, L.length - 1)] +
        '-' + pad(randInt(r, 100, 999), 3);
    } while (used.has(p));
    used.add(p);
    return p;
  }

  /* ---------- Generación del padrón ---------- */
  function buildDemo() {
    const r = mulberry32(20261019);
    const now = Date.now();
    const usadas = new Set();
    const casas = [];
    const residentes = [];
    const vehiculos = [];
    const eventos = [];
    let evSeq = 0;

    const pushEv = (e) => {
      e.id = 'ev-' + (++evSeq);
      eventos.push(e);
      return e;
    };

    let nCasa = 0;
    MANZANAS.forEach((mz) => {
      for (let lote = 1; lote <= 25; lote++) {
        nCasa++;
        const id = mz.k + '-' + pad(lote);
        const vacia = r() < 0.04;
        casas.push({
          id, mz: mz.k, lote, calle: mz.calle, etapa: mz.etapa,
          estado: vacia ? 'desocupada' : 'habitada',
          metros: randInt(r, 120, 240),
          creada: now - randInt(r, 200, 1600) * 86400000
        });
        if (vacia) continue;

        const nRes = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.18 ? 1 : 0);
        const apellido = pick(APELLIDOS, r);
        for (let k = 0; k < nRes; k++) {
          const nombre = pick(NOMBRES, r) + ' ' + apellido + (k > 0 ? ' ' + pick(APELLIDOS, r) : '');
          residentes.push({
            id: 'r-' + id + '-' + k,
            nombre,
            doc: String(randInt(r, 10000000, 79999999)),
            telefono: '9' + String(randInt(r, 10000000, 99999999)),
            casaId: id,
            rol: k === 0 ? (r() < 0.7 ? 'propietario' : 'inquilino') : (r() < 0.5 ? 'familiar' : 'inquilino'),
            email: nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@correo.pe',
            activo: true
          });
        }

        const nVeh = r() < 0.22 ? 0 : (r() < 0.3 ? 2 : 1);
        for (let v = 0; v < nVeh; v++) {
          const tipo = r() < 0.24 ? 'moto' : (r() < 0.2 ? 'camioneta' : 'auto');
          const mm = pick(MARCAS[tipo], r);
          const residente = residentes.filter((x) => x.casaId === id)[v % nRes];
          vehiculos.push({
            id: 'v-' + id + '-' + v,
            placa: plate(r, usadas),
            tipo,
            marca: mm[0],
            modelo: mm[1],
            color: pick(COLORES, r),
            anio: randInt(r, 2012, 2026),
            casaId: id,
            residenteId: residente.id,
            residente: residente.nombre,
            activo: true,
            creado: now - randInt(r, 30, 900) * 86400000
          });
        }
      }
    });

    /* --- Viajes cerrados de vehículos (últimos 3 días) --- */
    vehiculos.forEach((v) => {
      const n = 1 + (r() < 0.45 ? 1 : 0);
      for (let t = 0; t < n; t++) {
        const day = Math.floor(r() * 3);
        const base = new Date(now - day * 86400000);
        base.setHours(randInt(r, 6, 20), randInt(r, 0, 59), 0, 0);
        let entrada = base.getTime();
        const dur = randInt(r, 20, 300);
        let salida = entrada + dur * 60000;
        if (salida > now - 5 * 60000) {
          salida = now - randInt(r, 10, 90) * 60000;
          entrada = salida - dur * 60000;
        }
        pushEv({
          ts: entrada, sentido: 'in', tipo: 'vehiculo', placa: v.placa, vehiculoId: v.id,
          casaId: v.casaId, nombre: v.residente, metodo: r() < 0.8 ? 'placa' : 'manual',
          detalle: v.marca + ' ' + v.modelo
        });
        pushEv({
          ts: salida, sentido: 'out', tipo: 'vehiculo', placa: v.placa, vehiculoId: v.id,
          casaId: v.casaId, nombre: v.residente, metodo: r() < 0.8 ? 'placa' : 'manual',
          detalle: v.marca + ' ' + v.modelo
        });
      }
    });

    /* --- Vehículos que están dentro ahora --- */
    const mezcla = vehiculos.slice().sort(() => r() - 0.5);
    mezcla.slice(0, 15).forEach((v) => {
      const ult = eventos.filter((e) => e.placa === v.placa).reduce((a, b) => Math.max(a, b.ts), 0);
      const desde = Math.max(ult + 45 * 60000, now - randInt(r, 25, 320) * 60000);
      pushEv({
        ts: Math.min(desde, now - 4 * 60000), sentido: 'in', tipo: 'vehiculo', placa: v.placa,
        vehiculoId: v.id, casaId: v.casaId, nombre: v.residente, metodo: 'placa',
        detalle: v.marca + ' ' + v.modelo
      });
    });

    /* --- Movimiento peatonal de residentes --- */
    const resSample = residentes.filter(() => r() < 0.24).slice(0, 46);
    resSample.forEach((p) => {
      const open = r() < 0.25;
      const day = Math.floor(r() * 2);
      const d = new Date(now - day * 86400000);
      d.setHours(randInt(r, 6, 21), randInt(r, 0, 59), 0, 0);
      let entrada = d.getTime();
      if (entrada > now - 10 * 60000) entrada = now - randInt(r, 40, 200) * 60000;
      pushEv({
        ts: entrada, sentido: 'in', tipo: 'persona', nombre: p.nombre, personaId: p.id,
        casaId: p.casaId, metodo: r() < 0.35 ? 'qr' : 'manual', detalle: 'Residente · ' + p.rol
      });
      if (!open) {
        const salida = entrada + randInt(r, 30, 260) * 60000;
        if (salida < now - 2 * 60000) {
          pushEv({
            ts: salida, sentido: 'out', tipo: 'persona', nombre: p.nombre, personaId: p.id,
            casaId: p.casaId, metodo: 'manual', detalle: 'Residente · ' + p.rol
          });
        }
      }
    });

    /* --- Visitas --- */
    for (let i = 0; i < 22; i++) {
      const casa = casas[randInt(r, 0, casas.length - 1)];
      if (casa.estado === 'desocupada') continue;
      const activa = i < 8;
      const day = activa ? 0 : Math.floor(r() * 2);
      const d = new Date(now - day * 86400000);
      d.setHours(randInt(r, 8, 20), randInt(r, 0, 59), 0, 0);
      let entrada = d.getTime();
      if (entrada > now - 15 * 60000) entrada = now - randInt(r, 30, 240) * 60000;
      const nombre = pick(NOMBRES, r) + ' ' + pick(APELLIDOS, r);
      const motivo = pick(MOTIVOS, r);
      const conPlaca = r() < 0.55;
      const pl = conPlaca ? plate(r, usadas) : null;
      pushEv({
        ts: entrada, sentido: 'in', tipo: 'visita', nombre, casaId: casa.id,
        placa: pl || '', metodo: pl ? 'placa' : 'manual', motivo, detalle: motivo
      });
      if (!activa) {
        const salida = entrada + randInt(r, 25, 220) * 60000;
        if (salida < now - 3 * 60000) {
          pushEv({
            ts: salida, sentido: 'out', tipo: 'visita', nombre, casaId: casa.id,
            placa: pl || '', metodo: 'manual', motivo, detalle: motivo
          });
        }
      }
    }

    /* --- Vehículos temporales (no registrados en el padrón) --- */
    [
      { placa: 'TMP-482', casaId: 'B-14', nombre: 'Delivery · Rappi', motivo: 'Delivery', tipoVehiculo: 'moto', autorizadoMin: 60, mins: 38 },
      { placa: 'TMP-917', casaId: 'C-07', nombre: 'Servicio técnico · Luz del Sur', motivo: 'Servicio técnico', tipoVehiculo: 'camioneta', autorizadoMin: 60, mins: 96 },
      { placa: 'TAX-118', casaId: 'D-12', nombre: 'Taxi · Yango', motivo: 'Taxi', tipoVehiculo: 'auto', autorizadoMin: 20, mins: 12 }
    ].forEach((t) => {
      pushEv({
        ts: now - t.mins * 60000, sentido: 'in', tipo: 'vehiculo', placa: t.placa,
        vehiculoId: null, casaId: t.casaId, nombre: t.nombre, metodo: 'camara',
        temporal: true, autorizadoMin: t.autorizadoMin, motivo: t.motivo,
        tipoVehiculo: t.tipoVehiculo, foto: null,
        detalle: 'Temporal · ' + t.motivo
      });
    });

    eventos.sort((a, b) => b.ts - a.ts);

    return {
      schema: SCHEMA,
      creado: now,
      demo: true,
      config: {
        nombre: 'URB San Lucas',
        direccion: 'Av. San Lucas 120 · Lima',
        casas: 100,
        aforo: 420,
        patronPlaca: '^[A-Z]{3}-?[0-9]{3}$',
        horasVisita: 4,
        permisosPorteria: ['accesos', 'vehiculos'],
        admin: 'Ana Lozano',
        telefono: '+51 987 654 321'
      },
      casas,
      residentes,
      vehiculos,
      eventos
    };
  }

  function buildEmpty() {
    return {
      schema: SCHEMA, creado: Date.now(), demo: false,
      config: {
        nombre: 'URB San Lucas', direccion: 'Av. San Lucas 120 · Lima', casas: 0, aforo: 0,
        patronPlaca: '^[A-Z]{3}-?[0-9]{3}$', horasVisita: 4,
        permisosPorteria: ['accesos', 'vehiculos'],
        admin: 'Administración', telefono: ''
      },
      casas: [], residentes: [], vehiculos: [], eventos: []
    };
  }

  /* ---------- Store ---------- */
  const DB = {
    state: null,
    available: true,

    load() {
      try {
        const raw = global.localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.schema === SCHEMA && Array.isArray(s.eventos)) {
            if (!Array.isArray(s.config.permisosPorteria)) s.config.permisosPorteria = ['accesos', 'vehiculos'];
            // migración de nombre anterior
            if (s.config.nombre === 'Residencial Los Álamos') s.config.nombre = 'URB San Lucas';
            if (s.config.direccion === 'Av. Los Álamos 120 · Lima') s.config.direccion = 'Av. San Lucas 120 · Lima';
            if (Array.isArray(s.casas)) {
              s.casas.forEach((h) => { if (h.calle === 'Av. Los Álamos') h.calle = 'Av. San Lucas'; });
            }
            this.state = s;
            // Los datos de demostración se archivan y se arranca en limpio
            if (s.demo === true) {
              try { global.localStorage.setItem(KEY + '.demo.backup', JSON.stringify(s)); } catch (e) { /* sin espacio */ }
              this.state = buildEmpty();
              this.save();
            }
            return this.state;
          }
        }
      } catch (err) {
        this.available = false;
        console.warn('localStorage no disponible, usando memoria.', err);
      }
      this.state = buildEmpty();
      this.save();
      return this.state;
    },

    save() {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (err) {
        this.available = false;
      }
    },

    reset(demo) {
      this.state = demo ? buildDemo() : buildEmpty();
      this.save();
      return this.state;
    },

    addEvento(ev) {
      const e = Object.assign({
        id: 'ev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        ts: Date.now()
      }, ev);
      this.state.eventos.unshift(e);
      this.state.eventos.sort((a, b) => b.ts - a.ts);
      this.save();
      return e;
    },

    addVehiculo(v) { this.state.vehiculos.unshift(v); this.save(); return v; },
    addResidente(r) { this.state.residentes.unshift(r); this.save(); return r; },
    removeVehiculo(id) { this.state.vehiculos = this.state.vehiculos.filter((v) => v.id !== id); this.save(); },
    removeResidente(id) { this.state.residentes = this.state.residentes.filter((r) => r.id !== id); this.save(); },
    updateConfig(patch) { Object.assign(this.state.config, patch); this.save(); }
  };

  global.DB = DB;
  global.Seed = { buildDemo, buildEmpty, KEY };
})(window);
