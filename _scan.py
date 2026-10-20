import pathlib

p = pathlib.Path(r"D:\Documents\web\Urb\assets\js\camera.js")
s = p.read_text(encoding="utf-8")

# ---------- preprocess con ancho configurable ----------
s = s.replace("function preprocess(video, mode) {", "function preprocess(video, mode, targetW) {")
s = s.replace("    const targetW = 1000;\n", "    const width = targetW || 1000;\n")
s = s.replace("    canvas.width = targetW;\n    canvas.height = Math.round(sh * (targetW / sw));",
              "    canvas.width = width;\n    canvas.height = Math.round(sh * (width / sw));")

# ---------- lector con caja del texto ----------
a = s.index("  async function readPlate(video) {")
b = s.index("  /* Foto de evidencia: ancho máximo 560 px, JPEG comprimido */")
new_read = r'''  function biggestWord(data, width) {
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

'''
s = s[:a] + new_read + s[b:]

# ---------- badge ----------
s = s.replace('<div class="cam-auto" data-auto hidden>AUTO · 3 s</div>',
              '<div class="cam-auto" data-auto hidden>ESCANEANDO</div>')

# ---------- variables y helpers ----------
s = s.replace("""      let foto = null;
      let autoTimer = null;
      let cdTimer = null;
      let startTimer = null;
      let busy = false;

      function setStatus(txt) { statusEl.textContent = txt || ''; }
      function clearTimers() { clearTimeout(autoTimer); clearTimeout(startTimer); clearInterval(cdTimer); }""",
"""      let foto = null;
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
      function clearTimers() { clearTimeout(scanTimer); clearTimeout(startTimer); }""")

s = s.replace("""      const close = (val) => {
        clearTimers();
        stop();""",
"""      const close = (val) => {
        closed = true;
        clearTimers();
        stop();""")

# ---------- reemplazar bloque beginCountdown ... again ----------
a = s.index("      function beginCountdown() {")
b = s.index("      function submit(val) {")
new_block = r'''      function startScan() {
        if (!opts.auto) return;
        startedAt = Date.now();
        autoBadge.hidden = false;
        autoBadge.textContent = 'ESCANEANDO';
        setStatus('Buscando una placa…');
        loopScan();
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
          if (r.h < 26) {
            setHint('Acércate: la placa se ve pequeña', 'warn');
            setStatus('Acércate un poco para leer la placa…');
          } else if (r.h > 170 || r.edge) {
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

'''
s = s[:a] + new_block + s[b:]

# ---------- switch: reiniciar estado ----------
s = s.replace("if (a === 'switch') { facing = facing === 'environment' ? 'user' : 'environment'; stop(); start(); }",
              "if (a === 'switch') { facing = facing === 'environment' ? 'user' : 'environment'; foto = null; scanning = false; stop(); start(); }")

p.write_text(s, encoding='utf-8')
print('scan ok')
