(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const email = typeof config.contactEmail === 'string' ? config.contactEmail.trim() : '';
  const validEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email);
  const lineUrl = typeof config.personalLineUrl === 'string' ? config.personalLineUrl.trim() : '';
  function isPersonalLineUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        ((url.hostname === 'line.me' && /^\/ti\/p\/[^/]+$/.test(url.pathname)) ||
         (url.hostname === 'lin.ee' && /^\/[^/]+$/.test(url.pathname))) &&
        !url.search && !url.hash;
    } catch (_) { return false; }
  }
  const validLine = isPersonalLineUrl(lineUrl);
  document.querySelectorAll('[data-direct-line]').forEach(function (link) {
    link.hidden = !validLine;
    if (validLine) link.href = lineUrl;
  });
  document.querySelectorAll('[data-direct-line-hint]').forEach(function (hint) {
    hint.hidden = !validLine;
  });
  const notice = document.getElementById('preview-notice');
  if (notice) notice.hidden = config.privacyConfirmed === true;
  if (notice && validLine && document.getElementById('consult-form')) {
    notice.textContent = 'PREVIEW — 個人LINEに接続済みです。限定共有で動作確認中です。';
  }
  document.querySelectorAll('[data-contact-email]').forEach(function (link) {
    link.hidden = !validEmail;
    if (validEmail) { link.textContent = email; link.href = 'mailto:' + email; }
  });
  document.querySelectorAll('[data-operator-name]').forEach(function (element) {
    element.textContent = config.operatorName || 'AIPLUN（運営者情報を確認中）';
  });
  const allowedCategories = {
    career: '転職・キャリア',
    rent: '賃貸・引っ越し',
    utility: '電気・ガス・通信（インフラ）'
  };
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  // Animate visible content once. Content stays readable without JS or animation support.
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealed = new WeakSet();
  const activeReveals = new Set();
  const revealTargets = Array.from(document.querySelectorAll(
    '.hero-content > *, .hero-bottom, .intro-grid > div, .section-heading, .service-item, ' +
    '.customer-heading > div, .customer-principles article, .customer-transparency, .flow-card, ' +
    '.consult-aside, .form-head, .faq-items details, .closing-inner > div, .closing-inner > a, ' +
    '.detail-hero-grid > div, .detail-photo, .detail-summary, .service-values, .detail-feature, ' +
    '.detail-two-col > div, .detail-checklist li, .detail-role-grid article, .detail-step-list li, ' +
    '.detail-prep, .detail-related, .footer-inner > div'
  ));
  let revealObserver;
  function setupReveals() {
    if (revealObserver) revealObserver.disconnect();
    if (motionPreference.matches) {
      activeReveals.forEach(function (animation) { animation.cancel(); });
      activeReveals.clear();
      return;
    }
    if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || revealed.has(entry.target)) return;
        revealed.add(entry.target);
        revealObserver.unobserve(entry.target);
        const animation = entry.target.animate([
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)' });
        activeReveals.add(animation);
        animation.finished.then(function () { activeReveals.delete(animation); }, function () { activeReveals.delete(animation); });
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
    revealTargets.forEach(function (element) {
      if (!revealed.has(element)) revealObserver.observe(element);
    });
  }
  setupReveals();
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', setupReveals);
  const form = document.getElementById('consult-form');
  if (!form) return;
  const cards = Array.from(document.querySelectorAll('[data-service]'));
  const categoryRadios = Array.from(document.querySelectorAll('input[name="category"]'));
  const messageDraft = document.getElementById('draft');
  const error = document.getElementById('form-error');
  const result = document.getElementById('result');
  const lineAction = document.getElementById('line-action');
  const lineMissing = document.getElementById('line-missing');
  const mailAction = document.getElementById('mail-action');
  const copyButton = document.getElementById('copy-draft');
  const copyStatus = document.getElementById('copy-status');
  lineAction.hidden = !validLine;
  if (validLine && !validEmail) {
    document.querySelector('#result > p').textContent = '内容を確認して、個人LINEで送信してください。';
    document.getElementById('send-hint').textContent = '① メッセージをコピー → ② 個人LINEを友だち追加 → ③ トークに貼り付けて送信。友だち追加だけでは相談内容は届きません。';
  }
  lineMissing.hidden = validLine || !validEmail;
  document.getElementById('no-contact').hidden = validLine || validEmail;
  if (!validLine) document.getElementById('send-hint').textContent = validEmail ? '① メッセージを確認 → ② メールを作成 → ③ メールアプリで送信。アプリが起動しない場合は、コピーした文章を普段のメールに貼り付けてお送りください。宛先：' + email : 'コピーした文章を、お知らせ済みの連絡先に貼り付けて送信してください。';
  const consultationId = 'AL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    (window.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const detailsInput = form.elements.namedItem('details');
  const exampleButton = document.getElementById('insert-example');
  const examples = {
    career: '転職するかまだ迷っています。今の働き方や、これからの選択肢について相談したいです。',
    rent: '引っ越しを考えています。希望のエリアや予算を整理するところから相談したいです。',
    utility: '電気・ガス・インターネットについて、今の契約や切り替えの進め方を相談したいです。'
  };
  function updateDetailsCount() {
    document.getElementById('char-count').textContent = detailsInput.value.length + ' / 1000';
    exampleButton.disabled = detailsInput.value.trim().length > 0;
  }
  detailsInput.addEventListener('input', updateDetailsCount);
  exampleButton.addEventListener('click', function () {
    if (detailsInput.value.trim()) return;
    const selected = form.querySelector('input[name="category"]:checked');
    detailsInput.value = examples[selected && selected.value] || 'まだ具体的には決まっていませんが、まずは話を聞いてみたいです。';
    detailsInput.dispatchEvent(new Event('input', { bubbles: true }));
    detailsInput.focus();
  });
  updateDetailsCount();
  const mobileConsult = document.querySelector('.mobile-consult');
  if (mobileConsult && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      mobileConsult.classList.toggle('in-form', entries[0].isIntersecting);
    }, { threshold: 0 }).observe(form);
  }

  function refreshSelection() {
    result.hidden = true;
    const active = form.querySelector('input[name="category"]:checked');
    const value = active ? active.value : '';
    cards.forEach(function (card) {
      card.setAttribute('aria-pressed', String(card.dataset.service === value));
    });
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      const radio = categoryRadios.find(function (item) {
        return item.value === card.dataset.service;
      });
      if (radio) {
        radio.checked = true;
        refreshSelection();
        document.getElementById('consult').scrollIntoView({ behavior: motion, block: 'start' });
      }
    });
  });
  categoryRadios.forEach(function (radio) { radio.addEventListener('change', refreshSelection); });
  const initialCategory = new URLSearchParams(window.location.search).get('category');
  if (initialCategory && Object.hasOwn(allowedCategories, initialCategory)) {
    const initialRadio = categoryRadios.find(function (radio) { return radio.value === initialCategory; });
    if (initialRadio) initialRadio.checked = true;
    refreshSelection();
  }

  function generateText(category, timing, nickname, details, consent) {
    const params = new URLSearchParams(window.location.search);
    const rawSource = params.get('ref') || params.get('utm_source') || '';
    const source = rawSource.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const parts = [
      '【AIPLUN LIFE｜相談のお問い合わせ】',
      '相談ID：' + consultationId,
      '',
      'ご相談カテゴリー：' + allowedCategories[category],
      'ご相談の時期：' + timing,
      'お名前：' + (nickname || '未記入'),
      '',
      '相談内容：',
      details || 'まずは相談したいです。',
      '',
      '専門担当者の案内：' + (consent ? '話を聞いてみたい' : 'まずはAIPLUNへの相談のみ') + '\n第三者への情報共有：未同意（共有前に別途確認）'
    ];
    if (source) parts.push('ご案内元：' + source);
    parts.push('', '※AIPLUN相談窓口へのメッセージです。');
    return parts.join('\n');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.textContent = '';
    copyStatus.textContent = '';
    const category = form.querySelector('input[name="category"]:checked');
    const timing = form.elements.namedItem('timing');
    if (!category || !Object.hasOwn(allowedCategories, category.value)) {
      error.textContent = '相談カテゴリーを選択してください。';
      categoryRadios[0].focus();
      document.getElementById('category-options').scrollIntoView({ block: 'center', behavior: motion });
      return;
    }
    if (!Array.from(timing.options).some(function (option) { return option.value && option.value === timing.value; })) {
      error.textContent = '相談したい時期を選択してください。';
      timing.focus();
      return;
    }

    const nickname = (form.elements.namedItem('nickname').value || '').trim().slice(0, 40);
    const details = (form.elements.namedItem('details').value || '').trim().slice(0, 1000);
    const consent = form.elements.namedItem('shareConsent').checked;
    const draft = generateText(category.value, timing.value, nickname, details, consent);
    messageDraft.value = draft;

    if (validLine) {
      lineAction.href = lineUrl;
    }

    if (validEmail) {
      mailAction.href = 'mailto:' + email + '?subject=' +
        encodeURIComponent('AIPLUN LIFE｜' + allowedCategories[category.value] + 'の相談') +
        '&body=' + encodeURIComponent(draft);
      mailAction.hidden = false;
    } else {
      mailAction.hidden = true;
    }

    result.hidden = false;
    document.getElementById('result-title').focus({ preventScroll: true });
    result.scrollIntoView({ behavior: motion, block: 'center' });
  });

  form.addEventListener('input', function (event) {
    if (event.target !== messageDraft) { result.hidden = true; error.textContent = ''; }
  });

  copyButton.addEventListener('click', async function () {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(messageDraft.value);
      } else {
        messageDraft.focus();
        messageDraft.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      }
      copyStatus.textContent = 'コピーしました。LINEやメールに貼り付けて、送信してください。';
    } catch (err) {
      messageDraft.focus();
      messageDraft.select();
      copyStatus.textContent = '文章を選択しました。コピーしてLINEやメールに貼り付けてください。';
    }
  });
})();
