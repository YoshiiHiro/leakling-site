// ===== Nav scroll effect =====
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  lastScroll = scrollY;
}, { passive: true });

// ===== Mobile hamburger =====
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile nav on link click
document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});

// ===== Smooth scroll for anchor links (fallback) =====
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ===== Download consent — gate the installer button =====
const consent = document.getElementById('download-consent');
const downloadBtn = document.getElementById('download-btn');

if (consent && downloadBtn) {
  const update = () => {
    const ok = consent.checked;
    downloadBtn.classList.toggle('dimmed', !ok);
    downloadBtn.setAttribute('aria-disabled', String(!ok));
  };
  consent.addEventListener('change', update);
  // Belt-and-suspenders: block navigation if unchecked (covers keyboard/screen readers)
  downloadBtn.addEventListener('click', (e) => {
    if (!consent.checked) e.preventDefault();
  });
  update();
}
