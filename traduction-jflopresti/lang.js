/* =====================================================================
   lang.js — bouton FR / EN pour tout le site jflopresti.fr
   - Ajoute le bouton dans la barre de navigation de chaque page
   - Traduit la page à partir de /lang-en.json (textes relus à la main)
   - Langue au chargement : ?lang=en|fr, sinon dernier choix du visiteur,
     sinon langue du navigateur
   - Un texte absent du dictionnaire reste simplement en français
   ===================================================================== */
(function () {
  'use strict';

  var INLINE = /^(A|STRONG|EM|B|I|SPAN|BR|SUP|SUB|SMALL|MARK|ABBR|U|S|TIME|WBR)$/;
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|TEXTAREA|CODE|PRE|SELECT)$/;
  var ATTRS = ['placeholder', 'alt', 'aria-label', 'title'];
  var norm = function (t) { return (t || '').replace(/\s+/g, ' ').trim(); };

  // A "unit" = the outermost element that mixes text with inline tags only
  // (e.g. <p>Texte <strong>gras</strong> et <a>lien</a></p>). It is translated as a whole.
  function onlyInline(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (!INLINE.test(c.tagName.toUpperCase()) || !onlyInline(c)) return false;
    }
    return true;
  }
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && /[A-Za-zÀ-ÿ0-9]/.test(n.nodeValue)) return true;
    }
    return false;
  }
  function isUnitCandidate(el) {
    return el && el !== document.body && !SKIP.test(el.tagName.toUpperCase()) &&
      el.firstElementChild && onlyInline(el) && hasOwnText(el);
  }

  // Walk a root and report units, lone text nodes and translatable attributes
  function scan(root, onUnit, onText, onAttr) {
    (function walk(node) {
      if (node.nodeType === 1) {
        var tag = node.tagName.toUpperCase();
        if (SKIP.test(tag) || node.id === 'lang-toggle') return;
        for (var i = 0; i < ATTRS.length; i++) {
          var v = node.getAttribute(ATTRS[i]);
          if (v && /[A-Za-zÀ-ÿ]/.test(v)) onAttr(node, ATTRS[i], v);
        }
        if (tag === 'INPUT' && /^(submit|button)$/i.test(node.type) && node.value) onAttr(node, 'value', node.value);
        if (isUnitCandidate(node) && !isUnitCandidate(node.parentElement)) { onUnit(node); return; }
        for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
      } else if (node.nodeType === 3 && /[A-Za-zÀ-ÿ]/.test(node.nodeValue)) {
        onText(node);
      }
    })(root);
  }

  // Extraction helper, used once to build lang-en.json (not used by visitors)
  window.__langCollect = function () {
    var out = { html: [], text: [], title: document.title,
      meta: (document.querySelector('meta[name="description"]') || {}).content || '' };
    scan(document.body,
      function (el) { out.html.push(norm(el.innerHTML)); },
      function (n) { out.text.push(norm(n.nodeValue)); },
      function (el, a, v) { out.text.push(norm(v)); });
    // <option> labels live inside <select>, which the walk skips
    document.querySelectorAll('select option').forEach(function (o) { out.text.push(norm(o.textContent)); });
    return out;
  };

  var dict = null, current = 'fr', applying = false;
  var saved = [];            // functions that put the French text back
  var metaDesc = document.querySelector('meta[name="description"]');
  var original = { title: document.title, meta: metaDesc ? metaDesc.content : '' };

  function translateText(n) {
    var v = n.nodeValue, en = dict.t[norm(v)];
    if (en) {
      var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
      n.nodeValue = lead + en + trail;
      saved.push(function () { n.nodeValue = v; });
    }
  }
  function translateRoot(root) {
    if (!dict) return;
    applying = true;
    scan(root,
      function (el) {
        var fr = el.innerHTML, en = dict.h[norm(fr)];
        if (en) { el.innerHTML = en; saved.push(function () { el.innerHTML = fr; }); }
        else {
          var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) translateText(w.currentNode);
        }
      },
      translateText,
      function (el, a, v) {
        var en = dict.t[norm(v)];
        if (!en) return;
        if (a === 'value') { el.value = en; saved.push(function () { el.value = v; }); }
        else { el.setAttribute(a, en); saved.push(function () { el.setAttribute(a, v); }); }
      });
    (root.querySelectorAll ? root.querySelectorAll('select option') : []).forEach(function (o) {
      var fr = o.textContent, en = dict.t[norm(fr)];
      if (en) { o.textContent = en; saved.push(function () { o.textContent = fr; }); }
    });
    applying = false;
  }

  function setButton(lang) {
    var b = document.getElementById('lang-toggle');
    if (!b) return;
    b.setAttribute('aria-label', lang === 'en' ? 'Passer en français' : 'Switch to English');
    b.querySelector('[data-l="fr"]').className = lang === 'fr' ? 'on' : '';
    b.querySelector('[data-l="en"]').className = lang === 'en' ? 'on' : '';
  }
  function remember(l) { try { localStorage.setItem('lang', l); } catch (e) {} }

  function load(cb) {
    if (dict) return cb();
    fetch('/lang-en.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { dict = d; cb(); })
      .catch(function () {});
  }
  function toEnglish() {
    if (current === 'en') return;
    load(function () {
      translateRoot(document.body);
      document.documentElement.lang = 'en';
      if (dict.title[norm(original.title)]) document.title = dict.title[norm(original.title)];
      if (metaDesc && dict.t[norm(original.meta)]) metaDesc.content = dict.t[norm(original.meta)];
      current = 'en'; setButton('en'); remember('en');
    });
  }
  function toFrench() {
    if (current === 'fr') return;
    applying = true;
    for (var i = saved.length - 1; i >= 0; i--) saved[i]();
    saved = [];
    applying = false;
    document.documentElement.lang = 'fr';
    document.title = original.title;
    if (metaDesc) metaDesc.content = original.meta;
    current = 'fr'; setButton('fr'); remember('fr');
  }

  function addButton() {
    if (document.getElementById('lang-toggle')) return;
    var nav = document.querySelector('nav');
    var st = document.createElement('style');
    st.textContent =
      '.nav-end{display:flex;align-items:center;gap:1.75rem;}' +
      '.lang-float{position:fixed;top:1rem;right:1rem;z-index:1000;background:#fff;border-radius:100px;}' +
      '#lang-toggle{font:inherit;font-size:.75rem;font-weight:700;letter-spacing:.06em;color:#1B3A5C;background:transparent;' +
      'border:1px solid rgba(27,58,92,.25);border-radius:100px;padding:.35rem .8rem;min-height:34px;cursor:pointer;' +
      'display:inline-flex;align-items:center;gap:.3rem;transition:border-color .2s,color .2s;white-space:nowrap;}' +
      '#lang-toggle:hover,#lang-toggle:focus-visible{border-color:#E8541A;color:#E8541A;outline:none;}' +
      '#lang-toggle span{opacity:.45;font-weight:500;}#lang-toggle span.on{opacity:1;font-weight:700;}' +
      '#lang-toggle i{opacity:.3;font-style:normal;}' +
      '@media(max-width:900px){.nav-end{gap:1rem;}}';
    document.head.appendChild(st);

    // Group everything after the logo on the right, then add the button
    // (pages without a menu, like the 404 page, get a small floating button)
    var end = document.createElement('div');
    if (nav) {
      end.className = 'nav-end';
      Array.prototype.slice.call(nav.children, 1).forEach(function (k) { end.appendChild(k); });
      nav.appendChild(end);
    } else {
      end.className = 'lang-float';
      document.body.appendChild(end);
    }

    var b = document.createElement('button');
    b.type = 'button'; b.id = 'lang-toggle';
    b.innerHTML = '<span data-l="fr">FR</span><i>/</i><span data-l="en">EN</span>';
    end.insertBefore(b, end.querySelector('.nav-burger'));
    b.addEventListener('click', function () { current === 'en' ? toFrench() : toEnglish(); });
    setButton('fr');
  }

  // Content added later (blog cards, form messages…) is translated too
  function watch() {
    new MutationObserver(function (muts) {
      if (applying || current !== 'en' || !dict) return;
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) translateRoot(n);
          else if (n.nodeType === 3) { applying = true; translateText(n); applying = false; }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    addButton();
    watch();
    var p = new URLSearchParams(location.search).get('lang'), s = null;
    try { s = localStorage.getItem('lang'); } catch (e) {}
    var lang = (p === 'en' || p === 'fr') ? p : (s === 'en' || s === 'fr') ? s :
      ((navigator.language || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en');
    if (lang === 'en') toEnglish();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
