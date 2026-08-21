const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('is-open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  });
});

const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());

const previewVideo = document.querySelector('.game-preview-video');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function syncPreviewMotion() {
  if (!previewVideo) return;
  if (reducedMotion.matches) {
    previewVideo.pause();
  } else {
    previewVideo.play().catch(() => {});
  }
}

syncPreviewMotion();
reducedMotion.addEventListener?.('change', syncPreviewMotion);
