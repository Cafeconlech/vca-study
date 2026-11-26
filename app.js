/* 벤처투자분석사 암기 학습 앱
   흐름: 요약 읽기 → 빈칸 암기(간격 반복) → 관련 문제 → 다음 개념
   데이터는 data.enc.json(AES-GCM). 열쇠는 링크의 #k= 로 받아 이 기기에만 저장. 기록은 localStorage. */
'use strict';
const $ = s => document.querySelector(s);
const APP = $('#app');
const SUBJ = { 1: '1권 투자이해', 2: '2권 투자방법론', 3: '3권 회수이해' };
const KIND = { wrong: '오답 핵심', tax: '세금 별표', freq: '빈출' };
const INT = [0, 1, 3, 7, 14, 30];           // 빈칸 상자별 다음 복습까지 일수
const NUM = '①②③④⑤';
let D = null;                                 // 복호화된 데이터
let U = {}, Qm = {}, Cz = {};                 // id → 객체

// ---------- 저장소 ----------
const SKEY = 'vca_study_v1', KKEY = 'vca_key';
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
let S = (() => { try { return JSON.parse(ls(SKEY) || '{}'); } catch (e) { return {}; } })();
S.u = S.u || {}; S.c = S.c || {}; S.q = S.q || {}; S.mark = S.mark || {}; S.wrong = S.wrong || {}; S.opt = S.opt || {};
const save = () => ls(SKEY, JSON.stringify(S));
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 864e5); };

// ---------- 표시 도우미 ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>').replace(/\^\^(.+?)\^\^/g, '<b class="red">$1</b>');
const stars = n => n ? ' <span class="tag w">' + '★'.repeat(n) + '</span>' : '';
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function applyOpt() {
  document.documentElement.style.setProperty('--fs', (S.opt.fs || 16) + 'px');
  if (S.opt.theme) document.documentElement.setAttribute('data-theme', S.opt.theme); else document.documentElement.removeAttribute('data-theme');
}
applyOpt();

// ---------- 화면 전환(뒤로가기 지원) ----------
let cur = { v: 'home', p: {} }, depth = 0;
function go(v, p = {}, push = true) {
  cur = { v, p };
  if (push) { history.pushState(cur, '', location.pathname); depth++; }
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => { if (depth > 0) depth--; if (e.state && D) { cur = e.state; render(); } });
function goBack() { if (depth > 0) history.back(); else go('home', {}, false); }
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.go));
function hdr(title, back = true) {
  return '<div class="top">' + (back ? '<button class="ib" onclick="goBack()">←</button>' : '') + '<h1>' + esc(title) + '</h1>' +
    '<button class="ib" onclick="go(\'settings\')">⚙</button></div>';
}
function setNav(v) {
  $('#nav').hidden = false;
  const map = { home: 'home', study: 'study', subject: 'study', unit: 'study', review: 'review', cloze: 'review', quizMenu: 'quizMenu', quiz: 'quizMenu', stats: 'stats' };
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === map[v]));
}

// ---------- 학습 상태 계산 ----------
const unitDone = id => !!(S.u[id] && S.u[id].done);
const clozeDue = id => { const r = S.c[id]; return r && r.due <= today(); };
const dueList = () => D.clozes.filter(c => clozeDue(c.id));
const mastered = id => (S.c[id] && S.c[id].box >= 3);
function nextUnit(fromId) {
  const ids = D.units.map(u => u.id);
  let start = fromId ? ids.indexOf(fromId) + 1 : 0;
  for (let k = 0; k < ids.length; k++) { const id = ids[(start + k) % ids.length]; if (!unitDone(id)) return id; }
  return null;
}
function wrongIds() { return Object.keys(S.wrong).filter(id => S.wrong[id] && Qm[id]); }
const freshLeft = s => D.questions.filter(q => q.f.includes('n') && (!s || q.s === s) && !S.q[q.id]);
// 오답 + 안 푼 신규 문제를 번갈아 섞어 20개. 한 판 안에서는 같은 문제가 다시 나오지 않는다.
function freshMix(s) {
  const w = shuffle(wrongIds().map(id => Qm[id]).filter(q => !s || q.s === s)), n = shuffle(freshLeft(s)), out = [];
  while (out.length < 20 && (w.length || n.length)) { if (n.length) out.push(n.shift()); if (w.length && out.length < 20) out.push(w.shift()); }
  return out;
}
function qStat(list) { let n = 0, ok = 0; list.forEach(q => { const r = S.q[q.id]; if (r) { n++; if (r.last) ok++; } }); return { n, ok }; }

// ---------- 화면들 ----------
const V = {};

V.home = () => {
  const nu = nextUnit(S.last);
  const due = dueList().length;
  const doneN = D.units.filter(u => unitDone(u.id)).length;
  const wN = wrongIds().length;
  const kakao = /KAKAOTALK/i.test(navigator.userAgent);
  let h = hdr('벤처투자분석사 암기', false);
  if (kakao && !S.opt.hideKakao) h += '<div class="banner">카카오톡 안에서도 쓸 수 있어요. 기록은 <b>이 브라우저</b>에만 저장됩니다. 홈 화면에 앱처럼 두려면 ' +
    '<a href="kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href.split('#')[0] + '#k=' + (ls(KKEY) || '')) + '">기본 브라우저로 열기</a> → 홈 화면에 추가. ' +
    '<a href="#" onclick="S.opt.hideKakao=1;save();render();return false">닫기</a></div>';
  h += '<div class="card"><div class="sub">오늘 할 일</div>' +
    '<div class="row" style="margin-top:6px"><div class="sp"><div class="big">' + due + '</div><div class="sub">빈칸 복습</div></div>' +
    '<div class="sp"><div class="big">' + doneN + '<span class="sub">/' + D.units.length + '</span></div><div class="sub">요약 완료</div></div>' +
    '<div class="sp"><div class="big">' + wN + '</div><div class="sub">남은 오답</div></div></div>' +
    '<div class="bar"><i style="width:' + (100 * doneN / D.units.length).toFixed(1) + '%"></i></div>' +
    (nu ? '<button class="btn pri" onclick="go(\'unit\',{id:\'' + nu + '\',step:\'read\'})">이어서 학습 ▶ ' + esc(U[nu].title) + '</button>' : '<div class="sub">모든 요약을 한 번씩 끝냈어요. 빈칸 복습과 오답으로 다지세요.</div>') +
    ((wN || freshLeft().length) ? '<button class="btn pri" style="background:var(--no);border-color:var(--no)" onclick="go(\'quiz\',{set:\'fresh\'})">🔥 오답 + 새 핵심문제 20 (새 문제 ' + freshLeft().length + '개 남음)</button>' : '') +
    '<div class="grid2"><a class="btn" style="text-align:center;text-decoration:none" href="new/">🆕 새 핵심문제</a>' +
    '<a class="btn" style="text-align:center;text-decoration:none" href="mock/">📝 실전 모의고사</a></div>' +
    '<div class="grid2"><button class="btn" ' + (due ? '' : 'disabled') + ' onclick="go(\'cloze\',{set:\'due\'})">🧠 빈칸 복습 ' + due + '</button>' +
    '<button class="btn" ' + (wN ? '' : 'disabled') + ' onclick="go(\'quiz\',{set:\'wrong\'})">✍️ 오답 다시 ' + wN + '</button></div></div>';
  h += '<div class="card"><div class="sub" style="margin-bottom:4px">과목별</div>';
  for (const s of [1, 2, 3]) {
    const us = D.units.filter(u => u.subject === s), d = us.filter(u => unitDone(u.id)).length;
    h += '<button class="btn" onclick="go(\'subject\',{s:' + s + '})"><div class="row"><b class="sp">' + SUBJ[s] + '</b><span class="sub">' + d + '/' + us.length + '</span></div>' +
      '<div class="bar"><i style="width:' + (100 * d / us.length).toFixed(1) + '%"></i></div></button>';
  }
  h += '</div>';
  const diag = D.diagnosis.find(x => x.label === '예상 점수');
  if (diag) h += '<div class="card"><div class="sub">내 진단</div><div style="margin-top:4px">' + md(diag.text.split('\n')[0]) + '</div>' +
    '<button class="btn ghost" onclick="go(\'tips\')">진단·시험 요령 전체 보기 ›</button></div>';
  return h;
};

V.study = () => {
  let h = hdr('요약 학습');
  for (const s of [1, 2, 3]) {
    const us = D.units.filter(u => u.subject === s);
    const kinds = ['wrong', 'tax', 'freq'].filter(k => us.some(u => u.kind === k));
    h += '<div class="card"><b>' + SUBJ[s] + '</b>';
    kinds.forEach(k => {
      const ku = us.filter(u => u.kind === k), d = ku.filter(u => unitDone(u.id)).length;
      h += '<button class="btn" onclick="go(\'subject\',{s:' + s + ',k:\'' + k + '\'})"><div class="row"><span class="sp">' + KIND[k] + '</span><span class="sub">' + d + '/' + ku.length + '</span></div></button>';
    });
    h += '</div>';
  }
  h += '<div class="card"><button class="btn" onclick="go(\'tips\')">📌 진단 · 시험 요령 · 암기 한 줄</button></div>';
  return h;
};

V.subject = ({ s, k }) => {
  const us = D.units.filter(u => u.subject === s && (!k || u.kind === k));
  let h = hdr(SUBJ[s] + (k ? ' · ' + KIND[k] : ''));
  const firstUndone = us.find(u => !unitDone(u.id));
  if (firstUndone) h += '<button class="btn pri" onclick="go(\'unit\',{id:\'' + firstUndone.id + '\',step:\'read\'})">여기서부터 이어서 ▶</button>';
  let g = '';
  h += '<div class="card list">';
  us.forEach(u => {
    if (u.group !== g) { g = u.group; h += '<div class="grp">' + esc(g) + '</div>'; }
    const nm = D.clozes.filter(c => c.u === u.id).filter(c => mastered(c.id)).length;
    h += '<div class="it" onclick="go(\'unit\',{id:\'' + u.id + '\',step:\'read\'})"><span>' + (unitDone(u.id) ? '✅' : '⬜') + '</span>' +
      '<span class="t">' + esc(u.title) + stars(u.stars) + '<br><span class="sub">빈칸 ' + nm + '/' + u.nCloze + ' · 문제 ' + u.qs.length + (S.mark['u' + u.id] ? ' · ★저장' : '') + '</span></span><span class="sub">›</span></div>';
  });
  return h + '</div>';
};

// 요약 → 빈칸 → 문제 → 완료
V.unit = ({ id, step, i }) => {
  const u = U[id];
  S.last = id; save();
  const cz = D.clozes.filter(c => c.u === id);
  // 예전에(오늘 이전) 이미 맞힌 문제는 요약 단계에서 다시 내지 않는다 → 반복 줄이기
  const qs = u.qs.map(x => Qm[x]).filter(Boolean).filter(q => { const r = S.q[q.id]; return !(r && r.last && (r.day || '') < today()); });
  const steps = ['read', 'cloze', 'quiz', 'done'];
  const label = { read: '① 요약', cloze: '② 빈칸 ' + cz.length, quiz: '③ 문제 ' + qs.length, done: '완료' };
  let h = hdr(u.title) + '<div class="steps">' + steps.map(s => '<span class="' + (s === step ? 'on' : '') + '">' + label[s] + '</span>').join('') + '</div>';
  if (step === 'read') {
    h += '<div class="card"><div><span class="tag">' + SUBJ[u.subject] + '</span><span class="tag">' + esc(u.group) + '</span>' + stars(u.stars) + '</div>' +
      '<h2 style="font-size:1.15em;margin:8px 0 4px">' + esc(u.title) + '</h2><ul class="pts">' + u.lines.map(l => '<li>' + md(l) + '</li>').join('') + '</ul>' +
      (u.trap ? '<div class="trap">⚠ ' + md(u.trap) + '</div>' : '') +
      '<div class="src">' + esc([u.src, u.why].filter(Boolean).join(' · ')) + (u.verified === false ? ' · 원문 미확인' : '') + '</div></div>';
    h += '<div class="row"><button class="btn ghost" style="width:auto" onclick="toggleMark(\'u' + id + '\')">' + (S.mark['u' + id] ? '★ 저장됨' : '☆ 저장') + '</button><span class="sp"></span></div>';
    if (cz.length) h += '<button class="btn pri" onclick="go(\'unit\',{id:\'' + id + '\',step:\'cloze\',i:0},false)">빈칸으로 외우기 (' + cz.length + ') ▶</button>';
    else if (qs.length) h += '<button class="btn pri" onclick="go(\'unit\',{id:\'' + id + '\',step:\'quiz\',i:0},false)">관련 문제 풀기 (' + qs.length + ') ▶</button>';
    else h += '<button class="btn pri" onclick="finishUnit(\'' + id + '\')">다 외웠어요 ✓</button>';
    return h;
  }
  if (step === 'cloze') {
    const c = cz[i || 0];
    h += clozeCard(c, (i || 0) + 1, cz.length, ok => {
      gradeCloze(c.id, ok);
      const ni = (i || 0) + 1;
      if (ni < cz.length) go('unit', { id, step: 'cloze', i: ni }, false);
      else if (qs.length) go('unit', { id, step: 'quiz', i: 0 }, false);
      else finishUnit(id);
    });
    h += '<div class="sub center">빈칸을 떠올린 뒤 정답을 확인하고, 스스로 채점하세요.</div>';
    return h;
  }
  if (step === 'quiz') {
    const qi = i || 0;
    if (!qs[qi]) { setTimeout(() => finishUnit(id)); return h; }
    h += mcqCard(qs[qi], qi + 1, qs.length, () => {
      if (qi + 1 < qs.length) go('unit', { id, step: 'quiz', i: qi + 1 }, false);
      else finishUnit(id);
    }, true);
    return h;
  }
  // done
  const nu = nextUnit(id);
  const ok = qs.filter(q => S.q[q.id] && S.q[q.id].last).length;
  h += '<div class="card center"><div class="big">✅ 완료</div><div class="sub">빈칸 ' + cz.length + '개 · 문제 ' + ok + '/' + qs.length + ' 정답</div>' +
    '<div class="sub" style="margin-top:6px">틀린 빈칸은 내일·3일·7일 뒤 "빈칸 복습"에 다시 나옵니다.</div></div>' +
    (nu ? '<button class="btn pri" onclick="go(\'unit\',{id:\'' + nu + '\',step:\'read\'})">다음 개념 ▶ ' + esc(U[nu].title) + '</button>' : '') +
    '<button class="btn" onclick="go(\'unit\',{id:\'' + id + '\',step:\'read\'})">요약 다시 보기</button>' +
    '<button class="btn ghost" onclick="go(\'subject\',{s:' + u.subject + ',k:\'' + u.kind + '\'})">목록으로</button>';
  return h;
};
function finishUnit(id) { S.u[id] = Object.assign(S.u[id] || {}, { done: today() }); save(); go('unit', { id, step: 'done' }, false); }
function toggleMark(k) { if (S.mark[k]) delete S.mark[k]; else S.mark[k] = 1; save(); render(); }

// 빈칸 카드
let czCb = null;
function clozeCard(c, n, total, cb) {
  czCb = cb;
  const u = U[c.u];
  const html = c.parts.map(p => p.b !== undefined ? '<span class="blank">' + esc(p.b) + '</span>' : md(p.t)).join('');
  const r = S.c[c.id];
  return '<div class="card"><div class="row"><span class="tag">' + esc(u.title) + '</span><span class="sp"></span><span class="sub">' + n + '/' + total + (r ? ' · 상자 ' + r.box : ' · 처음') + '</span></div>' +
    '<div class="cz" id="cz" style="margin-top:8px">' + html + '</div></div>' +
    '<div id="czBtns"><button class="btn pri" onclick="revealCloze()">정답 보기</button></div>';
}
function revealCloze() {
  document.querySelectorAll('#cz .blank').forEach(b => b.classList.add('show'));
  $('#czBtns').innerHTML = '<div class="grid2"><button class="btn" style="text-align:center;border-color:var(--no)" onclick="czCb(false)">✗ 몰랐어요</button>' +
    '<button class="btn" style="text-align:center;border-color:var(--ok)" onclick="czCb(true)">✓ 알았어요</button></div>';
}
function gradeCloze(id, ok) {
  const r = S.c[id] || { box: 0 };
  r.box = ok ? Math.min(5, r.box + 1) : 1;
  r.due = today() + (ok ? INT[r.box] : 0);
  r.seen = (r.seen || 0) + 1;
  S.c[id] = r; save();
}

// 5지선다 카드
let mcqCb = null, mcqLocked = false;
function mcqCard(q, n, total, cb, inUnit) {
  mcqCb = cb; mcqLocked = false;
  const tags = (q.f.includes('n') ? '<span class="tag no">🔥 신규</span>' : '') + (q.f.includes('o') ?'<span class="tag w">공식기출</span>' : '') + (q.f.includes('x') ? '<span class="tag">실전</span>' : '') + (q.f.includes('l') ? '<span class="tag">강의예상</span>' : '') +
    (S.wrong[q.id] ? '<span class="tag no">내 오답</span>' : '');
  window.__q = q; window.__inUnit = inUnit;
  return '<div class="card"><div class="row"><span class="sub">' + n + '/' + total + ' · ' + SUBJ[q.s] + ' ' + esc(q.n || '') + '</span><span class="sp"></span>' + tags + '</div>' +
    '<div class="q">' + esc(q.q) + '</div>' + q.c.map((c, k) => '<button class="ch" data-k="' + (k + 1) + '" onclick="answer(' + (k + 1) + ')">' + NUM[k] + ' ' + esc(c) + '</button>').join('') +
    '<div id="qx"></div></div>';
}
function answer(k) {
  if (mcqLocked) return; mcqLocked = true;
  const q = window.__q, ok = k === q.a;
  document.querySelectorAll('.ch').forEach(b => { const kk = +b.dataset.k; if (kk === q.a) b.classList.add('ok'); else if (kk === k) b.classList.add('no'); });
  const r = S.q[q.id] || { n: 0, ok: 0 }; r.n++; if (ok) r.ok++; r.last = ok; r.day = today(); S.q[q.id] = r;
  if (ok) delete S.wrong[q.id]; else S.wrong[q.id] = 1;
  save();
  const link = (!window.__inUnit && q.u && U[q.u]) ? '<button class="btn" onclick="go(\'unit\',{id:\'' + q.u + '\',step:\'read\'})">📘 관련 요약 보기: ' + esc(U[q.u].title) + '</button>' : '';
  $('#qx').innerHTML = '<div class="ex"><b>' + (ok ? '정답 ✓' : '오답 ✗ · 정답 ' + NUM[q.a - 1]) + '</b>\n' + esc(q.e) + (q.p ? '\n(교재 PDF ' + q.p + '쪽 부근)' : '') + '</div>' + link +
    '<div class="row"><button class="btn ghost" style="width:auto" onclick="toggleMark(\'q' + q.id + '\')">' + (S.mark['q' + q.id] ? '★ 저장됨' : '☆ 저장') + '</button><span class="sp"></span></div>' +
    '<button class="btn pri" onclick="mcqCb()">다음 ▶</button>';
  $('#qx').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 빈칸 복습
V.review = () => {
  const due = dueList().length, seen = Object.keys(S.c).length, ms = D.clozes.filter(c => mastered(c.id)).length;
  let h = hdr('빈칸 암기');
  h += '<div class="card"><div class="row"><div class="sp"><div class="big">' + due + '</div><div class="sub">오늘 복습</div></div><div class="sp"><div class="big">' + seen + '</div><div class="sub">본 빈칸</div></div>' +
    '<div class="sp"><div class="big">' + ms + '</div><div class="sub">외운 빈칸(상자3↑)</div></div></div>' +
    '<button class="btn pri" ' + (due ? '' : 'disabled') + ' onclick="go(\'cloze\',{set:\'due\'})">오늘 복습 시작 (' + due + ')</button>' +
    '<div class="sub">틀리면 상자 1로 돌아가고, 맞히면 1·3·7·14·30일 뒤에 다시 나옵니다.</div></div>';
  h += '<div class="card"><div class="sub">새 빈칸 연습 (20개씩)</div>';
  for (const s of [1, 2, 3]) {
    const n = D.clozes.filter(c => U[c.u].subject === s && !S.c[c.id]).length;
    h += '<button class="btn" ' + (n ? '' : 'disabled') + ' onclick="go(\'cloze\',{set:\'new\',s:' + s + '})">' + SUBJ[s] + ' · 안 본 빈칸 ' + n + '</button>';
  }
  h += '<button class="btn" onclick="go(\'cloze\',{set:\'weak\'})">자주 틀리는 빈칸 (상자 1~2)</button></div>';
  return h;
};
let czSession = null;
V.cloze = ({ set, s }) => {
  if (!czSession || czSession.key !== JSON.stringify(cur.p)) {
    let list;
    if (set === 'due') list = shuffle(dueList());
    else if (set === 'new') list = D.clozes.filter(c => U[c.u].subject === s && !S.c[c.id]).slice(0, 20);
    else list = shuffle(D.clozes.filter(c => S.c[c.id] && S.c[c.id].box <= 2)).slice(0, 20);
    czSession = { key: JSON.stringify(cur.p), list, i: 0, ok: 0 };
  }
  const ss = czSession;
  let h = hdr('빈칸 ' + (set === 'due' ? '복습' : set === 'new' ? '새 연습' : '약한 빈칸'));
  if (!ss.list.length) return h + '<div class="card center sub">해당하는 빈칸이 없어요.</div>';
  if (ss.i >= ss.list.length) {
    const done = ss.list.length; czSession = null;
    return h + '<div class="card center"><div class="big">' + ss.ok + '/' + done + '</div><div class="sub">알았어요 비율</div></div><button class="btn pri" onclick="go(\'review\')">빈칸 홈으로</button>';
  }
  const c = ss.list[ss.i];
  h += clozeCard(c, ss.i + 1, ss.list.length, ok => { gradeCloze(c.id, ok); if (ok) ss.ok++; ss.i++; render(); window.scrollTo(0, 0); });
  h += '<button class="btn ghost" onclick="go(\'unit\',{id:\'' + c.u + '\',step:\'read\'})">📘 이 요약 전체 보기</button>';
  return h;
};

// 문제
V.quizMenu = () => {
  let h = hdr('문제 풀기');
  const wN = wrongIds().length, mN = Object.keys(S.mark).filter(k => k[0] === 'q').length;
  h += '<div class="card"><button class="btn pri" style="background:var(--no);border-color:var(--no)" ' + ((wN || freshLeft().length) ? '' : 'disabled') + ' onclick="go(\'quiz\',{set:\'fresh\'})">🔥 오답 + 새 핵심문제 20</button>' +
    '<div class="sub">안 푼 새 문제와 남은 오답을 번갈아 냅니다. 맞히면 빠지고, 틀리면 오답으로 남습니다.</div>' +
    '<button class="btn" ' + (wN ? '' : 'disabled') + ' onclick="go(\'quiz\',{set:\'wrong\'})">✍️ 내 오답만 다시 풀기 (' + wN + ')</button>' +
    '<button class="btn" ' + (mN ? '' : 'disabled') + ' onclick="go(\'quiz\',{set:\'mark\'})">★ 저장한 문제 (' + mN + ')</button></div>';
  for (const s of [1, 2, 3]) {
    const all = D.questions.filter(q => q.s === s), st = qStat(all);
    h += '<div class="card"><div class="row"><b class="sp">' + SUBJ[s] + '</b><span class="sub">푼 ' + st.n + '/' + all.length + ' · 정답 ' + (st.n ? Math.round(100 * st.ok / st.n) : 0) + '%</span></div>' +
      '<div class="grid2" style="margin-top:6px"><button class="btn" onclick="go(\'quiz\',{set:\'rand\',s:' + s + '})">랜덤 10</button>' +
      '<button class="btn" onclick="go(\'quiz\',{set:\'exam\',s:' + s + '})">실전 20</button>' +
      '<button class="btn" onclick="go(\'quiz\',{set:\'new\',s:' + s + '})">안 푼 문제</button>' +
      '<button class="btn" onclick="go(\'quiz\',{set:\'off\',s:' + s + '})">공식 기출</button>' +
      '<button class="btn" style="grid-column:1/-1" ' + ((freshLeft(s).length || wrongIds().some(id => Qm[id].s === s)) ? '' : 'disabled') + ' onclick="go(\'quiz\',{set:\'fresh\',s:' + s + '})">🔥 오답 + 새 핵심 (새 ' + freshLeft(s).length + ')</button></div></div>';
  }
  return h;
};
let qSession = null;
V.quiz = ({ set, s }) => {
  if (!qSession || qSession.key !== JSON.stringify(cur.p)) {
    let list;
    const sub = D.questions.filter(q => !s || q.s === s);
    if (set === 'fresh') list = freshMix(s);
    else if (set === 'wrong') list = shuffle(wrongIds().map(id => Qm[id]));
    else if (set === 'mark') list = Object.keys(S.mark).filter(k => k[0] === 'q').map(k => Qm[k.slice(1)]).filter(Boolean);
    else if (set === 'exam') list = sub.filter(q => q.f.includes('x'));
    else if (set === 'off') list = sub.filter(q => q.f.includes('o'));
    else if (set === 'new') list = shuffle(sub.filter(q => !S.q[q.id])).slice(0, 10);
    else list = shuffle(sub).slice(0, 10);
    qSession = { key: JSON.stringify(cur.p), list, i: 0, ok: 0, wrong: [] };
  }
  const ss = qSession;
  const name = { fresh: '오답 + 새 핵심', wrong: '내 오답', mark: '저장한 문제', exam: '실전 20', off: '공식 기출', new: '안 푼 문제', rand: '랜덤 10' }[set];
  let h = hdr((s ? SUBJ[s] + ' · ' : '') + name);
  if (!ss.list.length) return h + '<div class="card center sub">해당하는 문제가 없어요.</div>';
  if (ss.i >= ss.list.length) {
    const n = ss.list.length, ok = ss.list.filter(q => S.q[q.id] && S.q[q.id].last).length; qSession = null;
    const pct = Math.round(100 * ok / n);
    return h + '<div class="card center"><div class="big">' + ok + '/' + n + '</div><div class="sub">' + pct + '점 · 합격선은 과목당 40점↑, 평균 70점↑</div></div>' +
      ((set === 'fresh' && (freshLeft(s).length || wrongIds().length)) ? '<button class="btn pri" style="background:var(--no);border-color:var(--no)" onclick="qSession=null;go(\'quiz\',{set:\'fresh\'' + (s ? ',s:' + s : '') + ',t:Date.now()},false)">🔥 다음 20문제</button>' : '') +
      '<button class="btn pri" onclick="go(\'quizMenu\')">문제 홈으로</button>' + (wrongIds().length ? '<button class="btn" onclick="go(\'quiz\',{set:\'wrong\'})">오답 다시 풀기</button>' : '');
  }
  h += mcqCard(ss.list[ss.i], ss.i + 1, ss.list.length, () => { ss.i++; render(); window.scrollTo(0, 0); }, false);
  return h;
};

V.stats = () => {
  let h = hdr('학습 기록');
  for (const s of [1, 2, 3]) {
    const us = D.units.filter(u => u.subject === s), cz = D.clozes.filter(c => U[c.u].subject === s), qs = D.questions.filter(q => q.s === s), st = qStat(qs);
    const ud = us.filter(u => unitDone(u.id)).length, cm = cz.filter(c => mastered(c.id)).length;
    h += '<div class="card"><b>' + SUBJ[s] + '</b>' +
      '<div class="sub" style="margin-top:6px">요약 ' + ud + '/' + us.length + '</div><div class="bar"><i style="width:' + (100 * ud / us.length) + '%"></i></div>' +
      '<div class="sub">외운 빈칸 ' + cm + '/' + cz.length + '</div><div class="bar"><i style="width:' + (100 * cm / Math.max(1, cz.length)) + '%"></i></div>' +
      '<div class="sub">문제 정답률 ' + (st.n ? Math.round(100 * st.ok / st.n) : 0) + '% (푼 ' + st.n + '/' + qs.length + ') · 남은 오답 ' + wrongIds().filter(id => Qm[id].s === s).length + '</div></div>';
  }
  const wl = wrongIds();
  h += '<div class="card"><b>내 오답 번호 내보내기</b><div class="sub" style="margin-top:4px">복사해서 Claude 채팅에 붙여 넣으면, 그 개념으로 새 문제를 만들어 드려요. 문제 번호만 담깁니다.</div>' +
    '<button class="btn pri" ' + (wl.length ? '' : 'disabled') + ' onclick="copyWrong()">📋 내 오답 번호 복사 (' + wl.length + ')</button><div id="wout"></div></div>';
  h += '<div class="card sub">기록은 이 기기의 이 브라우저에만 저장됩니다. 카카오톡과 크롬은 기록이 따로 쌓여요.</div>';
  return h;
};

function copyWrong() {
  const by = { 1: [], 2: [], 3: [] };
  wrongIds().forEach(id => { const q = Qm[id], r = S.q[id]; by[q.s].push(id + (r ? '(' + r.n + '회 중 ' + (r.n - r.ok) + '오답)' : '(시드)')); });
  const txt = '앱 오답 ' + today() + '\n' + [1, 2, 3].map(s => s + '권 ' + by[s].length + '개: ' + by[s].join(', ')).join('\n');
  const show = msg => { $('#wout').innerHTML = '<div class="sub" style="margin:6px 0">' + msg + '</div><textarea readonly style="width:100%;height:140px;font:inherit;font-size:.8em" onclick="this.select()">' + esc(txt) + '</textarea>'; };
  try { navigator.clipboard.writeText(txt).then(() => show('복사했어요. 채팅에 붙여 넣으세요.'), () => show('자동 복사가 막혔어요. 아래 글을 길게 눌러 전체 선택 → 복사하세요.')); }
  catch (e) { show('아래 글을 길게 눌러 전체 선택 → 복사하세요.'); }
}

V.tips = () => {
  let h = hdr('진단 · 시험 요령');
  h += '<div class="card"><b>진단</b>' + D.diagnosis.map(d => '<div style="margin-top:8px"><span class="tag">' + esc(d.label) + '</span><div>' + d.text.split('\n').map(md).join('<br>') + '</div></div>').join('') + '</div>';
  h += '<div class="card"><b>암기 한 줄</b>' + D.oneLiners.map(o => '<div style="margin-top:8px">' + md(o.text) + '</div>').join('') + '</div>';
  h += '<div class="card"><b>시험 당일 요령</b><ul class="pts">' + D.tips.map(t => '<li>' + md(t) + '</li>').join('') + '</ul></div>';
  return h;
};

V.settings = () => {
  let h = hdr('설정');
  h += '<div class="card"><b>글자 크기</b><div class="grid2" style="margin-top:8px"><button class="btn" onclick="setFs(-1)">가 작게</button><button class="btn" onclick="setFs(1)">가 크게</button></div>' +
    '<div class="sub">현재 ' + (S.opt.fs || 16) + 'px</div></div>';
  h += '<div class="card"><b>화면</b><div class="grid2" style="margin-top:8px"><button class="btn" onclick="setTheme(\'light\')">밝게</button><button class="btn" onclick="setTheme(\'dark\')">어둡게</button></div>' +
    '<button class="btn ghost" onclick="setTheme(\'\')">기기 설정 따르기</button></div>';
  h += '<div class="card"><b>홈 화면에 추가</b><div class="sub" style="margin-top:6px">크롬: 메뉴 ⋮ → 홈 화면에 추가 / 사파리: 공유 □↑ → 홈 화면에 추가. 카카오톡 안에서는 오른쪽 위 메뉴 → 다른 브라우저로 열기 후 추가하세요.</div></div>';
  h += '<div class="card"><b>기록</b><button class="btn" onclick="if(confirm(\'빈칸·문제·요약 기록을 모두 지울까요?\')){S={u:{},c:{},q:{},mark:{},wrong:{},opt:S.opt};seedWrong(true);save();go(\'home\')}">학습 기록 초기화</button>' +
    '<div class="sub">데이터 기준일 ' + esc(D.built) + '</div></div>';
  return h;
};
function setFs(d) { S.opt.fs = Math.max(13, Math.min(22, (S.opt.fs || 16) + d)); save(); applyOpt(); render(); }
function setTheme(t) { S.opt.theme = t || undefined; save(); applyOpt(); render(); }

function render() {
  const f = V[cur.v] || V.home;
  APP.innerHTML = f(cur.p || {});
  setNav(cur.v);
}

// ---------- 잠금 해제(복호화) ----------
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(pass) {
  const res = await fetch('data.enc.json', { cache: 'no-cache' });
  const e = await res.json();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(e.salt), iterations: e.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(e.iv) }, key, b64(e.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function lockScreen(msg) {
  $('#nav').hidden = true;
  APP.innerHTML = '<div class="top"><h1>벤처투자분석사 암기</h1></div><div class="card"><b>열쇠가 필요해요</b>' +
    '<div class="sub" style="margin:6px 0 10px">카카오톡으로 받은 링크를 눌러 들어오면 자동으로 열립니다. 직접 입력하려면 링크의 <code>#k=</code> 뒤 글자를 넣으세요.</div>' +
    (msg ? '<div class="banner">' + esc(msg) + '</div>' : '') +
    '<input type="password" id="kin" placeholder="열쇠" autocomplete="off"><button class="btn pri" onclick="unlock($(\'#kin\').value.trim())">열기</button></div>';
}
function seedWrong(force) {
  if (S.seeded && !force) return;
  (D.wrongSeed || []).forEach(id => { if (Qm[id]) S.wrong[id] = 1; });
  S.seeded = 1; save();
}
async function unlock(pass) {
  if (!pass) return lockScreen('열쇠를 입력하세요.');
  APP.innerHTML = '<div class="card center sub">여는 중…</div>';
  try {
    D = await decrypt(pass);
  } catch (e) {
    ls(KKEY, null);
    return lockScreen(navigator.onLine === false ? '인터넷 연결을 확인하세요.' : '열쇠가 맞지 않아요.');
  }
  ls(KKEY, pass);
  U = Object.fromEntries(D.units.map(u => [u.id, u]));
  Qm = Object.fromEntries(D.questions.map(q => [q.id, q]));
  seedWrong(false);
  history.replaceState({ v: 'home', p: {} }, '', location.pathname);
  cur = { v: 'home', p: {} };
  render();
}
(function boot() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (m) ls(KKEY, decodeURIComponent(m[1]));
  const k = ls(KKEY);
  if (k) unlock(k); else lockScreen();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
