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

  function preprocess(video) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const sx = vw * 0.08, sw = vw * 0.84;
    const sy = vh * 0.30, sh = vh * 0.40;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 900 / sw);
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = g > 118 ? Math.min(255, (g - 118) * 2.3 + 118) : Math.max(0, g * 0.55);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function cleanPlate(text) {
    const raw = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length < 5) return '';
    const six = raw.slice(0, 6);
    if (/^[A-Z]{3}[0-9]{3}$/.test(six)) return six.slice(0, 3) + '-' + six.slice(3);
    return six;
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
        '<button class="icon-btn" data-cam="switch" aria-label="Cambiar cámara" style="color:#fff">' + U.icon('switch') + '</button>' +
        '</div>' +
        '<div class="cam-stage">' +
        '<video autoplay playsinline muted></video>' +
        '<img hidden alt="Captura de la placa">' +
        '<div class="cam-frame"><span></span><span></span><span></span><span></span></div>' +
        '<div class="cam-auto" data-auto hidden>AUTO · 3 s</div>' +
        '<div class="cam-hint" data-hint>Encuadra la placa dentro del recuadro</div>' +
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
      let autoTimer = null;
      let cdTimer = null;
      let startTimer = null;
      let busy = false;

      function setStatus(txt) { statusEl.textContent = txt || ''; }
      function clearTimers() { clearTimeout(autoTimer); clearTimeout(startTimer); clearInterval(cdTimer); }

      const close = (val) => {
        clearTimers();
        stop();
        el.remove();
        document.body.style.overflow = '';
        if (val && opts.onResult) opts.onResult(val, { manual: !foto, foto: foto });
      };

      function beginCountdown() {
        if (!opts.auto) return;
        clearTimers();
        let n = 3;
        autoBadge.hidden = false;
        autoBadge.textContent = 'AUTO · ' + n + ' s';
        setStatus('Captura automática en ' + n + '…');
        cdTimer = setInterval(() => {
          n--;
          if (n > 0) {
            autoBadge.textContent = 'AUTO · ' + n + ' s';
            setStatus('Captura automática en ' + n + '…');
          } else {
            clearInterval(cdTimer);
            setStatus('Capturando…');
          }
        }, 700);
        autoTimer = setTimeout(() => { clearTimers(); shot(true); }, 2200);
      }

      async function start() {
        setStatus('Encendiendo cámara…');
        startTimer = setTimeout(() => {
          if (!stream) {
            setStatus(window.isSecureContext
              ? 'No se pudo abrir la cámara. Usa una foto o escribe la placa.'
              : 'La cámara requiere http://localhost o HTTPS. Usa una foto o escribe la placa.');
            el.querySelector('[data-hint]').hidden = true;
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
          setStatus('');
          el.querySelector('[data-hint]').hidden = false;
          autoBadge.hidden = !opts.auto;
          beginCountdown();
        } catch (err) {
          clearTimeout(startTimer);
          const secure = window.isSecureContext;
          setStatus(secure
            ? 'No se pudo abrir la cámara. Usa una foto o escribe la placa.'
            : 'La cámara requiere http://localhost o HTTPS. Usa una foto o escribe la placa.');
          el.querySelector('[data-hint]').hidden = true;
          autoBadge.hidden = true;
          video.style.display = 'none';
        }
      }

      async function shot(auto) {
        clearTimers();
        if (!stream || !video.videoWidth) {
          input.focus();
          setStatus('Sin cámara: escribe la placa o sube una foto.');
          return;
        }
        if (busy) return;
        busy = true;

        foto = snapshot(video, 560);
        const canvas = preprocess(video);
        const img = el.querySelector('img');
        img.src = foto;
        img.hidden = false;
        video.style.display = 'none';
        el.querySelector('.cam-frame').style.display = 'none';
        el.querySelector('[data-hint]').hidden = true;
        el.querySelector('[data-cam="again"]').hidden = false;
        el.querySelector('[data-cam="shot"]').hidden = true;
        autoBadge.hidden = true;

        setStatus(auto ? 'Foto capturada · leyendo placa…' : 'Procesando imagen…');

        try {
          const T = await Promise.race([
            loadTesseract(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 11000))
          ]);
          const res = await T.recognize(canvas, 'eng', {
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
            logger: (m) => {
              if (m.status === 'recognizing text') setStatus('Leyendo placa… ' + Math.round(m.progress * 100) + '%');
            }
          });
          const plate = cleanPlate(res.data.text);
          const conf = Math.round(res.data.confidence || 0);
          if (plate) {
            input.value = plate;
            readout.hidden = false;
            readout.querySelector('strong').textContent = plate;
            setStatus('Placa leída · ' + conf + '% de confianza. Verifica y registra.');
          } else {
            setStatus('No se reconoció la placa. Corrige el texto o repite la foto.');
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
        const img = el.querySelector('img');
        img.hidden = true;
        video.style.display = '';
        el.querySelector('.cam-frame').style.display = '';
        el.querySelector('[data-cam="again"]').hidden = true;
        el.querySelector('[data-cam="shot"]').hidden = false;
        readout.hidden = true;
        input.value = '';
        setStatus('');
        beginCountdown();
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
        if (a === 'switch') { facing = facing === 'environment' ? 'user' : 'environment'; stop(); start(); }
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

    return { open };
  }

  global.Camera = Camera();
})(window);
