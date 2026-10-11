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
  // размер теста выбирается на экране «Тест»: число из SIZES или 'all' — все вопросы пула
  const SIZES = [10, 15, 25, 50];
  const testSize = () => S.size === 'all' || SIZES.includes(S.size) ? S.size : TEST_SIZE;
  const sizeOf = pool => testSize() === 'all' ? pool : Math.min(testSize(), pool);
  function pickFrom(pool) {
    // сначала вопросы, которых не было в последних тестах, потом недавние — если свежих не хватает
    const recent = new Set(S.recent);
    const fresh = pool.filter(id => !recent.has(id)), seen = pool.filter(id => recent.has(id));
    return shuffle([...shuffle(fresh), ...shuffle(seen)].slice(0, sizeOf(pool.length)));
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
    const size = testSize();
    const last = S.h.slice(-10);
    const avg = last.length ? Math.round(last.reduce((s, h) => s + h.ok / h.n, 0) / last.length * 100) + '%' : '—';
    const resume = S.quiz && S.quiz.items.some(it => it.a === null)
      ? `<div class="card" style="margin-top:12px"><b>Незаконченный тест</b><p class="muted small" style="margin:4px 0 12px">Вопрос ${S.quiz.items.filter(it => it.a !== null).length + 1} из ${S.quiz.items.length}</p>
         <div class="btn-row"><button class="btn" data-act="resume">Продолжить</button><button class="btn ghost" data-act="drop">Сбросить</button></div></div>` : '';
    const v = view(`
      <section class="card hero"><div class="diamond"></div>
        <h2>${size === 'all' ? 'Все вопросы выбранных тем' : `${size} случайных вопросов`}</h2>
        <p>Вопросы на английском, ответ проверяется сразу. Для сдачи нужно 90%.</p>
        <div class="stats">
          <div class="stat"><b>${S.h.length}</b><span>тестов</span></div>
          <div class="stat"><b>${avg}</b><span>средний (10)</span></div>
          <div class="stat"><b>${errs.length}</b><span>ошибок</span></div>
        </div>
      </section>
      ${resume}
      <div class="section-h"><span>Сколько вопросов</span></div>
      <div class="chips qsize">${[...SIZES, 'all'].map(s => `<button class="chip ${size === s ? 'on' : ''}" data-size="${s}">${s === 'all' ? `Все<i>${pool}</i>` : s}</button>`).join('')}</div>
      <p class="muted small qsize-hint">50 — как на экзамене. «Все» — выбранные темы целиком.</p>
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
      <div class="sticky-cta"><button class="btn" data-act="start" ${pool ? '' : 'disabled'}>Начать тест · ${sizeOf(pool)} из ${pool}</button></div>
      <p class="muted small" style="text-align:center;margin-top:14px">База: ${D.questions.length} вопросов · обновлена ${fmtDate(D.built)}</p>
      <p class="offline-st muted small" id="offline-st"></p>`);
    offlineStatus();
    v.onclick = e => {
      const t = e.target.closest('[data-topic]');
      if (t) { const s = new Set(selectedTopics()); s.has(t.dataset.topic) ? s.delete(t.dataset.topic) : s.add(t.dataset.topic); S.sel = [...s]; save(); return screenTest(); }
      const z = e.target.closest('[data-size]');
      if (z) { S.size = z.dataset.size === 'all' ? 'all' : +z.dataset.size; save(); const y = window.scrollY; screenTest(); window.scrollTo(0, y); return; }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'all') { S.sel = sel.size === D.topics.length ? [] : D.topics.map(x => x.id); save(); screenTest(); }
      if (a === 'start') startQuiz('topics', pickFrom(D.questions.filter(q => sel.has(q.t)).map(q => q.id)));
      if (a === 'resume') go('#quiz');
      if (a === 'drop') { S.quiz = null; save(); screenTest(); }
      if (a === 'cache-imgs') { navigator.serviceWorker?.controller?.postMessage('cache-images'); const el = $('#offline-st'); if (el) el.textContent = 'Скачиваю картинки…'; }
    };
  }
  /* офлайн: сколько картинок уже сохранено на телефоне */
  async function offlineStatus() {
    const el = $('#offline-st');
    if (!el || !('caches' in window) || !navigator.serviceWorker || !location.protocol.startsWith('http')) return;
    try {
      const list = await (await fetch('data/images.json')).json();
      const c = await caches.open('dlt-img-v2');
      const have = new Set((await c.keys()).map(r => new URL(r.url).pathname));
      const base = new URL('./', location.href).pathname;
      const n = list.filter(p => have.has(base + p)).length;
      const ready = !!navigator.serviceWorker.controller && n === list.length;
      if (!$('#offline-st')) return;
      el.innerHTML = ready ? `✓ Работает без интернета · сохранено ${n} картинок`
        : `Офлайн: сохранено ${n} из ${list.length} картинок · <button class="link-btn" data-act="cache-imgs">Докачать</button>`;
    } catch (_) { /* без интернета и без кэша — просто молчим */ }
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', () => { if ($('#offline-st')) offlineStatus(); });
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', ev => { if (/^images-/.test(ev.data) && location.hash.replace('#', '') in { '': 1, test: 1 }) offlineStatus(); });
  // просим браузер не удалять сохранённое (на iPhone в Safari без установки может не сработать)
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}

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
        <button class="btn warn" data-act="quiz">Тест из ошибок · ${sizeOf(list.length)}${errFilter !== 'all' ? ' · ' + esc(TOPIC[errFilter].ru) : ''}</button>
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
          <button class="card cat" data-gest><span class="sw sw-gest">✋</span>
            <span class="t"><b>Жесты регулировщика и водителя</b><span>свисток, сигналы рукой · с анимацией</span></span><span class="chev">${ICON.chev}</span></button>
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
      if (e.target.closest('[data-gest]')) { signQuery = ''; return go('#gestures'); }
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
  const N_MODES = [['sheet', 'Шпаргалка', 'Сроки, расстояния, скорости — для запоминания'], ['sort', 'Полки', 'Разложите расстояния по полкам'],
    ['park', 'Парковка', 'Встаньте как можно ближе — но не в запретной зоне'], ['speed', 'Скорость', 'Поставьте стрелку на нужную скорость']];
  // перерисовать экран, не сбрасывая прокрутку
  const redrawNumbers = () => { const y = window.scrollY; screenNumbers(); window.scrollTo(0, y); };
  function screenNumbers() {
    const N = window.NUMBERS;
    const mode = N_MODES.find(m => m[0] === S.nMode) || N_MODES[0];
    chrome({ title: 'Цифры', subtitle: mode[2], tab: 'numbers' });
    if (!N) { view('<div class="empty">Нет данных</div>'); return; }
    const seg = `<div class="seg nseg">${N_MODES.map(([id, t]) => `<button class="${mode[0] === id ? 'on' : ''}" data-nmode="${id}">${t}</button>`).join('')}</div>`;
    const handle = { sheet: numSheet, sort: numSort, park: numPark, speed: numSpeed }[mode[0]](N, seg);
    $('#view').onclick = e => {
      const m = e.target.closest('[data-nmode]');
      if (m) { S.nMode = m.dataset.nmode; save(); return screenNumbers(); }
      handle(e);
    };
  }

  /* шпаргалка */
  function numSheet(N, seg) {
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
    const nav = [['speed', 'Скорость'], ['alcohol', 'Алкоголь'], ['dist', 'Расстояния'], ['time', 'Секунды'], ['terms', 'Сроки'], ['kerb', 'Бордюры'], ['fines', 'Штрафы'], ['tech', 'Техника']];
    view(`${seg}
      <div class="card ntop">
        <div><b>Режим проверки</b><span class="muted small">цифры скрыты — нажмите, чтобы открыть</span></div>
        <button class="switch ${hide ? 'on' : ''}" data-act="hide" aria-pressed="${hide}"><i></i></button>
      </div>
      <div class="chips nchips">${nav.map(([id, t]) => `<button class="chip" data-go="${id}">${t}</button>`).join('')}</div>
      <p class="muted small legend">✅ закон · 🔑 ключ DLT · 🟡 первоисточник не найден</p>
      <div id="nbody" class="${hide ? 'hidden-nums' : ''}">
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
    return e => {
      if (e.target.closest('[data-act="hide"]')) { S.numHide = !S.numHide; save(); return redrawNumbers(); }
      const g = e.target.closest('[data-go]'); if (g) { document.getElementById('n-' + g.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const n = e.target.closest('[data-num]'); if (n && S.numHide) { n.classList.toggle('shown'); }
    };
  }

  /* игра «Разложи по полочкам»: карточка — [текст, полка, метка, статья] */
  let nSort = null;  // текущий раунд (в памяти, как колода слов)
  const fmtTime = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const replay = el => { el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim'); };
  function numSort(N, seg) {
    const sets = N.sort;
    const set = sets.find(s => s.id === S.sgSet) || sets[0];
    if (!nSort || nSort.set !== set.id) nSort = { set: set.id, order: shuffle([...set.cards.keys()]), i: 0, put: set.bins.map(() => []), err: {}, miss: 0, t0: Date.now(), fb: null };
    const g = nSort, done = g.i >= g.order.length, cur = set.cards[g.order[g.i]];
    const many = set.bins.length > 4;
    const chips = `<div class="chips">${sets.map(s => `<button class="chip ${s.id === set.id ? 'on' : ''}" data-sgset="${s.id}">${esc(s.name)}<i>${s.cards.length}</i></button>`).join('')}</div>`;
    if (done) {
      view(`${seg}${chips}
        <div class="card sg-done"><div class="big">${g.miss ? '👍' : '🎉'}</div><b>Всё разложено</b>
          <p class="muted small">Время ${fmtTime(g.t)} · ${g.miss ? plural(g.miss, 'ошибка', 'ошибки', 'ошибок') : 'без ошибок'}${g.rec ? ' · новый рекорд!' : g.prev ? ` · лучший: ${fmtTime(g.prev.t)}, ${g.prev.e ? plural(g.prev.e, 'ошибка', 'ошибки', 'ошибок') : 'без ошибок'}` : ''}</p>
          <button class="btn" data-act="sg-again">Ещё раз</button></div>
        <h3 class="nh3">${esc(set.ask)}</h3>
        <div class="card nlist">${set.bins.map((b, bi) => `<div class="nrow"><span class="nk"><b>${esc(b)}</b></span><span class="nv">${g.put[bi].map(ci => `<span class="${g.err[ci] ? 'sg-e' : ''}">${esc(set.cards[ci][0])}</span>`).join('<br>')}</span></div>`).join('')}</div>
        ${g.miss ? '<p class="muted small" style="margin:8px 4px 0">Красным — где ошиблись.</p>' : ''}`);
    } else {
      // в полке: на 4 полки — подписи карточек, на 8 — точки (подписи не помещаются)
      const inBin = bi => g.put[bi].length ? `<span class="sg-in">${g.put[bi].map(ci => many ? `<i class="dot ${g.err[ci] ? 'err' : ''}"></i>` : `<i class="${g.err[ci] ? 'err' : ''}">${esc(set.cards[ci][0])}</i>`).join('')}</span>` : '';
      view(`${seg}${chips}
        <div class="wprog sg-prog"><i style="width:${g.i / g.order.length * 100}%"></i></div>
        <p class="muted small sg-meta" id="sgmeta">${g.i + 1} из ${g.order.length}${g.miss ? ` · ${plural(g.miss, 'ошибка', 'ошибки', 'ошибок')}` : ''}</p>
        <div class="sg-card" id="sgcard"><small>${esc(set.ask)}</small>${esc(cur[0])}</div>
        <p class="sg-fb ${g.fb ? 'ok' : ''}" id="sgfb">${g.fb || 'Нажмите на полку с правильным расстоянием'}</p>
        <div class="sg-bins ${many ? 'many' : ''}">${set.bins.map((b, bi) => `<button class="sg-bin" data-bin="${bi}"><b>${esc(b)}</b>${inBin(bi)}</button>`).join('')}</div>`);
      if (g.last != null) { const el = document.querySelector(`[data-bin="${g.last}"]`); el.classList.add('good'); replay(el); g.last = null; }
    }
    return e => {
      const s = e.target.closest('[data-sgset]'); if (s) { S.sgSet = s.dataset.sgset; save(); nSort = null; return screenNumbers(); }
      if (e.target.closest('[data-act="sg-again"]')) { nSort = null; return screenNumbers(); }
      const b = e.target.closest('[data-bin]'); if (!b || done) return;
      const bi = +b.dataset.bin, ci = g.order[g.i], card = set.cards[ci];
      if (set.bins[bi] === card[1]) {
        g.put[bi].push(ci); g.i++; g.last = bi;
        g.fb = `✓ ${esc(card[1])} · ${mk(card[2])} ${esc(card[3])}`;
        if (g.i >= g.order.length) {
          g.t = Date.now() - g.t0;
          S.nBest = S.nBest || {};
          const k = 'sort:' + set.id, prev = g.prev = S.nBest[k];
          if (!prev || g.miss < prev.e || (g.miss === prev.e && g.t < prev.t)) { S.nBest[k] = { e: g.miss, t: g.t }; g.rec = !!prev; }
          save();
        }
        return redrawNumbers();
      }
      g.miss++; g.err[ci] = 1;
      b.classList.remove('good'); b.classList.add('bad'); replay(b);
      replay($('#sgcard'));
      const fb = $('#sgfb'); fb.className = 'sg-fb bad'; fb.textContent = `Не ${set.bins[bi]} — попробуйте другую полку`;
      $('#sgmeta').textContent = `${g.i + 1} из ${g.order.length} · ${plural(g.miss, 'ошибка', 'ошибки', 'ошибок')}`;
      try { navigator.vibrate?.(40); } catch (_) {}
    };
  }

  /* игра «Парковка»: машина едет вверх вдоль левого бордюра; встать как можно ближе к предмету, но не в запретной зоне.
     Координаты — метры вдоль дороги от низа сцены (s растёт по ходу движения, вверх по экрану). */
  let nPark = null;
  // сцена 34 м, 9 px на метр, предмет в 6 м от края (зоны 3 и 5 м видны целиком), машина 4,5 м, штраф за стоянку — до 500 ฿
  const PK = { span: 34, px: 9, edge: 6, car: 4.5, start: 18, fine: 500 };
  const pkR = v => Math.round(v * 10) / 10;
  const pkY = s => pkR((PK.span - s) * PK.px);
  // предмет: не доезжая — у верха сцены (машина подъезжает снизу), проехав — у низа (машина сверху)
  const pkObj = t => { const s0 = t.side === 'before' ? PK.span - PK.edge - t.len : PK.edge; return [s0, s0 + t.len]; };
  const pkMax = t => { const [s0, s1] = pkObj(t); return Math.floor(t.side === 'before' ? s0 - PK.car : PK.span - PK.car - s1); };
  const pkNeed = t => t.zone[t.side === 'before' ? 0 : 1];
  const pkRes = (t, d) => d === pkNeed(t) ? 'ok' : d > pkNeed(t) ? 'far' : 'bad';
  function pkThing(kind, s0, s1) {
    const top = pkY(s1), h = pkR((s1 - s0) * PK.px), mid = pkR(top + h / 2);
    const emo = (e, x) => `<text x="${x}" y="${pkR(mid + 9)}" class="pk-emo">${e}</text>`;
    const across = (x0, x1, step, w, cls) => { let o = ''; for (let x = x0; x < x1; x += step) o += `<rect x="${x}" y="${top}" width="${w}" height="${h}" class="${cls}"/>`; return o; };
    switch (kind) {
      case 'hydrant': return `<rect x="36" y="${pkR(mid - 12)}" width="18" height="24" rx="7" class="pk-hyd"/><rect x="31" y="${pkR(mid - 3)}" width="28" height="7" rx="3.5" class="pk-hyd"/>`;
      case 'mailbox': return emo('📮', 40);
      case 'bus': return `<rect x="52" y="${pkR(mid - 1)}" width="11" height="2" class="pk-pole"/>` + emo('🚏', 36);
      case 'light': return `<rect x="52" y="${pkR(mid - 1)}" width="11" height="2" class="pk-pole"/>` + emo('🚦', 36);
      case 'crossing': return across(70, 200, 13, 7, 'pk-zebra') + emo('🚶', 30);
      case 'drive': return `<rect x="0" y="${top}" width="65" height="${h}" class="pk-drive"/>` + emo('🏠', 22);
      case 'junction': return `<rect x="0" y="${top}" width="66" height="${h}" class="pk-road"/><line x1="0" y1="${mid}" x2="62" y2="${mid}" class="pk-mid"/>`;
      case 'island': return `<rect x="123" y="-12" width="20" height="${pkR(pkY(s0) + 12)}" rx="10" class="pk-island"/>`;
      case 'rail': return across(0, 280, 11, 5, 'pk-sleeper') + `<line x1="0" y1="${pkR(top + h * .3)}" x2="280" y2="${pkR(top + h * .3)}" class="pk-rail"/><line x1="0" y1="${pkR(top + h * .7)}" x2="280" y2="${pkR(top + h * .7)}" class="pk-rail"/>`;
    }
    return '';
  }
  function parkSvg(t, d, res) {
    const W = 280, H = PK.span * PK.px, [s0, s1] = pkObj(t);
    const front = t.side === 'before' ? s0 - d : s1 + d + PK.car;
    let o = `<rect width="${W}" height="${H}" class="pk-road"/><rect width="62" height="${H}" class="pk-walk"/><rect x="202" width="78" height="${H}" class="pk-walk"/>
      <line x1="133" y1="0" x2="133" y2="${H}" class="pk-mid"/>`;
    for (let s = 0; s <= PK.span; s++) o += `<line x1="${s % 5 ? 55 : 48}" y1="${pkY(s)}" x2="62" y2="${pkY(s)}" class="pk-tick"/>`;  // метки на бордюре: 1 м, каждые 5 м длиннее
    o += `<line x1="63" y1="0" x2="63" y2="${H}" class="pk-kerb"/>` + pkThing(t.kind, s0, s1);
    if (res) {  // запретная зона — только после «Встать»
      const zone = (a, b, n) => { a = Math.max(0, a); b = Math.min(PK.span, b);
        return n ? `<rect x="66" y="${pkY(b)}" width="62" height="${pkR((b - a) * PK.px)}" class="pk-zone"/><text x="97" y="${pkR((pkY(a) + pkY(b)) / 2 + 5)}" class="pk-zl">${n} м</text>` : ''; };
      o += zone(s0 - t.zone[0], s0, t.zone[0]) + zone(s1, s1 + t.zone[1], t.zone[1]);
    }
    const [m0, m1] = t.side === 'before' ? [front, s0] : [s1, front - PK.car];  // промежуток между машиной и предметом
    if (m1 > m0) o += `<path d="M114 ${pkY(m1)}V${pkY(m0)}M109 ${pkY(m1)}H119M109 ${pkY(m0)}H119" class="pk-gap"/>`;
    const y = pkY(front);
    return o + `<g class="pk-car ${res || ''}"><rect x="72" y="${y}" width="26" height="${pkR(PK.car * PK.px)}" rx="6" class="body"/>
      <rect x="75" y="${pkR(y + 6)}" width="20" height="9" rx="2" class="glass"/><rect x="76" y="${pkR(y + 30)}" width="18" height="6" rx="2" class="glass"/></g>`;
  }
  function numPark(N, seg) {
    const T = N.park;
    if (!nPark) nPark = { order: shuffle([...T.keys()]), i: 0, d: null, res: [], checked: false };
    const g = nPark, done = g.i >= g.order.length, t = T[g.order[g.i]];
    const fines = () => g.res.filter(x => x.r === 'bad').length * PK.fine;
    const baht = n => n.toLocaleString('ru-RU') + ' ฿';
    if (done) {
      const ok = g.res.filter(x => x.r === 'ok').length;
      view(`${seg}
        <div class="card sg-done"><div class="big">${ok === g.res.length ? '🎉' : fines() ? '🧾' : '🅿️'}</div><b>Идеально: ${ok} из ${g.res.length}</b>
          <p class="muted small">${fines() ? `Штрафы: ${baht(fines())}` : 'Без штрафов'}${g.rec ? ' · новый рекорд!' : g.prev ? ` · лучший: ${g.prev.ok} из ${g.prev.n}` : ''}</p>
          <button class="btn" data-act="pk-again">Ещё раз</button></div>
        <h3 class="nh3">Стоянка запрещена ближе чем</h3>
        <div class="card sp-sum"><table class="ntable sp-table pk-sum"><thead><tr><th></th><th>Запрет</th><th>Вы</th></tr></thead>
          <tbody>${g.res.map(x => { const q = T[x.ti]; return `<tr><td>${esc(q.name)}</td><td>${pkNeed(q)} м</td><td class="${x.r}">${x.d} м</td></tr>`; }).join('')}</tbody></table>
          <p class="muted small" style="margin:8px 0 0">Зелёным — ровно на границе, жёлтым — законно, но можно было ближе, красным — штраф. Все расстояния — LTA ст. 57.</p></div>`);
    } else {
      if (g.d == null) g.d = Math.min(PK.start, pkMax(t));
      const r = g.checked ? pkRes(t, g.d) : '', need = pkNeed(t);
      const msg = { ok: `✓ Идеально — ровно ${need} м`, far: `Законно, но можно было ближе — запрет ${need} м`, bad: `✕ Штраф до ${baht(PK.fine)} — ближе ${need} м стоять нельзя` }[r];
      view(`${seg}
        <div class="wprog sg-prog"><i style="width:${g.i / g.order.length * 100}%"></i></div>
        <p class="muted small sg-meta">${g.i + 1} из ${g.order.length}${fines() ? ` · штрафы ${baht(fines())}` : ''}</p>
        <div class="card pk-task"><small>Встаньте как можно ближе</small><b>${esc(t.to)}</b></div>
        <div class="pk-scene"><svg id="pksvg" viewBox="0 0 280 ${PK.span * PK.px}" aria-label="Улица сверху: машина у левого бордюра">${parkSvg(t, g.d, r)}</svg></div>
        <div class="sp-read ${r}"><span id="pkv">${g.d}</span><small>м до предмета</small></div>
        ${g.checked ? `<p class="sg-fb ${r}">${msg}</p><p class="muted small pk-rule">${esc(t.rule)} · ст. 57</p>
          <button class="btn" data-act="pk-next">${g.i + 1 < g.order.length ? 'Дальше' : 'Итог'}</button>`
        : `<div class="btn-row sp-ctl"><button class="btn ghost" data-act="pk-dec" aria-label="Ближе на 1 м">−</button><button class="btn" data-act="pk-check">Встать</button><button class="btn ghost" data-act="pk-inc" aria-label="Дальше на 1 м">+</button></div>
          <p class="muted small sp-note">Тяните машину вдоль бордюра или нажимайте − и +. Шаг — 1 м.</p>`}`);
      const svg = $('#pksvg');
      g.setD = d => { d = Math.max(0, Math.min(pkMax(t), d)); if (d === g.d) return; g.d = d; svg.innerHTML = parkSvg(t, d, ''); $('#pkv').textContent = d; };
      if (!g.checked) {
        // палец — центр машины; переводим его в расстояние до предмета, шаг 1 м
        const fromPointer = ev => {
          const b = svg.getBoundingClientRect(), s = PK.span - (ev.clientY - b.top) / b.height * PK.span, [s0, s1] = pkObj(t);
          g.setD(Math.round(t.side === 'before' ? s0 - s - PK.car / 2 : s - PK.car / 2 - s1));
        };
        svg.onpointerdown = ev => { svg.setPointerCapture(ev.pointerId); fromPointer(ev); svg.onpointermove = fromPointer; };
        svg.onpointerup = svg.onpointercancel = () => { svg.onpointermove = null; };
      }
    }
    return e => {
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'pk-again') { nPark = null; return screenNumbers(); }
      if (done || !a) return;
      if (a === 'pk-inc' || a === 'pk-dec') return g.setD(g.d + (a === 'pk-inc' ? 1 : -1));
      if (a === 'pk-check') { g.checked = true; g.res.push({ ti: g.order[g.i], d: g.d, r: pkRes(t, g.d) }); return redrawNumbers(); }
      if (a === 'pk-next') {
        g.i++; g.checked = false; g.d = null;
        if (g.i >= g.order.length) {
          const ok = g.res.filter(x => x.r === 'ok').length;
          S.nBest = S.nBest || {};
          const prev = g.prev = S.nBest.park;
          if (!prev || ok > prev.ok) { S.nBest.park = { ok, n: g.res.length }; g.rec = !!prev; }
          save();
        }
        return redrawNumbers();
      }
    };
  }

  /* игра «Спидометр»: машина / мотоцикл / мотоцикл ≥ 400 см³ × 4 зоны */
  let nSpeed = null;
  const SP_MAX = 140, SP_CX = 120, SP_CY = 124, SP_R = 100;
  const spRot = v => `rotate(${v / SP_MAX * 180} ${SP_CX} ${SP_CY})`;
  const spWho = r => r.who.replace(/\s*\/.*/, '');
  function speedGauge(val, ans, cls) {
    const pt = (v, r) => { const a = Math.PI * (1 - v / SP_MAX); return [(SP_CX + r * Math.cos(a)).toFixed(1), (SP_CY - r * Math.sin(a)).toFixed(1)]; };
    const arc = (a, b, r = SP_R) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`; };
    let ticks = '';
    for (let v = 0; v <= SP_MAX; v += 10) {
      const maj = v % 20 === 0, [x1, y1] = pt(v, SP_R - (maj ? 13 : 7)), [x2, y2] = pt(v, SP_R);
      ticks += `<line class="spd-tick ${maj ? 'maj' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      if (maj) { const [lx, ly] = pt(v, SP_R - 27); ticks += `<text class="spd-lbl" x="${lx}" y="${+ly + 4}">${v}</text>`; }
    }
    return `<svg viewBox="0 0 240 136" aria-label="Спидометр">
      <path class="spd-arc" d="${arc(0, SP_MAX)}"/>${ticks}
      ${ans != null ? `<path class="spd-ans" d="${arc(Math.max(0, ans - 3), Math.min(SP_MAX, ans + 3), SP_R + 1)}"/>` : ''}
      <g id="spd-needle" class="spd-needle ${cls || ''}" transform="${spRot(val)}"><line x1="${SP_CX}" y1="${SP_CY}" x2="${SP_CX - SP_R + 38}" y2="${SP_CY}"/></g>
      <circle class="spd-hub" cx="${SP_CX}" cy="${SP_CY}" r="7"/></svg>`;
  }
  function numSpeed(N, seg) {
    const R = N.speedMain;
    const f = ['all', ...R.keys()].map(String).includes(S.spF) ? S.spF : 'all';
    if (!nSpeed || nSpeed.f !== f) {
      const tasks = [];
      R.forEach((r, ri) => { if (f === 'all' || +f === ri) r.v.forEach((_, zi) => tasks.push({ ri, zi })); });
      nSpeed = { f, tasks: shuffle(tasks), i: 0, val: 0, res: [], checked: false };
    }
    const g = nSpeed, done = g.i >= g.tasks.length, t = g.tasks[g.i];
    const chips = `<div class="chips">${[['all', 'Все'], ...R.map((r, i) => [String(i), `${r.icon} ${spWho(r)}`])].map(([id, name]) => `<button class="chip ${f === id ? 'on' : ''}" data-spf="${id}">${esc(name)}</button>`).join('')}</div>`;
    const note = '<p class="muted small sp-note">Ответы — по постановлению 2021 г., на экзамене так же. В Бангкоке на деле 60 км/ч на большинстве дорог.</p>';
    if (done) {
      const okN = g.res.filter(x => x.ok).length;
      view(`${seg}${chips}
        <div class="card sg-done"><div class="big">${okN === g.res.length ? '🎉' : '🏁'}</div><b>${okN} из ${g.res.length} верно</b>
          <p class="muted small">${g.rec ? 'Новый рекорд!' : g.prev ? `Лучший результат: ${g.prev.ok} из ${g.prev.n}` : ''}</p>
          <button class="btn" data-act="sp-again">Ещё раз</button></div>
        <h3 class="nh3">Ответы, км/ч</h3>
        <div class="card sp-sum"><table class="ntable sp-table"><thead><tr><th></th>${N.speedZones.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead>
          <tbody>${R.map((r, ri) => `<tr><td>${r.icon} ${esc(spWho(r))}</td>${r.v.map((v, zi) => { const x = g.res.find(y => y.ri === ri && y.zi === zi);
            return `<td class="${x ? (x.ok ? 'ok' : 'bad') : ''}">${v}${x && !x.ok ? `<small>было ${x.val}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
          <p class="muted small" style="margin:8px 0 0">${N.speedZones.map((z, i) => `<b>${i + 1}</b> — ${esc(z)}`).join(' · ')}</p></div>${note}`);
    } else {
      const r = R[t.ri], ans = r.v[t.zi], ok = g.checked && g.val === ans;
      view(`${seg}${chips}
        <div class="wprog sg-prog"><i style="width:${g.i / g.tasks.length * 100}%"></i></div>
        <p class="muted small sg-meta">${g.i + 1} из ${g.tasks.length}</p>
        <div class="card sp-task"><span class="sp-ico">${r.icon}</span><div><b>${esc(r.who)}</b>
          <div class="sp-zone">${esc(N.speedZones[t.zi])}</div><div class="muted small">${esc(N.speedZonesHint[t.zi])}</div></div></div>
        <div class="sp-gauge" id="spg">${speedGauge(g.val, g.checked ? ans : null, g.checked ? (ok ? 'ok' : 'bad') : '')}</div>
        <div class="sp-read ${g.checked ? (ok ? 'ok' : 'bad') : ''}"><span id="spv">${g.val}</span><small>км/ч</small></div>
        ${g.checked ? `<p class="sg-fb ${ok ? 'ok' : 'bad'}">${ok ? '✓ Верно' : `✕ Нужно ${ans} км/ч — отмечено зелёным на шкале`}</p>
          <button class="btn" data-act="sp-next">${g.i + 1 < g.tasks.length ? 'Дальше' : 'Итог'}</button>`
        : `<div class="btn-row sp-ctl"><button class="btn ghost" data-act="sp-dec" aria-label="Меньше на 10">−</button><button class="btn" data-act="sp-check">Проверить</button><button class="btn ghost" data-act="sp-inc" aria-label="Больше на 10">+</button></div>
          <p class="muted small sp-note">Перетащите стрелку или нажмите на шкалу. Шаг — 10 км/ч.</p>`}
        ${note}`);
      const svg = $('#spg svg');
      const setVal = v => { v = Math.max(0, Math.min(SP_MAX, v)); if (v === g.val) return; g.val = v; $('#spd-needle').setAttribute('transform', spRot(v)); $('#spv').textContent = v; };
      if (!g.checked) {
        // угол точки касания относительно центра шкалы → скорость, с шагом 10
        const fromPointer = ev => {
          const b = svg.getBoundingClientRect();
          const x = (ev.clientX - b.left) / b.width * 240 - SP_CX, y = SP_CY - (ev.clientY - b.top) / b.height * 136;
          setVal(Math.round((1 - Math.atan2(Math.max(y, 0), x) / Math.PI) * SP_MAX / 10) * 10);
        };
        svg.onpointerdown = ev => { svg.setPointerCapture(ev.pointerId); fromPointer(ev); svg.onpointermove = fromPointer; };
        svg.onpointerup = svg.onpointercancel = () => { svg.onpointermove = null; };
      }
      g.setVal = setVal;
    }
    return e => {
      const c = e.target.closest('[data-spf]'); if (c) { S.spF = c.dataset.spf; save(); nSpeed = null; return screenNumbers(); }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'sp-again') { nSpeed = null; return screenNumbers(); }
      if (done || !a) return;
      if (a === 'sp-inc' || a === 'sp-dec') return g.setVal(g.val + (a === 'sp-inc' ? 10 : -10));
      if (a === 'sp-check') { g.checked = true; g.res.push({ ri: t.ri, zi: t.zi, val: g.val, ok: g.val === R[t.ri].v[t.zi] }); return redrawNumbers(); }
      if (a === 'sp-next') {
        g.i++; g.checked = false; g.val = 0;
        if (g.i >= g.tasks.length) {
          const okN = g.res.filter(x => x.ok).length;
          S.nBest = S.nBest || {};
          const k = 'speed:' + f, prev = g.prev = S.nBest[k];
          if (!prev || okN / g.res.length > prev.ok / prev.n) { S.nBest[k] = { ok: okN, n: g.res.length }; g.rec = !!prev; }
          save();
        }
        return redrawNumbers();
      }
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

  /* ---------- gestures: регулировщик (ст. 24–25) и водитель (ст. 37) ---------- */
  // фигура регулировщика лицом к нам: его ПРАВАЯ рука — слева на картинке
  function officerSvg(fig) {
    const arm = (d, hot) => `<path d="${d}" class="${hot ? 'arm hot' : 'arm'}"/>`;
    const R = { down: arm('M44 50 L38 92'), up: arm('M44 50 L14 50 L14 18', 1) };
    const L = { down: arm('M76 50 L82 92'), out: arm('M76 50 L114 50', 1), palm: arm('M76 50 L110 50 L110 34', 1) };
    const [r, l] = { rUp: ['up', 'down'], lOut: ['down', 'out'], 'rUp+lOut': ['up', 'out'], lPalm: ['down', 'palm'], bothPalm: ['palmR', 'palm'] }[fig];
    const right = r === 'palmR' ? arm('M44 50 L10 50 L10 34', 1) : R[r];
    return `<svg viewBox="0 0 124 150" class="g-fig" aria-hidden="true">
      <circle cx="60" cy="26" r="12" class="body"/><path d="M44 42h32v52H44z" class="body" rx="6"/>
      <path d="M48 94l-3 46M72 94l3 46" class="leg"/>${right}${L[l]}
      <text x="22" y="146" class="lbl">прав.</text><text x="98" y="146" class="lbl" text-anchor="middle">лев.</text></svg>`;
  }
  // вид сверху: регулировщик в центре смотрит ВВЕРХ; f — спереди, b — сзади, l/r — слева/справа от него
  function topSvg(stop) {
    const G = {
      f: ['M60 6 V30', '54,28 66,28 60,37', 'M50 41 H70'], b: ['M60 114 V90', '54,92 66,92 60,83', 'M50 79 H70'],
      l: ['M6 60 H30', '28,54 28,66 37,60', 'M41 50 V70'], r: ['M114 60 H90', '92,54 92,66 83,60', 'M79 50 V70'],
    };
    const arrows = Object.entries(G).map(([k, [d, head, bar]]) => { const st = stop.includes(k);
      return `<g class="${st ? 'stop' : 'go'}"><path d="${d}" class="ga"/><polygon points="${head}" class="gh"/>${st ? `<path d="${bar}" class="bar"/>` : ''}</g>`; }).join('');
    return `<svg viewBox="0 0 120 120" class="g-top" aria-hidden="true">
      <path d="M44 0h32v120H44zM0 44h120v32H0z" class="road"/>${arrows}
      <circle cx="60" cy="60" r="8" class="cop"/><path d="M55 55 L60 47 L65 55z" class="nose"/></svg>`;
  }
  // водитель: вид СЗАДИ на машину (так видит тот, кто едет следом); руль справа — рука торчит справа
  function driverSvg(kind) {
    const sh = 'M104 52';
    const armStraight = `<path d="${sh} L132 52" class="arm hot"/>`;
    const body = `<rect x="18" y="50" width="90" height="38" rx="9" class="car"/><path d="M30 50 L38 24 H90 L98 50z" class="car glass-frame"/><path d="M36 48 L42 28 H86 L92 48z" class="glass"/>
      <circle cx="78" cy="38" r="7" class="head"/><rect x="22" y="58" width="14" height="9" rx="2" class="tail"/><rect x="90" y="58" width="14" height="9" rx="2" class="tail"/>
      <rect x="22" y="86" width="16" height="10" rx="3" class="tyre"/><rect x="88" y="86" width="16" height="10" rx="3" class="tyre"/><rect x="52" y="70" width="22" height="9" rx="1.5" class="plate"/>`;
    const parts = {
      right: armStraight,
      slow: `<g class="anim-updown">${armStraight}<circle cx="133" cy="52" r="4.5" class="hand"/></g>`,
      pass: `${armStraight}<g class="anim-fwd"><path d="M132 52 L140 46" class="arm hot"/></g><path d="M126 30 V16 M121 21 L126 15 L131 21" class="hint"/>`,
      left: `${armStraight}<g class="anim-left"><path d="M132 52 L132 38" class="arm hot"/></g><path d="M112 20 H96 M101 15 L95 20 L101 25" class="hint"/>`,
      stop: `<path d="${sh} L124 52 L124 24" class="arm hot"/><rect x="119" y="13" width="10" height="13" rx="4" class="hand"/>`,
    };
    return `<svg viewBox="0 0 146 100" class="g-car" aria-hidden="true">${body}${parts[kind]}</svg>`;
  }
  const OFFICER = [
    { fig: 'rUp', stop: ['f'], name: 'Правая рука согнута вверх, ладонь вперёд', mean: 'Стоят те, кто едет СПЕРЕДИ — навстречу его лицу', go: 'Разрешает ехать: поворачивает ладонь и машет назад', law: 'ст. 24(4)', exam: 1 },
    { fig: 'lOut', stop: ['b'], name: 'Левая рука вытянута в сторону, на уровне плеча', mean: 'Стоят те, кто едет СЗАДИ — к его спине', go: 'Разрешает ехать: опускает руку и машет вперёд', law: 'ст. 24(1)', exam: 1 },
    { fig: 'rUp+lOut', stop: ['f', 'b'], name: 'Правая согнута вверх + левая вытянута', mean: 'Стоят и спереди, и сзади — едут только те, кто сбоку', law: 'ст. 24(5)' },
    { fig: 'lPalm', stop: ['l'], name: 'Рука вытянута в сторону, ладонь поднята «стеной»', mean: 'Стоят те, кто едет с той стороны, где вытянута рука (рука любая)', go: 'Разрешает ехать: переворачивает ладонь и машет через голову назад', law: 'ст. 24(2)' },
    { fig: 'bothPalm', stop: ['l', 'r'], name: 'Обе руки в стороны, ладони подняты', mean: 'Стоят с обеих сторон — слева и справа от него', law: 'ст. 24(3)' },
  ];
  const DRIVER = [
    { k: 'right', name: 'Направо или перестроиться вправо', how: 'Рука вытянута в сторону на уровне плеча — неподвижно', law: 'ст. 37(4)' },
    { k: 'slow', name: 'Снижаю скорость', how: 'Рука вытянута, машет вверх-вниз несколько раз', law: 'ст. 37(1)', exam: 1 },
    { k: 'pass', name: 'Обгоняйте, проезжайте', how: 'Рука вытянута, кисть машет вперёд несколько раз', law: 'ст. 37(3)' },
    { k: 'left', name: 'Налево или перестроиться влево', how: 'Рука вытянута, кисть загнута вверх и машет влево (над крышей) несколько раз', law: 'ст. 37(5)' },
    { k: 'stop', name: 'Останавливаюсь', how: 'Рука в сторону, предплечье вверх под прямым углом, ладонь вперёд — неподвижно', law: 'ст. 37(2)' },
  ];
  function screenGestures() {
    chrome({ title: 'Жесты', subtitle: 'Регулировщик и сигналы рукой водителя', back: true, tab: 'signs' });
    const hide = !!S.gHide;
    const ex = x => x.exam ? '<span class="g-exam">в тестах</span>' : '';
    view(`
      <div class="card ntop"><div><b>Проверь себя</b><span class="muted small">значения скрыты — нажмите на карточку</span></div>
        <button class="switch ${hide ? 'on' : ''}" data-act="ghide" aria-pressed="${hide}"><i></i></button></div>
      <div id="gbody" class="${hide ? 'g-hidden' : ''}">
      <h2 class="nh">Регулировщик<small>Его жесты главнее светофора, знаков и разметки</small></h2>
      <div class="card memo g-memo">
        <span class="gm-h">Как запомнить</span>
        <p>👉 <b>П</b>равая (согнута вверх) — стоят <b>П</b>еред ним. <b>Л</b>евая в сторону — стоят сзади, за спиной.</p>
        <p>✋ Рука в сторону с поднятой ладонью — «стена» сбоку: стоят те, кто едет со стороны этой руки.</p>
        <p>⚠️ Ловушка: левая рука в сторону. Ладонь <u>не</u> поднята — стоят <b>сзади</b>. Ладонь поднята — стоят <b>слева</b>.</p>
      </div>
      <p class="muted small g-legend">Схема — вид сверху: кружок — регулировщик, смотрит вверх ↑. <span class="lg-s">красные</span> стоят, <span class="lg-g">зелёные</span> едут.</p>
      <div class="stack">${OFFICER.map(o => `
        <div class="card g-card" data-reveal>
          <div class="g-pics">${officerSvg(o.fig)}${topSvg(o.stop)}</div>
          <div class="g-name">${esc(o.name)} ${ex(o)}</div>
          <div class="g-mean">${esc(o.mean)}</div>
          ${o.go ? `<div class="g-go small muted">${esc(o.go)}</div>` : ''}
          <div class="g-law">✅ ${o.law}</div>
        </div>`).join('')}</div>
      <div class="card nlist" style="margin-top:12px">
        <div class="nrow"><span class="nk"><b>— один длинный</b></span><span class="nv">свисток: <span class="g-ans">немедленно остановиться</span> ✅</span></div>
        <div class="nrow"><span class="nk"><b>• • два коротких</b></span><span class="nv">свисток: <span class="g-ans">можно ехать</span> ✅</span></div>
        <div class="nrow"><span class="nk"><b>Нет стоп-линии</b></span><span class="nv"><span class="g-ans">остановиться не ближе 3 м от регулировщика</span> ✅</span></div>
      </div>
      <p class="muted small" style="margin:6px 4px 0">Свисток — ст. 25, 3 м — ст. 24 Закона о дорожном движении.</p>

      <h2 class="nh">Сигналы рукой водителя<small>Только ПРАВОЙ рукой — руль справа (ст. 37)</small></h2>
      <div class="card memo g-memo">
        <span class="gm-h">Как запомнить</span>
        <p>Всё показывается <b>прямой</b> рукой, кроме <b>«стоп»</b> — там предплечье вверх и ладонь «стоп», как у регулировщика.</p>
        <p>Рука <b>неподвижна</b> — направо: рука сама показывает в сторону поворота.</p>
        <p>Рука <b>машет</b> — объясняет: вверх-вниз «тише-тише», вперёд «давай, обгоняй», через крышу влево «я налево».</p>
      </div>
      <p class="muted small g-legend">Вид сзади — так жест видит тот, кто едет за вами.</p>
      <div class="g-grid">${DRIVER.map(d => `
        <div class="card g-dcard" data-reveal>${driverSvg(d.k)}
          <div class="g-name">${esc(d.name)} ${ex(d)}</div>
          <div class="g-mean small">${esc(d.how)}</div>
          <div class="g-law">✅ ${d.law}</div>
        </div>`).join('')}</div>
      <p class="muted small" style="margin:8px 4px 0">Если руль слева — вместо жестов рукой подают световые сигналы: поворотники, стоп-сигналы (ст. 37).</p>

      <h2 class="nh">На мотоцикле<small>Если не работают поворотники или стоп-сигнал</small></h2>
      <div class="card nlist">
        <div class="nnote">✅ Отдельных жестов для мотоцикла в законе нет: ст. 37 одна для всех водителей. В пособии DLT для мотоциклистов — тот же текст. Значит, те же жесты, <b>правой рукой</b>.</div>
        <div class="nnote">✅ Если жест не видно — из-за машины, груза или плохой видимости — включают световой сигнал не меньше чем за 30 м до поворота, перестроения или остановки (ст. 36).</div>
        <div class="nnote">💡 На практике: правая рука — это газ и передний тормоз. Сначала сбросьте газ, руль держите левой, жест — коротко.</div>
      </div>
      </div>
      <p class="muted small" style="text-align:center;margin-top:18px">Источник: Закон о дорожном движении 1979, ст. 24, 25, 36, 37; пособие DLT для мотоциклистов (2023)</p>`);
    $('#view').onclick = e => {
      if (e.target.closest('[data-act="ghide"]')) { S.gHide = !S.gHide; save(); const y = window.scrollY; screenGestures(); window.scrollTo(0, y); return; }
      const c = e.target.closest('[data-reveal]'); if (c && S.gHide) c.classList.toggle('shown');
    };
  }

  /* ---------- справка (traps.md + review.md) ---------- */
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const TRAP_TAG = { rep: ['🔁', 'ошибался несколько раз'], pin: ['📌', 'на повтор'], warn: ['⚠️', 'спорный ключ'] };
  let guideQuery = '';
  function screenGuide() {
    const G = window.GUIDE;
    chrome({ title: 'Справка', subtitle: 'Ловушки экзамена и отличия от ПДД РФ', tab: 'guide' });
    if (!G) { view('<div class="empty">Нет данных</div>'); return; }
    const errN = activeErrors().length;
    const trapCard = t => `<div class="card trap" id="t-${t.id}">
        <div class="trap-h"><b>${esc(t.title)}</b>${t.tag ? `<span class="ttag ttag-${t.tag}" title="${TRAP_TAG[t.tag][1]}">${TRAP_TAG[t.tag][0]} ${TRAP_TAG[t.tag][1]}</span>` : ''}</div>
        <div class="muted small">${esc(t.topic)}</div>
        ${t.imgs ? `<div class="trap-imgs">${t.imgs.map(([src, cap]) => `<figure>${img(src, 'trap-img', true)}<figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>` : ''}
        <ul class="trap-text">${t.text.map(x => `<li>${md(x)}</li>`).join('')}</ul></div>`;
    view(`
      <div class="chips nchips">${[['review', 'Что повторить'], ['ru', 'Отличия от РФ'], ['traps', 'Ловушки'], ['links', 'Шпаргалки']].map(([id, t]) => `<button class="chip" data-go="${id}">${t}</button>`).join('')}</div>

      <section class="nsec" id="n-review"><h2 class="nh">Что повторить</h2>
      ${G.retake.map(r => `<div class="card">
        <b>Пройти тему заново: ${esc(TOPIC[r.topic]?.ru || r.topic)}</b>
        <p class="muted small" style="margin:4px 0 10px">${esc(r.why)}. Сначала прочитать: ${r.read.map(id => `<a href="#" data-trap="${id}">${esc(G.traps.find(t => t.id === id)?.title || id)}</a>`).join(', ')}.</p>
        <button class="btn" data-retake="${r.topic}">Тест по теме · ${plural(sizeOf(D.questions.filter(q => q.t === r.topic).length), 'вопрос', 'вопроса', 'вопросов')}</button></div>`).join('')}
      <div class="card" style="margin-top:10px"><b>Мои ошибки</b>
        <p class="muted small" style="margin:4px 0 10px">${errN ? `Сейчас ${plural(errN, 'вопрос', 'вопроса', 'вопросов')} на повтор — включая отмеченные 📌 в ваших заметках.` : 'Активных ошибок нет.'}</p>
        <button class="btn ghost" data-go-hash="#errors">Открыть «Ошибки»</button></div>
      </section>

      <section class="nsec" id="n-ru"><h2 class="nh">Отличия от ПДД РФ<small>Только самые важные. На экзамене — по тайским правилам</small></h2>
      <div class="ru-list">${G.ru.map(([topic, th, ru]) => `<div class="card ru-row">
        <div class="ru-t">${esc(topic)}</div>
        <div class="ru-th"><span class="flag">🇹🇭</span><span>${md(th)}</span></div>
        <div class="ru-ru"><span class="flag">🇷🇺</span><span>${md(ru)}</span></div></div>`).join('')}</div>
      </section>

      <section class="nsec" id="n-traps"><h2 class="nh">Ловушки экзамена<small>Где ключ DLT неочевиден или вы ошибались</small></h2>
      <label class="search">${ICON.search}<input id="gq" type="search" placeholder="Поиск: HOV, бордюр, 15 дней…" autocomplete="off"></label>
      <div id="gtraps" class="stack"></div>
      </section>

      <section class="nsec" id="n-links"><h2 class="nh">Шпаргалки</h2>
      <div class="stack">
        <button class="card cat" data-go-hash="#gestures"><span class="sw sw-gest">✋</span><span class="t"><b>Жесты регулировщика и водителя</b><span>кто стоит, сигналы рукой, свисток</span></span><span class="chev">${ICON.chev}</span></button>
        <button class="card cat" data-go-hash="#numbers"><span class="sw sw-gest">🔢</span><span class="t"><b>Цифры</b><span>скорости, расстояния, сроки, штрафы</span></span><span class="chev">${ICON.chev}</span></button>
      </div></section>
      <p class="muted small" style="text-align:center;margin-top:18px">Источник: traps.md, review.md · Закон о дорожном движении 1979</p>`);
    const inp = $('#gq'); inp.value = guideQuery;
    const draw = () => {
      const q = guideQuery.trim().toLowerCase();
      const list = G.traps.filter(t => !q || [t.title, t.topic, ...t.text, ...(t.imgs || []).map(i => i[1])].join(' ').toLowerCase().includes(q));
      $('#gtraps').innerHTML = list.length ? list.map(trapCard).join('') : '<p class="muted">Ничего не найдено</p>';
    };
    draw();
    inp.oninput = () => { guideQuery = inp.value; draw(); };
    $('#view').onclick = e => {
      const g = e.target.closest('[data-go]'); if (g) { document.getElementById('n-' + g.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const t = e.target.closest('[data-trap]');
      if (t) { e.preventDefault(); if (guideQuery) { guideQuery = ''; inp.value = ''; draw(); } document.getElementById('t-' + t.dataset.trap)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const r = e.target.closest('[data-retake]'); if (r) { startQuiz('topics', pickFrom(D.questions.filter(q => q.t === r.dataset.retake).map(q => q.id))); return; }
      const h = e.target.closest('[data-go-hash]'); if (h) go(h.dataset.goHash);
    };
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
    if (h === '#gestures') return screenGestures();
    if (h === '#guide') return screenGuide();
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
