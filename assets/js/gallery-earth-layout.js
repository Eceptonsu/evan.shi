// Keep screen-space offsets between frames. Repacking from the anchor on each
// frame makes nearby photos jump between otherwise equally valid empty slots.
export function placeMarkers(markers, width, height, blend) {
  const clampX = x => Math.max(30, Math.min(width - 30, x));
  const clampY = y => Math.max(32, Math.min(height - 32, y));
  const targets = markers.map(marker => ({
    marker,
    x: clampX(marker.x + marker.offsetX),
    y: clampY(marker.y + marker.offsetY)
  }));

  // Continuous separation, warm-started from the previous frame. No sorting,
  // discrete slot selection, or re-centering when a neighboring pin disappears.
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i], b = targets[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= 70) continue;
        if (distance < 0.001) {
          // Shared geographic pins still get a deterministic separation direction.
          const angle = (a.marker.index + b.marker.index) * 2.399963;
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
        }
        const shift = (70 - distance) / 2;
        const sx = dx / distance * shift, sy = dy / distance * shift;
        a.x = clampX(a.x - sx); a.y = clampY(a.y - sy);
        b.x = clampX(b.x + sx); b.y = clampY(b.y + sy);
      }
    }
  }
  for (const { marker, x, y } of targets) {
    // Place new photos before their fade-in; ease only subsequent adjustments.
    const amount = marker.opacity < 0.01 ? 1 : blend;
    marker.offsetX += (x - marker.x - marker.offsetX) * amount;
    marker.offsetY += (y - marker.y - marker.offsetY) * amount;
    marker.px = marker.x + marker.offsetX;
    marker.py = marker.y + marker.offsetY;
  }
}
