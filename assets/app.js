/* The Business Book — interactive study site (static, GitHub Pages friendly) */
(function () {
  'use strict';
  const META = window.META;
  const CH = META.chapters;
  const TOP = META.topics;
  const COLORS = { ch1: 'var(--ch1)', ch2: 'var(--ch2)', ch3: 'var(--ch3)', ch4: 'var(--ch4)', ch5: 'var(--ch5)', ch6: 'var(--ch6)' };
  window.DATA = window.DATA || {};

  /* ---------- storage (safe) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bizbook.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bizbook.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  /* ---------- language ---------- */
  const qsLang = new URLSearchParams(location.search).get('lang');
  let LANG = qsLang || store.get('lang', null) || guessLang();
  if (!LANGS.find(l => l.code === LANG)) LANG = 'en';
  store.set('lang', LANG);
  const NATIVE_UI = !!UI[LANG];
  const GT = !(LANG === 'en' || LANG === 'ko');      // Google-translate English content
  const CL = LANG === 'ko' ? 'ko' : 'en';           // content language
  let BI = store.get('bi', false);                   // bilingual (show English under Korean)

  function guessLang() {
    const n = (navigator.language || 'en').toLowerCase();
    if (n.startsWith('ko')) return 'ko';
    if (n.startsWith('zh')) return 'zh-CN';
    const two = n.slice(0, 2);
    return (LANGS.find(l => l.code === two) || { code: 'en' }).code;
  }
  function t(k) { return (UI[LANG] && UI[LANG][k]) || UI.en[k] || k; }
  // UI text: if we have a hand-written table for this language, keep Google Translate away from it
  function T(k) { return `<span class="${NATIVE_UI && GT ? 'notranslate' : ''}">${esc(t(k))}</span>`; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const chTitle = c => CL === 'ko' ? c.title_ko : c.title;
  const chSub = c => CL === 'ko' ? c.sub_ko : c.sub;
  const tpTitle = x => CL === 'ko' ? x.title_ko : x.title;
  const tpQuote = x => CL === 'ko' ? x.quote_ko : x.quote;
  const chOf = id => CH.find(c => c.id === id.split('-')[0]);
  const chNum = c => CH.indexOf(c) + 1;

  function setLang(code) {
    store.set('lang', code);
    const needGT = !(code === 'en' || code === 'ko');
    const host = location.hostname;
    const kill = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = kill;
    if (host) { document.cookie = kill + '; domain=' + host; document.cookie = kill + '; domain=.' + host; }
    if (needGT) document.cookie = `googtrans=/en/${code}; path=/`;
    // Same URL + hash only changes the hash (no reload), so drop ?lang and force a reload.
    const u = new URL(location.href); u.searchParams.delete('lang');
    try { history.replaceState(null, '', u.toString()); } catch (e) {}
    location.reload();
  }
  function initGT() {
    if (!GT) return;
    document.cookie = `googtrans=/en/${LANG}; path=/`;
    window.gtInit = function () {
      try { new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gt'); } catch (e) {}
    };
    const s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=gtInit';
    document.head.appendChild(s);
  }

  /* ---------- data loading ---------- */
  const loading = {};
  function loadChapter(cid) {
    if (loading[cid]) return loading[cid];
    loading[cid] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = `data/${cid}.js?v=2`;
      s.onload = () => res(); s.onerror = rej;
      document.head.appendChild(s);
    });
    return loading[cid];
  }
  const loadAll = () => Promise.all(CH.map(c => loadChapter(c.id)));

  /* ---------- scores ---------- */
  function scores() { return store.get('scores', {}); }
  function saveScore(key, pct) {
    const s = scores(); const o = s[key] || { best: 0, tries: 0 };
    o.last = pct; o.best = Math.max(o.best, pct); o.tries++; s[key] = o; store.set('scores', s);
  }
  function badge(key) {
    const o = scores()[key];
    if (!o) return `<span class="badge">${T('notStarted')}</span>`;
    const cls = o.best >= 80 ? 'ok' : o.best >= 50 ? 'mid' : 'low';
    return `<span class="badge ${cls}">${T('best')} ${o.best}%</span>`;
  }
  function chProgress(c) {
    const s = scores(); const done = c.topics.filter(id => s[id]);
    const avg = done.length ? Math.round(done.reduce((a, id) => a + s[id].best, 0) / done.length) : 0;
    return { done: done.length, total: c.topics.length, avg };
  }

  /* ---------- shell ---------- */
  const app = document.getElementById('app');
  function shell(crumbs, body, color) {
    const cur = LANGS.find(l => l.code === LANG);
    document.body.style.setProperty('--c', color || 'var(--accent)');
    app.innerHTML = `
    <header class="top"><div class="wrap">
      <a class="brand" href="#/"><span class="logo">B</span><span><span class="notranslate">The Business Book</span><small>${T('siteSub')}</small></span></a>
      <div class="crumbs">${crumbs || ''}</div>
      <div class="lang notranslate" id="lang">
        <button aria-haspopup="true" title="Language">🌐 ${cur.flag} ${esc(cur.label)} ▾</button>
        <ul>${LANGS.map(l => `<li><button data-l="${l.code}" class="${l.code === LANG ? 'on' : ''}">${l.flag} ${esc(l.label)}</button></li>`).join('')}</ul>
      </div>
    </div></header>
    ${GT && t('translatedNote') ? `<div class="note">${T('translatedNote')}</div>` : ''}
    <main>${body}</main>
    <footer><div class="wrap">
      <span>Study notes & exercises based on <i>The Business Book</i> (DK, “Big Ideas Simply Explained”). For classroom use.</span>
      <button class="linkbtn" id="reset">${T('resetProgress')}</button>
    </div></footer>`;
    const lang = document.getElementById('lang');
    lang.querySelector('button').onclick = e => { e.stopPropagation(); lang.classList.toggle('open'); };
    lang.querySelectorAll('li button').forEach(b => b.onclick = () => setLang(b.dataset.l));
    document.onclick = () => lang.classList.remove('open');
    document.getElementById('reset').onclick = () => { if (confirm(t('resetConfirm'))) { store.set('scores', {}); route(); } };
    window.scrollTo(0, 0);
  }

  /* ---------- home ---------- */
  function home() {
    const s = scores(); const ids = Object.keys(TOP);
    const done = ids.filter(id => s[id]);
    const avg = done.length ? Math.round(done.reduce((a, id) => a + s[id].best, 0) / done.length) : 0;
    const body = `
    <section class="wrap hero">
      <h1>${CL === 'ko' ? '비즈니스 북' : '<span class="notranslate">The Business Book</span>'}</h1>
      <p class="lead">${T('heroLead')}</p>
      <div class="stats">
        <div class="stat"><b>${CH.length}</b><span>${T('chapters')}</span></div>
        <div class="stat"><b>${ids.length}</b><span>${T('topics')}</span></div>
        <div class="stat"><b>${ids.length * 10}</b><span>${T('questions')}</span></div>
        <div class="stat"><b>${done.length}/${ids.length}</b><span>${T('progress')} · ${T('completed')}</span></div>
        <div class="stat"><b>${avg}%</b><span>${T('avgScore')}</span></div>
      </div>
      <div class="searchbox"><input id="q" type="search" placeholder="${esc(t('search'))}"></div>
      <div id="sres" class="sres"></div>
    </section>
    <section class="wrap">
      <h2 class="sec">${T('chapters')}</h2>
      <div class="grid">${CH.map(chCard).join('')}</div>
    </section>`;
    shell('', body);
    const q = document.getElementById('q');
    let timer;
    q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => search(q.value), 150); };
  }
  function chCard(c) {
    const p = chProgress(c); const n = chNum(c);
    return `<article class="chcard" style="--c:${COLORS[c.id]}">
      <a class="band" href="#/ch/${c.id}"><span class="num">${n}</span>
        <h3>${esc(chTitle(c))}</h3><p>${esc(chSub(c))}</p></a>
      <ol>${c.topics.map((id, i) => `<li><a href="#/t/${id}"><span class="n">${n}.${i + 1}</span><span class="t">${esc(tpTitle(TOP[id]))}</span>${scores()[id] ? badge(id) : ''}</a></li>`).join('')}</ol>
      <div class="foot"><span>${p.done}/${p.total}</span><div class="bar"><i style="width:${p.total ? p.done / p.total * 100 : 0}%"></i></div><a class="btn primary" style="padding:6px 12px;font-size:13px" href="#/ch/${c.id}">${T('start')} →</a></div>
    </article>`;
  }
  function search(qs) {
    const box = document.getElementById('sres'); qs = qs.trim().toLowerCase();
    if (!qs) { box.innerHTML = ''; return; }
    const quick = () => {
      const hits = [];
      for (const id in TOP) {
        const m = TOP[id]; const d = DATA[id];
        let hay = [m.title, m.quote, m.title_ko, m.quote_ko].join(' ');
        if (d) hay += ' ' + JSON.stringify([d.en.terms, d.ko.terms, d.en.people, d.en.keyPoints, d.ko.keyPoints]);
        if (hay.toLowerCase().includes(qs)) hits.push(id);
      }
      box.innerHTML = hits.length ? hits.slice(0, 30).map(id => {
        const c = chOf(id);
        return `<a href="#/t/${id}" style="--c:${COLORS[c.id]}"><span class="dot"></span><span><b>${esc(tpTitle(TOP[id]))}</b><br><small>${chNum(c)}. ${esc(chTitle(c))} · “${esc(tpQuote(TOP[id]))}”</small></span></a>`;
      }).join('') : `<p>${T('noResults')}</p>`;
    };
    quick(); loadAll().then(quick);
  }

  /* ---------- chapter ---------- */
  function chapter(cid) {
    const c = CH.find(x => x.id === cid); if (!c) return home();
    const n = chNum(c); const p = chProgress(c);
    const body = `
    <section class="chhead"><div class="wrap">
      <div class="k">${T('chapter')} ${n} · ${c.topics.length} ${T('topics')}</div>
      <h1>${esc(chTitle(c))}</h1><p>${esc(chSub(c))}${CL === 'ko' ? ` · <span class="notranslate">${esc(c.title)}</span>` : ''}</p>
      <div class="btns">
        <a class="btn light" href="#/t/${c.topics[0]}">${T('learn')} →</a>
        <a class="btn primary" href="#/test/${c.id}">📝 ${T('chapterTest')} (${c.topics.length * 10} ${T('questions')})</a>
        ${scores()['test-' + c.id] ? badge('test-' + c.id) : ''}
      </div>
      <p style="margin-top:12px;font-size:14px">${T('progress')}: ${p.done}/${p.total} ${T('completed')} · ${T('avgScore')} ${p.avg}%</p>
    </div></section>
    <section class="wrap"><div class="tlist">
      ${c.topics.map((id, i) => { const m = TOP[id]; return `
        <a class="tcard" href="#/t/${id}">
          <span class="ti">${n}.${i + 1} · ${esc(tpTitle(m))}</span>
          <span class="q">“${esc(tpQuote(m))}”</span>
          <span class="meta"><span>${T('page')} ${m.page}</span>${badge(id)}</span>
        </a>`; }).join('')}
    </div></section>`;
    shell(`<a href="#/">${T('home')}</a> › ${esc(chTitle(c))}`, body, COLORS[c.id]);
  }

  /* ---------- topic ---------- */
  function topic(id, tab) {
    const m = TOP[id]; if (!m) return home();
    const c = chOf(id); const n = chNum(c); const idx = c.topics.indexOf(id);
    shell(`<a href="#/">${T('home')}</a> › <a href="#/ch/${c.id}">${esc(chTitle(c))}</a> › ${esc(tpTitle(m))}`, `<div class="loading">${T('loading')}</div>`, COLORS[c.id]);
    loadChapter(c.id).then(() => {
      const d = DATA[id];
      if (!d) { document.querySelector('main').innerHTML = `<div class="loading">Content coming soon.</div>`; return; }
      tab = tab || 'learn';
      const L = d[CL], E = d.en;
      const bi = CL === 'ko' && BI;
      const allIds = Object.keys(TOP); const gi = allIds.indexOf(id);
      const prev = allIds[gi - 1], next = allIds[gi + 1];
      const learn = `
        <div class="panel"><h3>${T('summary')}</h3>${L.summary.map((p, i) => `<p>${esc(p)}</p>${bi ? `<p class="biling">${esc(E.summary[i] || '')}</p>` : ''}`).join('')}</div>
        <div class="panel"><h3>${T('keyPoints')}</h3><ul class="kp">${L.keyPoints.map((k, i) => `<li>${esc(k)}${bi ? `<div class="biling">${esc(E.keyPoints[i] || '')}</div>` : ''}</li>`).join('')}</ul></div>
        <div class="panel"><h3>${T('terms')}</h3><dl class="terms">${L.terms.map((x, i) => `<dt>${esc(x.term)}</dt><dd>${esc(x.def)}${bi ? `<div class="biling">${esc((E.terms[i] || {}).def || '')}</div>` : ''}</dd>`).join('')}</dl></div>
        ${L.people && L.people.length ? `<div class="panel"><h3>${T('people')}</h3><div class="people">${L.people.map(p => `<div class="person"><span class="av">${esc((E.people[L.people.indexOf(p)] || p).name.replace(/[^A-Za-z가-힣]/g, '').slice(0, 1) || '★')}</span><div><b>${esc(p.name)}</b><span>${esc(p.note)}</span></div></div>`).join('')}</div></div>` : ''}
        <div class="panel case"><h3>${T('case')}</h3><p>${esc(L.case)}</p>${bi ? `<p class="biling">${esc(E.case)}</p>` : ''}</div>
        <div class="panel discuss"><h3>💬 ${T('discuss')}</h3><p>${esc(L.discuss)}</p>${bi ? `<p class="biling">${esc(E.discuss)}</p>` : ''}</div>
        <div style="text-align:center;margin:10px 0 24px"><a class="btn accent" href="#/t/${id}/quiz">✏️ ${T('quiz')} (10 ${T('questions')}) →</a></div>`;
      const cards = `<p style="color:var(--muted)">${T('flipHint')}</p><div class="cards">${L.terms.map((x, i) => `<div class="flip"><div class="in"><div class="f">${esc(x.term)}</div><div class="b">${esc(x.def)}${bi ? `<br><br><span style="color:var(--muted)">${esc(E.terms[i].def)}</span>` : ''}</div></div></div>`).join('')}</div>`;
      const main = document.querySelector('main');
      main.innerHTML = `
      <section class="wrap thead">
        <div class="k">${T('chapter')} ${n} · ${T('topic')} ${n}.${idx + 1} · ${T('page')} ${m.page}</div>
        <blockquote>${esc(tpQuote(m))}</blockquote>
        <h1>${esc(tpTitle(m))}</h1>
        ${CL === 'ko' ? `<div class="alt notranslate">${esc(m.title)} — “${esc(m.quote)}”</div>` : ''}
      </section>
      <section class="wrap">
        <div class="tabs">
          <button data-tab="learn" class="${tab === 'learn' ? 'on' : ''}">📖 ${T('learn')}</button>
          <button data-tab="cards" class="${tab === 'cards' ? 'on' : ''}">🃏 ${T('flashcards')}</button>
          <button data-tab="quiz" class="${tab === 'quiz' ? 'on' : ''}">✏️ ${T('quiz')} ${scores()[id] ? badge(id) : ''}</button>
          ${CL === 'ko' ? `<label style="margin-inline-start:auto;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);white-space:nowrap"><input type="checkbox" id="bi" ${BI ? 'checked' : ''}> 영어 원문 함께 보기</label>` : ''}
        </div>
        <div class="layout">
          <div id="tabbody">${tab === 'learn' ? learn : tab === 'cards' ? cards : ''}</div>
          <aside class="side">
            <div class="panel"><h3>${esc(chTitle(c))}</h3><nav class="toc">${c.topics.map((x, i) => `<a href="#/t/${x}" class="${x === id ? 'on' : ''}">${n}.${i + 1} ${esc(tpTitle(TOP[x]))}</a>`).join('')}</nav>
              <div style="margin-top:12px"><a class="btn ghost" style="width:100%;justify-content:center" href="#/test/${c.id}">📝 ${T('chapterTest')}</a></div></div>
          </aside>
        </div>
        <div class="pager">
          ${prev ? `<a class="btn ghost" href="#/t/${prev}">← ${T('prev')}</a>` : '<span></span>'}
          ${next ? `<a class="btn ghost" href="#/t/${next}">${T('next')} →</a>` : ''}
        </div>
      </section>`;
      main.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { location.hash = `#/t/${id}/${b.dataset.tab}`; });
      const bic = document.getElementById('bi'); if (bic) bic.onchange = () => { BI = bic.checked; store.set('bi', BI); topic(id, tab); };
      main.querySelectorAll('.flip').forEach(f => f.onclick = () => f.classList.toggle('on'));
      if (tab === 'quiz') quiz(document.getElementById('tabbody'), [{ id, qs: d.quiz }], id);
    });
  }

  /* ---------- chapter test ---------- */
  function chapterTest(cid) {
    const c = CH.find(x => x.id === cid); if (!c) return home();
    shell(`<a href="#/">${T('home')}</a> › <a href="#/ch/${c.id}">${esc(chTitle(c))}</a> › ${T('chapterTest')}`, `<div class="loading">${T('loading')}</div>`, COLORS[c.id]);
    loadChapter(cid).then(() => {
      const main = document.querySelector('main');
      main.innerHTML = `<section class="wrap thead"><div class="k">${T('chapter')} ${chNum(c)}</div>
        <blockquote>${T('chapterTest')}</blockquote><h1>${esc(chTitle(c))}</h1><p class="alt">${T('chapterTestDesc')}</p></section>
        <section class="wrap"><div id="tabbody"></div></section>`;
      const groups = c.topics.filter(id => DATA[id]).map(id => ({ id, qs: DATA[id].quiz }));
      quiz(document.getElementById('tabbody'), groups, 'test-' + cid);
    });
  }

  /* ---------- quiz engine ---------- */
  const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, "'").replace(/[^a-z0-9'%$ ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const squash = s => norm(s).replace(/[ ']/g, '');
  function quiz(el, groups, key) {
    const items = []; groups.forEach(g => g.qs.forEach(q => items.push({ g: g.id, q })));
    const ans = new Array(items.length).fill(null);
    const multi = groups.length > 1;
    let html = ''; let lastG = null;
    items.forEach((it, i) => {
      if (multi && it.g !== lastG) { lastG = it.g; const m = TOP[it.g]; html += `<div class="group-h">${esc(tpTitle(m))}</div>`; }
      const q = it.q; const qt = (q.q[CL] || q.q.en);
      let inner = '';
      if (q.type === 'mc') {
        const opts = q.options[CL] || q.options.en;
        inner = `<div class="opts">${opts.map((o, j) => `<button class="opt" data-i="${i}" data-v="${j}"><span class="l">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
      } else if (q.type === 'tf') {
        inner = `<div class="tfrow"><button class="opt" data-i="${i}" data-v="true">⭕ ${T('true')}</button><button class="opt" data-i="${i}" data-v="false">❌ ${T('false')}</button></div>`;
      } else {
        inner = `${GT ? `<div class="qsub notranslate">${esc(q.q.en)}</div>` : ''}<input class="fillin notranslate" data-i="${i}" autocomplete="off" spellcheck="false" placeholder="${esc(t('typeAnswer'))}">`;
      }
      html += `<div class="qitem" id="q${i}"><div class="qhead"><span class="qnum">${i + 1}</span><span class="qtype">${T(q.type)}</span></div>
        <div class="qtext">${esc(qt).replace(/_{3,}/g, '<u>&emsp;&emsp;&emsp;</u>')}</div>${inner}<div class="fb"></div></div>`;
    });
    el.innerHTML = `<div id="res"></div>${html}
      <div class="qbar"><span class="count" id="cnt"></span>
        <button class="btn ghost" id="retry" style="display:none">↻ ${T('retry')}</button>
        <button class="btn accent" id="check">✔ ${T('check')}</button></div>`;
    let done = false;
    const cnt = el.querySelector('#cnt');
    const upd = () => { cnt.innerHTML = `${T('showAll')}: <b>${ans.filter(a => a !== null && a !== '').length}</b> / ${items.length}`; };
    upd();
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (done) return; const i = +b.dataset.i;
      b.parentElement.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const v = b.dataset.v; ans[i] = v === 'true' ? true : v === 'false' ? false : +v;
      document.getElementById('q' + i).classList.remove('miss'); upd();
    });
    el.querySelectorAll('.fillin').forEach(inp => {
      inp.oninput = () => { ans[+inp.dataset.i] = inp.value; document.getElementById('q' + inp.dataset.i).classList.remove('miss'); upd(); };
      inp.onkeydown = e => { if (e.key === 'Enter') { const nx = document.getElementById('q' + (+inp.dataset.i + 1)); if (nx) nx.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    });
    el.querySelector('#check').onclick = () => {
      const missing = ans.map((a, i) => (a === null || a === '') ? i : -1).filter(i => i >= 0);
      if (missing.length) {
        missing.forEach(i => document.getElementById('q' + i).classList.add('miss'));
        document.getElementById('q' + missing[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
        cnt.innerHTML = `⚠️ ${T('unanswered')} ${missing.slice(0, 12).map(i => i + 1).join(', ')}${missing.length > 12 ? '…' : ''}`;
        return;
      }
      grade();
    };
    el.querySelector('#retry').onclick = () => quiz(el, groups, key);

    function grade() {
      done = true; let right = 0; const per = {};
      items.forEach((it, i) => {
        const q = it.q; const box = document.getElementById('q' + i); let ok;
        if (q.type === 'mc' || q.type === 'tf') {
          ok = ans[i] === q.answer;
          box.querySelectorAll('.opt').forEach(b => {
            const v = b.dataset.v; const val = v === 'true' ? true : v === 'false' ? false : +v;
            if (val === q.answer) b.classList.add('right'); else if (val === ans[i]) b.classList.add('wrong');
          });
        } else {
          const a = norm(ans[i]); ok = q.answer.some(x => norm(x) === a || squash(x) === squash(ans[i]));
          box.querySelector('input').disabled = true;
        }
        if (ok) right++;
        per[it.g] = per[it.g] || [0, 0]; per[it.g][1]++; if (ok) per[it.g][0]++;
        box.classList.add('done', ok ? 'ok' : 'bad');
        const correctTxt = q.type === 'mc' ? `${'ABCD'[q.answer]}. ${(q.options[CL] || q.options.en)[q.answer]}` : q.type === 'tf' ? t(q.answer ? 'true' : 'false') : q.answer[0];
        box.querySelector('.fb').innerHTML = `<b class="${ok ? 'ok' : 'bad'}">${ok ? '✅ ' + T('correct') : '❌ ' + T('incorrect')}</b>${ok ? '' : ` — ${T('answer')}: <b class="${q.type === 'fill' ? 'notranslate' : ''}">${esc(correctTxt)}</b>`}<br>${esc(q.explain[CL] || q.explain.en)}`;
      });
      const pct = Math.round(right / items.length * 100);
      saveScore(key, pct);
      if (multi) Object.keys(per).forEach(g => { const [r, n] = per[g]; const s = scores(); if (!s[g]) saveScore(g, Math.round(r / n * 100)); });
      const msg = pct >= 80 ? 'great' : pct >= 50 ? 'good' : 'keep';
      document.getElementById('res').innerHTML = `<div class="panel"><div class="result">
        <div class="ring" style="--p:${pct}"><b>${pct}%</b></div>
        <div><h2>${T('score')}: ${right} / ${items.length}</h2><p style="margin:0">${T(msg)}</p>
        <p style="margin:6px 0 0;color:var(--muted);font-size:14px">${T('best')}: ${scores()[key].best}%</p></div></div>
        ${multi ? `<h3 style="margin-top:18px">${T('bySection')}</h3><table class="rtable">${Object.keys(per).map(g => `<tr><td><a href="#/t/${g}">${esc(tpTitle(TOP[g]))}</a></td><td>${per[g][0]}/${per[g][1]}</td></tr>`).join('')}</table>` : ''}
      </div>`;
      el.querySelector('#check').style.display = 'none';
      el.querySelector('#retry').style.display = '';
      cnt.innerHTML = `${T('score')}: <b>${right}/${items.length} (${pct}%)</b>`;
      document.getElementById('res').scrollIntoView({ behavior: 'smooth' });
    }
  }

  /* ---------- router ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'ch' && h[1]) return chapter(h[1]);
    if (h[0] === 't' && h[1]) return topic(h[1], h[2]);
    if (h[0] === 'test' && h[1]) return chapterTest(h[1]);
    home();
  }
  document.documentElement.lang = LANG;
  if (LANG === 'ar') document.body.classList.add('rtl');
  window.addEventListener('hashchange', route);
  initGT();
  route();
})();
