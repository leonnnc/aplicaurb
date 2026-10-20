/* ══════════════════════════════════════════════════════════
   camera.js — Captura automática de placa
   · Cámara trasera (getUserMedia)
   · Disparo automático a los 3 segundos (o manual)
   · Foto comprimida como evidencia del movimiento
   · OCR opcional con Tesseract.js
   · Entrada manual / galería como respaldo
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let tesseractPromise = null;

  function loadTesseract() {
    if (global.Tesseract) return Promise.resolve(global.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      const timer = setTimeout(() => { s.remove(); reject(new Error('timeout')); }, 9000);
      s.onload = () => { clearTimeout(timer); resolve(global.Tesseract); };
      s.onerror = () => { clearTimeout(timer); reject(new Error('offline')); };
      document.head.appendChild(s);
    });
    return tesseractPromise;
  }

  function preprocess(video, mode, targetW) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    // Recorte ceñido a la zona donde el guardia encuadra la placa
    const sw = vw * 0.40;
    const sh = vh * 0.18;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const width = targetW || 1000;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(sh * (width / sw));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v;
      if (mode === 'threshold') v = g > 125 ? 255 : 0;
      else v = Math.max(0, Math.min(255, (g - 128) * 1.9 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /* Valida y corrige confusiones típicas (O/0, I/1, S/5, B/8, G/6, Z/2).
     Devuelve "" si no cumple un formato real: así no se muestra basura. */
  function validPlate(text) {
    const s = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length < 5 || s.length > 7) return '';
    const isL = (c) => /[A-Z]/.test(c);
    const isD = (c) => /[0-9]/.test(c);
    const toL = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 6: 'G', 2: 'Z' };
    const toD = { O: '0', Q: '0', D: '0', I: '1', S: '5', B: '8', G: '6', Z: '2' };

    function build(len, letterCount) {
      let out = '';
      let changes = 0;
      for (let i = 0; i < len; i++) {
        const ch = s[i];
        if (i < letterCount) {
          if (isL(ch)) out += ch;
          else if (toL[ch]) { out += toL[ch]; changes++; }
          else return '';
        } else {
          if (isD(ch)) out += ch;
          else if (toD[ch]) { out += toD[ch]; changes++; }
          else return '';
        }
      }
      return changes <= 2 ? out : '';
    }

    function buildDigitsFirst(len, digitCount) {
      let out = '';
      let changes = 0;
      for (let i = 0; i < len; i++) {
        const ch = s[i];
        if (i < digitCount) {
          if (isD(ch)) out += ch;
          else if (toD[ch]) { out += toD[ch]; changes++; }
          else return '';
        } else {
          if (isL(ch)) out += ch;
          else if (toL[ch]) { out += toL[ch]; changes++; }
          else return '';
        }
      }
      return changes <= 2 ? out : '';
    }

    if (s.length === 6) {
      const auto = build(6, 3);
      if (/^[A-Z]{3}[0-9]{3}$/.test(auto)) return auto.slice(0, 3) + '-' + auto.slice(3);
      const moto = buildDigitsFirst(6, 4);
      if (/^[0-9]{4}[A-Z]{2}$/.test(moto)) return moto.slice(0, 4) + '-' + moto.slice(4);
      return '';
    }

    if (s.length === 5) {
      const moto = buildDigitsFirst(5, 4);
      if (/^[0-9]{4}[A-Z]$/.test(moto)) return moto.slice(0, 4) + '-' + moto.slice(4);
    }
    return '';
  }

  function biggestWord(data, width) {
    let best = null;
    const words = data.words || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const txt = String(w.text || '').replace(/[^A-Za-z0-9]/g, '');
      if (txt.length < 3) continue;
      const h = w.bbox.y1 - w.bbox.y0;
      if (!best || h > best.height) {
        best = { height: h, edge: w.bbox.x0 < 6 || w.bbox.x1 > width - 6 };
      }
    }
    if (!best && data.lines && data.lines.length) {
      const bb = data.lines[0].bbox;
      best = { height: bb.y1 - bb.y0, edge: bb.x0 < 6 || bb.x1 > width - 6 };
    }
    return best;
  }

  async function readPlate(video, targetW, modes) {
    const T = await loadTesseract();
    const list = modes || ['gray', 'threshold'];
    let best = { plate: '', conf: 0, h: 0, edge: false };
    for (let i = 0; i < list.length; i++) {
      const canvas = preprocess(video, list[i], targetW || 1000);
      const res = await T.recognize(canvas, 'eng', {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7'
      });
      const conf = Math.round(res.data.confidence || 0);
      const plate = validPlate(res.data.text);
      const box = biggestWord(res.data, canvas.width);
      if (plate && conf > best.conf) {
        best = { plate: plate, conf: conf, h: box ? box.height : 0, edge: box ? box.edge : false };
      } else if (!plate && box && box.height > best.h) {
        best.h = box.height;
        best.edge = box.edge;
      }
      if (plate && conf >= 70) break;
    }
    return best;
  }

  /* Foto de evidencia: ancho máximo 560 px, JPEG comprimido */
  function snapshot(video, maxW) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(1, (maxW || 560) / vw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.58);
  }

  function fileToData(file, maxW) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, (maxW || 560) / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.58));
        };
        img.onerror = () => resolve(reader.result);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function Camera() {
    let stream = null, facing = 'environment', video = null, readout = null, input = null, statusEl = null;

    function stop() {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    }

    function render() {
      const el = document.createElement('div');
      el.className = 'cam';
      el.innerHTML =
        '<div class="cam-top">' +
        '<button class="icon-btn" data-cam="close" aria-label="Cerrar" style="color:#fff">' + U.icon('x') + '</button>' +
        '<h3>Escanear placa</h3>' +
        '<div class="cam-tools">' +
        '<button class="cam-tool" data-cam="torch" aria-label="Linterna" hidden>' + U.icon('flash') + '</button>' +
        '<button class="cam-tool" data-cam="zoom" aria-label="Zoom" hidden>1×</button>' +
        '<button class="icon-btn" data-cam="switch" aria-label="Cambiar cámara" style="color:#fff">' + U.icon('switch') + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="cam-stage">' +
        '<video autoplay playsinline muted></video>' +
        '<img hidden alt="Captura de la placa">' +
        '<div class="cam-frame"><span></span><span></span><span></span><span></span></div>' +
        '<div class="cam-auto" data-auto hidden>ESCANEANDO</div>' +
        '<div class="cam-hint" data-hint>Acerca la cámara: la placa debe llenar el recuadro</div>' +
        '<div class="cam-readout" data-readout hidden><small>Placa detectada</small><strong>—</strong></div>' +
        '</div>' +
        '<div class="cam-bottom">' +
        '<div class="cam-status" data-status></div>' +
        '<div class="cam-manual">' +
        '<input class="input" data-manual maxlength="8" placeholder="Escribir placa manual" autocomplete="off" spellcheck="false">' +
        '<button class="btn" data-cam="manual">Usar</button>' +
        '</div>' +
        '<div class="cam-actions">' +
        '<label class="cam-side" title="Subir foto">' + U.icon('camera') +
        '<input type="file" accept="image/*" capture="environment" data-file></label>' +
        '<button class="cam-shutter" data-cam="shot" aria-label="Capturar"><i></i></button>' +
        '<button class="cam-side" data-cam="again" aria-label="Repetir" hidden>' + U.icon('time') + '</button>' +
        '</div>' +
        '</div>';
      return el;
    }

    function open(opts) {
      opts = opts || {};
      const el = render();
      document.body.appendChild(el);
      document.body.style.overflow = 'hidden';
      video = el.querySelector('video');
      readout = el.querySelector('[data-readout]');
      input = el.querySelector('[data-manual]');
      statusEl = el.querySelector('[data-status]');
      const autoBadge = el.querySelector('[data-auto]');

      let foto = null;
      let scanTimer = null;
      let startTimer = null;
      let busy = false;
      let scanning = false;
      let closed = false;
      let startedAt = 0;
      const hintEl = el.querySelector('[data-hint]');

      function setStatus(txt) { statusEl.textContent = txt || ''; }
      function setHint(txt, tone) {
        hintEl.textContent = txt;
        hintEl.dataset.tone = tone || '';
      }
      function clearTimers() { clearTimeout(scanTimer); clearTimeout(startTimer); }

      const close = (val) => {
        closed = true;
        clearTimers();
        stop();
        el.remove();
        document.body.style.overflow = '';
        if (val && opts.onResult) opts.onResult(val, { manual: !foto, foto: foto });
      };

      function startScan() {
        if (!opts.auto) return;
        startedAt = Date.now();
        autoBadge.hidden = false;
        autoBadge.textContent = 'ESCANEANDO';
        setStatus('Buscando una placa…');
        scanTimer = setTimeout(loopScan, 500);
      }

      async function loopScan() {
        if (closed || !stream || scanning || foto) return;
        scanning = true;
        let r = { plate: '', conf: 0, h: 0, edge: false };
        try {
          r = await readPlate(video, 620, ['gray']);
        } catch (e) {
          scanning = false;
          setStatus('OCR no disponible sin conexión. Toma la foto y escribe la placa.');
          return;
        }
        scanning = false;
        if (closed || foto) return;

        if (r.plate && r.conf >= 45) {
          setStatus('Placa detectada · ' + r.plate);
          shot(false, r);
          return;
        }

        const elapsed = Date.now() - startedAt;
        if (r.h) {
          if (r.h < 24) {
            setHint('Acércate: la placa se ve pequeña', 'warn');
            setStatus('Acércate un poco para leer la placa…');
          } else if (r.h > 105 || r.edge) {
            setHint('Aléjate un poco: la placa está muy cerca', 'warn');
            setStatus('Aléjate un poco para encuadrarla…');
          } else {
            setHint('Mantén la placa dentro del recuadro', '');
            setStatus('Leyendo placa…');
          }
        } else if (elapsed > 6000) {
          setHint('Encuadra la movilidad completa', 'warn');
          setStatus('No se detecta placa. Encuadra la movilidad…');
        } else {
          setHint('Centra la placa dentro del recuadro', '');
          setStatus('Buscando una placa…');
        }

        if (elapsed > 11000) {
          shot(true, null, true);
          return;
        }
        scanTimer = setTimeout(loopScan, 700);
      }

      function setupTools(track) {
        if (!track) return;
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        const zoomBtn = el.querySelector('[data-cam="zoom"]');
        const torchBtn = el.querySelector('[data-cam="torch"]');

        if (zoomBtn && caps.zoom && caps.zoom.max > caps.zoom.min) {
          const min = caps.zoom.min;
          const max = caps.zoom.max;
          const step = Math.max(1, Math.round((max - min) / 4));
          let z = track.getSettings().zoom || min;
          const label = () => { zoomBtn.textContent = Math.round(1 + (z - min) / step) + '×'; };
          zoomBtn.hidden = false;
          label();
          zoomBtn.addEventListener('click', async () => {
            z = z + step > max ? min : z + step;
            try {
              await track.applyConstraints({ advanced: [{ zoom: z }] });
              label();
            } catch (e) { zoomBtn.hidden = true; }
          });
        }

        if (torchBtn && caps.torch) {
          let on = false;
          torchBtn.hidden = false;
          torchBtn.addEventListener('click', async () => {
            on = !on;
            try {
              await track.applyConstraints({ advanced: [{ torch: on }] });
              torchBtn.classList.toggle('is-on', on);
            } catch (e) { torchBtn.hidden = true; }
          });
        }
      }

      async function start() {
        setStatus('Encendiendo cámara…');
        startTimer = setTimeout(() => {
          if (!stream) {
            setStatus(window.isSecureContext
              ? 'No se pudo abrir la cámara. Usa una foto o escribe la placa.'
              : 'La cámara requiere http://localhost o HTTPS. Usa una foto o escribe la placa.');
            hintEl.hidden = true;
            autoBadge.hidden = true;
            video.style.display = 'none';
          }
        }, 6000);
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('unsupported');
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
          });
          clearTimeout(startTimer);
          video.srcObject = stream;
          await video.play();
          setupTools(stream.getVideoTracks()[0]);
          setStatus('');
          hintEl.hidden = false;
          autoBadge.hidden = !opts.auto;
          startScan();
        } catch (err) {
          clearTimeout(startTimer);
          const secure = window.isSecureContext;
          setStatus(secure
            ? 'No se pudo abrir la cámara. Usa una foto o escribe la placa.'
            : 'La cámara requiere http://localhost o HTTPS. Usa una foto o escribe la placa.');
          hintEl.hidden = true;
          autoBadge.hidden = true;
          video.style.display = 'none';
        }
      }

      async function shot(auto, pre, general) {
        clearTimers();
        if (!stream || !video.videoWidth) {
          input.focus();
          setStatus('Sin cámara: escribe la placa o sube una foto.');
          return;
        }
        if (busy) return;
        busy = true;

        foto = snapshot(video, 560);
        const img = el.querySelector('img');
        img.src = foto;
        img.hidden = false;
        video.style.display = 'none';
        el.querySelector('.cam-frame').style.display = 'none';
        hintEl.hidden = true;
        el.querySelector('[data-cam="again"]').hidden = false;
        el.querySelector('[data-cam="shot"]').hidden = true;
        autoBadge.hidden = true;

        if (general) {
          readout.hidden = true;
          setStatus('No se detectó placa. Foto general adjunta; escribe la placa.');
          busy = false;
          input.focus();
          input.select();
          return;
        }

        if (pre && pre.plate) {
          input.value = pre.plate;
          readout.hidden = false;
          readout.querySelector('strong').textContent = pre.plate;
          setStatus('Placa leída automáticamente · ' + pre.conf + '% de confianza. Verifica y registra.');
          busy = false;
          input.focus();
          input.select();
          return;
        }

        setStatus(auto ? 'Foto capturada · leyendo placa…' : 'Procesando imagen…');

        try {
          const r = await readPlate(video, 1000, ['gray', 'threshold']);
          if (r.plate && r.conf >= 40) {
            input.value = r.plate;
            readout.hidden = false;
            readout.querySelector('strong').textContent = r.plate;
            setStatus('Placa leída · ' + r.conf + '% de confianza. Verifica y registra.');
          } else {
            readout.hidden = true;
            setStatus('No se pudo leer con claridad. Acércate y repite, o escríbela.');
          }
        } catch (e) {
          setStatus('OCR no disponible sin conexión. Escribe la placa y usa la foto.');
        }
        busy = false;
        input.focus();
        input.select();
      }

      function again() {
        clearTimers();
        foto = null;
        busy = false;
        scanning = false;
        const img = el.querySelector('img');
        img.hidden = true;
        video.style.display = '';
        el.querySelector('.cam-frame').style.display = '';
        el.querySelector('[data-cam="again"]').hidden = true;
        el.querySelector('[data-cam="shot"]').hidden = false;
        readout.hidden = true;
        input.value = '';
        setStatus('');
        setHint('Centra la placa dentro del recuadro', '');
        startScan();
      }

      function submit(val) {
        const plate = U.fmtPlate(val);
        if (!plate || plate.replace(/\W/g, '').length < 4) {
          setStatus('Ingresa una placa válida.');
          input.focus();
          return;
        }
        close(plate);
      }

      el.addEventListener('click', (e) => {
        const act = e.target.closest('[data-cam]');
        if (!act) return;
        const a = act.dataset.cam;
        if (a === 'close') close(null);
        if (a === 'switch') { facing = facing === 'environment' ? 'user' : 'environment'; foto = null; scanning = false; stop(); start(); }
        if (a === 'shot') shot(false);
        if (a === 'again') again();
        if (a === 'manual') submit(input.value);
      });

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(input.value); });
      input.addEventListener('input', () => {
        const pos = input.selectionStart;
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        input.setSelectionRange(pos, pos);
        readout.hidden = true;
      });

      el.querySelector('[data-file]').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        clearTimers();
        const data = await fileToData(file, 560);
        if (!data) return;
        foto = data;
        const img = el.querySelector('img');
        img.src = data;
        img.hidden = false;
        video.style.display = 'none';
        el.querySelector('.cam-frame').style.display = 'none';
        el.querySelector('[data-cam="again"]').hidden = false;
        el.querySelector('[data-cam="shot"]').hidden = true;
        autoBadge.hidden = true;
        setStatus('Leyendo imagen…');
        try {
          const T = await loadTesseract();
          const res = await T.recognize(img, 'eng', { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-' });
          const plate = cleanPlate(res.data.text);
          if (plate) {
            input.value = plate;
            readout.hidden = false;
            readout.querySelector('strong').textContent = plate;
            setStatus('Verifica la lectura y confirma.');
          } else setStatus('No se reconoció. Escribe la placa manualmente.');
        } catch (err) {
          setStatus('OCR no disponible. Escribe la placa manualmente.');
        }
        input.focus();
      });

      start();
      return { close: () => close(null) };
    }

    return { open, validPlate };
  }

  global.Camera = Camera();
})(window);
