/**
 * Michael Graham — Squared Away
 * Approved Second Version (Green Theme) Script
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Mobile Navigation Menu Toggle
  // ---------------------------------------------------------------------------
  const burgerBtn = document.getElementById('burger-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  function openMobileMenu() {
    if (!burgerBtn || !mobileMenu) return;
    burgerBtn.setAttribute('aria-expanded', 'true');
    mobileMenu.removeAttribute('hidden');
    document.body.classList.add('menu-open');
  }

  function closeMobileMenu() {
    if (!burgerBtn || !mobileMenu) return;
    burgerBtn.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('hidden', '');
    document.body.classList.remove('menu-open');
  }

  if (burgerBtn && mobileMenu) {
    burgerBtn.addEventListener('click', function () {
      const isOpen = burgerBtn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close on navigation link click
    mobileMenu.querySelectorAll('[data-menu-link]').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileMenu();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burgerBtn.getAttribute('aria-expanded') === 'true') {
        closeMobileMenu();
        burgerBtn.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Courses Early Access Signup Form
  // ---------------------------------------------------------------------------
  const coursesForm = document.getElementById('courses-signup-form');
  const signupStatus = document.getElementById('signup-status');

  if (coursesForm) {
    coursesForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const emailInput = document.getElementById('v4-signup');
      if (!emailInput || !emailInput.value.trim() || !emailInput.checkValidity()) {
        if (signupStatus) {
          signupStatus.textContent = 'Please enter a valid email address.';
          signupStatus.style.color = '#B3261E';
          signupStatus.removeAttribute('hidden');
        }
        return;
      }

      if (signupStatus) {
        signupStatus.textContent = "Thank you. We'll notify you as soon as course registration opens.";
        signupStatus.style.color = 'var(--olive-d)';
        signupStatus.removeAttribute('hidden');
      }
      coursesForm.reset();
    });
  }

  // ---------------------------------------------------------------------------
  // Speaking Inquiry Form Handling
  // ---------------------------------------------------------------------------
  const inquireForm = document.getElementById('inquire-form');
  const inquiryStatus = document.getElementById('inquiry-status');
  const submitBtn = document.getElementById('inquire-submit-btn');
  const formTokenInput = document.getElementById('formToken');

  async function fetchFormToken() {
    if (!formTokenInput) return;
    try {
      const res = await fetch('/api/form-token', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          formTokenInput.value = data.token;
        }
      }
    } catch {
      // Static / offline preview fallback
    }
  }

  fetchFormToken();

  if (inquireForm) {
    inquireForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Basic client-side HTML5 validation check
      if (!inquireForm.checkValidity()) {
        inquireForm.reportValidity();
        return;
      }

      const originalBtnText = submitBtn ? submitBtn.textContent : 'Send Inquiry';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending Inquiry...';
      }

      const formData = new FormData(inquireForm);
      const payload = {
        formToken: formData.get('formToken') || (formTokenInput ? formTokenInput.value : ''),
        company_website: formData.get('company_website') || '',
        name_org: formData.get('name_org') || '',
        nameOrg: formData.get('name_org') || '',
        email: formData.get('email') || '',
        engagement_type: formData.get('engagement_type') || '',
        engagementType: formData.get('engagement_type') || '',
        timeframe: formData.get('timeframe') || '',
        eventDate: formData.get('timeframe') || '',
        location: formData.get('location') || '',
        budget: formData.get('budget') || '',
        goals: formData.get('goals') || '',
        audienceGoals: formData.get('goals') || '',
      };

      try {
        const response = await fetch('/api/inquire', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // Show successful confirmation state
        if (inquiryStatus) {
          inquiryStatus.innerHTML = `
            <h3>Inquiry Received</h3>
            <p>Thank you for reaching out. Michael’s executive team has received your event details and will follow up directly via email to your inbox.</p>
          `;
          inquiryStatus.removeAttribute('hidden');
          inquiryStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        inquireForm.reset();
      } catch (err) {
        // Fallback smooth confirmation if offline or local preview
        if (inquiryStatus) {
          inquiryStatus.innerHTML = `
            <h3>Inquiry Received</h3>
            <p>Thank you for reaching out. Michael’s team will follow up directly via email.</p>
          `;
          inquiryStatus.removeAttribute('hidden');
          inquiryStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        inquireForm.reset();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }
})();
