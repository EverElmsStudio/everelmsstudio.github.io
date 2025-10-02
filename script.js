// EverElms Studio — main script
// - Mobile nav, active link tracking
// - Diary page: sort + clamp (newest full, others collapsible)
// - Home: YouTube tile -> inline embed
// - Home: Art lightbox
// - Home: Music card = direct <audio> playback (faux visualizer is pure CSS)

document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // ===== Mobile nav =====
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    nav.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => {
        if (nav.classList.contains("open")) {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      })
    );
  }

  // ===== Active link highlight (home anchors) =====
  const sections = document.querySelectorAll("main section[id]");
  const links = document.querySelectorAll('.site-nav a[href^="#"]');
  if (sections.length && links.length) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.removeAttribute("aria-current"));
          const active = document.querySelector(`.site-nav a[href="#${e.target.id}"]`);
          if (active) active.setAttribute("aria-current", "page");
        }
      });
    }, { threshold: 0.55 });
    sections.forEach(s => obs.observe(s));
  }

  // ===== Diary page: newest first + clamp others =====
  const list = document.querySelector(".entry-list");
  if (list) {
    const items = Array.from(list.children);
    items.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
    items.forEach(el => list.appendChild(el));

    const entries = Array.from(list.children);
    entries.forEach((entry, idx) => {
      const content = entry.querySelector(".entry__content");
      if (!content) return;

      if (!content.id) content.id = `entry-content-${idx + 1}`;

      if (idx === 0) {
        entry.classList.remove("entry--clamp", "is-open");
        return;
      }

      entry.classList.add("entry--clamp");
      entry.classList.remove("is-open");

      if (!entry.querySelector(".entry__toggle")) {
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "entry__toggle";
        toggleBtn.textContent = "Read more";
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.setAttribute("aria-controls", content.id);

        const tags = entry.querySelector(".entry__tags");
        if (tags) entry.insertBefore(toggleBtn, tags); else entry.appendChild(toggleBtn);

        toggleBtn.addEventListener("click", () => {
          const open = entry.classList.toggle("is-open");
          toggleBtn.setAttribute("aria-expanded", String(open));
          toggleBtn.textContent = open ? "Show less" : "Read more";
        });
      }
    });
  }

  // ===== Home: YouTube tile -> inline embed =====
  document.querySelectorAll(".card--yt").forEach(card => {
    const id = card.dataset.ytId && card.dataset.ytId.trim();
    const tile = card.querySelector(".yt-tile");
    const img = card.querySelector(".yt-thumb");
    if (!tile) return;

    if (img && id && id !== "VIDEO_ID_HERE") {
      img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      img.alt = "Latest YouTube video thumbnail";
    } else if (tile && img) {
      img.remove();
      tile.insertAdjacentHTML("afterbegin", `
        <svg viewBox="0 0 1200 630" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="gy" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#0b1630"/><stop offset="100%" stop-color="#4040c7"/></linearGradient></defs>
          <rect width="1200" height="630" fill="url(#gy)"></rect>
        </svg>
      `);
    }

    const play = () => {
      if (!id || id === "VIDEO_ID_HERE") {
        window.open("https://www.youtube.com/@EverElmsStudio", "_blank");
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "yt-embed";
      wrap.innerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>`;
      tile.replaceWith(wrap);
    };

    tile.addEventListener("click", play);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); }
    });
  });

  // ===== Home: Visual Art lightbox =====
  const lb = document.querySelector(".lightbox");
  const lbImg = lb?.querySelector(".lightbox__img");
  const lbClose = lb?.querySelector(".lightbox__close");

  const openLightbox = (src, alt) => {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt || "Artwork";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  };
  const closeLightbox = () => {
    if (!lb || !lbImg) return;
    lb.hidden = true;
    lbImg.src = "";
    document.body.style.overflow = "";
  };
  lbClose?.addEventListener("click", closeLightbox);
  lb?.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb?.hidden) closeLightbox(); });

  document.querySelectorAll(".card--art").forEach(card => {
    const btn = card.querySelector(".art-expand");
    const thumb = card.querySelector(".art-thumb");
    const full = card.dataset.artFull || (thumb && thumb.getAttribute("src"));
    const alt = thumb?.getAttribute("alt") || "Artwork";
    if (btn && full) btn.addEventListener("click", () => openLightbox(full, alt));
    if (thumb && full) {
      thumb.style.cursor = "zoom-in";
      thumb.addEventListener("click", () => openLightbox(full, alt));
    }
  });

  // ===== Home: Music (direct <audio> playback; faux visualizer is CSS-only) =====
  document.querySelectorAll(".card--audio").forEach(card => {
    const btn = card.querySelector(".audio-play");
    const audio = card.querySelector(".audio-el");
    if (!btn || !audio) return;

    // Keep data-audio-src and <audio src> in sync if provided
    const dataSrc = card.dataset.audioSrc && card.dataset.audioSrc.trim();
    if (dataSrc && audio.getAttribute("src") !== dataSrc) {
      audio.setAttribute("src", dataSrc);
    }

    audio.addEventListener("play", () => { btn.textContent = "Pause"; });
    audio.addEventListener("pause", () => { btn.textContent = "Play"; });
    audio.addEventListener("ended", () => { btn.textContent = "Play"; });

    btn.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          btn.textContent = "Loading…";
          await audio.play();
        } else {
          audio.pause();
        }
      } catch {
        btn.textContent = "Play";
      }
    });
  });
});
/* === Lightweight Art Lightbox (no deps) =============================== */
(function () {
  function openLightbox(src, alt) {
    // build overlay
    const overlay = document.createElement('div');
    overlay.className = 'lb';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.tabIndex = -1;

    // image
    const img = document.createElement('img');
    img.className = 'lb__img';
    img.src = src;
    if (alt) img.alt = alt;

    // close button (accessible)
    const close = document.createElement('button');
    close.className = 'lb__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';

    overlay.append(img, close);
    document.body.appendChild(overlay);

    // lock scroll while open
    const prevBodyOverflow = document.body.style.overflow;
    const prevDocOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // helpers
    const cleanup = () => {
      overlay.remove();
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevDocOverflow;
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => (e.key === 'Escape') && cleanup();

    // close interactions
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target === close) cleanup();
    });
    document.addEventListener('keydown', onKey);

    // focus overlay for ESC handling
    setTimeout(() => overlay.focus(), 0);
  }

  // Delegate clicks from any ".art-expand" button
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.art-expand');
    if (!btn) return;

    e.preventDefault();
    const card = btn.closest('.card--art');
    const full =
      card?.dataset.artFull ||
      card?.querySelector('.art-thumb')?.src;

    const alt = card?.querySelector('.art-thumb')?.alt || 'Artwork';
    if (full) openLightbox(full, alt);
  });
})();
(function(){
  const list = document.querySelector('.entry-list[data-src]');
  if (!list) return;

  const src = list.getAttribute('data-src');
  const initialCount = parseInt(list.getAttribute('data-initial') || '6', 10);
  const moreBtn = document.getElementById('load-more');

  let all = [];
  let shown = 0;

  fetch(src + '?v=' + Date.now()) // cache-bust on GH Pages after updates
    .then(r => r.json())
    .then(data => {
      all = (data.entries || [])
        .slice()
        .sort((a,b) => (b.date > a.date ? 1 : -1)); // newest first
      renderNext(initialCount);
      if (moreBtn && shown < all.length) {
        moreBtn.hidden = false;
        moreBtn.addEventListener('click', () => renderNext(6));
      }
    })
    .catch(err => {
      console.error('Diary load failed:', err);
      list.innerHTML = '<p class="muted">Could not load diary right now.</p>';
    });

  function renderNext(n){
    const slice = all.slice(shown, shown + n);
    const frag = document.createDocumentFragment();

    slice.forEach(entry => {
      const article = document.createElement('article');
      article.className = 'entry';
      article.setAttribute('data-date', entry.date);

      const head = document.createElement('div');
      head.className = 'entry__head';

      const h2 = document.createElement('h2');
      h2.className = 'entry__title';
      h2.textContent = entry.title;

      const time = document.createElement('time');
      time.setAttribute('datetime', entry.date);
      time.textContent = formatDate(entry.date);

      head.append(h2, time);

      const content = document.createElement('div');
      content.className = 'entry__content';
      (entry.html || []).forEach(html => {
        const div = document.createElement('div');
        div.innerHTML = html;
        // unwrap to keep your CSS targeting <p>, etc.
        [...div.childNodes].forEach(n => content.appendChild(n));
      });

      const tags = document.createElement('div');
      tags.className = 'entry__tags';
      (entry.tags || []).forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tags.appendChild(span);
      });

      article.append(head, content, tags);
      frag.appendChild(article);
    });

    list.appendChild(frag);
    shown += slice.length;

    if (moreBtn && shown >= all.length) moreBtn.hidden = true;
  }

  function formatDate(iso){
     const [y, m, d] = iso.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[m - 1]} ${d}, ${y}`;
  }
})();
