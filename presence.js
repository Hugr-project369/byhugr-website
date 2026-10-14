// Approved light web V2, integrated with V4 scroll scenes and dialogs.
// Generative light only: no sensing, tracking, storage or requests.
export function createPresence(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const nodes = [], edges = [], roots = [[], []];
  let seed = 8031;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function addNode(x, y, z, side, depth, bridge = false) {
    // This geometry is constant: reuse it instead of repeating trigonometry per frame.
    const angle = Math.atan2(y - 0.5, x - 0.5) + Math.PI / 2;
    nodes.push({
      x,
      y,
      parent: -1,
      z,
      side,
      depth,
      bridge,
      heartX: 0.5 + Math.sin(angle) ** 3 * 0.32,
      heartY:
        (13 * Math.cos(angle) -
          5 * Math.cos(2 * angle) -
          2 * Math.cos(3 * angle) -
          Math.cos(4 * angle)) * 0.022,
      phase: random() * TAU,
      size: 0.35 + random(),
      px: 0,
      py: 0,
      lit: 0,
      near: 0,
      links: [],
    });
    return nodes.length - 1;
  }
  function addEdge(a, b, bridge = false) {
    const n = nodes[a],
      m = nodes[b];
    const length = Math.hypot(n.x - m.x, n.y - m.y);
    const e = {
      a,
      b,
      length,
      side: n.side,
      phase: random() * TAU,
      bend: (random() - 0.5) * 0.35,
      bridge,
      depth: clamp(0.66 + (n.z + m.z) * 0.24, 0.3, 1),
    };
    edges.push(e);
    if (m.parent < 0) m.parent = a;
    n.links.push([b, length]);
    m.links.push([a, length]);
  }
  // Each filament branches, curves and holds its topology as the landscape transforms.
  function branch(x, y, angle, length, depth, side, parent = -1, z = 0) {
    let previous = parent;
    for (let k = 0; k < 5; k++) {
      angle += (random() - 0.5) * 0.4;
      x += (Math.cos(angle) * length) / 5;
      y += (Math.sin(angle) * length) / 5;
      const id = addNode(x, y, z + (random() - 0.5) * 0.14, side, depth);
      if (previous >= 0) addEdge(previous, id);
      else roots[side].push(id);
      previous = id;
    }
    if (depth > 0) {
      branch(
        x,
        y,
        angle - 0.36 - random() * 0.23,
        length * 0.72,
        depth - 1,
        side,
        previous,
        z + (random() - 0.5) * 0.38,
      );
      branch(
        x,
        y,
        angle + 0.36 + random() * 0.23,
        length * 0.73,
        depth - 1,
        side,
        previous,
        z + (random() - 0.5) * 0.38,
      );
    }
  }
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 5; i++)
      branch(
        side ? 1.06 : -0.06,
        0.09 + i * 0.205,
        (side ? Math.PI : 0) + (2 - i) * 0.25,
        0.17 + random() * 0.065,
        4,
        side,
        -1,
        (random() - 0.5) * 0.9,
      );
    for (let i = 1; i < roots[side].length; i++)
      addEdge(roots[side][i - 1], roots[side][i]);
  }
  // Anastomoses connect neighbouring branches, avoiding a repeated tree silhouette.
  for (let i = 0; i < nodes.length; i += 3) {
    let best = -1,
      distance = 0.045;
    for (let j = i + 9; j < Math.min(i + 420, nodes.length); j += 4) {
      if (nodes[i].side !== nodes[j].side) continue;
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < distance && d > 0.012) {
        best = j;
        distance = d;
      }
    }
    if (best >= 0) addEdge(i, best);
  }
  function nearest(x, y, projected = false) {
    let best = 0,
      distance = Infinity;
    nodes.forEach((n, i) => {
      const d = projected
        ? Math.hypot(n.px - x, n.py - y)
        : Math.hypot(n.x - x, n.y - y);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    return best;
  }
  const sources = [nearest(0.18, 0.48), nearest(0.82, 0.48)];
  // The two worlds share one continuous bridge: the light really crosses between them.
  const left = nearest(0.27, 0.77),
    right = nearest(0.73, 0.77);
  let previous = left;
  for (let i = 1; i <= 40; i++) {
    const t = i / 41;
    const id = addNode(
      mix(nodes[left].x, nodes[right].x, t),
      mix(nodes[left].y, nodes[right].y, t) + Math.sin(t * TAU) * 0.047,
      -0.1,
      t > 0.5 ? 1 : 0,
      3,
      true,
    );
    addEdge(previous, id, true);
    previous = id;
  }
  addEdge(previous, right, true);
  // Dijkstra on the actual graph. Pulse timing follows connection length, not screen radius.
  function distances(source) {
    const dist = new Float32Array(nodes.length).fill(Infinity);
    dist[source] = 0;
    const heap = [[0, source]];
    const push = (value) => {
      let i = heap.length;
      heap.push(value);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= value[0]) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = value;
    };
    while (heap.length) {
      const [d, id] = heap[0],
        tail = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++;
          if (heap[c][0] >= tail[0]) break;
          heap[i] = heap[c];
          i = c;
        }
        heap[i] = tail;
      }
      if (d > dist[id] + 0.00001) continue;
      for (const [next, cost] of nodes[id].links) {
        const candidate = d + cost;
        if (candidate < dist[next]) {
          dist[next] = candidate;
          push([candidate, next]);
        }
      }
    }
    return dist;
  }
  // Relax intermediate knots while preserving endpoints and junctions.
  for (let pass = 0; pass < 3; pass++) {
    const positions = nodes.map(n => {
      if (n.links.length !== 2 || n.bridge) return [n.x, n.y];
      const a = nodes[n.links[0][0]], b = nodes[n.links[1][0]];
      return [mix(n.x, (a.x + b.x) * .5, .45), mix(n.y, (a.y + b.y) * .5, .45)];
    });
    nodes.forEach((n, i) => { [n.x, n.y] = positions[i]; });
  }
  edges.forEach(e => {
    const a = nodes[e.a], b = nodes[e.b];
    e.length = Math.max(.0001, Math.hypot(a.x - b.x, a.y - b.y));
  });
  nodes.forEach(n => n.links.forEach(link => {
    const b = nodes[link[0]]; link[1] = Math.max(.0001, Math.hypot(n.x - b.x, n.y - b.y));
  }));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const { signal } = abort;
  let width = 0, height = 0, time = 2.4, last = 0, raf = 0, nextBeat = 6.6, cycle = 1;
  let paused = motion.matches, active = true, disposed = false, lost = false, lastTouch = -10;
  const pointer = { x: .5, y: .5, active: false, strength: 0 };
  const smooth = { x: .5, y: .5 };
  const pulses = [];
  let modal = false, scroll = 0, scrollTarget = 0;
  const palette = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    return [mix(231, 151, t), mix(186, 164, t), mix(113, 237, t)].map(Math.round);
  });
  const colors = palette.map(c => c.join(','));
  const colorAt = x => { const t = clamp((x - .35) / .3); return Math.round(t * t * (3 - 2 * t) * 23); };
  const glows = colors.map(color => {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, `rgba(${color},.8)`);
    grad.addColorStop(.045, `rgba(${color},.55)`);
    grad.addColorStop(.16, `rgba(${color},.15)`);
    grad.addColorStop(.45, `rgba(${color},.025)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 96, 96); return c;
  });
  const background = document.createElement('canvas');
  const backgroundCtx = background.getContext('2d', {alpha: false});
  const dust = Array.from({ length: 220 }, () => ({ x: random(), y: random(), z: random(), phase: random() * TAU }));
  const automaticDistances = sources.map(distances);
  edges.forEach((e, id) => {
    e.id = id;
    e.color = colorAt((nodes[e.a].x + nodes[e.b].x) * .5);
    e.head = {x: 0, y: 0};
    e.activePulses = []; e.alphas = new Float32Array(9);
  });
  nodes.forEach(n => {
    n.color = colorAt(n.x);
    n.depthAlpha = clamp(.67 + n.z * .45, .25, 1);
    n.wave = [Math.sin(n.y * 4.2), Math.cos(n.y * 4.2), Math.sin(n.x * 5), Math.cos(n.x * 5), Math.cos(n.x * 4), Math.sin(n.x * 4), Math.sin(n.y * 6), Math.cos(n.y * 6)];
  });
  const SPEED = .235;
  const combinedLayer = [null];
  function sendPulse(source, strength = .82) {
    const index = sources.indexOf(source);
    const dist = index < 0 ? distances(source) : automaticDistances[index];
    const arrivals = Float32Array.from(dist, d => d / SPEED);
    const paths = edges.map(e => {
      const a = dist[e.a], b = dist[e.b];
      return { begin: Math.min(a,b) / SPEED - .4,
        end: (Math.max(a,b) + e.length) / SPEED + 1.8,
        samples: Float32Array.from({length: 9}, (_, k) => Math.min(a + e.length*k/8, b + e.length*(1-k/8)) / SPEED) };
    });
    pulses.push({ start: time, dist, arrivals, paths, strength });
    if (pulses.length > 4) pulses.shift();
  }
  sendPulse(sources[0]);
  pulses[0].start = .8;
  function envelope(age) {
    if (age < -.35 || age > 1.8) return 0;
    return Math.exp(-((age / (age < 0 ? .13 : .42)) ** 2))
      + .16 * Math.exp(-(((age - .55) / .25) ** 2));
  }
  function glow(x, y, size, color, alpha) {
    if (alpha < .004) return;
    ctx.globalAlpha = clamp(alpha);
    ctx.drawImage(glows[color], x - size * .5, y - size * .5, size, size);
    ctx.globalAlpha = 1;
  }
  function trace(e) {
    const a = nodes[e.a], b = nodes[e.b];
    ctx.beginPath(); ctx.moveTo(a.px, a.py);
    ctx.bezierCurveTo(e.c1x, e.c1y, e.c2x, e.c2y, b.px, b.py);
  }
  function curve(e, t, out) {
    const a = nodes[e.a], b = nodes[e.b], u = 1 - t;
    out.x = u*u*u*a.px + 3*u*u*t*e.c1x + 3*u*t*t*e.c2x + t*t*t*b.px;
    out.y = u*u*u*a.py + 3*u*u*t*e.c1y + 3*u*t*t*e.c2y + t*t*t*b.py;
    return out;
  }
  // Each branch uses its predecessor and continuing child for a continuous spline.
  nodes.forEach((n, id) => { n.id = id; n.child = n.links.find(([i]) => nodes[i].parent === id)?.[0] ?? -1; });
  function controls(e) {
    const a = nodes[e.a], b = nodes[e.b];
    const dx = b.px - a.px, dy = b.py - a.py;
    if (b.parent !== e.a) {
      const bend = e.bend * .3;
      e.c1x = a.px + dx / 3 - dy * bend; e.c1y = a.py + dy / 3 + dx * bend;
      e.c2x = a.px + dx * 2 / 3 - dy * bend; e.c2y = a.py + dy * 2 / 3 + dx * bend;
      return;
    }
    const before = a.parent < 0 ? {px: a.px - dx, py: a.py - dy} : nodes[a.parent];
    const after = b.child < 0 ? {px: b.px + dx, py: b.py + dy} : nodes[b.child];
    const limit = Math.hypot(dx, dy) * .45;
    let ax = (b.px - before.px) / 6, ay = (b.py - before.py) / 6;
    let bx = (after.px - a.px) / 6, by = (after.py - a.py) / 6;
    const as = Math.min(1, limit / (Math.hypot(ax, ay) || 1));
    const bs = Math.min(1, limit / (Math.hypot(bx, by) || 1));
    e.c1x = a.px + ax * as; e.c1y = a.py + ay * as;
    e.c2x = b.px - bx * bs; e.c2y = b.py - by * bs;
  }
  function sectionProgress() {
    const hero = document.querySelector("#hero"),
      statement = document.querySelector("#heart"),
      join = document.querySelector("#join");
    if (!hero || !statement || !join) return 0;
    const y = window.scrollY + height * 0.5;
    const middle =
      statement.getBoundingClientRect().top +
      window.scrollY +
      statement.offsetHeight * 0.5;
    const end =
      join.getBoundingClientRect().top +
      window.scrollY +
      join.offsetHeight * 0.5;
    if (y < middle)
      return (
        clamp(
          (y - hero.offsetHeight * 0.5) / (middle - hero.offsetHeight * 0.5),
        ) * 2
      );
    return 2 + clamp((y - middle) / Math.max(1, end - middle)) * 2;
  }
  function draw() {
    if (disposed || lost || width < 2 || height < 2) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.drawImage(background, 0, 0, width, height);
    const small = width < 700;
    const heart = Math.max(0, 1 - Math.abs(scroll - 2) * 1.2);
    const meeting = Math.max(0, 1 - Math.abs(scroll - 4));
    const breath = Math.sin(time * .23) * .004;
    const phase = [Math.cos(time*.115), Math.sin(time*.115), Math.cos(time*.08), Math.sin(time*.08), Math.cos(time*.095), Math.sin(time*.095), Math.cos(time*.07), Math.sin(time*.07)];
    ctx.globalCompositeOperation = 'lighter';
    for (const s of dust) {
      const x = (s.x * width + Math.sin(time * .018 + s.phase) * 9 * s.z + (smooth.x - .5) * s.z * 22 + width) % width;
      const y = (s.y * height + Math.cos(time * .025 + s.phase) * 6 * s.z + (smooth.y - .5) * s.z * 16 + height) % height;
      const alpha = (.1 + s.z * .2) * (.75 + Math.sin(time * .3 + s.phase) * .15);
      ctx.fillStyle = `rgba(221,215,208,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, .22 + s.z * .45, 0, TAU); ctx.fill();
      if (s.z > .98) glow(x, y, 16, Math.round(s.x * 23), .09);
    }
    for (const n of nodes) {
      // A shared low-frequency field deforms whole branches rather than shaking their tips.
      const w = n.wave;
      const dx = (w[0]*phase[0] + w[1]*phase[1])*.009 + (w[2]*phase[2] - w[3]*phase[3])*.004;
      const dy = (w[4]*phase[4] - w[5]*phase[5])*.012 + (w[6]*phase[6] + w[7]*phase[7])*.004;
      let x = .5 + (n.x - .5) * (1 + breath) + dx;
      let y = .5 + (n.y - .5) * (1 + breath) + dy;
      // Portrait gets its own open composition, not a crop through a dense hotspot.
      if (small) { x = .5 + (x - .5) * 1.3; y = .5 + (y - .5) * .84; }
      // Preserve the approved site's heart and final convergence as the reader scrolls.
      const hy = .51 - n.heartY * Math.min(1, (width / height) * 1.25);
      x = mix(x, n.heartX + (n.x - .5) * .04, heart * .9);
      y = mix(y, hy + (n.y - .5) * .07, heart * .9);
      x = mix(x, .5 + (n.x - .5) * .66, meeting * .5);
      y = mix(y, .55 + (n.y - .5) * .78, meeting * .5);
      n.px = x * width + (smooth.x - .5) * (12 + n.z * 22);
      n.py = y * height + (smooth.y - .5) * (8 + n.z * 16);
      // Retain the existing reading veil so the background never competes with copy.
      n.veil = 1 - (1 - heart * .6) * .52 * Math.exp(-(
        ((n.px / width - .5) / .23) ** 2 + ((n.py / height - .45) / .28) ** 2
      ));
      const pdx = n.px - pointer.x * width, pdy = n.py - pointer.y * height;
      n.near = pointer.strength * Math.exp(-(pdx*pdx + pdy*pdy) / (small ? 8100 : 21025));
      n.lit = 0;
      for (const pulse of pulses) n.lit += envelope(time - pulse.start - pulse.arrivals[n.id]) * pulse.strength;
      n.lit = Math.min(small ? .85 : 1.2, n.lit);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      if ((a.px < -40 && b.px < -40) || (a.px > width + 40 && b.px > width + 40) || (a.py < -40 && b.py < -40) || (a.py > height + 40 && b.py > height + 40)) continue;
      controls(e);
      const near = Math.max(a.near, b.near);
      const lit = Math.max(a.lit, b.lit);
      const depth = (a.depthAlpha + b.depthAlpha) * .5;
      const veil = (a.veil + b.veil) * .5;
      const alpha = (.11 + depth * .115 + near * .26) * (e.bridge ? 1.22 : 1) * veil;
      ctx.strokeStyle = `rgba(${colors[e.color]},${alpha})`;
      ctx.lineWidth = .42 + depth * .34;
      trace(e); ctx.stroke();
      if (near > .05 || lit > .03) {
        ctx.strokeStyle = `rgba(${colors[e.color]},${(lit * .028 + near * .02) * veil})`;
        ctx.lineWidth = 3.2;
        trace(e); ctx.stroke();
      }
      // Additive trails of the same colour can share a gradient without losing detail.
      const activePulses = e.activePulses; activePulses.length = 0;
      for (const p of pulses) if (time-p.start >= p.paths[e.id].begin && time-p.start <= p.paths[e.id].end) activePulses.push(p);
      if (!activePulses.length || Math.hypot(b.px-a.px, b.py-a.py) < .01) continue;
      const alphas = e.alphas; alphas.fill(0);
      let maximum = 0;
      for (const pulse of activePulses) {
        const age = time-pulse.start, arrivals = pulse.paths[e.id].samples;
        for (let k=0;k<=8;k++) {
          alphas[k] += Math.min(.7, envelope(age-arrivals[k])*pulse.strength*.55);
          maximum = Math.max(maximum, alphas[k]);
        }
      }
      const layers = maximum <= 1 ? combinedLayer : activePulses;
      for (const layer of layers) {
        if (maximum === 0) break;
        const gradient = ctx.createLinearGradient(a.px, a.py, b.px, b.py);
        for (let k=0;k<=8;k++) {
          const alpha = layer ? Math.min(.7, envelope(time-layer.start-layer.paths[e.id].samples[k])*layer.strength*.55) : alphas[k];
          gradient.addColorStop(k/8, `rgba(${colors[e.color]},${alpha * veil})`);
        }
        ctx.lineWidth = .72 + depth*.3; ctx.strokeStyle = gradient;
        trace(e); ctx.stroke();
      }
      for (const pulse of activePulses) {
        const da = pulse.dist[e.a], db = pulse.dist[e.b];
        const age = time-pulse.start;
        // The head follows the exact same cubic; the trail stays visible between frames.
        const direction = da <= db ? 1 : -1;
        const progress = (age * SPEED - Math.min(da, db)) / e.length;
        if (progress >= 0 && progress <= 1) {
          const p = curve(e, direction > 0 ? progress : 1 - progress, e.head);
          glow(p.x, p.y, small ? 17 : 23, e.color, pulse.strength * .42 * veil);
          ctx.fillStyle = `rgba(255,236,205,${pulse.strength * .8 * veil})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, small ? .5 : .7, 0, TAU); ctx.fill();
        }
      }
    }
    for (const n of nodes) {
      if (n.px < -20 || n.px > width + 20 || n.py < -20 || n.py > height + 20) continue;
      const energy = n.lit * .55 + n.near * .3;
      const alpha = Math.min(.86, .12 + n.size * .08 + energy) * n.veil;
      ctx.fillStyle = `rgba(${colors[n.color]},${alpha})`;
      ctx.beginPath(); ctx.arc(n.px, n.py, (.2 + n.size * .32 + energy * .28) * (small ? .8 : 1), 0, TAU); ctx.fill();
      if ((n.id % 19 === 0 && energy > .08) || n.near > .65) glow(n.px, n.py, 20 + energy * 19, n.color, energy * .27 * n.veil);
    }
    // Fine companion fibres gently braid around the connecting thread.
    for (let strand = 0; strand < 7; strand++) {
      const offset = (strand - 3) * .0026;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = t * width;
        const y = height * (.776 + Math.sin(t * TAU + time * .095 + strand * .055) * (.034 + strand * .0018) + offset);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = .4;
      ctx.strokeStyle = `rgba(${colors[4 + strand * 2]},${(.028 + .012 * Math.sin(time * .13 + strand)) * (1 - heart * .7)})`;
      ctx.stroke();
    }
    for (const id of sources) {
      const n = nodes[id];
      glow(n.px, n.py, (small ? 80 : 130) + n.lit * 34, n.color, .16 + n.lit * .15);
      glow(n.px, n.py, 22, n.color, .15 + n.lit * .25);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function frame(now) {
    raf = 0;
    if (paused || !active || disposed || document.hidden || lost) return;
    if (now - last < 1000 / 40 - 1) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min((now - last) / 1000, .05); last = now; time += dt * (modal ? .55 : 1);
    scroll += (scrollTarget - scroll) * (1 - Math.exp(-dt * 1.4));
    const follow = 1 - Math.exp(-dt * 2.7);
    smooth.x += (pointer.x - smooth.x) * follow; smooth.y += (pointer.y - smooth.y) * follow;
    pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt * 4));
    if (time >= nextBeat) { sendPulse(sources[cycle++ % 2]); nextBeat = time + 7.8; }
    while (pulses.length && time - pulses[0].start > 18) pulses.shift();
    draw(); raf = requestAnimationFrame(frame);
  }
  function restart() {
    cancelAnimationFrame(raf); raf = 0; last = performance.now();
    if (!paused && active && !disposed && !document.hidden && !lost) raf = requestAnimationFrame(frame);
  }
  function resize() {
    const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
    if (width < 2 || height < 2) return;
    const dpr = Math.min(devicePixelRatio || 1, width < 700 ? 1.75 : 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background.width = canvas.width; background.height = canvas.height;
    backgroundCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backgroundCtx.fillStyle = '#07080e'; backgroundCtx.fillRect(0, 0, width, height);
    const size = Math.min(width, height * 1.5) * 2.8;
    backgroundCtx.globalAlpha = .24;
    backgroundCtx.drawImage(glows[0], width * -.1 - size / 2, height * .58 - size / 2, size, size);
    backgroundCtx.globalAlpha = .20;
    backgroundCtx.drawImage(glows[23], width * 1.13 - size / 2, height * .36 - size / 2, size, size);
    backgroundCtx.globalAlpha = 1;
    scroll = scrollTarget = sectionProgress();
    draw();
  }
  function setPaused(value) {
    paused = value; pointer.active = false;
    document.documentElement.classList.toggle('motion-paused', paused);
    document.dispatchEvent(new CustomEvent('hugr-motion', {detail: {paused}}));
    restart();
  }
  function setActive(value) { active = value; pointer.active = false; if (active) resize(); restart(); }
  function position(e) {
    const box = canvas.getBoundingClientRect();
    pointer.x = clamp((e.clientX - box.left) / box.width);
    pointer.y = clamp((e.clientY - box.top) / box.height);
  }
  document.addEventListener('pointermove', e => { if (paused || modal) return; position(e); pointer.active = e.pointerType !== 'touch'; }, { signal, passive: true });
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) { pointer.active = false; pointer.x = pointer.y = .5; } }, { signal });
  let start = null;
  document.addEventListener('pointerdown', e => { start = {x: e.clientX, y: e.clientY, at: performance.now()}; position(e); }, { signal, passive: true });
  document.addEventListener('pointercancel', () => { start = null; pointer.active = false; }, { signal });
  document.addEventListener('pointerup', e => {
    if (!start || paused || !active || modal || !(e.target instanceof Element) ||
      e.target.closest('a,button,summary,input,textarea,select,dialog') ||
      !e.target.closest('#hero,#heart,#join')) { start = null; return; }
    const valid = Math.hypot(e.clientX - start.x, e.clientY - start.y) < 12 && performance.now() - start.at < 600;
    start = null;
    if (!valid || time - lastTouch < .5) return;
    position(e); sendPulse(nearest(pointer.x * width, pointer.y * height, true), 1); lastTouch = time;
  }, { signal, passive: true });
  document.addEventListener('hugr-dialog', e => {
    modal = Boolean(e.detail.open); pointer.active = false; pointer.strength = 0; start = null;
  }, { signal });
  window.addEventListener('scroll', () => {
    scrollTarget = sectionProgress();
    if (paused) { scroll = scrollTarget; draw(); }
  }, { signal, passive: true });
  // Language changes rebuild page sections without resizing the fixed background.
  const layout = new ResizeObserver(() => {
    scrollTarget = sectionProgress();
    if (paused) { scroll = scrollTarget; draw(); }
  });
  layout.observe(document.body);
  document.addEventListener('visibilitychange', restart, { signal });
  window.addEventListener('pageshow', () => { resize(); restart(); }, { signal });
  motion.addEventListener('change', () => setPaused(motion.matches), { signal });
  canvas.addEventListener('contextlost', e => { e.preventDefault(); lost = true; restart(); }, { signal });
  canvas.addEventListener('contextrestored', () => { lost = false; resize(); restart(); }, { signal });
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resize(); setPaused(paused);
  return { setPaused, setActive, get paused() { return paused; },
    sendLight() { if (!paused && active) sendPulse(sources[cycle++ % 2], 1); },
    dispose() { disposed = true; abort.abort(); observer.disconnect(); layout.disconnect(); cancelAnimationFrame(raf); }
  };
}
