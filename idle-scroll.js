/** A quiet, interruptible page drift. No additional interface controls. */
export function startIdleScroll() {
  const idleDelay = 10_000;
  const speed = 100 * .45; // 45% of a 100 CSS-pixel/second reference speed.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('#mobile-nav');
  const spotify = document.querySelector('#spotify-inline');
  const removers = [];
  const heldPointers = new Set();
  let timer = 0, frame = 0, previousTime = 0, targetY = scrollY;
  let expectedY = null, focused = document.hasFocus(), disposed = false;
  let lastActivity = performance.now();

  function blocked() {
    const active = document.activeElement;
    return document.hidden || !focused || reduced.matches || heldPointers.size > 0
      || document.body.classList.contains('intro-active')
      || !document.documentElement.classList.contains('is-ready')
      || !!document.querySelector('dialog[open]')
      || (menu && !menu.hidden) || (spotify && !spotify.hidden)
      || active?.matches('input, textarea, select, iframe, [contenteditable]:not([contenteditable="false"])')
      || (getSelection()?.isCollapsed === false);
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    previousTime = 0; expectedY = null;
  }
  function schedule(delay = idleDelay) {
    clearTimeout(timer);
    if (!disposed && !document.hidden && focused && !reduced.matches) {
      timer = setTimeout(begin, delay);
    }
  }
  function activity() {
    lastActivity = performance.now();
    stop(); schedule();
  }
  function begin() {
    if (disposed) return;
    if (blocked()) { schedule(1000); return; }
    const remaining = idleDelay - (performance.now() - lastActivity);
    if (remaining > 0) { schedule(remaining); return; }
    if (scrollY >= document.documentElement.scrollHeight - innerHeight - 1) return;
    targetY = scrollY;
    previousTime = 0;
    frame = requestAnimationFrame(advance);
  }
  function advance(now) {
    if (disposed) return;
    if (blocked()) { stop(); schedule(); return; }
    const delta = previousTime ? Math.min(now - previousTime, 64) : 0;
    previousTime = now;
    const bottom = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    targetY = Math.min(bottom, targetY + speed * delta / 1000);
    expectedY = targetY;
    window.scrollTo({ top: targetY, behavior: 'instant' });
    if (targetY >= bottom - .5) { stop(); return; }
    frame = requestAnimationFrame(advance);
  }
  function listen(target, name, callback, options = { passive: true }) {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  }

  // A real interaction always takes priority, including dragging the scrollbar.
  for (const event of ['pointermove', 'wheel', 'touchstart', 'touchmove', 'touchend', 'keydown', 'click']) {
    listen(window, event, activity, { passive: true, capture: true });
  }
  listen(window, 'pointerdown', event => { heldPointers.add(event.pointerId); activity(); }, { passive: true, capture: true });
  for (const event of ['pointerup', 'pointercancel']) {
    listen(window, event, e => { heldPointers.delete(e.pointerId); activity(); }, { passive: true, capture: true });
  }
  listen(document, 'focusin', activity);
  listen(document, 'selectionchange', activity);
  listen(window, 'resize', activity);
  listen(window, 'scroll', () => {
    // Ignore only our own frame's movement; manual and anchor scrolling restart the delay.
    if (frame && expectedY !== null && Math.abs(scrollY - expectedY) <= 2) return;
    activity();
  });
  listen(window, 'blur', () => { focused = false; heldPointers.clear(); activity(); });
  listen(window, 'focus', () => { focused = true; activity(); });
  listen(document, 'visibilitychange', activity);
  listen(reduced, 'change', activity);
  const stateObserver = new MutationObserver(activity);
  stateObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  stateObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  activity();
  return () => {
    disposed = true; stop(); clearTimeout(timer);
    stateObserver.disconnect(); removers.forEach(remove => remove());
  };
}
