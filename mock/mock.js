/* 벤처투자분석사 실전 모의고사 1~3회
   60문항(1권 1~20, 2권 21~40, 3권 41~60) · 70분. 마킹만 하고 제출하면 채점 → 그 다음에 해설을 볼 수 있다.
   데이터는 data.enc.json(AES-GCM). 열쇠는 본 학습앱과 같다. 기록은 이 브라우저 localStorage. */
'use strict';
const $ = s => document.querySelector(s);
const APP = $('#app'), FOOT = $('#foot'), FIN = $('#footIn');
const SUBJ = { 1: '1권 투자이해', 2: '2권 투자방법론', 3: '3권 회수이해' };
const NUM = '①②③④⑤';
const SKEY = 'vca_mock_v1', KKEY = 'vca_key';
let D = null;
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
let S = (() => { try { return JSON.parse(ls(SKEY) || '{}'); } catch (e) { return {}; } })();
S.r = S.r || {}; S.opt = S.opt || {};
const save = () => ls(SKEY, JSON.stringify(S));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function applyOpt() { document.documentElement.style.setProperty('--fs', (S.opt.fs || 16) + 'px'); }
function setFs(d) { S.opt.fs = Math.max(13, Math.min(22, (S.opt.fs || 16) + d)); save(); applyOpt(); }

const R = r => D.rounds[r] || [];
const st = r => S.r[r];
const marked = r => Object.keys((st(r) || {}).ans || {}).length;

let view = { v: 'home' }, tick = null;
function go(v) { view = v; stopTick(); if (v.v === 'exam') startTick(); render(); window.scrollTo(0, 0); }

// ---------- 타이머: 시험 화면이 열려 있을 때만 줄어든다 ----------
function startTick() {
  stopTick();
  tick = setInterval(() => {
    const x = st(view.r); if (!x || x.done) return stopTick();
    x.left -= 1; if (x.left % 5 === 0) save();
    const el = $('#tm'); if (el) { el.textContent = '⏱ ' + mmss(x.left); el.classList.toggle('low', x.left <= 300); }
    if (x.left <= 0) { save(); stopTick(); alert('시험 시간이 끝났습니다. 자동으로 제출합니다.'); submit(view.r, true); }
  }, 1000);
}
function stopTick() { if (tick) clearInterval(tick); tick = null; }
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- 홈 ----------
function home() {
  let h = '<div class="top"><h1>📝 실전 모의고사</h1><button class="ib" onclick="setFs(-1)">가-</button><button class="ib" onclick="setFs(1)">가+</button></div>';
  h += '<div class="card sub">회차마다 60문항(1권 1~20 · 2권 21~40 · 3권 41~60), 제한시간 ' + D.minutes + '분. 풀 때는 정답이 보이지 않고, <b>제출해야 채점</b>되며 그 뒤에 해설을 볼 수 있어요. 합격 기준: 과목별 40점 이상 + 평균 70점 이상.</div>';
  for (const r of [1, 2, 3]) {
    const x = st(r), n = R(r).length;
    h += '<div class="card"><div class="row"><b class="sp" style="font-size:1.1em">' + r + '회 모의고사</b>';
    if (!n) { h += '<span class="sub">준비 중</span></div></div>'; continue; }
    if (!x) h += '<span class="tag">미응시</span></div><button class="btn pri" onclick="begin(' + r + ')">시험 시작 (' + n + '문항 · ' + D.minutes + '분)</button>';
    else if (!x.done) h += '<span class="tag flag">진행 중</span></div><div class="sub">마킹 ' + marked(r) + '/' + n + ' · 남은 시간 ' + mmss(x.left) + '</div>' +
      '<button class="btn pri" onclick="go({v:\'exam\',r:' + r + ',i:' + (x.i || 0) + '})">이어서 풀기</button>';
    else {
      const sc = x.score;
      h += '<span class="tag ' + (sc.pass ? 'ok' : 'no') + '">' + (sc.pass ? '합격' : '불합격') + '</span></div>' +
        '<div class="row" style="margin-top:4px"><div class="sp"><div class="big">' + sc.avg.toFixed(1) + '</div><div class="sub">평균</div></div>' +
        [1, 2, 3].map(s => '<div class="sp"><div class="big" style="font-size:1.25em">' + sc.sub[s] + '</div><div class="sub">' + s + '권</div></div>').join('') + '</div>' +
        '<div class="grid2" style="margin-top:8px"><button class="btn pri" onclick="go({v:\'result\',r:' + r + '})">결과 보기</button><button class="btn" onclick="go({v:\'review\',r:' + r + ',f:\'no\',k:0})">틀린 문제 해설</button></div>';
    }
    if (x) h += '<button class="btn ghost" onclick="if(confirm(\'' + r + '회 기록을 지우고 처음부터 다시 볼까요?\')){delete S.r[' + r + '];save();render()}">다시 응시하기</button>';
    h += '</div>';
  }
  h += '<div class="card"><a class="btn ghost" href="../">← 요약·빈칸 학습 앱</a><a class="btn ghost" href="../new/">🔥 새 핵심문제 앱</a></div>';
  return h;
}
function begin(r) {
  S.r[r] = { ans: {}, flag: {}, left: D.minutes * 60, i: 0, started: Date.now(), done: false };
  save(); go({ v: 'exam', r, i: 0 });
}

// ---------- 시험 ----------
function exam() {
  const { r } = view, x = st(r), L = R(r);
  const i = Math.max(0, Math.min(L.length - 1, view.i)); view.i = i; x.i = i;
  const q = L[i], my = x.ans[q.id];
  let h = '<div class="top"><button class="ib" onclick="save();go({v:\'home\'})">✕</button><h1>' + r + '회 · ' + (i + 1) + '/' + L.length + '</h1>' +
    '<span class="timer' + (x.left <= 300 ? ' low' : '') + '" id="tm">⏱ ' + mmss(x.left) + '</span><button class="ib" onclick="go({v:\'sheet\',r:' + r + '})">답안지</button></div>';
  h += '<div class="card"><div class="row"><span class="tag">' + SUBJ[q.s] + '</span><span class="sp"></span>' +
    '<button class="ib" style="height:32px;' + (x.flag[q.id] ? 'background:var(--flagS);color:var(--flag);border-color:var(--flag)' : '') + '" onclick="toggleFlag()">' + (x.flag[q.id] ? '🚩 헷갈림' : '🏳 헷갈림 표시') + '</button></div>' +
    '<div class="q">' + (i + 1) + '. ' + esc(q.q) + '</div>' +
    q.c.map((c, k) => '<button class="ch' + (my === k + 1 ? ' sel' : '') + '" onclick="mark(' + (k + 1) + ')">' + NUM[k] + ' ' + esc(c) + '</button>').join('') + '</div>';
  h += '<div class="sub center">마킹 ' + marked(r) + '/' + L.length + ' · 답은 언제든 바꿀 수 있어요</div>';
  FOOT.hidden = false;
  FIN.innerHTML = '<button class="btn" ' + (i ? '' : 'disabled') + ' onclick="move(-1)">◀ 이전</button>' +
    (i < L.length - 1 ? '<button class="btn pri" onclick="move(1)">다음 ▶</button>' : '<button class="btn warn" onclick="go({v:\'sheet\',r:' + r + '})">답안지 · 제출</button>');
  return h;
}
function mark(k) { const x = st(view.r), q = R(view.r)[view.i]; if (x.ans[q.id] === k) delete x.ans[q.id]; else x.ans[q.id] = k; save(); render(); }
function toggleFlag() { const x = st(view.r), q = R(view.r)[view.i]; if (x.flag[q.id]) delete x.flag[q.id]; else x.flag[q.id] = 1; save(); render(); }
function move(d) { view.i += d; save(); render(); window.scrollTo(0, 0); }

function omr(r, mode) {
  const x = st(r), L = R(r);
  let h = '';
  for (const s of [1, 2, 3]) {
    h += '<div class="omrh">' + SUBJ[s] + '</div><div class="omr">';
    L.forEach((q, i) => {
      if (q.s !== s) return;
      let c = '';
      if (mode === 'exam') c = (x.ans[q.id] ? 'm' : '') + (x.flag[q.id] ? ' f' : '') + (i === x.i ? ' cur' : '');
      else c = (x.ans[q.id] === q.a ? 'ok' : 'no') + (x.flag[q.id] ? ' f' : '');
      const lab = mode === 'exam' && x.ans[q.id] ? (i + 1) + '<br>' + NUM[x.ans[q.id] - 1] : (i + 1);
      h += '<button class="' + c + '" style="line-height:1.1" onclick="' + (mode === 'exam' ? 'go({v:\'exam\',r:' + r + ',i:' + i + '})' : 'go({v:\'review\',r:' + r + ',f:\'all\',k:' + i + '})') + '">' + lab + '</button>';
    });
    h += '</div>';
  }
  return h;
}
function sheet() {
  const { r } = view, x = st(r), L = R(r), un = L.length - marked(r), fl = Object.keys(x.flag).length;
  let h = '<div class="top"><button class="ib" onclick="go({v:\'exam\',r:' + r + ',i:' + (x.i || 0) + '})">←</button><h1>' + r + '회 답안지</h1><span class="timer">⏱ ' + mmss(x.left) + '</span></div>';
  h += '<div class="card"><div class="row"><div class="sp"><div class="big">' + marked(r) + '</div><div class="sub">마킹</div></div><div class="sp"><div class="big" style="color:var(--no)">' + un + '</div><div class="sub">안 한 문항</div></div>' +
    '<div class="sp"><div class="big" style="color:var(--flag)">' + fl + '</div><div class="sub">🚩 헷갈림</div></div></div>' + omr(r, 'exam') +
    '<div class="sub">번호를 누르면 그 문제로 갑니다. 주황 점은 헷갈림 표시.</div></div>';
  h += '<button class="btn warn" onclick="submit(' + r + ')">제출하고 채점하기</button>';
  FOOT.hidden = true;
  return h;
}
function submit(r, auto) {
  const x = st(r), L = R(r), un = L.length - marked(r);
  if (!auto && !confirm((un ? '안 한 문항이 ' + un + '개 있어요(0점 처리). ' : '') + '제출하면 답을 바꿀 수 없어요. 제출할까요?')) return;
  const sub = {};
  for (const s of [1, 2, 3]) { const l = L.filter(q => q.s === s); sub[s] = Math.round(100 * l.filter(q => x.ans[q.id] === q.a).length / Math.max(1, l.length)); }
  const avg = (sub[1] + sub[2] + sub[3]) / 3;
  x.score = { sub, avg, ok: L.filter(q => x.ans[q.id] === q.a).length, pass: avg >= 70 && [1, 2, 3].every(s => sub[s] >= 40) };
  x.done = true; x.used = D.minutes * 60 - x.left; x.at = Date.now();
  save(); go({ v: 'result', r });
}

// ---------- 결과 ----------
function result() {
  const { r } = view, x = st(r), sc = x.score, L = R(r);
  let h = '<div class="top"><button class="ib" onclick="go({v:\'home\'})">←</button><h1>' + r + '회 결과</h1></div>';
  h += '<div class="card center"><div class="sub">평균</div><div class="big" style="font-size:2.4em">' + sc.avg.toFixed(1) + '</div>' +
    '<div class="' + (sc.pass ? 'pass' : 'fail') + '" style="font-size:1.2em">' + (sc.pass ? '합격권 🎉' : '불합격') + '</div>' +
    '<div class="sub">정답 ' + sc.ok + '/' + L.length + ' · 걸린 시간 ' + mmss(x.used) + '</div>' +
    '<table class="sc"><tr><th>과목</th><th>점수</th><th>정답</th><th>과락(40)</th></tr>' +
    [1, 2, 3].map(s => { const l = L.filter(q => q.s === s); return '<tr><td>' + SUBJ[s] + '</td><td><b>' + sc.sub[s] + '</b></td><td>' + l.filter(q => x.ans[q.id] === q.a).length + '/' + l.length + '</td><td class="' + (sc.sub[s] >= 40 ? 'pass' : 'fail') + '">' + (sc.sub[s] >= 40 ? '통과' : '과락') + '</td></tr>'; }).join('') +
    '</table>' + (!sc.pass ? '<div class="sub" style="margin-top:8px">' + (sc.avg < 70 ? '평균 70점까지 ' + (70 - sc.avg).toFixed(1) + '점 부족' : '') + ([1, 2, 3].some(s => sc.sub[s] < 40) ? ' · 과락 과목 있음' : '') + '</div>' : '') + '</div>';
  const nW = L.filter(q => x.ans[q.id] !== q.a).length, nF = Object.keys(x.flag).length;
  h += '<div class="card"><b>해설 보기</b><div class="grid2" style="margin-top:8px">' +
    '<button class="btn pri" ' + (nW ? '' : 'disabled') + ' onclick="go({v:\'review\',r:' + r + ',f:\'no\',k:0})">❌ 틀린 문제 ' + nW + '</button>' +
    '<button class="btn" onclick="go({v:\'review\',r:' + r + ',f:\'all\',k:0})">전체 60문항</button></div>' +
    (nF ? '<button class="btn" onclick="go({v:\'review\',r:' + r + ',f:\'flag\',k:0})">🚩 헷갈렸던 문제 ' + nF + '</button>' : '') +
    '<div class="sub" style="margin-top:6px">초록 = 맞힘, 빨강 = 틀림. 번호를 누르면 그 문제 해설로 갑니다.</div>' + omr(r, 'done') + '</div>';
  h += '<div class="card"><button class="btn" onclick="copyWrong(' + r + ')">📋 틀린 문제 번호 복사 (Claude에게 보내기용)</button><div id="wout"></div></div>';
  FOOT.hidden = true;
  return h;
}
function copyWrong(r) {
  const x = st(r), L = R(r);
  const w = L.map((q, i) => [q, i]).filter(([q]) => x.ans[q.id] !== q.a).map(([q, i]) => (i + 1) + '번 ' + q.id);
  const txt = '모의고사 ' + r + '회 오답 (' + w.length + '개, 평균 ' + x.score.avg.toFixed(1) + ' · 1권 ' + x.score.sub[1] + ' 2권 ' + x.score.sub[2] + ' 3권 ' + x.score.sub[3] + ')\n' + w.join(', ');
  const show = m => { $('#wout').innerHTML = '<div class="sub" style="margin:6px 0">' + m + '</div><textarea readonly style="width:100%;height:110px;font:inherit;font-size:.8em" onclick="this.select()">' + esc(txt) + '</textarea>'; };
  try { navigator.clipboard.writeText(txt).then(() => show('복사했어요. Claude 채팅에 붙여 넣으세요.'), () => show('아래 글을 길게 눌러 전체 선택 → 복사하세요.')); }
  catch (e) { show('아래 글을 길게 눌러 전체 선택 → 복사하세요.'); }
}

// ---------- 해설 ----------
function review() {
  const { r, f } = view, x = st(r), L = R(r);
  const idx = L.map((q, i) => i).filter(i => f === 'all' || (f === 'no' ? x.ans[L[i].id] !== L[i].a : x.flag[L[i].id]));
  let k = f === 'all' ? Math.max(0, idx.indexOf(view.k)) : Math.min(view.k, idx.length - 1);
  if (f === 'all' && idx.indexOf(view.k) < 0) k = 0;
  const label = { all: '전체', no: '틀린 문제', flag: '헷갈린 문제' }[f];
  let h = '<div class="top"><button class="ib" onclick="go({v:\'result\',r:' + r + '})">←</button><h1>' + r + '회 해설 · ' + label + '</h1></div>';
  h += '<div class="seg">' + ['no', 'flag', 'all'].map(t => '<button class="' + (t === f ? 'on' : '') + '" onclick="go({v:\'review\',r:' + r + ',f:\'' + t + '\',k:0})">' + { all: '전체', no: '❌ 틀린', flag: '🚩 헷갈림' }[t] + '</button>').join('') + '</div>';
  if (!idx.length) { FOOT.hidden = true; return h + '<div class="card center sub">해당하는 문제가 없어요.</div>'; }
  const i = idx[k], q = L[i], my = x.ans[q.id], ok = my === q.a;
  view.k = f === 'all' ? i : k;
  h += '<div class="card"><div class="row"><span class="sub">' + (k + 1) + '/' + idx.length + '</span><span class="tag">' + SUBJ[q.s] + '</span><span class="sp"></span>' +
    '<span class="tag ' + (ok ? 'ok' : 'no') + '">' + (ok ? '정답' : my ? '오답' : '미응답') + '</span>' + (x.flag[q.id] ? '<span class="tag flag">🚩</span>' : '') + '</div>' +
    '<div class="q">' + (i + 1) + '. ' + esc(q.q) + '</div>' +
    q.c.map((c, j) => '<div class="ch' + (j + 1 === q.a ? ' ok' : j + 1 === my ? ' no' : '') + '">' + NUM[j] + ' ' + esc(c) + (j + 1 === q.a ? ' ✓' : j + 1 === my ? ' ← 내 답' : '') + '</div>').join('');
  const lines = q.e.split('\n'), mi = lines.findIndex(l => /^\s*암기\s*[:：]/.test(l));
  const mem = mi >= 0 ? lines.splice(mi, 1)[0] : '';
  h += '<div class="ex"><b>정답 ' + NUM[q.a - 1] + (my ? ' · 내 답 ' + NUM[my - 1] : ' · 미응답') + '</b>\n' + esc(lines.join('\n').trim()) +
    (mem ? '<span class="mem">📌 ' + esc(mem.trim()) + '</span>' : '') + (q.p ? '\n(교재 PDF ' + q.p + '쪽 부근 · ' + esc(q.tp || '') + ')' : '') + '</div></div>';
  FOOT.hidden = false;
  const nav = d => f === 'all' ? idx[k + d] : k + d;
  FIN.innerHTML = '<button class="btn" ' + (k > 0 ? '' : 'disabled') + ' onclick="view.k=' + nav(-1) + ';render();scrollTo(0,0)">◀ 이전</button>' +
    '<button class="btn pri" ' + (k < idx.length - 1 ? '' : 'disabled') + ' onclick="view.k=' + nav(1) + ';render();scrollTo(0,0)">다음 ▶</button>';
  return h;
}

function render() {
  FOOT.hidden = true;
  const f = { home, exam, sheet, result, review }[view.v] || home;
  if (view.v !== 'home' && !st(view.r)) view = { v: 'home' };
  APP.innerHTML = (view.v === 'home' ? home : f)();
}

// ---------- 잠금 해제 ----------
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(pass) {
  const e = await (await fetch('data.enc.json', { cache: 'no-cache' })).json();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(e.salt), iterations: e.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(e.iv) }, key, b64(e.ct))));
}
function lockScreen(msg) {
  APP.innerHTML = '<div class="top"><h1>📝 실전 모의고사</h1></div><div class="card"><b>열쇠가 필요해요</b>' +
    '<div class="sub" style="margin:6px 0 10px">카카오톡으로 받은 링크를 누르면 자동으로 열립니다. 직접 넣으려면 링크의 #k= 뒤 글자를 입력하세요.</div>' +
    (msg ? '<div class="banner">' + esc(msg) + '</div>' : '') +
    '<input type="password" id="kin" placeholder="열쇠" autocomplete="off"><button class="btn pri" onclick="unlock($(\'#kin\').value.trim())">열기</button></div>';
}
async function unlock(pass) {
  if (!pass) return lockScreen('열쇠를 입력하세요.');
  APP.innerHTML = '<div class="card center sub">여는 중…</div>';
  try { D = await decrypt(pass); }
  catch (e) { ls(KKEY, null); return lockScreen(navigator.onLine === false ? '인터넷 연결을 확인하세요.' : '열쇠가 맞지 않아요.'); }
  ls(KKEY, pass);
  history.replaceState(null, '', location.pathname);
  applyOpt(); render();
}
(function boot() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (m) ls(KKEY, decodeURIComponent(m[1]));
  const k = ls(KKEY);
  if (k) unlock(k); else lockScreen();
})();
