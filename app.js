'use strict';

(() => {
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 1. Shrinking header fallback for browsers without CSS scroll-driven animations
  const siteHeader = document.getElementById('site-header');
  if (
    siteHeader &&
    !CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)')
  ) {
    const syncHeader = () => {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 48);
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  // 2. Luxury Scroll Entry Reveal System (/animate & Emil Kowalski standards)
  const revealItems = document.querySelectorAll('.reveal-item');
  if (revealItems.length > 0 && !reducedMotionQuery.matches) {
    revealItems.forEach((el) => el.classList.add('is-reveal-pending'));
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove('is-reveal-pending');
          entry.target.classList.add('is-reveal-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );
    revealItems.forEach((el) => revealObserver.observe(el));
  }

  // 2b. Magic UI TextAnimate: Word Pull Up + BlurInUp progressive heading splitter
  const pullUpHeadings = document.querySelectorAll('.magic-pull-up');
  pullUpHeadings.forEach((heading) => {
    const childNodes = Array.from(heading.childNodes);
    heading.innerHTML = '';
    let wordIndex = 0;
    childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/);
        words.forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) {
            heading.appendChild(document.createTextNode(w));
          } else {
            const span = document.createElement('span');
            span.className = 'magic-word';
            span.style.setProperty('--word-idx', String(wordIndex++));
            span.textContent = w;
            heading.appendChild(span);
          }
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName.toLowerCase() === 'br') {
          heading.appendChild(node.cloneNode());
        } else {
          const subText = node.textContent;
          const clonedContainer = node.cloneNode(false);
          const words = subText.split(/(\s+)/);
          words.forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) {
              clonedContainer.appendChild(document.createTextNode(w));
            } else {
              const span = document.createElement('span');
              span.className = 'magic-word';
              span.style.setProperty('--word-idx', String(wordIndex++));
              span.textContent = w;
              clonedContainer.appendChild(span);
            }
          });
          heading.appendChild(clonedContainer);
        }
      }
    });
  });

  // Activate Hero section load animation
  const heroSection = document.getElementById('opening');
  if (heroSection) {
    requestAnimationFrame(() => {
      heroSection.classList.add('is-hero-active');
    });
  }

  // 2c. Magic UI NumberTicker for Verified Credentials
  const tickerEls = document.querySelectorAll('[data-ticker-target]');
  if (tickerEls.length > 0) {
    const runTicker = (el) => {
      const target = parseInt(el.getAttribute('data-ticker-target'), 10);
      const suffix = el.getAttribute('data-ticker-suffix') || '';
      if (isNaN(target)) return;
      if (reducedMotionQuery.matches) {
        el.textContent = target + suffix;
        return;
      }
      const duration = 1200;
      const start = performance.now();
      function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current + suffix;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target + suffix;
        }
      }
      requestAnimationFrame(step);
    };

    const tickerObserver = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          obs.unobserve(entry.target);
          entry.target.querySelectorAll('[data-ticker-target]').forEach(runTicker);
        }
      },
      { threshold: 0.25 }
    );
    const proofStrip = document.querySelector('.proof-strip');
    if (proofStrip) tickerObserver.observe(proofStrip);
  }

  // 3. Active nav anchor tracking
  const navAnchors = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const trackedSections = navAnchors
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (trackedSections.length > 0) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const activeId = `#${entry.target.id}`;
          for (const link of navAnchors) {
            if (link.getAttribute('href') === activeId) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    trackedSections.forEach((sec) => navObserver.observe(sec));
  }

  // 4. Mobile Navigation Dialog (<dialog> with native focus trap & Esc dismissal)
  const menuToggle = document.getElementById('menu-toggle');
  const mobileDialog = document.getElementById('mobile-nav-dialog');
  const closeMobileNav = document.getElementById('close-mobile-nav');

  if (menuToggle && mobileDialog) {
    menuToggle.addEventListener('click', () => {
      mobileDialog.showModal();
      menuToggle.setAttribute('aria-expanded', 'true');
    });

    closeMobileNav?.addEventListener('click', () => {
      mobileDialog.close();
    });

    mobileDialog.addEventListener('close', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus();
    });

    mobileDialog.addEventListener('click', (e) => {
      if (e.target === mobileDialog) mobileDialog.close();
    });

    mobileDialog.querySelectorAll('[data-nav-close]').forEach((link) => {
      link.addEventListener('click', () => {
        if (mobileDialog.open) mobileDialog.close();
      });
    });
  }

  // 5. Speaking Reel Video: Lazy-loading fallback, Reduced Motion, and WCAG 2.2.2 Controls
  const reelVideo = document.getElementById('speaking-reel');
  const playToggleBtn = document.getElementById('reel-play-toggle');
  const muteToggleBtn = document.getElementById('reel-mute-toggle');

  if (reelVideo) {
    const syncReducedMotion = (prefersReduced) => {
      if (prefersReduced) {
        reelVideo.removeAttribute('autoplay');
        reelVideo.pause();
      }
      updatePlayLabel();
    };

    const updatePlayLabel = () => {
      if (!playToggleBtn) return;
      const paused = reelVideo.paused;
      playToggleBtn.textContent = paused ? 'Play Video' : 'Pause Video';
      playToggleBtn.setAttribute('aria-label', paused ? 'Play speaking reel video' : 'Pause speaking reel video');
    };

    const updateMuteLabel = () => {
      if (!muteToggleBtn) return;
      const muted = reelVideo.muted;
      muteToggleBtn.textContent = muted ? 'Unmute Audio' : 'Mute Audio';
      muteToggleBtn.setAttribute('aria-label', muted ? 'Unmute speaking reel audio' : 'Mute speaking reel audio');
    };

    if (!Object.hasOwn(HTMLMediaElement.prototype, 'loading')) {
      const source = reelVideo.querySelector('source');
      if (source && source.src) {
        const videoSrc = source.src;
        source.dataset.src = videoSrc;
        source.removeAttribute('src');
        reelVideo.preload = 'none';
        const mediaObserver = new IntersectionObserver(
          (entries, obs) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              if (source.dataset.src) {
                source.src = source.dataset.src;
                delete source.dataset.src;
                reelVideo.preload = 'metadata';
                reelVideo.load();
                if (!reducedMotionQuery.matches) {
                  reelVideo.play().catch(() => {});
                }
              }
              obs.unobserve(reelVideo);
            }
          },
          { rootMargin: '200px 0px' }
        );
        mediaObserver.observe(reelVideo);
      }
    }

    syncReducedMotion(reducedMotionQuery.matches);
    reducedMotionQuery.addEventListener('change', (e) => syncReducedMotion(e.matches));

    reelVideo.addEventListener('play', updatePlayLabel);
    reelVideo.addEventListener('pause', updatePlayLabel);

    playToggleBtn?.addEventListener('click', () => {
      if (reelVideo.paused) {
        reelVideo.play().catch(() => {});
      } else {
        reelVideo.pause();
      }
      updatePlayLabel();
    });

    muteToggleBtn?.addEventListener('click', () => {
      reelVideo.muted = !reelVideo.muted;
      if (!reelVideo.muted && reelVideo.paused) {
        reelVideo.play().catch(() => {});
      }
      updateMuteLabel();
    });

    updatePlayLabel();
    updateMuteLabel();
  }

  // 6. Pre-select Engagement Format, Topic, or Book Inquiry from Page CTAs
  const engagementSelect = document.getElementById('engagementType');
  const goalsTextarea = document.getElementById('audienceGoals');
  const nameOrgInput = document.getElementById('nameOrg');

  document.querySelectorAll('[data-preselect-format]').forEach((el) => {
    el.addEventListener('click', () => {
      if (!engagementSelect) return;
      const fmt = el.getAttribute('data-preselect-format');
      if (fmt) {
        engagementSelect.value = fmt;
        engagementSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  document.querySelectorAll('[data-preselect-topic]').forEach((el) => {
    el.addEventListener('click', () => {
      const topic = el.getAttribute('data-preselect-topic');
      if (engagementSelect && !engagementSelect.value) {
        engagementSelect.value = 'Keynote';
      }
      if (goalsTextarea && topic && !goalsTextarea.value.includes(topic)) {
        const prefix = `Interested in topic: "${topic}".\n`;
        goalsTextarea.value = prefix + goalsTextarea.value;
      }
    });
  });

  document.querySelectorAll('[data-preselect-book]').forEach((el) => {
    el.addEventListener('click', () => {
      const bookNote = el.getAttribute('data-preselect-book');
      if (engagementSelect && !engagementSelect.value) {
        engagementSelect.value = 'Custom Engagement';
      }
      if (goalsTextarea && bookNote && !goalsTextarea.value.includes(bookNote)) {
        goalsTextarea.value = `Inquiry regarding: ${bookNote}.\n` + goalsTextarea.value;
      }
    });
  });

  // 7. Booking Form: Accessible Validation (:user-invalid + ARIA sync) & Server Submission
  const form = document.getElementById('booking-form');
  const formTokenInput = document.getElementById('formToken');
  const statusBanner = document.getElementById('form-status-banner');
  const submitBtn = document.getElementById('submit-inquiry-btn');

  async function refreshFormToken() {
    if (!formTokenInput) return;
    try {
      const res = await fetch('/api/form-token', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.token) formTokenInput.value = data.token;
      }
    } catch {
      // Static file preview fallback if opened without Node server
    }
  }

  refreshFormToken();

  if (form) {
    // Check URL query for progressive-enhancement non-JS redirect confirmation
    if (new URLSearchParams(window.location.search).get('submitted') === '1' && statusBanner) {
      statusBanner.hidden = false;
      statusBanner.className = 'status-banner is-success';
      statusBanner.textContent = 'Thank you. Your availability inquiry has been received by Michael Graham’s team.';
    }

    // Link error description ID to aria-describedby ONLY while invalid
    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    // Single polite live-region announcer for screen readers
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.classList.add('visually-hidden');
    document.body.append(announcer);
    let announceTimer;
    let announcedField;

    const spokenText = (node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      copy
        .querySelectorAll('[role="img"][aria-label]')
        .forEach((n) => n.replaceWith(`${n.getAttribute('aria-label')}: `));
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };

    const announceError = (el) => {
      const errorEl = document.getElementById(el.dataset.error);
      if (!errorEl) return;
      const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
      clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = label + spokenText(errorEl);
      }, 500);
    };

    const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
    const dirtyState = new WeakMap();
    const flagged = new WeakSet();
    const announced = new WeakSet();

    const validateCustomRules = (el) => {
      if (!el.setCustomValidity) return;
      if (el.id === 'email' && el.value.trim().length > 0) {
        const strictEmail = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
        if (!strictEmail.test(el.value.trim())) {
          el.setCustomValidity('Enter a valid email address with a domain (e.g., alex@company.com).');
          return;
        }
      }
      el.setCustomValidity('');
    };

    const syncFieldState = (el, announce = false, forceFallbackCheck = false) => {
      if (!el.matches?.('input, select, textarea') || el.id === 'company_website') return;
      validateCustomRules(el);

      let invalid;
      if (supportsUserInvalid) {
        invalid = el.matches(':user-invalid');
      } else {
        const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
        invalid = (forceFallbackCheck || (state.hasInteracted && state.hasBlurred)) && !el.validity.valid;
        el.classList.toggle('user-invalid-fallback', invalid);
        el.classList.toggle('user-valid-fallback', !invalid && state.hasInteracted && el.validity.valid);
      }

      if (invalid) {
        if (announce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = '';
        }
      }
    };

    const formControls = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(
      (el) => el.id !== 'company_website'
    );
    formControls.forEach((el) => el.setAttribute('aria-invalid', 'false'));

    form.addEventListener(
      'blur',
      (e) => {
        const el = e.target;
        if (!supportsUserInvalid) {
          const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
          st.hasBlurred = true;
          dirtyState.set(el, st);
        }
        syncFieldState(el, true);
      },
      true
    );

    form.addEventListener('input', (e) => {
      const el = e.target;
      if (!supportsUserInvalid) {
        const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
        st.hasInteracted = true;
        dirtyState.set(el, st);
      }
      if (el.hasAttribute('aria-invalid')) {
        syncFieldState(el, false);
      }
    });

    form.addEventListener(
      'change',
      (e) => {
        const el = e.target;
        if (!supportsUserInvalid) {
          const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
          st.hasInteracted = true;
          st.hasBlurred = true;
          dirtyState.set(el, st);
        }
        syncFieldState(el, true);
      },
      true
    );

    form.addEventListener(
      'invalid',
      (e) => {
        const el = e.target;
        announced.add(el);
        if (!supportsUserInvalid) {
          dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
        }
        syncFieldState(el, false, true);
      },
      true
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (statusBanner) statusBanner.hidden = true;

      formControls.forEach((el) => validateCustomRules(el));

      if (!form.checkValidity()) {
        formControls.forEach((el) => {
          if (!el.validity.valid) {
            if (!supportsUserInvalid) {
              dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
            }
            el.setAttribute('aria-invalid', 'true');
            el.classList.add('user-invalid-fallback');
            linkError(el, true);
            flagged.add(el);
          }
        });
        const firstInvalid = formControls.find((el) => !el.validity.valid);
        firstInvalid?.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting Inquiry...';
      }

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const res = await fetch('/api/inquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          if (data.errors) {
            let firstServerErrorField = null;
            for (const [fieldName, errText] of Object.entries(data.errors)) {
              const fieldEl = form.elements.namedItem(fieldName);
              const errBox = document.getElementById(`${fieldName}-error`);
              if (fieldEl && fieldEl instanceof HTMLElement) {
                fieldEl.setAttribute('aria-invalid', 'true');
                fieldEl.classList.add('user-invalid-fallback');
                linkError(fieldEl, true);
                if (!firstServerErrorField) firstServerErrorField = fieldEl;
              }
              if (errBox && errText) {
                errBox.textContent = errText;
              }
            }
            firstServerErrorField?.focus();
          }

          if (statusBanner) {
            statusBanner.hidden = false;
            statusBanner.className = 'status-banner is-error';
            statusBanner.textContent = data.message || 'Unable to submit your inquiry. Please review the form and try again.';
          }

          if (data.reason === 'expired_token' || data.reason === 'invalid_signature' || data.reason === 'missing_token') {
            await refreshFormToken();
          }
          return;
        }

        // Success
        form.reset();
        formControls.forEach((el) => {
          dirtyState.delete(el);
          flagged.delete(el);
          announced.delete(el);
          el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          el.setAttribute('aria-invalid', 'false');
          linkError(el, false);
        });

        if (statusBanner) {
          statusBanner.hidden = false;
          statusBanner.className = 'status-banner is-success';
          statusBanner.textContent = `Confirmation ${data.inquiryId}: ${data.message}`;
        }
        await refreshFormToken();
      } catch {
        if (statusBanner) {
          statusBanner.hidden = false;
          statusBanner.className = 'status-banner is-error';
          statusBanner.textContent = 'Network error while submitting. Please verify the server is running and try again.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Check Availability';
        }
      }
    });
  }

  // 8. Tagline Reveal Scroll Activation (Landing Page Design B11 & Animate)
  const taglineWords = document.querySelectorAll('#tagline-reveal .reveal-word');
  if (taglineWords.length > 0) {
    if (reducedMotionQuery.matches) {
      taglineWords.forEach((word) => word.classList.add('is-active'));
    } else {
      const taglineSection = document.getElementById('tagline-reveal');
      if (taglineSection) {
        let hasActivated = false;
        const revealObserver = new IntersectionObserver(
          (entries, obs) => {
            for (const entry of entries) {
              if (entry.isIntersecting && !hasActivated) {
                hasActivated = true;
                obs.unobserve(entry.target);
                taglineWords.forEach((word, idx) => {
                  setTimeout(() => {
                    word.classList.add('is-active');
                  }, idx * 48);
                });
              }
            }
          },
          { threshold: 0.35, rootMargin: '0px 0px -10% 0px' }
        );
        revealObserver.observe(taglineSection);
      }
    }
  }

  // Update footer copyright year
  const yearEl = document.getElementById('copyright-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
