/* 全站顶栏导航 + 页面切换动画（glass/site-topbar.js） */
(function () {
  'use strict';

  var LINKS = [
    ['landing.html', '官网', 'landing'],
    ['index.html', '组件', 'index'],
    ['mobile.html', '手机端', 'mobile'],
    ['web.html', '网页端', 'web'],
    ['starter.html', '起步模板', 'starter'],
    ['admin.html', '后台模板', 'admin'],
    ['shop.html', '店铺模板', 'shop'],
    ['docs.html', '文档', 'docs']
  ];

  var NAV_FLAG = 'lg-site-nav';

  function pageKey() {
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!file || file === '/') return 'landing';
    return file.replace(/\.html$/, '') || 'index';
  }

  function renderNav(active) {
    return LINKS.map(function (row) {
      var on = row[2] === active ? ' class="on"' : '';
      return '<a href="' + row[0] + '"' + on + '>' + row[1] + '</a>';
    }).join('');
  }

  function fillNav() {
    var active = pageKey();
    [].forEach.call(document.querySelectorAll('nav[data-site-nav]'), function (nav) {
      var key = nav.getAttribute('data-site-nav');
      if (key === '' || key === 'auto') key = active;
      nav.innerHTML = renderNav(key);
    });
  }

  function reducedMotion() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isSiteNavLink(a) {
    if (!a || !a.getAttribute) return false;
    if (a.target === '_blank' || a.hasAttribute('download')) return false;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (a.closest('nav[data-site-nav]')) return true;
    if (a.closest('.topbar-web') && a.classList.contains('brand')) return true;
    if (a.closest('footer .tpl-foot nav, .tpl-foot nav')) return true;
    return false;
  }

  function resolveUrl(href) {
    try {
      return new URL(href, location.href);
    } catch (e) {
      return null;
    }
  }

  function isHtmlPage(url) {
    if (url.origin !== location.origin) return false;
    var p = url.pathname;
    if (p === '/' || /\/index\.html$/i.test(p)) return true;
    return /\.html$/i.test(p);
  }

  function leaveAndGo(url) {
    if (reducedMotion()) {
      location.href = url;
      return;
    }
    try {
      sessionStorage.setItem(NAV_FLAG, '1');
    } catch (e) { /* ignore */ }
    document.body.classList.add('lg-page-leave');
    window.setTimeout(function () {
      location.href = url;
    }, 260);
  }

  function bindPageTransitions() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!isSiteNavLink(a)) return;
      var url = resolveUrl(a.getAttribute('href'));
      if (!url || !isHtmlPage(url)) return;
      if (url.href === location.href) return;
      e.preventDefault();
      leaveAndGo(url.href);
    }, true);
  }

  function playEnter() {
    var fromNav = false;
    try {
      fromNav = sessionStorage.getItem(NAV_FLAG) === '1';
      if (fromNav) sessionStorage.removeItem(NAV_FLAG);
    } catch (e) { /* ignore */ }
    if (fromNav && !reducedMotion()) {
      document.body.classList.add('lg-page-enter');
      window.setTimeout(function () {
        document.body.classList.remove('lg-page-enter');
      }, 520);
    }
  }

  function boot() {
    fillNav();
    bindPageTransitions();
    playEnter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
