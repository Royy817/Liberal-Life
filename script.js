(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const allowedCategories = {
    career: '転職・キャリア',
    rent: '賃貸・引っ越し',
    utility: '電気・ガス・通信（インフラ）'
  };
  const form = document.getElementById('consult-form');
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
  const year = document.getElementById('year');
  const email = typeof config.contactEmail === 'string' ? config.contactEmail.trim() : '';
  const lineUrl = typeof config.lineOfficialUrl === 'string' ? config.lineOfficialUrl.trim() : '';
  const validLine = /^https:\/\/(lin\.ee|line\.me|page\.line\.me)\//i.test(lineUrl);

  year.textContent = String(new Date().getFullYear());
  lineAction.hidden = !validLine;
  lineMissing.hidden = validLine;

  function refreshSelection() {
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
        document.getElementById('consult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  categoryRadios.forEach(function (radio) { radio.addEventListener('change', refreshSelection); });

  function generateText(category, timing, nickname, details, consent) {
    const params = new URLSearchParams(window.location.search);
    const rawSource = params.get('ref') || params.get('utm_source') || '';
    const source = rawSource.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const parts = [
      '【AIPLUN LIFE｜相談のお問い合わせ】',
      '',
      'ご相談カテゴリー：' + allowedCategories[category],
      'ご相談の時期：' + timing,
      'お名前：' + (nickname || '未記入'),
      '',
      '相談内容：',
      details || 'まずは相談したいです。',
      '',
      'Liberal Life担当者への情報共有：' + (consent ? '希望する・同意する' : '現時点では希望しない')
    ];
    if (source) parts.push('ご案内元：' + source);
    parts.push('', '※AIPLUN相談窓口へのメッセージです。');
    return parts.join('\n');
  }

  function validEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.textContent = '';
    copyStatus.textContent = '';
    const category = form.querySelector('input[name="category"]:checked');
    const timing = form.elements.namedItem('timing');
    if (!category || !Object.hasOwn(allowedCategories, category.value)) {
      error.textContent = '相談カテゴリーを選択してください。';
      document.getElementById('category-options').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!timing.value) {
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

    if (validEmailAddress(email)) {
      mailAction.href = 'mailto:' + email + '?subject=' +
        encodeURIComponent('AIPLUN LIFE｜' + allowedCategories[category.value] + 'の相談') +
        '&body=' + encodeURIComponent(draft);
      mailAction.hidden = false;
    } else {
      mailAction.hidden = true;
    }

    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      copyStatus.textContent = 'コピーしました。LINEのトークに貼り付けて送信してください。';
    } catch (err) {
      messageDraft.focus();
      messageDraft.select();
      copyStatus.textContent = '文章を選択しました。コピーしてLINEやメールに貼り付けてください。';
    }
  });
})();
