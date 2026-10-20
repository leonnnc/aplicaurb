# URB San Lucas · Control de accesos

Prototipo funcional de panel de portería para una urbanización de ~100 casas: registro de personas y vehículos, captura de placa desde el móvil, cálculo de permanencia y reportes.

**Stack:** HTML5 + CSS3 + JavaScript vanilla. Sin build, sin dependencias obligatorias, sin servidor.

## Abrir

```bat
iniciar.bat
```

o doble clic en `index.html` (la cámara puede quedar bloqueada; el resto funciona igual).

La cámara requiere `http://localhost` o HTTPS, por eso el `.bat` levanta un servidor local en el puerto 5500.

## Qué incluye

| Módulo | Descripción |
|---|---|
| Panel | KPIs en vivo, flujo por hora, últimos movimientos, alertas |
| Mapa | Plano SVG de 100 lotes, calles, garitas y estado por color |
| Accesos | Captura automática con foto, OCR, cotejo de placa, temporal y taxi (10–30 min) |
| Vehículos | Padrón, estado, permanencia e historial por placa |
| Residentes | Padrón de 100 casas con roles y contacto |
| Reportes | Entradas/salidas emparejadas, duración, filtros y CSV |
| Ajustes | Configuración, respaldo JSON, restaurar demo o vaciar |

## Roles

El administrador puede activar o desactivar las vistas de portería en **Ajustes → Accesos de portería**. Por defecto la garita solo ve Accesos y Vehículos; Reportes y Ajustes están bloqueados.

- **Administración**: todo, incluidos reportes, ajustes, altas/bajas y datos de contacto.
- **Portería**: solo Accesos y Vehículos, con botón permanente "Registrar entrada". Cámara + cotejo de placa, ingreso temporal con tiempo autorizado y consulta de vehículos. Sin panel, mapa, padrón, reportes ni ajustes.

## Datos

Todo se guarda en `localStorage` del navegador. La demo genera:

- 100 casas (manzanas A–D)
- ~200 residentes
- ~90 vehículos (autos, camionetas y motos)
- ~380 eventos de los últimos 3 días

Para reiniciar: **Ajustes → Restaurar demo**.

## Estructura

```
index.html
assets/
  css/styles.css
  img/hero.png
  js/
    data.js          modelo + generador demo
    core.js          utilidades, estancias, estadísticas
    camera.js        cámara + OCR opcional
    views-panel.js
    views-map.js
    views-access.js
    views-records.js
    views-reports.js
    app.js           arranque, navegación, roles
iniciar.bat
PROYECTO.md          documento de idea, alcance y arquitectura
```

## Limitaciones del prototipo

- Los datos viven solo en el navegador: no hay multiusuario ni sincronización entre dispositivos.
- El OCR es opcional (Tesseract.js por CDN) y depende de luz y ángulo; en producción se recomienda una API LPR o cámara fija.
- No hay autenticación real: el login es un selector de rol para demostración.
- Sin backend no hay evidencia fotográfica persistente ni auditoría de cambios.

La propuesta de producción (PWA offline + Supabase/Postgres + roles + evidencias) está en [PROYECTO.md](PROYECTO.md).
