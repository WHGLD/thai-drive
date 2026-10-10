/* DLT тренажёр — тесты по темам, мои ошибки, знаки. Данные: data/data.js (window.DATA). */
(() => {
  'use strict';
  const D = window.DATA;
  const Q = Object.fromEntries(D.questions.map(q => [q.id, q]));
  const TOPIC = Object.fromEntries(D.topics.map(t => [t.id, t]));
  const TEST_SIZE = 15;
  const RESOLVE_STREAK = 2;
  const LS_KEY = 'dlt-trainer.v1';
  const LETTERS = 'ABCD';

  /* ---------- storage ---------- */
  const fresh = () => ({ e: {}, st: {}, r: {}, h: [], recent: [], sel: null, quiz: null, fav: {} });
  let S = (() => {
    try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(LS_KEY) || '{}')); }
    catch (_) { return fresh(); }
  })();
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {} };

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many); };
  const fmtDate = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
  const isPic = t => !t || /^\(see picture\)$/i.test(t);
  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.55 5.2 5.75.83-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.63l5.75-.83z"/></svg>',
  };
  window.__imgFail = el => {
    const d = document.createElement('div');
    d.className = 'img-fail';
    d.textContent = navigator.onLine ? 'Картинка не загрузилась' : 'Нет сети — картинка загрузится, когда появится интернет';
    el.replaceWith(d);
  };
  const img = (src, cls = 'q-img', zoom = true) => src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${zoom ? 'data-zoom' : ''} onerror="__imgFail(this)">`
    : '';

  /* ---------- errors model ---------- */
  const hasError = id => !S.r[id] && !!(S.e[id] || D.errors[id]);
  function activeErrors() {
    const ids = new Set([...Object.keys(D.errors), ...Object.keys(S.e)]);
    const out = [];
    for (const id of ids) {
      if (!Q[id] || S.r[id]) continue;
      const dyn = S.e[id];
      const st = D.errors[id] || [];
      const srcs = st.map(x => x.src + (x.d ? ' · ' + fmtDate(x.d) : ''));
      if (dyn) srcs.unshift('Тест в приложении · ' + fmtDate(dyn.at));
      const last = dyn ? { mine: dyn.m, mi: dyn.mi } : { mine: st[st.length - 1].mine, mi: st[st.length - 1].mi };
      const at = dyn ? dyn.at : Date.parse(st[st.length - 1].d || '2026-10-09');
      out.push({ id, ...last, srcs, at, streak: S.st[id] || 0 });
    }
    return out.sort((a, b) => b.at - a.at);
  }
  function record(q, chosen) {
    const ok = chosen === q.c;
    if (ok) {
      if (hasError(q.id)) {
        S.st[q.id] = (S.st[q.id] || 0) + 1;
        if (S.st[q.id] >= RESOLVE_STREAK) { S.r[q.id] = Date.now(); delete S.e[q.id]; delete S.st[q.id]; }
      }
    } else {
      S.e[q.id] = { m: q.o[chosen], mi: q.oi ? q.oi[chosen] : null, at: Date.now() };
      S.st[q.id] = 0;
      delete S.r[q.id];
    }
    save();
    return ok;
  }

  /* ---------- quiz model ---------- */
  function pickFrom(pool) {
    const recent = new Set(S.recent);
    let cand = pool.filter(id => !recent.has(id));
    if (cand.length < TEST_SIZE) cand = pool;
    return shuffle(cand).slice(0, TEST_SIZE);
  }
  function startQuiz(mode, ids) {
    if (!ids.length) return;
    S.quiz = { mode, i: 0, items: ids.map(id => ({ id, order: shuffle([...Q[id].o.keys()]), a: null })), at: Date.now() };
    S.recent = [...ids, ...S.recent].slice(0, 45);
    save();
    go('#quiz');
  }
  const selectedTopics = () => S.sel || D.topics.map(t => t.id);

  /* ---------- chrome ---------- */
  function chrome({ title, subtitle = '', back = false, badge = '', tab = null, quiz = false }) {
    $('#title').textContent = title;
    $('#subtitle').textContent = subtitle;
    $('#back-btn').hidden = !back;
    const b = $('#topbar-badge'); b.hidden = !badge; b.textContent = badge;
    document.body.classList.toggle('in-quiz', quiz);
    document.querySelectorAll('.tabbar button').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    const n = activeErrors().length;
    $('#err-dot').hidden = !n;
    document.title = title + ' · DLT Тренажёр';
  }
  const view = html => { const v = $('#view'); v.innerHTML = html; window.scrollTo(0, 0); return v; };

  /* ---------- screens ---------- */
  function screenTest() {
    chrome({ title: 'Тест', subtitle: 'Теория DLT · категория A', tab: 'test' });
    const sel = new Set(selectedTopics());
    const errs = activeErrors();
    const errBy = {}; errs.forEach(e => { const t = Q[e.id].t; errBy[t] = (errBy[t] || 0) + 1; });
    const pool = D.questions.filter(q => sel.has(q.t)).length;
    const last = S.h.slice(-10);
    const avg = last.length ? Math.round(last.reduce((s, h) => s + h.ok / h.n, 0) / last.length * 100) + '%' : '—';
    const resume = S.quiz && S.quiz.items.some(it => it.a === null)
      ? `<div class="card" style="margin-top:12px"><b>Незаконченный тест</b><p class="muted small" style="margin:4px 0 12px">Вопрос ${S.quiz.items.filter(it => it.a !== null).length + 1} из ${S.quiz.items.length}</p>
         <div class="btn-row"><button class="btn" data-act="resume">Продолжить</button><button class="btn ghost" data-act="drop">Сбросить</button></div></div>` : '';
    const v = view(`
      <section class="card hero"><div class="diamond"></div>
        <h2>${TEST_SIZE} случайных вопросов</h2>
        <p>Вопросы на английском, ответ проверяется сразу. Для сдачи нужно 90%.</p>
        <div class="stats">
          <div class="stat"><b>${S.h.length}</b><span>тестов</span></div>
          <div class="stat"><b>${avg}</b><span>средний (10)</span></div>
          <div class="stat"><b>${errs.length}</b><span>ошибок</span></div>
        </div>
      </section>
      ${resume}
      <div class="section-h"><span>Темы</span><button data-act="all">${sel.size === D.topics.length ? 'Снять все' : 'Выбрать все'}</button></div>
      <div class="card topics" style="padding:0">
        ${D.topics.map(t => `
          <button class="topic ${sel.has(t.id) ? 'on' : ''}" data-topic="${t.id}">
            <span class="chk">${ICON.check}</span>
            <span class="t"><b>${esc(t.ru)}</b><span>${esc(t.en)}</span></span>
            ${errBy[t.id] ? `<span class="err">${errBy[t.id]}</span>` : ''}
            <span class="cnt">${t.n}</span>
          </button>`).join('')}
      </div>
      <div class="sticky-cta"><button class="btn" data-act="start" ${pool ? '' : 'disabled'}>Начать тест · ${Math.min(TEST_SIZE, pool)} из ${pool}</button></div>
      <p class="muted small" style="text-align:center;margin-top:14px">База: ${D.questions.length} вопросов · обновлена ${fmtDate(D.built)}</p>`);
    v.onclick = e => {
      const t = e.target.closest('[data-topic]');
      if (t) { const s = new Set(selectedTopics()); s.has(t.dataset.topic) ? s.delete(t.dataset.topic) : s.add(t.dataset.topic); S.sel = [...s]; save(); return screenTest(); }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'all') { S.sel = sel.size === D.topics.length ? [] : D.topics.map(x => x.id); save(); screenTest(); }
      if (a === 'start') startQuiz('topics', pickFrom(D.questions.filter(q => sel.has(q.t)).map(q => q.id)));
      if (a === 'resume') go('#quiz');
      if (a === 'drop') { S.quiz = null; save(); screenTest(); }
    };
  }

  function screenQuiz() {
    const z = S.quiz;
    if (!z) return go('#test', true);
    if (z.i >= z.items.length) return go('#result', true);
    const it = z.items[z.i], q = Q[it.id];
    if (!q) { z.items.splice(z.i, 1); save(); return screenQuiz(); }
    const done = z.items.filter(x => x.a !== null);
    const okN = done.filter(x => x.a === Q[x.id].c).length;
    chrome({ title: `Вопрос ${z.i + 1} из ${z.items.length}`, subtitle: z.mode === 'errors' ? 'Тест из ошибок' : TOPIC[q.t].ru, back: true, badge: done.length ? `${okN}/${done.length}` : '', quiz: true });
    const answered = it.a !== null;
    const pic = !!q.oi;
    const optHtml = it.order.map((oi, k) => {
      let cls = '';
      if (answered) { if (oi === q.c) cls = 'right'; else if (oi === it.a) cls = 'wrong'; }
      const label = q.o[oi];
      return `<button class="opt ${cls}" data-o="${oi}" ${answered ? 'disabled' : ''}>
        <span class="l">${LETTERS[k]}</span>
        ${pic ? img(q.oi[oi], '', false) : ''}
        ${pic && isPic(label) ? '' : `<span class="ot">${esc(label)}</span>`}
      </button>`;
    }).join('');
    let fb = '';
    if (answered) {
      const ok = it.a === q.c;
      const ck = it.order.indexOf(q.c);
      fb = `<div class="feedback ${ok ? 'ok' : 'bad'}">
        <h3>${ok ? ICON.check + ' Верно' : ICON.x + ' Неверно'}</h3>
        ${ok ? '' : `<p>Правильный ответ: <b>${LETTERS[ck]}${isPic(q.o[q.c]) ? '' : ' — ' + esc(q.o[q.c])}</b></p>`}
        ${explain(q)}
      </div>`;
    }
    const last = z.i === z.items.length - 1;
    view(`
      <div class="progress"><i style="width:${(z.i + (answered ? 1 : 0)) / z.items.length * 100}%"></i></div>
      <div class="q-meta"><span class="tag">${esc(TOPIC[q.t].en)}</span>${hasError(q.id) ? '<span class="tag bad">была ошибка</span>' : ''}</div>
      <p class="q-text">${esc(q.q)}</p>
      ${img(q.img)}
      <div class="opts ${pic ? 'grid' : ''} ${answered ? 'locked' : ''}">${optHtml}</div>
      ${fb}
      <div class="quiz-bar" ${answered ? '' : 'hidden'}><button class="btn" data-act="next">${last ? 'Результат' : 'Далее'}</button></div>`);
    $('#view').onclick = e => {
      const o = e.target.closest('[data-o]');
      if (o && !answered) { it.a = +o.dataset.o; record(q, it.a); save(); screenQuiz(); requestAnimationFrame(() => document.querySelector('.feedback')?.scrollIntoView({ block: 'nearest' })); return; }
      if (e.target.closest('[data-act="next"]')) { z.i++; save(); z.i >= z.items.length ? finishQuiz() : screenQuiz(); }
    };
  }

  function finishQuiz() {
    const z = S.quiz;
    const ok = z.items.filter(x => x.a === Q[x.id]?.c).length;
    S.h.push({ at: Date.now(), ok, n: z.items.length, mode: z.mode });
    S.h = S.h.slice(-200);
    z.done = true;
    save();
    go('#result', true);
  }

  function screenResult() {
    const z = S.quiz;
    if (!z || !z.done) return go('#test', true);
    chrome({ title: 'Результат', subtitle: z.mode === 'errors' ? 'Тест из ошибок' : 'Тест по темам', tab: 'test' });
    const ok = z.items.filter(x => x.a === Q[x.id]?.c).length, n = z.items.length;
    const pct = Math.round(ok / n * 100);
    const pass = pct >= 90;
    const wrong = z.items.filter(x => Q[x.id] && x.a !== Q[x.id].c);
    view(`
      <section class="card score">
        <div class="ring" style="--p:${pct};--c:${pass ? 'var(--ok)' : pct >= 70 ? 'var(--sign)' : 'var(--bad)'}"><span>${pct}%</span></div>
        <div><h2>${ok} из ${n}</h2><p>${pass ? 'Уровень экзамена: 90% и выше' : `До 90% не хватает ${Math.ceil(n * 0.9) - ok} ${Math.ceil(n * 0.9) - ok === 1 ? 'ответа' : 'ответов'}`}</p></div>
      </section>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="again">Новый тест</button>${activeErrors().length ? '<button class="btn warn" data-act="errs">Из ошибок</button>' : ''}</div>
      ${wrong.length ? `<div class="section-h"><span>Ошибки в этом тесте · ${wrong.length}</span></div>
        <div class="stack">${wrong.map(x => errorCard(Q[x.id], Q[x.id].o[x.a], Q[x.id].oi ? Q[x.id].oi[x.a] : null)).join('')}</div>`
        : '<div class="empty"><div class="big">🎉</div>Без ошибок!</div>'}`);
    $('#view').onclick = e => {
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'again') { S.quiz = null; save(); go('#test'); }
      if (a === 'errs') startQuiz('errors', pickFrom(activeErrors().map(x => x.id)));
    };
  }

  const explain = q => (q.x ? `<div class="note why"><b>Почему так</b>${esc(q.x)}</div>` : '')
    + (q.n ? `<div class="note mine-note"><b>Моя заметка</b>${esc(q.n)}</div>` : '');

  function errorCard(q, mine, mi, extra = '') {
    const corr = q.o[q.c], ci = q.oi ? q.oi[q.c] : null;
    return `<article class="card ecard">
      <div class="q-meta"><span class="tag">${esc(TOPIC[q.t].en)}</span></div>
      <p class="q-text">${esc(q.q)}</p>
      ${img(q.img)}
      <div class="ans mine"><span class="k">Мой ответ</span><div>${isPic(mine) && mi ? '' : esc(mine)}${img(mi, '', true)}</div></div>
      <div class="ans corr"><span class="k">Верно</span><div>${isPic(corr) && ci ? '' : esc(corr)}${img(ci, '', true)}</div></div>
      ${explain(q)}
      ${extra}
    </article>`;
  }

  let errFilter = 'all', showResolved = false;
  function screenErrors() {
    const errs = activeErrors();
    const resolved = Object.keys(S.r).filter(id => Q[id]);
    chrome({ title: 'Мои ошибки', subtitle: errs.length ? `${plural(errs.length, 'вопрос', 'вопроса', 'вопросов')} · решено ${resolved.length}` : '', tab: 'errors' });
    const by = {}; errs.forEach(e => { const t = Q[e.id].t; by[t] = (by[t] || 0) + 1; });
    if (errFilter !== 'all' && !by[errFilter]) errFilter = 'all';
    const list = errs.filter(e => errFilter === 'all' || Q[e.id].t === errFilter);
    const cards = list.map(e => errorCard(Q[e.id], e.mine, e.mi,
      `<div class="e-src"><span>${esc(e.srcs[0] || '')}${e.srcs.length > 1 ? ` <span title="${esc(e.srcs.slice(1).join('\n'))}">+${e.srcs.length - 1}</span>` : ''}</span>
        <span class="streak" title="Верных ответов подряд">${Array.from({ length: RESOLVE_STREAK }, (_, i) => `<i class="${i < e.streak ? 'on' : ''}"></i>`).join('')}</span></div>`)).join('');
    view(errs.length ? `
      <section class="card">
        <b>Повторить ошибки</b>
        <p class="muted small" style="margin:4px 0 12px">Вопрос уходит из списка после ${RESOLVE_STREAK} верных ответов подряд (кружки внизу карточки).</p>
        <button class="btn warn" data-act="quiz">Тест из ошибок · ${Math.min(TEST_SIZE, list.length)}${errFilter !== 'all' ? ' · ' + esc(TOPIC[errFilter].ru) : ''}</button>
      </section>
      <div class="chips" style="margin-top:14px">
        <button class="chip ${errFilter === 'all' ? 'on' : ''}" data-f="all">Все<i>${errs.length}</i></button>
        ${D.topics.filter(t => by[t.id]).map(t => `<button class="chip ${errFilter === t.id ? 'on' : ''}" data-f="${t.id}">${esc(t.ru)}<i>${by[t.id]}</i></button>`).join('')}
      </div>
      <div class="stack" style="margin-top:8px">${cards}</div>
      ${resolvedBlock(resolved)}
    ` : `<div class="empty"><div class="big">✅</div><b>Активных ошибок нет</b><p class="small">Ошибки из новых тестов появятся здесь автоматически.</p></div>${resolvedBlock(resolved)}`);
    $('#view').onclick = e => {
      const f = e.target.closest('[data-f]'); if (f) { errFilter = f.dataset.f; return screenErrors(); }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'quiz') startQuiz('errors', pickFrom(list.map(x => x.id)));
      if (a === 'resolved') { showResolved = !showResolved; screenErrors(); }
      if (a === 'reset' && confirm('Сбросить прогресс тестов (ошибки из тестов в приложении, решённые вопросы, историю)? Ошибки из ваших файлов и избранные знаки останутся.')) { S = { ...fresh(), fav: S.fav || {} }; save(); screenErrors(); }
      const un = e.target.closest('[data-unresolve]'); if (un) { delete S.r[un.dataset.unresolve]; save(); screenErrors(); }
    };
  }
  function resolvedBlock(ids) {
    return `<div class="section-h"><span>Решённые · ${ids.length}</span>${ids.length ? `<button data-act="resolved">${showResolved ? 'Скрыть' : 'Показать'}</button>` : ''}</div>
      ${showResolved ? `<div class="stack">${ids.map(id => `<div class="card small"><b>${esc(Q[id].q)}</b><div class="muted" style="margin-top:4px">✓ ${esc(Q[id].o[Q[id].c])}</div><button class="link-btn" data-unresolve="${id}">Вернуть в ошибки</button></div>`).join('')}</div>` : ''}
      <div style="text-align:center;margin-top:18px"><button class="danger-link" data-act="reset">Сбросить прогресс</button></div>`;
  }

  const catParts = t => { const m = t.match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [m[1], m[2]] : [t, '']; };
  const signKey = s => s.img.split('/').pop();
  const SIGN_BY_KEY = {};
  D.signs.forEach(c => c.signs.forEach((s, i) => { SIGN_BY_KEY[signKey(s)] = [c.id, i, s]; }));
  const favs = () => Object.entries(S.fav || {}).filter(([k]) => SIGN_BY_KEY[k]).sort((a, b) => b[1] - a[1]).map(([k]) => SIGN_BY_KEY[k]);
  const isFav = s => !!(S.fav && S.fav[signKey(s)]);
  function toggleFav(s) {
    S.fav = S.fav || {};
    const k = signKey(s);
    if (S.fav[k]) delete S.fav[k]; else S.fav[k] = Date.now();
    save();
    return !!S.fav[k];
  }
  let signQuery = '', redrawSigns = null;
  function screenSigns(catId) {
    const fav = catId === 'fav';
    const cat = !fav && catId && D.signs.find(c => c.id === catId);
    if (catId && !fav && !cat) return go('#signs', true);
    if (fav) {
      chrome({ title: 'Избранные знаки', subtitle: plural(favs().length, 'знак', 'знака', 'знаков'), back: true, tab: 'signs' });
      view(`<label class="search">${ICON.search}<input id="sq" type="search" placeholder="Поиск в избранном" autocomplete="off"></label><div id="sres"></div>`);
    } else if (!cat) {
      chrome({ title: 'Дорожные знаки', subtitle: `${D.signs.reduce((n, c) => n + c.signs.length, 0)} знаков · 4 категории`, tab: 'signs' });
      view(`<label class="search">${ICON.search}<input id="sq" type="search" placeholder="Поиск: stop, мотоцикл, ห้าม…" autocomplete="off"></label><div id="sres"></div>`);
    } else {
      const [ru, th] = catParts(cat.title);
      chrome({ title: ru, subtitle: `${th} · ${cat.signs.length}`, back: true, tab: 'signs' });
      view(`<div class="card tip">${esc(cat.tip)}</div>
        <label class="search">${ICON.search}<input id="sq" type="search" placeholder="Поиск в категории" autocomplete="off"></label><div id="sres"></div>`);
    }
    const inp = $('#sq');
    inp.value = signQuery;
    const grid = list => `<div class="sign-grid">${list.map(signTile).join('')}</div>${list.length ? '' : '<p class="muted">Ничего не найдено</p>'}`;
    const draw = () => {
      const q = signQuery.trim().toLowerCase();
      const match = s => !q || [s.n, s.en, s.th, s.d].some(x => (x || '').toLowerCase().includes(q));
      let html;
      if (fav) {
        const list = favs();
        $('#subtitle').textContent = plural(list.length, 'знак', 'знака', 'знаков');
        html = list.length
          ? grid(list.filter(x => match(x[2]))) + `<div style="text-align:center;margin-top:18px"><button class="danger-link" data-act="clear-fav">Очистить избранное</button></div>`
          : `<div class="empty"><div class="big">☆</div><b>Пока пусто</b><p class="small">Нажмите на звёздочку на карточке знака или кнопку «В избранное» в его описании.</p></div>`;
      } else if (cat) {
        html = grid(cat.signs.map((s, i) => [cat.id, i, s]).filter(x => match(x[2])));
      } else if (q) {
        html = grid(D.signs.flatMap(c => c.signs.map((s, i) => [c.id, i, s])).filter(x => match(x[2])));
      } else {
        const n = favs().length;
        html = `<div class="stack">
          <button class="card cat" data-cat="fav"><span class="sw sw-fav">${ICON.star}</span>
            <span class="t"><b>Избранное</b><span>${n ? plural(n, 'знак', 'знака', 'знаков') : 'отмечайте знаки звёздочкой'}</span></span><span class="chev">${ICON.chev}</span></button>
          ${D.signs.map(c => { const [ru, th] = catParts(c.title); return `
          <button class="card cat" data-cat="${c.id}"><span class="sw sw-${c.id}"><i></i></span>
            <span class="t"><b>${esc(ru)}</b><span>${esc(th)} · ${c.signs.length} · ${esc(c.shape)}</span></span><span class="chev">${ICON.chev}</span></button>`; }).join('')}</div>`;
      }
      $('#sres').innerHTML = html;
    };
    redrawSigns = draw;
    draw();
    inp.oninput = () => { signQuery = inp.value; draw(); };
    $('#view').onclick = e => {
      const f = e.target.closest('[data-fav]');
      if (f) {
        e.stopPropagation();
        const s = SIGN_BY_KEY[f.dataset.fav][2];
        const on = toggleFav(s);
        if (fav) draw(); else { f.classList.toggle('on', on); f.setAttribute('aria-pressed', on); }
        return;
      }
      if (e.target.closest('[data-act="clear-fav"]')) { if (confirm('Убрать все знаки из избранного?')) { S.fav = {}; save(); draw(); } return; }
      const c = e.target.closest('[data-cat]'); if (c) { signQuery = ''; return go('#signs/' + c.dataset.cat); }
      const s = e.target.closest('[data-sign]'); if (s) { const [ci, si] = s.dataset.sign.split(':'); openSign(D.signs.find(x => x.id === ci).signs[+si]); }
    };
  }
  function signTile([ci, i, s]) {
    const on = isFav(s);
    return `<div class="sign">
      <button class="sign-open" data-sign="${ci}:${i}"><span class="im">${img(s.img, '', false)}</span><span class="tx"><b>${esc(s.n)}</b><span>${esc(s.en)}</span></span></button>
      <button class="fav-btn ${on ? 'on' : ''}" data-fav="${esc(signKey(s))}" aria-label="Избранное" aria-pressed="${on}">${ICON.star}</button>
    </div>`;
  }
  function openSign(s) {
    const favBtn = () => isFav(s) ? `${ICON.star}<span>В избранном</span>` : `${ICON.star}<span>В избранное</span>`;
    $('#sheet-body').innerHTML = `${img(s.img, 'big-img', true)}<h2>${esc(s.n)}</h2>
      <div class="kv"><b>EN</b>${esc(s.en)}</div><div class="kv"><b>TH</b>${esc(s.th)}</div>
      <div class="note" style="margin-top:14px"><b>Что значит</b>${esc(s.d)}</div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn ghost fav-toggle ${isFav(s) ? 'on' : ''}" data-sheet-fav>${favBtn()}</button>
        <button class="btn ghost" data-close>Закрыть</button>
      </div>`;
    $('#sheet-body').querySelector('[data-sheet-fav]').onclick = ev => {
      const b = ev.currentTarget;
      const on = toggleFav(s);
      b.classList.toggle('on', on); b.innerHTML = favBtn();
      if (redrawSigns && location.hash.startsWith('#signs')) redrawSigns();
    };
    $('#sheet').hidden = false;
  }

  /* ---------- numbers ---------- */
  const MARK = { ok: ['✅', 'закон'], key: ['🔑', 'ключ DLT'], unv: ['🟡', 'не подтверждено'], warn: ['⚠️', 'внимание'] };
  const mk = m => m && MARK[m] ? `<i class="mk" title="${MARK[m][1]}">${MARK[m][0]}</i>` : '';
  const num = (v, cls = '') => `<span class="num ${cls}" data-num>${esc(v)}</span>`;
  function screenNumbers() {
    const N = window.NUMBERS;
    chrome({ title: 'Цифры', subtitle: 'Сроки, расстояния, скорости — для запоминания', tab: 'numbers' });
    if (!N) { view('<div class="empty">Нет данных</div>'); return; }
    const hide = !!S.numHide;
    const sec = (id, title, body, sub = '') => `<section class="nsec" id="n-${id}"><h2 class="nh">${title}${sub ? `<small>${sub}</small>` : ''}</h2>${body}</section>`;
    // ans: какая колонка — «ответ» (скрывается в режиме проверки): 'k' — левая (число), 'v' — правая
    const rows = (list, ans = 'k') => `<div class="card nlist">${list.map(([a, b, m]) => `<div class="nrow"><span class="nk">${ans === 'k' ? num(a) : `<b>${esc(a)}</b>`}</span><span class="nv">${ans === 'v' ? num(b, 'txt') : esc(b)} ${mk(m)}</span></div>`).join('')}</div>`;
    const max = 120;
    const speed = `
      <div class="card">
        <div class="zones">${N.speedZones.map((z, i) => `<span><b>${i + 1}</b>${esc(z)}</span>`).join('')}</div>
        ${N.speedMain.map(r => `<div class="srow ${r.focus ? 'focus' : ''}">
          <div class="swho">${esc(r.who)}${r.focus ? ' <em>категория A</em>' : ''}</div>
          <div class="sbars">${r.v.map((v, i) => `<div class="sbar">${num(v)}${r.key && r.key.includes(i) ? '<i class="mk">🔑</i>' : ''}<i class="col" style="height:${Math.round(v / max * 76)}px"></i><small>${i + 1}</small></div>`).join('')}</div>
        </div>`).join('')}
        <p class="muted small" style="margin:10px 0 0">${N.speedZonesHint.map((h, i) => `<b>${i + 1}</b> — ${esc(h)}`).join(' · ')}</p>
      </div>
      <details class="card more"><summary>Другие ТС</summary>
        <p class="muted small" style="margin:0 16px 8px">Колонки 1–4 — как на графике выше. «Скоростная дорога» (ทางพิเศษ): эстакада или тоннель / на уровне земли.</p><div class="tscroll"><table class="ntable"><thead><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>Скоростная дорога</th></tr></thead>
        <tbody>${N.speedOther.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td>${num(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </details>
      <div class="card nlist">${N.speedNotes.map(([t, m]) => `<div class="nnote ${m === 'warn' ? 'warn' : ''}">${mk(m)} ${esc(t)}</div>`).join('')}</div>`;
    const alcohol = `<div class="alc">${N.alcohol.map(a => `<div class="card acard"><div class="abig">${num(a.v)}<span>${a.unit}</span></div><div class="small muted">${esc(a.alt)}</div><p>${esc(a.who)} ${mk(a.m)}</p></div>`).join('')}</div>
      ${rows(N.alcoholPenalty, 'v')}`;
    const ladder = `<div class="ladder">${N.ladder.map(st => `<div class="step"><div class="bub">${num(st.n)}<small>${st.u}</small></div><ul>${st.items.map(([t, m]) => `<li>${esc(t)} ${mk(m)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    const timeline = `<div class="card memo">💡 ${esc(N.timelineMemo)}</div>
      <div class="ladder tl">${N.timeline.map(st => `<div class="step ${st.tone || ''}"><div class="bub">${num(st.n)}<small>${st.u}</small></div><ul>${st.items.map(([t, m]) => `<li>${esc(t)} ${mk(m)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="muted small" style="margin:10px 4px 0">«…» в тексте — это число в кружке слева.</p><h3 class="nh3">Права просрочены</h3>${rows(N.expired)}
      <h3 class="nh3">Возраст ТС и водителя</h3>${rows(N.ages)}
      ${rows(N.docs, 'v')}`;
    const kerbs = `<div class="card">${N.kerbs.map(k => `<div class="kerb"><span class="kstripe" style="--a:${k.c[0]};--b:${k.c[1]}"></span>
        <div class="kt"><b>${esc(k.name)}</b><span>${esc(k.txt)}</span></div>
        <span class="kyn ${k.stop ? 'y' : 'n'}">${k.stop ? '✓' : '✕'}<small>стоп</small></span><span class="kyn ${k.park ? 'y' : 'n'}">${k.park ? '✓' : '✕'}<small>стоянка</small></span></div>`).join('')}</div>`;
    const nav = [['exam', 'Экзамен'], ['speed', 'Скорость'], ['alcohol', 'Алкоголь'], ['dist', 'Расстояния'], ['time', 'Секунды'], ['terms', 'Сроки'], ['kerb', 'Бордюры'], ['fines', 'Штрафы'], ['tech', 'Техника']];
    view(`
      <div class="card ntop">
        <div><b>Режим проверки</b><span class="muted small">цифры скрыты — нажмите, чтобы открыть</span></div>
        <button class="switch ${hide ? 'on' : ''}" data-act="hide" aria-pressed="${hide}"><i></i></button>
      </div>
      <div class="chips nchips">${nav.map(([id, t]) => `<button class="chip" data-go="${id}">${t}</button>`).join('')}</div>
      <p class="muted small legend">✅ закон · 🔑 ключ DLT · 🟡 первоисточник не найден</p>
      <div id="nbody" class="${hide ? 'hidden-nums' : ''}">
      ${sec('exam', 'Экзамен', `<div class="card exam"><div class="ebar"><i style="width:${N.exam.pass / N.exam.total * 100}%"></i><span>${num(N.exam.pass)} из ${N.exam.total}</span></div><p class="small muted" style="margin:8px 0 0">${N.exam.total} вопросов, ${N.exam.sections} разделов · проходной балл 90% — можно ошибиться не больше чем в ${num(N.exam.total - N.exam.pass)} ✅</p></div>`)}
      ${sec('speed', 'Скорость, км/ч', speed, 'постановление 2021, действует с 07.2022 ✅')}
      ${sec('alcohol', 'Алкоголь', alcohol)}
      ${sec('dist', 'Расстояния', '<p class="muted small" style="margin:-4px 4px 8px">«…» в тексте — это число в кружке слева.</p>' + ladder + '<h3 class="nh3">Без расстояния — всегда</h3>' + rows(N.always, 'v'), 'от меньшего к большему')}
      ${sec('time', 'Секунды и прочее', rows(N.seconds) + rows(N.misc))}
      ${sec('terms', 'Сроки и документы', timeline)}
      ${sec('kerb', 'Цвет бордюра', kerbs)}
      ${sec('fines', 'Штрафы', rows(N.fines, 'v'), 'на экзамене редко, кроме алкоголя')}
      ${sec('tech', 'Техника', rows(N.tech, 'v'))}
      </div>
      <p class="muted small" style="text-align:center;margin-top:18px">Источник: numbers.md · проверено 10.10.2026</p>`);
    $('#view').onclick = e => {
      if (e.target.closest('[data-act="hide"]')) { S.numHide = !S.numHide; save(); const y = window.scrollY; screenNumbers(); window.scrollTo(0, y); return; }
      const g = e.target.closest('[data-go]'); if (g) { document.getElementById('n-' + g.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const n = e.target.closest('[data-num]'); if (n && S.numHide) { n.classList.toggle('shown'); }
    };
  }

  /* ---------- router ---------- */
  /* ---------- words (eng/glossary-en-ru.md) ---------- */
  const W = D.glossary || [];
  const W_SECS = [...new Set(W.map(w => w.s))];
  const wKnown = w => !!(S.wk && S.wk[w.en]);
  const setKnown = (w, on) => { S.wk = S.wk || {}; if (on) S.wk[w.en] = 1; else delete S.wk[w.en]; save(); };
  // подсветка фраз в тексте (без учёта регистра), всё остальное экранируется
  function hlText(text, phrases) {
    text = String(text || '');
    const ps = (phrases || []).filter(Boolean).sort((a, b) => b.length - a.length).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!ps.length) return esc(text);
    return text.split(new RegExp('(' + ps.join('|') + ')', 'gi')).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
  }
  function wordFront(w) {
    const e = w.ex || {};
    let ex = '';
    if (e.id && Q[e.id]) {
      const q = Q[e.id];
      ex = `<div class="wex"><div class="wex-h">Вопрос из базы · ${esc(TOPIC[q.t]?.ru || '')}</div>
        ${img(q.img, 'q-img w-img', true)}
        <p class="wq">${hlText(q.q, e.hl)}</p>
        ${q.o.some(Boolean) ? `<ul class="wopts">${q.o.map(o => o ? `<li>${hlText(o, e.hl)}</li>` : '').join('')}</ul>` : ''}</div>`;
    } else if (e.q) {
      ex = `<div class="wex"><div class="wex-h">Пример в стиле экзамена</div><p class="wq">${hlText(e.q, [])}</p></div>`;
    }
    return `<div class="wsec">${esc(w.s)}</div><div class="wen">${esc(w.en)}</div>${ex}<div class="whint">нажмите, чтобы перевернуть</div>`;
  }
  function wordBack(w) {
    const e = w.ex || {};
    let ex = '';
    if (e.id && Q[e.id]) {
      const q = Q[e.id], ans = q.o[q.c];
      ex = `<div class="wex"><div class="wex-h">Ответ на вопрос</div><p class="wq">${ans ? esc(ans) : '(ответ — картинка)'}</p>${q.x ? `<p class="wx">${esc(q.x)}</p>` : ''}</div>`;
    } else if (e.q) {
      ex = `<div class="wex"><div class="wex-h">Ответ</div><p class="wq">${esc(e.a)}</p><p class="wx">${esc(e.ru)}</p></div>`;
    }
    return `<div class="wsec">${esc(w.en)}</div><div class="wru">${esc(w.ru)}</div>${ex}`;
  }
  let wQuery = '', wDeck = null;
  function screenWords() {
    S.wMode = S.wMode || 'table';
    const sec = W_SECS.includes(S.wSec) ? S.wSec : 'all';
    const inSec = W.filter(w => sec === 'all' || w.s === sec);
    const known = W.filter(wKnown).length;
    chrome({ title: 'Слова', subtitle: `${W.length} терминов · знаю ${known}`, tab: 'words' });
    if (!W.length) { view('<div class="empty"><div class="big">📖</div><b>Словарь пуст</b><p class="small">Заполните eng/glossary-en-ru.md и пересоберите данные.</p></div>'); return; }
    const chips = `<div class="chips">${['all', ...W_SECS].map(id => { const n = id === 'all' ? W.length : W.filter(w => w.s === id).length;
      return `<button class="chip ${sec === id ? 'on' : ''}" data-sec="${esc(id)}">${id === 'all' ? 'Все' : esc(id)}<i>${n}</i></button>`; }).join('')}</div>`;
    const seg = `<div class="seg"><button class="${S.wMode === 'table' ? 'on' : ''}" data-mode="table">Таблица</button><button class="${S.wMode === 'cards' ? 'on' : ''}" data-mode="cards">Карточки</button></div>`;
    if (S.wMode === 'table') {
      const hide = !!S.wHide;
      view(`${seg}
        <label class="search">${ICON.search}<input id="wq" type="search" placeholder="Поиск: lane, обочина…" autocomplete="off"></label>
        ${chips}
        <div class="card ntop wtop"><div><b>Скрыть перевод</b><span class="muted small">нажмите на строку, чтобы открыть</span></div>
          <button class="switch ${hide ? 'on' : ''}" data-act="whide" aria-pressed="${hide}"><i></i></button></div>
        <div id="wres"></div>`);
      const inp = $('#wq'); inp.value = wQuery;
      const draw = () => {
        const q = wQuery.trim().toLowerCase();
        const list = inSec.filter(w => !q || (w.en + ' ' + w.ru).toLowerCase().includes(q));
        const groups = W_SECS.map(s => [s, list.filter(w => w.s === s)]).filter(g => g[1].length);
        $('#wres').innerHTML = list.length ? groups.map(([s, ws]) => `<h3 class="nh3">${esc(s)}</h3>
          <div class="card wtable ${hide ? 'hide-ru' : ''}">${ws.map(w => `<button class="wrow ${wKnown(w) ? 'known' : ''}" data-w="${W.indexOf(w)}">
            <span class="we">${esc(w.en)}</span><span class="wr">${esc(w.ru)}</span>${wKnown(w) ? '<i class="wk" title="Знаю">✓</i>' : ''}</button>`).join('')}</div>`).join('')
          : '<p class="muted">Ничего не найдено</p>';
      };
      draw();
      inp.oninput = () => { wQuery = inp.value; draw(); };
    } else {
      const onlyNew = S.wNew !== false;
      const pool = inSec.filter(w => !onlyNew || !wKnown(w));
      const sig = sec + '|' + onlyNew;
      if (!wDeck || wDeck.sig !== sig) wDeck = { sig, ids: shuffle(pool.map(w => W.indexOf(w))), i: 0, back: false };
      wDeck.ids = wDeck.ids.filter((id, pos) => pos < wDeck.i || pool.includes(W[id]));
      const d = wDeck, cur = W[d.ids[d.i]];
      view(`${seg}${chips}
        <div class="wbar"><label class="wnew"><input type="checkbox" data-act="wnew" ${onlyNew ? 'checked' : ''}> только неизученные</label>
          <button class="link-btn" data-act="shuffle">Перемешать</button></div>
        ${cur ? `
        <div class="wprog"><i style="width:${(d.i) / d.ids.length * 100}%"></i></div>
        <p class="muted small" style="text-align:center;margin:6px 0 10px">${d.i + 1} из ${d.ids.length}</p>
        <div class="wcard ${d.back ? 'back' : ''}" id="wcard" role="button" tabindex="0">${d.back ? wordBack(cur) : wordFront(cur)}</div>
        <div class="btn-row wbtns">
          <button class="btn ghost" data-act="prev" ${d.i ? '' : 'disabled'} aria-label="Назад">←</button>
          <button class="btn ghost" data-act="again">Ещё учу</button>
          <button class="btn" data-act="know">Знаю ✓</button>
        </div>` : `<div class="empty"><div class="big">🎉</div><b>${pool.length ? 'Колода пройдена' : 'Все слова в этом разделе изучены'}</b>
          <p class="small">${pool.length ? `Пройдено ${plural(d.ids.length, 'карточка', 'карточки', 'карточек')}.` : 'Снимите «только неизученные», чтобы повторить.'}</p>
          ${pool.length ? '<button class="btn" data-act="shuffle" style="margin-top:14px">Ещё раз</button>' : ''}</div>`}`);
    }
    $('#view').onclick = e => {
      const m = e.target.closest('[data-mode]'); if (m) { S.wMode = m.dataset.mode; save(); return screenWords(); }
      const c = e.target.closest('[data-sec]'); if (c) { S.wSec = c.dataset.sec; save(); return screenWords(); }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'whide') { S.wHide = !S.wHide; save(); const y = window.scrollY; screenWords(); window.scrollTo(0, y); return; }
      if (a === 'wnew') { S.wNew = e.target.checked; save(); return screenWords(); }
      if (a === 'shuffle') { wDeck = null; return screenWords(); }
      if (wDeck && (a === 'know' || a === 'again')) {
        const id = wDeck.ids[wDeck.i];
        setKnown(W[id], a === 'know');
        if (a === 'again' && S.wNew !== false) wDeck.ids.push(id);  // «ещё учу» — карточка вернётся в конце колоды
        wDeck.i++; wDeck.back = false; return screenWords();
      }
      if (wDeck && a === 'prev') { wDeck.i = Math.max(0, wDeck.i - 1); wDeck.back = false; return screenWords(); }
      if (e.target.closest('[data-zoom]')) return;
      const card = e.target.closest('#wcard');
      if (card && wDeck) {
        wDeck.back = !wDeck.back;
        card.classList.add('flip');
        setTimeout(() => { const cur = W[wDeck.ids[wDeck.i]]; card.innerHTML = wDeck.back ? wordBack(cur) : wordFront(cur); card.classList.toggle('back', wDeck.back); card.classList.remove('flip'); }, 140);
        return;
      }
      const r = e.target.closest('[data-w]'); if (r) openWord(W[+r.dataset.w], r);
    };
  }
  function openWord(w, row) {
    if (S.wHide && row && !row.classList.contains('shown')) { row.classList.add('shown'); return; }
    const draw = () => {
      $('#sheet-body').innerHTML = `<div class="wsheet">${wordFront(w).replace(/<div class="whint">.*?<\/div>/, '')}<hr>${wordBack(w)}</div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn ghost" data-wk>${wKnown(w) ? '✓ Знаю — убрать' : 'Отметить «знаю»'}</button>
          <button class="btn ghost" data-close>Закрыть</button></div>`;
      $('#sheet-body').querySelector('[data-wk]').onclick = () => { setKnown(w, !wKnown(w)); draw(); };
    };
    draw();
    $('#sheet').hidden = false;
  }

  function go(hash, replace) {
    if (location.hash === hash) return render();
    replace ? history.replaceState(null, '', hash) : history.pushState(null, '', hash);
    render();
  }
  function render() {
    $('#sheet').hidden = true; $('#zoom').hidden = true;
    const h = location.hash || '#test';
    if (h === '#quiz') return screenQuiz();
    if (h === '#result') return screenResult();
    if (h === '#errors') return screenErrors();
    if (h === '#numbers') return screenNumbers();
    if (h === '#words') return screenWords();
    if (h.startsWith('#signs/')) return screenSigns(h.slice(7));
    if (h === '#signs') return screenSigns(null);
    if (S.quiz && S.quiz.done) { S.quiz = null; save(); }
    return screenTest();
  }
  window.addEventListener('popstate', render);
  document.querySelector('.tabbar').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    const t = b.dataset.tab;
    if (t === 'signs') signQuery = '';
    go(t === 'test' && S.quiz && S.quiz.done ? '#result' : '#' + t);
  };
  $('#back-btn').onclick = () => {
    const h = location.hash;
    if (h === '#quiz') { go('#test'); return; }
    if (h.startsWith('#signs/')) { signQuery = ''; go('#signs'); return; }
    history.back();
  };
  document.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]');
    if (z && !z.closest('.opt')) { const m = $('#zoom'); m.querySelector('img').src = z.src; m.hidden = false; return; }
    if (e.target.closest('#zoom')) { $('#zoom').hidden = true; return; }
    if (e.target.id === 'sheet' || e.target.closest('[data-close]')) { $('#sheet').hidden = true; if (location.hash === '#words') { const y = window.scrollY; screenWords(); window.scrollTo(0, y); } }
  });

  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
