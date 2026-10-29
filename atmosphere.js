/** Luminous ribbons and drifting light: one continuous blue environment. */
const canvas = document.querySelector('#ambient-canvas');
if (canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const buffer = document.createElement('canvas');
  const ctx = buffer.getContext('2d', { alpha: false });
  const pageContext = canvas.getContext('2d', { alpha: false });
  const introCanvas = document.createElement('canvas');
  introCanvas.id = 'loader-atmosphere';
  introCanvas.setAttribute('aria-hidden', 'true');
  introCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.76';
  document.querySelector('#loader')?.prepend(introCanvas);
  const introContext = introCanvas.getContext('2d', { alpha: false });
  const spark = document.createElement('canvas');
  spark.width = spark.height = 64;
  const sparkContext = spark.getContext('2d');
  if (ctx && pageContext && introContext && sparkContext) {
    const light = sparkContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    light.addColorStop(0, 'rgba(219,252,255,.9)');
    light.addColorStop(.12, 'rgba(110,224,255,.65)');
    light.addColorStop(.35, 'rgba(13,151,255,.16)');
    light.addColorStop(1, 'rgba(0,95,255,0)');
    sparkContext.fillStyle = light;
    sparkContext.fillRect(0, 0, 64, 64);
    let width = 1, height = 1, density = 1, frame = 0, last = 0, paintCount = 0;
    let scrollTarget = 0, scrollPhase = 0, pointerX = 0, pointerY = 0;
    let pointerTargetX = 0, pointerTargetY = 0;
    const fract = value => value - Math.floor(value);
    const noise = seed => fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
    function pool(x, y, radius, center, edge) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, center);
      gradient.addColorStop(.44, edge);
      gradient.addColorStop(1, 'rgba(0,40,150,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    function wave(x, band, time, strand = 0) {
      const u = x / width * Math.PI * 2;
      const phase = time * (.68 + band * .12) + band * 1.9 + scrollPhase;
      return height * (.14 + band * .32)
        + Math.sin(u * .72 + phase) * height * .17
        + Math.sin(u * 1.46 - phase * .63) * height * .047
        + Math.sin(u * .37 + phase * .5 + strand * .07) * strand * 1.5
        + strand * 3.3 + pointerY * (15 + band * 12);
    }
    function ribbon(band, time) {
      const step = width < 700 ? 20 : 18;
      const thickness = height * (.08 + band * .015);
      const color = band === 1 ? '65,212,242' : band === 2 ? '39,129,255' : '33,96,255';
      ctx.beginPath();
      for (let x = -step; x <= width + step; x += step) {
        const y = wave(x, band, time);
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = width + step; x >= -step; x -= step) {
        ctx.lineTo(x, wave(x, band, time) + thickness * (1 + .23 * Math.sin(x / width * 5 + time)));
      }
      ctx.closePath();
      const wash = ctx.createLinearGradient(0, height * band * .25, width * .85, height);
      wash.addColorStop(0, `rgba(${color},.015)`);
      wash.addColorStop(.45, `rgba(${color},.14)`);
      wash.addColorStop(1, `rgba(${color},.025)`);
      ctx.fillStyle = wash;
      ctx.fill();
      const strands = width < 700 ? 14 : 23;
      for (let line = 0; line < strands; line++) {
        const centered = line - strands / 2;
        const strength = Math.pow(Math.max(0, 1 - Math.abs(centered) / (strands / 2)), 2);
        ctx.beginPath();
        ctx.lineWidth = strength > .92 ? 1.2 : .65;
        ctx.strokeStyle = `rgba(${color},${.018 + strength * .12})`;
        for (let x = -step; x <= width + step; x += step) {
          const y = wave(x + pointerX * 30, band, time, centered);
          if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const particles = width < 700 ? 7 : 13;
      for (let index = 0; index < particles; index++) {
        const seed = band * 31 + index;
        const travel = fract(noise(seed) + time * (.008 + noise(seed + 4) * .008));
        const x = travel * (width + 70) - 35;
        const lane = (noise(seed + 7) - .5) * 14;
        const y = wave(x, band, time, lane);
        const diameter = 5 + noise(seed + 2) * 10;
        ctx.globalAlpha = .2 + noise(seed + 6) * .32;
        ctx.drawImage(spark, x - diameter / 2, y - diameter / 2, diameter, diameter);
        if (index % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(x - 17, wave(x - 17, band, time, lane));
          ctx.lineTo(x, y);
          ctx.lineWidth = .65;
          ctx.strokeStyle = 'rgba(125,230,255,.38)';
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    function draw(now) {
      const time = reduced.matches ? 1.7 : now * .00025;
      pointerX += (pointerTargetX - pointerX) * .045;
      pointerY += (pointerTargetY - pointerY) * .045;
      scrollPhase += (scrollTarget - scrollPhase) * .035;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#020b27';
      ctx.fillRect(0, 0, width, height);
      pool(width * (.2 + Math.sin(time * .38) * .17) + pointerX * 30, height * .2, Math.max(width, height) * .8, 'rgba(0,67,255,.66)', 'rgba(0,43,185,.22)');
      pool(width * (.8 + Math.cos(time * .3) * .12), height * (.66 + Math.sin(time * .47) * .19), Math.max(width, height) * .65, 'rgba(0,145,230,.4)', 'rgba(0,63,190,.14)');
      pool(width * .46, height * (.7 + Math.cos(time * .25) * .34), width * .46, 'rgba(23,182,203,.12)', 'rgba(0,91,190,.06)');
      ctx.globalCompositeOperation = 'screen';
      for (let band = 0; band < 3; band++) ribbon(band, time);
      ctx.globalCompositeOperation = 'source-over';
      const shade = ctx.createRadialGradient(width * .5, height * .48, height * .08, width * .5, height * .48, Math.max(width, height) * .74);
      shade.addColorStop(0, 'rgba(0,7,26,.16)');
      shade.addColorStop(1, 'rgba(0,5,20,.04)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
      const introVisible = document.body.classList.contains('intro-active');
      (introVisible ? introContext : pageContext).drawImage(buffer, 0, 0);
      canvas.dataset.atmosphereFrame = String(++paintCount);
      canvas.dataset.atmosphereMotion = reduced.matches ? 'static' : 'flowing';
    }
    function resize() {
      width = innerWidth; height = innerHeight;
      density = Math.min(devicePixelRatio || 1, 1.5, 1920 / width, 1440 / height);
      for (const surface of [buffer, canvas, introCanvas]) {
        surface.width = Math.round(width * density);
        surface.height = Math.round(height * density);
      }
      ctx.setTransform(density, 0, 0, density, 0, 0);
      draw(performance.now());
      pageContext.drawImage(buffer, 0, 0);
      introContext.drawImage(buffer, 0, 0);
    }
    function animate(now) {
      frame = requestAnimationFrame(animate);
      const cadence = document.body.classList.contains('intro-active') ? 65 : width < 700 ? 50 : 40;
      if (document.hidden || now - last < cadence) return;
      last = now; draw(now);
    }
    function restart() {
      cancelAnimationFrame(frame);
      draw(performance.now());
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(animate);
    }
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', () => { scrollTarget = scrollY / Math.max(1, document.body.scrollHeight - height) * Math.PI * 2; }, { passive: true });
    window.addEventListener('pointermove', event => {
      if (reduced.matches || event.pointerType === 'touch') return;
      pointerTargetX = event.clientX / width - .5;
      pointerTargetY = event.clientY / height - .5;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { pointerTargetX = pointerTargetY = 0; }, { passive: true });
    document.addEventListener('visibilitychange', restart);
    reduced.addEventListener('change', restart);
    resize();
    if (!reduced.matches) frame = requestAnimationFrame(animate);
  }
}
