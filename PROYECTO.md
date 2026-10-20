# URB San Lucas — Control de accesos para una urbanización de 100 casas

## 1. La idea en una línea

Un panel único —web y móvil— donde la portería registra cada entrada y salida de personas y vehículos, el sistema calcula cuánto tiempo permanece cada uno dentro, y la administración ve todo en tiempo real sobre el plano de la urbanización.

No es "una web con formularios": es un **libro de garita digital, auditable y visual**.

---

## 2. El problema que resuelve

En una urb de ~100 casas y 200–300 residentes, la operación diaria tiene dolores concretos:

| Dolor actual | Consecuencia |
|---|---|
| Cuaderno o Excel en garita | Nadie sabe con certeza **quién está dentro ahora** |
| Vehículos entran sin registro | No hay tiempo de permanencia ni evidencia |
| Visitas sin control | Personas que se quedan horas sin aviso al residente |
| Padrón disperso (WhatsApp, papel) | Datos desactualizados y duplicados |
| Reclamos sin evidencia | "Mi auto salió a las 3", "entró un desconocido" |

**La propuesta:** que cada movimiento quede registrado en menos de 30 segundos, con placa, casa, sentido y hora, y que el tiempo dentro se calcule solo.

---

## 3. Concepto: un panel, tres momentos

```
        AUTORIZAR                REGISTRAR                 ANALIZAR
   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │ Casas            │    │ Garita           │    │ Panel en vivo    │
   │ Residentes       │───▶│ Entradas/salidas │───▶│ Reportes         │
   │ Vehículos        │    │ Placa + cámara   │    │ Permanencia      │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
```

Todo lo demás (mapa, alertas, ajustes) existe para sostener esos tres momentos.

---

## 4. Roles

| Rol | Qué hace | Alcance |
|---|---|---|
| **Administración** | Padrón, configuración, reportes, altas y bajas, datos de contacto | Todo |
| **Portería / Garita** | Solo dos pantallas: **Accesos** y **Vehículos**. Entra directo a la garita y registra entradas, salidas y temporales | Sin panel, mapa, padrón, reportes ni ajustes |
| **Vehículo no registrado** | No tiene cuenta ni ficha permanente | Ingreso temporal con tiempo autorizado |
| **Residente** (fase 2) | Autoriza visitas, ve su historial | Solo su casa |
| **Visita** | No tiene cuenta | Se registra en garita o por QR del residente |

**Permisos configurables.** En **Ajustes → Accesos de portería** el administrador decide qué secciones ve la garita: Panel, Mapa, Vehículos y Directorio. *Accesos* es obligatorio y *Reportes/Ajustes* están bloqueados para portería. Los cambios se aplican al siguiente inicio de sesión.

### Matriz de permisos

| Módulo | Administración | Portería |
|---|---|---|
| Panel operativo | Ver | Ver |
| Mapa / plano | Ver | Ver |
| Registrar accesos | Solo supervisar | Ver y registrar |
| Vehículos | Ver, crear, editar, eliminar | Solo consulta |
| Casas y residentes | Ver, crear, eliminar, datos de contacto | Directorio: nombre, rol y casa |
| Reportes y exportación | Ver y exportar | **Sin acceso** |
| Ajustes y respaldo | Ver y editar | **Sin acceso** |

La separación no es cosmética: la portería no debe poder exportar el padrón, ver teléfonos o documentos, ni borrar registros. En producción estas reglas se aplican **en el servidor** (políticas por fila en Postgres/Supabase), no ocultando botones en el navegador.

---

## 5. Los siete módulos

### 5.1 Panel general
- **Vehículos dentro** vs. flota registrada, **personas dentro**, **visitas activas**, **permanencia promedio** del día.
- Flujo de accesos por hora (entradas vs. salidas).
- Últimos movimientos en vivo.
- Ocupación por manzana y alertas (permanencia extendida, visita fuera de horario, lotes desocupados).

### 5.2 Mapa de la urbanización
- Plano **SVG interactivo**: 100 lotes en 4 manzanas, avenida principal, vías internas y dos garitas.
- Color por estado: blanco = sin movimiento, verde = vehículo dentro, ámbar = visita en curso.
- Buscador por lote, residente o placa (atenúa lo que no coincide).
- Clic en un lote → ficha con residentes, vehículos, estado y últimos accesos.

### 5.3 Accesos (garita) — exclusivo de portería

La interfaz de portería se reduce a **Accesos** y **Vehículos**, con un botón permanente **"Registrar entrada"** en la barra inferior (móvil) y en la barra superior (escritorio).
- Tres formularios: **Vehículo**, **Residente**, **Visita**. La administración solo supervisa.
- La acción principal es **"Escanear placa del vehículo"**: la cámara dispara **automáticamente a los 3 segundos**, muestra la foto y adjunta la evidencia al movimiento.
- El **tipo de vehículo** (auto, moto, camioneta, camión) se toma del padrón; en un ingreso temporal lo elige el guardia.
- La placa se **coteja contra el padrón**: si existe, muestra residente, casa, modelo y si ya está dentro.
- Si **no existe**, se registra un **ingreso temporal**: casa destino, motivo y **tiempo autorizado** (30 min a 8 h). No se agrega al padrón.
- **Taxi**: pestaña propia. Siempre es temporal, con tiempo autorizado entre **10 y 30 minutos** (20 por defecto) y sin alta en el padrón.
- Si el vehículo ya está dentro, el botón cambia a **"Registrar salida"** y se calcula la permanencia.
- Cada movimiento guarda **foto comprimida, hora, placa, tipo, casa y método**; la miniatura aparece en la lista.
- Panel "Dentro ahora" con cuenta regresiva de los temporales y salida en un toque.

### 5.4 Vehículos
- Padrón con placa, tipo (auto / camioneta / moto), marca, modelo, color, año, casa y residente.
- Estado dentro/fuera y permanencia actual.
- **Historial por placa**: cada estancia con entrada, salida y duración; total y promedio.
- Alta y baja (solo administración).

### 5.5 Casas y residentes
- Padrón de personas: nombre, documento, teléfono, rol (propietario / inquilino / familiar), casa.
- Filtro por manzana y búsqueda por nombre, casa o teléfono.
- Alta y baja de residentes; la casa pasa a "habitada" automáticamente.

### 5.6 Reportes
- **Estancias emparejadas**: cada entrada se cruza con su salida y se calcula la duración.
- Filtros por rango de fechas, tipo y texto (placa, persona o casa).
- Promedio y máximo de permanencia.
- Exportación a **CSV** (abre en Excel).

### 5.7 Ajustes
- Nombre y dirección de la urb, administrador, teléfono.
- Horas máximas de visita y patrón de placa configurable.
- Respaldo completo en **JSON** o empezar de cero.

---

## 6. Flujos clave

### Entrada vehicular (≈30 segundos)

```
1. Garita abre "Vehículo" y pulsa "Escanear placa con la cámara"
2. Apunta al vehículo  →  OCR propone "ABC-123"
3. El sistema coteja contra el padrón
4. ¿Existe?
   ├─ sí ──▶ residente, casa y modelo
   │         ├─ ya está dentro ──▶ "Registrar salida"
   │         └─ no está dentro ──▶ "Registrar entrada"
   └─ no ──▶ "Ingreso temporal"
             casa destino + motivo + tiempo autorizado (30 min a 8 h)
             no se agrega al padrón
5. Evento guardado: hora, placa, casa, método, tiempo autorizado
```

El temporal queda en "Dentro ahora" con cuenta regresiva. Al vencer, se marca en rojo y genera alerta; al salir se informa si excedió lo autorizado.

### Salida y tiempo de permanencia

```
entrada (abierta)  ──▶  salida  ──▶  duración = salida − entrada
                                    └─▶  alerta si supera 8 h
```

La permanencia **no se guarda como un dato editable**: se deriva del par entrada/salida. Así el historial es siempre consistente.

### Visita

```
Nombre + casa destino + motivo + placa (opcional)
   └─▶ contador de tiempo activo
        └─▶ alerta al superar las horas configuradas (4 h por defecto)
```

### Residente (peatonal)

```
Seleccionar del padrón → Entrada / Salida → evento con casa y rol
```

---

## 7. Modelo de datos

```sql
casas        (id 'A-01', mz, lote, calle, etapa, estado, metros)
residentes   (id, nombre, doc, telefono, email, casa_id, rol, activo)
vehiculos    (id, placa única, tipo, marca, modelo, color, anio,
              casa_id, residente_id, activo, creado)
eventos      (id, ts, sentido 'in'|'out', tipo 'vehiculo'|'persona'|'visita',
              placa, vehiculo_id, persona_id, nombre, casa_id,
              motivo, metodo 'camara'|'placa'|'manual'|'qr', nota)
config       (nombre, direccion, horas_visita, patron_placa, admin)
```

**Decisión de diseño central:** `eventos` es *append-only*. "Quién está dentro" se calcula con el último evento de cada placa o persona; nunca se escribe un flag mutable. Eso permite auditar, corregir y reconstruir cualquier estado pasado.

---

## 8. Arquitectura técnica

### Fase 1 — Prototipo local (ya construido)

```
index.html + CSS3 + JavaScript vanilla
        │
        ├── localStorage  (casas, residentes, vehículos, eventos)
        ├── SVG generado  (plano de 100 lotes)
        ├── getUserMedia  (cámara trasera del móvil)
        └── Tesseract.js  (OCR opcional, vía CDN)
```

Sin build, sin dependencias obligatorias, sin servidor. Se abre y funciona.

### Fase 2 — Producción recomendada

```
Móvil garita (PWA) ─┐
Desktop admin ──────┼── HTTPS ──▶  Supabase (Postgres + Auth + Storage)
Cámara LPR fija ────┘                    │
                                         ├── Realtime → panel en vivo
                                         ├── Storage  → foto de evidencia
                                         └── RLS      → permisos por rol
```

- **PWA offline-first**: Service Worker + IndexedDB. Si se cae el internet, la garita sigue registrando y sincroniza al volver. Crítico para portería.
- **Backend**: Supabase acelera (auth, base de datos, realtime, storage, políticas por rol). Alternativa: Node + Express + Prisma + PostgreSQL.
- **Tiempo real**: el panel se actualiza con cada evento, sin recargar.
- **Evidencias**: foto del vehículo y de la placa en cada acceso; retención configurable.
- **Seguridad**: contraseña para administración, PIN o sesión persistente para garita, registro de quién registró cada evento.

### OCR de placas: dos niveles

| Nivel | Tecnología | Cuándo |
|---|---|---|
| Móvil | Tesseract.js en el dispositivo | Ya incluido; gratis; exige que la placa llene el recuadro |
| Producción | API especializada (Plate Recognizer, OpenALPR) o SDK de cámara LPR | Garita fija, >95 % en condiciones controladas |

**Regla de oro:** el OCR *propone*, el guardia *confirma*. Ninguna placa se guarda sin validación humana. En el prototipo, si no hay conexión el OCR no está disponible y el campo manual sigue funcionando.

---

## 9. El fondo de la urb con sus calles

Hay tres formas de resolverlo, en orden de fidelidad:

| Opción | Ventaja | Costo |
|---|---|---|
| **A. Plano SVG esquemático** (implementado) | Liviano, se colorea por estado, zoom sin pérdida, editable | Hay que dibujarlo una vez |
| **B. Plano del arquitecto vectorizado** | Idéntico a la realidad | Requiere el DWG/PDF y vectorizar |
| **C. Imagen aérea/satelital de fondo + capa de lotes** | Muy realista | Licencia de imagen y georreferenciación |

**Recomendación:** si existe el plano del arquitecto, usarlo como base (B) y superponer estados. Si no, quedarse con el esquemático (A) y, opcionalmente, poner una foto aérea de fondo.

**Cómo digitalizar el plano real (fase 2):**
1. Numerar los lotes exactamente igual que el padrón (`A-01` … `D-25`).
2. Guardar la geometría de cada lote como GeoJSON en `casas.geometria`.
3. El mapa renderiza desde la base de datos, no desde coordenadas fijas.
4. Las garitas se marcan como puntos con su propio estado.

---

## 10. Reglas de negocio

- Una placa es **única** dentro del padrón.
- No se registra salida sin entrada previa (se avisa y se ofrece la entrada).
- Permanencia = `salida − entrada`; si no hay salida, se muestra "en curso".
- Alerta de permanencia vehicular: **> 8 h** (configurable).
- Alerta de visita: **> 4 h** (configurable).
- Todo vehículo no empadronado entra como **temporal** con tiempo autorizado; nunca se crea un registro permanente desde la garita.
- **Taxi**: mínimo 10 y máximo 30 minutos. El sistema acota el valor aunque se intente forzar desde el navegador.
- El temporizador se calcula desde la entrada; al vencer pasa a estado "excedido" y aparece en alertas.
- La administración **no registra accesos**: mantiene el padrón y supervisa.
- Aforo: máximo de vehículos dentro simultáneamente.
- Los eventos no se editan: se corrigen con un evento nuevo y una nota.

---

## 11. Privacidad y datos personales

En Perú aplica la **Ley 29733 de Protección de Datos Personales**. Implicaciones prácticas:

- Registrar solo lo necesario: nombre, casa, teléfono y placa.
- Avisar a residentes y visitantes que se registran accesos (cartel en garita).
- Las fotos de placas son evidencia: definir **retención** (p. ej. 30 días) y borrado automático.
- Acceso por rol: la portería no ve documentos ni exporta el padrón.
- Las exportaciones (CSV/JSON) quedan registradas y no se comparten por canales abiertos.
- No publicar el padrón ni el mapa con nombres en áreas comunes.

---

## 12. Roadmap

| Fase | Alcance | Tiempo estimado |
|---|---|---|
| **0. Prototipo** | Panel, mapa, accesos, padrón, reportes, cámara (este entregable) | Hecho |
| **1. Validación** | Probar con administración y 2 guardias; cargar padrón real; ajustar flujos | 1–2 semanas |
| **2. Producción** | Backend, auth por roles, PWA offline, evidencias, despliegue | 3–4 semanas |
| **3. Automatización** | LPR fija en garita, barrera, notificación al residente, QR de visita | 3–5 semanas |
| **4. Extras** | Reserva de áreas comunes, cuotas, libro de incidencias, app residente | Según prioridad |

---

## 13. Hardware (solo si se quiere automatizar)

- Celular o tablet Android resistente para la garita, con soporte y cargador.
- Cámara IP fija apuntando a la placa en cada garita (para LPR automático).
- Barrera vehicular con controlador (opcional; el sistema puede solo registrar).
- Router con respaldo eléctrico (UPS) para no perder conexión.
- Servidor: Supabase en la nube o mini PC local si se exige que los datos no salgan de la urb.

No incluyo precios porque dependen del proveedor y del tipo de cambio: conviene cotizar con 2–3 integradores locales antes de decidir.

---

## 14. Métricas de éxito

- **% de accesos con placa leída automáticamente** (meta: >70 % en móvil, >95 % con cámara fija).
- **Tiempo medio de registro** por vehículo (meta: <30 s).
- **Vehículos sin salida registrada >12 h** (meta: <2 %).
- **Incidencias resueltas con evidencia** (meta: 100 % de los reclamos).
- **Adherencia de garita**: eventos registrados por turno vs. vehículos observados.

---

## 15. Lo que ya está construido en esta carpeta

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura, login por rol, shell del dashboard |
| `assets/css/styles.css` | Sistema de diseño responsive (móvil, tablet, desktop) |
| `assets/js/data.js` | Modelo de datos y almacenamiento local |
| `assets/js/core.js` | Utilidades, estancias, estadísticas, modales |
| `assets/js/camera.js` | Cámara del móvil, captura, OCR opcional |
| `assets/js/views-*.js` | Panel, mapa, accesos, vehículos, residentes, reportes |
| `assets/js/app.js` | Navegación, roles, acciones globales |
| `assets/img/hero.png` | Vista aérea de la urbanización (portada) |
| `iniciar.bat` | Servidor local para probar con cámara |

---

## 16. Cómo abrirlo

```bat
iniciar.bat
```

Abre `http://localhost:5500`. Es importante usar `localhost` (o HTTPS): los navegadores solo permiten la cámara en contextos seguros. Si abres el `index.html` con doble clic, todo funciona **excepto** la cámara en algunos navegadores; la entrada manual y la galería siguen disponibles.

---

## 17. Siguientes pasos sugeridos

1. **Validar el flujo con la garita real** durante una semana (¿cuántos toques necesita? ¿qué falta?).
2. **Definir el padrón real**: 100 casas, propietarios vs. inquilinos, vehículos autorizados.
3. **Elegir el plano**: ¿existe el DWG del arquitecto? Si sí, vectorizarlo.
4. **Decidir el alcance de fase 2**: backend + offline + evidencias.
5. **Recién después** evaluar cámara LPR fija y barrera.

> El error más común en estos proyectos es empezar por el hardware. El valor está en el registro ordenado; la automatización es una mejora, no el punto de partida.
