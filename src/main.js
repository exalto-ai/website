// Fonts are self-hosted: the page promises nobody watches you work, so it
// makes no third-party requests.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './landing.css';

// Hero ledger: duplicate the row list so the translateY(-50%) loop is
// seamless, then start the animation. Without JS the ledger stays static.
const feed = document.querySelector('[data-ledger]');
if (feed) {
  const half = feed.querySelector('.ledger-half');
  if (half) {
    const copy = half.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    feed.append(copy);
    feed.classList.add('is-looping');
  }
  document.addEventListener('visibilitychange', () => {
    feed.classList.toggle('is-paused', document.hidden);
  });
}

// Contribution-history popover: hover or keyboard focus opens it, Escape
// dismisses, and on touch a tap toggles it.
const trigger = document.querySelector('.passage-trigger');
const popover = document.getElementById('history-pop');
if (trigger && popover) {
  const setOpen = (open) => {
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };
  const wrap = trigger.closest('.passage-live-wrap');
  wrap.addEventListener('mouseenter', () => setOpen(true));
  wrap.addEventListener('mouseleave', () => setOpen(false));
  trigger.addEventListener('focus', () => setOpen(true));
  wrap.addEventListener('focusout', (event) => {
    if (!wrap.contains(event.relatedTarget)) setOpen(false);
  });
  trigger.addEventListener('click', () => setOpen(popover.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}
