// A visual metaphor for a calm centre. All particles stay outside the boundary.
export function createAlignment(canvas, { compact = false, showCore = true, refinedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const wordmarkHost = showCore ? null : canvas.parentElement;
  const TAU = Math.PI * 2;
  const detailScale = compact ? 0.6 : 1;
  const particles = Array.from({ length: compact ? 10 : refinedMotion ? 14 : 18 }, (_, i) => ({
    angle: i * 2.399963,
    axis: i * 2.399963,
    offset: (i * 0.381966) % 1,
    period: refinedMotion ? 6.8 + (i % 7) * 0.49 : 5.3 + (i % 7) * 0.37,
    reach: 0.19 + (i % 5) * 0.024,
    direction: i % 2 ? 1 : -1,
    color: i % 4 ? "225,188,121" : "151,171,213",
  }));
  let width = 0,
    height = 0,
    time = 0,
    last = 0,
    raf = 0,
    visible = false,
    disposed = false;
  function glow(x, y, size, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(0.16, `rgba(${color},${alpha * 0.24})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  function position(p, phase, radius) {
    const impact = 0.62;
    const axis = refinedMotion ? p.axis : p.angle;
    // Keep each header comet's complete arrival inside the drawing area.
    const travel = !refinedMotion ? p.reach * width : Math.max(12, Math.min(
      p.reach * width,
      (width / 2 - 10) / Math.max(0.001, Math.abs(Math.cos(axis))) - radius,
      (height / 2 - 10) / Math.max(0.001, Math.abs(Math.sin(axis))) - radius,
    ));
    let distance, turn;
    if (phase < impact) {
      const inward = phase / impact;
      // Accelerate toward the boundary; do not ease to a halt before impact.
      distance = (1 - inward * inward) * travel;
      turn = !refinedMotion ? 0 : p.direction * (1 - inward) ** 2 * 0.16;
    } else {
      const outward = (phase - impact) / (1 - impact);
      // Reverse radial velocity immediately, then drift outward on a reflected path.
      distance = (1 - (1 - outward) ** 2) * travel;
      turn = p.direction * outward * (refinedMotion ? 0.64 : 0.42);
    }
    const angle = axis + turn;
    const r = radius + 2 + distance;
    return {
      x: width / 2 + Math.cos(angle) * r,
      y: height / 2 + Math.sin(angle) * r,
    };
  }
  function drawWordmarkBoundary(cx, cy, radius, contacts) {
    const count = Math.round(TAU * radius / 7.8);
    ctx.save();
    ctx.shadowColor = "#e9c887";
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + time * 0.038;
      // A slow travelling glint and the reflected contact light share one circle.
      let light = ((1 + Math.cos(angle - time * 0.24)) / 2) ** 18 * 0.32;
      for (const contact of contacts) {
        const distance = Math.abs(Math.atan2(
          Math.sin(angle - contact.angle), Math.cos(angle - contact.angle),
        ));
        const front = contact.phase * 0.9;
        light += Math.exp(-(((distance - front) / 0.1) ** 2)) *
          (1 - contact.phase) ** 2 * 0.65;
      }
      light = Math.min(1, light);
      ctx.shadowBlur = light * 8;
      ctx.fillStyle = `rgba(230,198,136,${0.5 + light * 0.45})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius,
        0.65 + light * 0.28, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function draw() {
    if (disposed || !canvas.isConnected || width < 5 || height < 5) return;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2,
      cy = height / 2,
      radius = Math.min(width * 0.26, height * 0.355);
    // Opaque interior masks the separate page background, too.
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, TAU);
    ctx.fillStyle = "#07080e";
    ctx.fill();
    glow(cx, cy, radius * 0.83, "221,185,119", 0.025);
    // Clip the complete particle layer, including bloom and tails, outside the ring.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(cx, cy, radius + 0.9, 0, TAU, true);
    ctx.clip("evenodd");
    const contacts = [];
    for (const p of particles) {
      const phase = (time / p.period + p.offset) % 1;
      if (refinedMotion) {
        const cycle = Math.floor(time / p.period + p.offset);
        p.axis = p.angle + Math.sin(cycle * 1.71 + p.angle) * 0.2;
      }
      const alpha = Math.min(1, phase * 9, (1 - phase) * 7) * 0.85;
      const at = position(p, phase, radius);
      // A bright head pulls a long, tapered wake. History traces the visible rebound.
      let previous = at;
      for (let j = 1; j <= 22; j++) {
        const u = Math.max(0, phase - j * 0.0038);
        const q = position(p, u, radius);
        const taper = (1 - j / 23) ** 1.7;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(q.x, q.y);
        ctx.lineCap = "round";
        ctx.lineWidth = (0.3 + taper * 1.3) * detailScale;
        ctx.strokeStyle = `rgba(${p.color},${alpha * taper * 0.78})`;
        ctx.stroke();
        previous = q;
      }
      glow(at.x, at.y, 16 * detailScale, p.color, alpha * 0.48);
      ctx.beginPath();
      ctx.arc(at.x, at.y, 1.55 * detailScale, 0, TAU);
      ctx.fillStyle = `rgba(255,235,195,${alpha})`;
      ctx.fill();
      if (refinedMotion && phase >= 0.62 && phase < 0.84) {
        const contact = (phase - 0.62) / 0.22;
        const x = cx + Math.cos(p.axis) * (radius + 2);
        const y = cy + Math.sin(p.axis) * (radius + 2);
        const fade = Math.sin(Math.min(1, contact * 8) * Math.PI / 2) *
          (1 - contact) ** 2;
        glow(x, y, 22, p.color, fade * 0.42);
        contacts.push({ angle: p.axis, phase: contact });
      } else if (!refinedMotion && phase >= 0.62 && phase < 0.7) {
        const contact = (phase - 0.62) / 0.08;
        const x = cx + Math.cos(p.angle) * (radius + 2);
        const y = cy + Math.sin(p.angle) * (radius + 2);
        glow(x, y, 27 * detailScale, p.color, (1 - contact) ** 2 * 0.65);
        // Impact fragments travel away; the centre remains completely untouched.
        for (let s = -1; s <= 1; s++) {
          const a = p.angle + s * 0.65,
            d = contact * 35 * detailScale;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
          ctx.lineTo(x + Math.cos(a) * (d + 3), y + Math.sin(a) * (d + 3));
          ctx.strokeStyle = `rgba(${p.color},${(1 - contact) * 0.65})`;
          ctx.lineWidth = 0.8 * detailScale;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    if (refinedMotion) {
      drawWordmarkBoundary(cx, cy, radius, contacts);
    } else {
      // One single dotted circumference, rotating as a whole over almost two minutes.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.055);
      ctx.setLineDash(compact ? [0.8, 4.5] : [1.3, 8.5]);
      ctx.lineCap = "round";
      ctx.lineWidth = compact ? 0.9 : 1.25;
      ctx.strokeStyle = "rgba(221,185,119,.76)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (!showCore) return;
    // Its light breathes independently of every impact: this centre stays at peace.
    const breath = 0.85 + Math.sin((time * TAU) / 9) * 0.15;
    const coreRadius = compact ? 1.8 : 3.2;
    glow(cx, cy, radius * 0.68, "226,185,111", 0.22 * breath);
    glow(cx, cy, radius * 0.29, "244,213,148", 0.5 * breath);
    glow(cx, cy, coreRadius * 6, "255,239,197", 0.72 * breath);
    ctx.save();
    ctx.shadowBlur = compact ? 7 : 16;
    ctx.shadowColor = "#ffe4a9";
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, TAU);
    ctx.fillStyle = "#fff7de";
    ctx.fill();
    ctx.restore();
  }
  function resize() {
    if (disposed || !canvas.isConnected) return;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (width < 5 || height < 5) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const pixelsWide = Math.round(width * dpr);
    const pixelsHigh = Math.round(height * dpr);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function tick(now) {
    raf = 0;
    if (disposed || !visible || motion.matches || document.hidden) return;
    if (now - last > 31) {
      time += Math.min((now - last) / 1000, 0.07);
      last = now;
      draw();
    }
    raf = requestAnimationFrame(tick);
  }
  function restart() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = performance.now();
    if (disposed) return;
    wordmarkHost?.classList.toggle("is-animating",
      visible && !motion.matches && !document.hidden);
    if (visible && !motion.matches && !document.hidden)
      raf = requestAnimationFrame(tick);
    else draw();
  }
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      restart();
    },
    { threshold: 0.05 },
  );
  const sizing = new ResizeObserver(resize);
  const restore = () => {
    resize();
    const r = canvas.getBoundingClientRect();
    visible =
      r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    restart();
  };
  sizing.observe(canvas);
  observer.observe(canvas);
  motion.addEventListener("change", restart);
  document.addEventListener("visibilitychange", restart);
  window.addEventListener("pageshow", restore);
  canvas.addEventListener("contextrestored", restore);
  resize();
  return () => {
    disposed = true;
    wordmarkHost?.classList.remove("is-animating");
    cancelAnimationFrame(raf);
    observer.disconnect();
    sizing.disconnect();
    motion.removeEventListener("change", restart);
    document.removeEventListener("visibilitychange", restart);
    window.removeEventListener("pageshow", restore);
    canvas.removeEventListener("contextrestored", restore);
  };
}
