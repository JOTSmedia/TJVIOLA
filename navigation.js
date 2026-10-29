/** One moving light follows navigation intent, with a fluid mobile reveal. */
export function initNavigation() {
  const header = document.querySelector('#site-header');
  const desktop = document.querySelector('.desktop-nav');
  const button = document.querySelector('#menu-toggle');
  const panel = document.querySelector('#mobile-nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMode = matchMedia('(min-width: 601px)');
  const links = [...document.querySelectorAll('.desktop-nav a, .mobile-nav a, .nav-book')];
  const sections = [...document.querySelectorAll('main > section[id]')];
  const indicator = document.createElement('span');
  indicator.className = 'nav-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  desktop.append(indicator);
  let activeHash = '', hoverLink = null, open = false, animation = null;
  let linkAnimations = [], frame = 0, revision = 0;

  function moveIndicator() {
    const focused = desktop.contains(document.activeElement) ? document.activeElement.closest('a') : null;
    const target = hoverLink || focused || [...desktop.querySelectorAll('a')].find(link => link.hash === activeHash);
    if (!target || !desktopMode.matches) { indicator.style.opacity = '0'; return; }
    const box = target.getBoundingClientRect(), parent = desktop.getBoundingClientRect();
    indicator.style.width = `${box.width}px`;
    indicator.style.transform = `translate3d(${box.left - parent.left}px,0,0)`;
    indicator.style.opacity = '1';
  }
  function update() {
    frame = 0;
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${height}px`);
    header.classList.toggle('is-scrolled', scrollY > 24);
    const marker = Math.min(innerHeight * .38, height + 180);
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= marker) current = section;
    }
    activeHash = current ? `#${current.id}` : '';
    for (const link of links) {
      const active = link.hash === activeHash;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    moveIndicator();
  }
  function queueUpdate() { if (!frame) frame = requestAnimationFrame(update); }
  function cancelAnimations() {
    animation?.cancel(); animation = null;
    linkAnimations.forEach(item => item.cancel()); linkAnimations = [];
  }
  function closeMenu({ immediate = false, returnFocus = false } = {}) {
    open = false;
    const token = ++revision;
    cancelAnimations();
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open navigation');
    panel.inert = true;
    if (returnFocus) button.focus({ preventScroll: true });
    const finish = () => {
      if (token !== revision) return;
      panel.hidden = true; animation?.cancel(); animation = null;
    };
    if (panel.hidden || immediate || reduced.matches) { finish(); return; }
    animation = panel.animate([
      { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0% 0)' },
      { opacity: 0, transform: 'translateY(-8px)', clipPath: 'inset(0 0 100% 0)' }
    ], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    animation.finished.then(finish).catch(() => {});
  }
  function openMenu(keyboard) {
    ++revision; cancelAnimations(); open = true;
    panel.hidden = false; panel.inert = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Close navigation');
    if (!reduced.matches) {
      animation = panel.animate([
        { opacity: 0, transform: 'translateY(-10px)', clipPath: 'inset(0 0 100% 0)' },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0% 0)' }
      ], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
      linkAnimations = [...panel.querySelectorAll('a')].map((link, index) => link.animate([
        { opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 300, delay: 45 + index * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
    if (keyboard) panel.querySelector('a')?.focus({ preventScroll: true });
  }
  button.addEventListener('click', event => open ? closeMenu() : openMenu(event.detail === 0));
  panel.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    closeMenu();
    const section = document.querySelector(link.hash);
    if (section) { section.tabIndex = -1; section.focus({ preventScroll: true }); }
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); closeMenu({ returnFocus: true }); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !panel.contains(event.target) && !header.contains(event.target)) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (open && !panel.contains(event.target) && !header.contains(event.target)) closeMenu();
  });
  desktop.querySelectorAll('a').forEach(link => {
    link.addEventListener('pointerenter', () => { hoverLink = link; moveIndicator(); });
    link.addEventListener('focus', moveIndicator);
  });
  desktop.addEventListener('pointerleave', () => { hoverLink = null; moveIndicator(); });
  desktop.addEventListener('focusout', () => queueMicrotask(moveIndicator));
  desktopMode.addEventListener('change', event => {
    if (event.matches) {
      const focusedHash = panel.contains(document.activeElement) ? document.activeElement.hash : null;
      closeMenu({ immediate: true });
      if (focusedHash) links.find(link => !panel.contains(link) && link.hash === focusedHash)?.focus({ preventScroll: true });
    }
    hoverLink = null; queueUpdate();
  });
  reduced.addEventListener('change', () => {
    cancelAnimations(); if (!open) closeMenu({ immediate: true });
  });
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate, { passive: true });
  new ResizeObserver(queueUpdate).observe(header);
  document.fonts.ready.then(queueUpdate);
  panel.inert = true;
  update();
}
