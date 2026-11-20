/**
 * VirtualFit Hero: Spatial 3D Try-On Interactive Showcase
 * Embedded visionOS-style spatial hero for ChicSort
 */

(function initVirtualFitHero() {
  const hero = document.getElementById('vf-hero');
  if (!hero) return;

  const ITEMS = [
    {n:"Basic T-shirt", p:45,  g:[1.14,3.06],  m:.37,   c:[["White","#f4f2ee"],["Ash","#c9c7c2"],["Charcoal","#3b3c3f"],["Navy","#27324d"]]},
    {n:"Basic Sweater", p:105, g:[49.7,1.39],  m:25.0,  c:[["White","#f6f4ef"],["Oat","#ddd3c2"],["Sage","#b9c2ae"],["Black","#1f1f21"]]},
    {n:"Linen Shirt",   p:95,  g:[98.2,3.33],  m:49.86, c:[["White","#f7f6f1"],["Sand","#d9ccb4"],["Sky","#bcd0e2"],["Olive","#717556"]]},
    {n:"Grey Hoodie",   p:110, g:[1.14,93.3],  m:74.77, c:[["Heather","#a9a9a8"],["Bone","#e6e1d6"],["Forest","#33463a"],["Black","#1f1f21"]]},
    {n:"Ringer Tee",    p:55,  g:[49.7,95.3],  m:99.35, c:[["White / Black","#f4f2ee"],["Cream / Navy","#efe6d3"],["Grey / Red","#c9c7c2"],["White / Green","#e9efe8"]]}
  ];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let pos = 0;
  let target = 0;
  let intro = prefersReducedMotion ? 1 : 0;
  let activeOutfitIdx = -1;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartPos = 0;
  let lastDragX = 0;
  let lastDragTime = 0;
  let dragVelocity = 0;

  let rawPointerX = 0.5;
  let rawPointerY = 0.5;
  let sx = 0;
  let sy = 0;

  let curX = 0;
  let curY = 0;
  let curTargetX = 0;
  let curTargetY = 0;
  let curMode = '';
  let isPointerInsideHero = false;

  const roomEl = hero.querySelector('.vf-room');
  const ghostEl = hero.querySelector('.vf-ghost');
  const ghostSpans = ghostEl ? ghostEl.querySelectorAll('span') : [];
  const arcEl = hero.querySelector('.vf-arc');
  const stageEl = hero.querySelector('.vf-stage');
  const mCur = hero.querySelector('#vf-mCur');
  const mNext = hero.querySelector('#vf-mNext');
  const mGrid = hero.querySelector('#vf-mGrid');
  const mScan = hero.querySelector('#vf-mScan');
  const thumbG = hero.querySelector('#vf-thumbG');
  const nameContainer = hero.querySelector('#vf-nameContainer');
  const priceContainer = hero.querySelector('#vf-priceContainer');
  const colorLabelContainer = hero.querySelector('#vf-colorLabelContainer');
  const colorDotsContainer = hero.querySelector('#vf-colorDots');
  const cursorEl = hero.querySelector('#vf-cursor');
  const tabPill = hero.querySelector('#vf-tabPill');
  const btnPrev = hero.querySelector('#vf-btnPrev');
  const btnNext = hero.querySelector('#vf-btnNext');

  // Build 10 Garment Cards
  const cards = [];
  const seeds = Array.from({ length: 10 }, () => Math.random() * Math.PI * 2);

  if (arcEl) {
    arcEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const item = ITEMS[i % 5];
      const card = document.createElement('div');
      card.className = 'vf-card glass';
      card.innerHTML = `
        <div class="vf-g" style="background-position:${item.g[0]}% ${item.g[1]}%"></div>
        <div class="vf-name">${item.n}</div>
        <div class="vf-price">$${item.p}</div>
        <div class="vf-sheen"></div>
      `;
      arcEl.appendChild(card);
      cards.push(card);

      if (!prefersReducedMotion) {
        card.addEventListener('mouseenter', () => {
          const sheen = card.querySelector('.vf-sheen');
          if (sheen) {
            sheen.animate([
              { transform: 'translateX(-100%)' },
              { transform: 'translateX(100%)' }
            ], { duration: 1000, easing: 'cubic-bezier(.2,.8,.2,1)' });
          }
        });
      }

      card.addEventListener('click', () => {
        if (Math.abs(lastDragX - dragStartX) < 6) {
          target = Math.round(pos + (((i - pos + 5) % 10 + 10) % 10 - 5));
        }
      });
    }
  }

  // Update Card Width CSS Variable on Hero
  function updateCardWidth() {
    const isPhone = window.innerWidth <= 767;
    const heroH = hero.clientHeight || window.innerHeight * 0.85;
    const cw = isPhone 
      ? Math.min(window.innerWidth * 0.28, 140)
      : Math.min(window.innerWidth * 0.13, heroH * 0.30);
    hero.style.setProperty('--CW', `${cw}px`);
  }
  updateCardWidth();
  window.addEventListener('resize', updateCardWidth);

  // Position Tab Pill
  function positionTabPill(tabBtn) {
    if (!tabBtn || !tabPill) return;
    tabPill.style.width = `${tabBtn.offsetWidth}px`;
    tabPill.style.transform = `translateX(${tabBtn.offsetLeft}px)`;
  }
  const initialActiveTab = hero.querySelector('.vf-tab-btn.active');
  setTimeout(() => positionTabPill(initialActiveTab), 100);

  // Tabs Click
  hero.querySelectorAll('.vf-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hero.querySelectorAll('.vf-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      positionTabPill(btn);
      target += 5;
    });
  });

  // Navigation Arrows
  if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); target -= 1; });
  if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); target += 1; });

  // Wheel over Hero
  let wheelDeltaAccumulator = 0;
  let lastWheelStepTime = 0;
  hero.addEventListener('wheel', (e) => {
    // Only capture horizontal delta or when user holds shift, let normal vertical scroll flow
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();
      const now = performance.now();
      wheelDeltaAccumulator += e.deltaX;
      if (Math.abs(wheelDeltaAccumulator) >= 50 && now - lastWheelStepTime >= 240) {
        target += Math.sign(wheelDeltaAccumulator);
        wheelDeltaAccumulator = 0;
        lastWheelStepTime = now;
      }
    }
  }, { passive: false });

  // Stage Pointer Drag Handling
  if (stageEl) {
    stageEl.addEventListener('pointerdown', (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      lastDragX = e.clientX;
      lastDragTime = performance.now();
      dragStartPos = pos;
      dragVelocity = 0;
      stageEl.setPointerCapture(e.pointerId);
      if (cursorEl) cursorEl.classList.add('is-down');
    });

    stageEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const now = performance.now();
      const dt = now - lastDragTime;
      const dx = e.clientX - lastDragX;
      if (dt > 0) {
        dragVelocity = dx / dt;
      }
      lastDragX = e.clientX;
      lastDragTime = now;

      const isPhone = window.innerWidth <= 767;
      const W = window.innerWidth;
      const xs1 = isPhone ? 0.40 * W : 0.26 * W;
      const totalDx = e.clientX - dragStartX;
      pos = dragStartPos - (totalDx / xs1);
    });

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      target = Math.round(pos - dragVelocity * 3.2);
      if (cursorEl) cursorEl.classList.remove('is-down');
    }
    stageEl.addEventListener('pointerup', endDrag);
    stageEl.addEventListener('pointercancel', endDrag);
  }

  // Pointer Movement inside Hero for Spatial Cursor & Tilt
  hero.addEventListener('pointerenter', () => {
    isPointerInsideHero = true;
    if (cursorEl) cursorEl.style.opacity = '1';
  });

  hero.addEventListener('pointerleave', () => {
    isPointerInsideHero = false;
    if (cursorEl) cursorEl.style.opacity = '0';
  });

  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    curTargetX = e.clientX - rect.left;
    curTargetY = e.clientY - rect.top;
    rawPointerX = (e.clientX - rect.left) / rect.width;
    rawPointerY = (e.clientY - rect.top) / rect.height;

    const targetEl = e.target;
    if (targetEl.closest('button, a, .vf-chip, .vf-dot, .vf-tab-btn, .vf-rail-btn')) {
      curMode = 'btn';
    } else if (targetEl.closest('.vf-card')) {
      curMode = 'try';
    } else if (isDragging || targetEl.closest('.vf-stage')) {
      curMode = 'drag';
    } else {
      curMode = '';
    }
  });

  // Buy Card Rolling Text Animation
  function rollText(container, newText) {
    if (!container) return;
    const oldEl = container.firstElementChild;
    if (oldEl && oldEl.textContent === newText) return;

    const newEl = document.createElement('div');
    newEl.textContent = newText;
    newEl.style.position = 'absolute';
    newEl.style.left = '0';
    newEl.style.top = '0';
    newEl.style.width = '100%';
    newEl.style.transform = 'translateY(110%)';
    container.appendChild(newEl);

    if (prefersReducedMotion) {
      if (oldEl) oldEl.remove();
      newEl.style.position = 'relative';
      newEl.style.transform = 'none';
      return;
    }

    if (oldEl) {
      oldEl.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-110%)' }],
        { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
      ).onfinish = () => oldEl.remove();
    }

    newEl.animate(
      [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }],
      { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
    );
  }

  // Size Chips
  hero.querySelectorAll('.vf-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      hero.querySelectorAll('.vf-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  let activeScanAnimations = [];

  // Try-On Scan Function (950 ms)
  function runTryOn(itemIndex) {
    activeOutfitIdx = itemIndex;
    const item = ITEMS[itemIndex];

    rollText(nameContainer, item.n);
    rollText(priceContainer, `$${item.p}`);

    if (thumbG) {
      thumbG.style.backgroundPosition = `${item.g[0]}% ${item.g[1]}%`;
      if (!prefersReducedMotion) {
        thumbG.animate(
          [{ transform: 'translateY(70%) scale(.8)' }, { transform: 'translateY(0) scale(1)' }],
          { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      }
    }

    if (colorDotsContainer) {
      colorDotsContainer.innerHTML = '';
      rollText(colorLabelContainer, `Color · ${item.c[0][0]}`);

      item.c.forEach(([colorName, colorHex], cIdx) => {
        const dot = document.createElement('div');
        dot.className = `vf-dot ${cIdx === 0 ? 'active' : ''}`;
        dot.style.background = colorHex;
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          colorDotsContainer.querySelectorAll('.vf-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          rollText(colorLabelContainer, `Color · ${colorName}`);
        });
        colorDotsContainer.appendChild(dot);
      });
    }

    if (prefersReducedMotion) {
      if (mCur) {
        mCur.style.backgroundPositionX = `${item.m}%`;
        mCur.style.opacity = '1';
      }
      return;
    }

    activeScanAnimations.forEach(anim => {
      try { anim.cancel(); } catch (err) {}
    });
    activeScanAnimations = [];

    if (!mNext || !mCur || !mScan || !mGrid) return;

    mNext.style.backgroundPositionX = `${item.m}%`;

    const animNext = mNext.animate(
      [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }],
      { duration: 950, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }
    );

    const animGrid = mGrid.animate(
      [
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0 0)', offset: 0.5 },
        { clipPath: 'inset(100% 0 0 0)' }
      ],
      { duration: 1092, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }
    );

    const animScan = mScan.animate(
      [
        { top: '0%', transform: 'scaleX(0.2)', opacity: 0 },
        { top: '6%', transform: 'scaleX(1)', opacity: 1, offset: 0.08 },
        { top: '94%', transform: 'scaleX(1)', opacity: 1, offset: 0.92 },
        { top: '100%', transform: 'scaleX(0.2)', opacity: 0 }
      ],
      { duration: 950, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }
    );

    const animSettle = mNext.animate(
      [{ transform: 'scale(1.012)' }, { transform: 'scale(1)' }],
      { duration: 1250, easing: 'ease-out', fill: 'forwards' }
    );

    activeScanAnimations = [animNext, animGrid, animScan, animSettle];

    animNext.onfinish = () => {
      mCur.style.backgroundPositionX = `${item.m}%`;
      mCur.style.opacity = '1';
      mNext.style.clipPath = 'inset(0 0 100% 0)';
      activeScanAnimations.forEach(a => {
        try { a.cancel(); } catch (err) {}
      });
      activeScanAnimations = [];
    };
  }

  // Animation Loop
  function loop(time) {
    const t = time * 0.001;

    if (!isDragging) {
      if (prefersReducedMotion) {
        pos = target;
      } else {
        pos += (target - pos) * 0.11;
      }
    }

    const targetSx = rawPointerX - 0.5;
    const targetSy = rawPointerY - 0.5;
    sx += (targetSx - sx) * 0.06;
    sy += (targetSy - sy) * 0.06;

    if (cursorEl && isPointerInsideHero) {
      curX += (curTargetX - curX) * 0.22;
      curY += (curTargetY - curY) * 0.22;
      cursorEl.style.transform = `translate3d(${curX - 29}px, ${curY - 29}px, 0)`;
      cursorEl.className = 'vf-cur' + (curMode ? ` is-${curMode}` : '');
    }

    if (!prefersReducedMotion && intro < 1) {
      intro += 0.012;
      if (intro > 1) intro = 1;
    }
    const ie = prefersReducedMotion ? 1 : (1 - Math.pow(1 - intro, 3));

    if (roomEl) {
      roomEl.style.transform = `translate3d(${-sx * 22}px, ${-sy * 14}px, 0) scale(${1.08 - 0.03 * ie})`;
    }
    if (ghostEl) {
      ghostEl.style.transform = `translate(calc(-50% - ${sx * 40}px), ${-sy * 16}px)`;
    }
    ghostSpans.forEach((span, k) => {
      span.style.transform = `translateY(${(1 - ie) * (60 + 30 * k)}px)`;
    });

    const isPhone = window.innerWidth <= 767;
    const W = hero.clientWidth || window.innerWidth;
    const H = hero.clientHeight || window.innerHeight;
    const XS = isPhone
      ? [0, .40, .60, .72, .80, .86].map(v => v * W)
      : [0, .26, .45, .60, .72, .80].map(v => v * W);

    function xAt(a) {
      if (a <= 0) return XS[0];
      const idx = Math.min(Math.floor(a), XS.length - 2);
      const frac = a - idx;
      return XS[idx] + (XS[idx + 1] - XS[idx]) * frac;
    }

    for (let i = 0; i < 10; i++) {
      const card = cards[i];
      if (!card) continue;
      const u = ((i - pos + 5) % 10 + 10) % 10 - 5;
      const a = Math.abs(u);
      const sg = Math.sign(u) || 1;

      const x = sg * xAt(a) * ie;

      let s, z, opacity, ry, blur;
      if (a < 1) {
        s = 0.55 + 0.45 * a;
        z = -260 * (1 - a);
        opacity = a;
        ry = -sg * 16 * a;
        blur = 0;
      } else {
        s = 1 / (1 + 0.3 * Math.pow(a - 1, 1.15));
        z = -110 * (a - 1);
        ry = -sg * (16 + 9 * Math.min(2, a - 1));
        blur = Math.max(0, a - 1.6) * 2.4;
        opacity = 1;
      }

      if (a > 3.4) {
        opacity = Math.max(0, 1 - (a - 3.4) / 0.8);
      }

      const bob = prefersReducedMotion ? 0 : (Math.sin(t * 1.1 + seeds[i]) * H * 0.006 * Math.min(1, a));
      const y = bob - (1 - s) * H * 0.04;

      ry += sx * 10;

      card.style.transform = `translate(${x}px, ${y}px) perspective(1300px) translateZ(${z}px) rotateY(${ry}deg) rotateX(${-sy * 6}deg) scale(${s * (0.6 + 0.4 * ie)})`;
      card.style.filter = (blur > 0.05 && !prefersReducedMotion) ? `blur(${blur}px)` : 'none';
      card.style.zIndex = a < 1 ? 1 : Math.round(100 - 10 * a);
      card.style.opacity = (opacity * ie).toFixed(3);
      card.style.display = (opacity * ie < 0.01) ? 'none' : 'block';
    }

    if (!isDragging && Math.abs(target - pos) < 0.02) {
      const itemIdx = ((Math.round(target) % 5) + 5) % 5;
      if (itemIdx !== activeOutfitIdx) {
        runTryOn(itemIdx);
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
