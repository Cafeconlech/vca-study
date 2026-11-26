/* 벤처투자분석사 새 핵심문제 앱
   1차 90문제(새 핵심) + 2차 90문제(오답 개념). 한 번 맞힌 문제는 다시 안 나오고, 틀린 문제만 "틀린 것 다시"로 모인다.
   데이터는 data.enc.json(AES-GCM). 열쇠는 본 앱과 같은 것(같은 주소라 저장된 열쇠를 함께 씀). */
'use strict';
const $ = s => document.querySelector(s);
const APP = $('#app');
const SUBJ = { 1: '1권 투자이해', 2: '2권 투자방법론', 3: '3권 회수이해' };
const SET = { 1: '1차 새 핵심 90', 2: '2차 오답 개념 90' };
const NUM = '①②③④⑤';
const SKEY = 'vca_new_v1', KKEY = 'vca_key';
let D = null, Qm = {};
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
let S = (() => { try { return JSON.parse(ls(SKEY) || '{}'); } catch (e) { return {}; } })();
S.r = S.r || {}; S.set = S.set || 1; S.opt = S.opt || {};
const save = () => ls(SKEY, JSON.stringify(S));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function applyOpt() { document.documentElement.style.setProperty('--fs', (S.opt.fs || 16) + 'px'); }

// 상태: r[id] = { n: 푼 횟수, ok: 맞힌 횟수, st: 'ok' | 'no' }
const inSet = (t, s) => D.questions.filter(q => q.set === t && (!s || q.s === s));
const stat = list => { const o = { all: list.length, ok: 0, no: 0, left: 0 }; list.forEach(q => { const r = S.r[q.id]; if (!r) o.left++; else if (r.st === 'ok') o.ok++; else o.no++; }); return o; };

let sess = null;  // { title, list, i, ok, wrongNow }
function start(kind, s) {
  const base = inSet(S.set, s);
  let list;
  if (kind === 'left') list = base.filter(q => !S.r[q.id]);
  else if (kind === 'no') list = shuffle(base.filter(q => S.r[q.id] && S.r[q.id].st === 'no'));
  else list = base.slice();
  if (kind === 'left' && S.opt.shuffle) list = shuffle(list);
  sess = { title: (s ? SUBJ[s] + ' · ' : '') + (kind === 'no' ? '틀린 것 다시' : kind === 'left' ? '안 푼 문제' : '전체 다시'), list: list.slice(0, kind === 'all' ? 999 : 20), i: 0, ok: 0, kind, s };
  window.scrollTo(0, 0); render();
}

function home() {
  const t = S.set, st = stat(inSet(t));
  let h = '<div class="top"><h1>🔥 새 핵심문제</h1><button class="ib" onclick="setFs(-1)">가-</button><button class="ib" onclick="setFs(1)">가+</button></div>';
  h += '<div class="seg">' + [1, 2].map(k => '<button class="' + (k === t ? 'on' : '') + '" onclick="S.set=' + k + ';save();render()">' + SET[k] + '</button>').join('') + '</div>';
  h += '<div class="sub" style="margin:2px 2px 0">' + (t === 1 ? '기존 문제와 겹치지 않는 시험 예상 핵심문제입니다.' : '예전에 틀린 예상문제 88개의 개념을 숫자·각도를 바꿔 다시 묻습니다.') + '</div>';
  h += '<div class="card"><div class="row"><div class="sp"><div class="big">' + st.left + '</div><div class="sub">안 푼 문제</div></div>' +
    '<div class="sp"><div class="big" style="color:var(--ok)">' + st.ok + '</div><div class="sub">맞힘</div></div>' +
    '<div class="sp"><div class="big" style="color:var(--no)">' + st.no + '</div><div class="sub">틀린 것</div></div></div>' +
    '<div class="bar"><i style="width:' + (100 * st.ok / st.all) + '%;background:var(--ok)"></i><i style="width:' + (100 * st.no / st.all) + '%;background:var(--no)"></i></div>' +
    '<button class="btn pri" ' + (st.left ? '' : 'disabled') + ' onclick="start(\'left\')">▶ 안 푼 문제 20개 풀기</button>' +
    '<button class="btn" ' + (st.no ? '' : 'disabled') + ' onclick="start(\'no\')">✍️ 틀린 것만 다시 (' + st.no + ')</button>' +
    '<div class="sub">맞힌 문제는 다시 나오지 않아요. 틀린 문제는 "틀린 것만 다시"에 모이고, 거기서 맞히면 빠집니다.</div></div>';
  h += '<div class="card"><div class="sub" style="margin-bottom:6px">과목별</div>';
  for (const s of [1, 2, 3]) {
    const x = stat(inSet(t, s));
    h += '<div class="row" style="margin-top:8px"><b class="sp">' + SUBJ[s] + '</b><span class="sub">맞힘 ' + x.ok + ' · 틀림 ' + x.no + ' / ' + x.all + '</span></div>' +
      '<div class="bar"><i style="width:' + (100 * x.ok / x.all) + '%;background:var(--ok)"></i><i style="width:' + (100 * x.no / x.all) + '%;background:var(--no)"></i></div>' +
      '<div class="grid3"><button class="btn" ' + (x.left ? '' : 'disabled') + ' onclick="start(\'left\',' + s + ')">안 푼 ' + x.left + '</button>' +
      '<button class="btn" ' + (x.no ? '' : 'disabled') + ' onclick="start(\'no\',' + s + ')">틀린 ' + x.no + '</button>' +
      '<button class="btn" onclick="start(\'all\',' + s + ')">전체 ' + x.all + '</button></div>';
  }
  h += '</div>';
  h += '<div class="card"><label class="row" style="cursor:pointer"><input type="checkbox" style="width:auto" ' + (S.opt.shuffle ? 'checked' : '') + ' onchange="S.opt.shuffle=this.checked;save()"> <span class="sp">안 푼 문제를 섞어서 내기</span></label>' +
    '<button class="btn" onclick="copyWrong()">📋 틀린 문제 번호 복사 (Claude에게 보내기용)</button><div id="wout"></div>' +
    '<button class="btn ghost" onclick="if(confirm(\'' + SET[t] + ' 기록을 지울까요?\')){inSet(' + t + ').forEach(q=>delete S.r[q.id]);save();render()}">이 묶음 기록 지우기</button>' +
    '<a class="btn ghost" href="../mock/">📝 실전 모의고사 1~3회</a><a class="btn ghost" href="../">← 요약·빈칸 학습 앱으로</a></div>';
  return h;
}

let locked = false;
function quiz() {
  const ss = sess;
  let h = '<div class="top"><button class="ib" onclick="sess=null;render()">←</button><h1>' + esc(ss.title) + '</h1></div>';
  if (!ss.list.length) return h + '<div class="card center sub">해당하는 문제가 없어요.</div><button class="btn pri" onclick="sess=null;render()">처음으로</button>';
  if (ss.i >= ss.list.length) {
    const n = ss.list.length;
    const more = ss.kind === 'left' && inSet(S.set, ss.s).some(q => !S.r[q.id]);
    const noN = inSet(S.set, ss.s).filter(q => S.r[q.id] && S.r[q.id].st === 'no').length;
    return h + '<div class="card center"><div class="big">' + ss.ok + '/' + n + '</div><div class="sub">' + Math.round(100 * ss.ok / n) + '점</div></div>' +
      (more ? '<button class="btn pri" onclick="start(\'left\',' + (ss.s || 0) + ')">▶ 다음 20문제</button>' : '') +
      (noN ? '<button class="btn" onclick="start(\'no\',' + (ss.s || 0) + ')">✍️ 틀린 것 다시 (' + noN + ')</button>' : '') +
      '<button class="btn ghost" onclick="sess=null;render()">처음으로</button>';
  }
  const q = ss.list[ss.i], r = S.r[q.id];
  locked = false;
  h += '<div class="card"><div class="row"><span class="sub">' + (ss.i + 1) + '/' + ss.list.length + ' · ' + SUBJ[q.s] + ' ' + (q.set === 1 ? '신규' : '오답개념') + ' ' + q.n + '</span><span class="sp"></span>' +
    (r && r.st === 'no' ? '<span class="tag no">전에 틀림</span>' : '') + '<span class="tag">' + esc(q.d) + '</span></div>' +
    '<div class="q">' + esc(q.q) + '</div>' + q.c.map((c, k) => '<button class="ch" data-k="' + (k + 1) + '" onclick="answer(' + (k + 1) + ')">' + NUM[k] + ' ' + esc(c) + '</button>').join('') +
    '<div id="qx"></div></div>';
  return h;
}
function answer(k) {
  if (locked) return; locked = true;
  const ss = sess, q = ss.list[ss.i], ok = k === q.a;
  document.querySelectorAll('.ch').forEach(b => { const kk = +b.dataset.k; if (kk === q.a) b.classList.add('ok'); else if (kk === k) b.classList.add('no'); });
  const r = S.r[q.id] || { n: 0, ok: 0 }; r.n++; if (ok) r.ok++; r.st = ok ? 'ok' : 'no'; S.r[q.id] = r; save();
  if (ok) ss.ok++;
  // 해설의 "암기:" 줄은 따로 강조
  const lines = q.e.split('\n'), mi = lines.findIndex(l => /^\s*암기\s*[:：]/.test(l));
  const mem = mi >= 0 ? lines.splice(mi, 1)[0] : '';
  $('#qx').innerHTML = '<div class="ex"><b>' + (ok ? '정답 ✓' : '오답 ✗ · 정답 ' + NUM[q.a - 1]) + '</b>\n' + esc(lines.join('\n').trim()) +
    (mem ? '<span class="mem">📌 ' + esc(mem.trim()) + '</span>' : '') + (q.p ? '\n(교재 PDF ' + q.p + '쪽 부근)' : '') + '</div>' +
    '<button class="btn pri" onclick="sess.i++;window.scrollTo(0,0);render()">다음 ▶</button>';
  $('#qx').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function copyWrong() {
  const ids = D.questions.filter(q => S.r[q.id] && S.r[q.id].st === 'no').map(q => q.id);
  const txt = '새 핵심문제 앱 오답 ' + new Date().toISOString().slice(0, 10) + ' (' + ids.length + '개)\n' + ids.join(', ');
  const show = m => { $('#wout').innerHTML = '<div class="sub" style="margin:6px 0">' + m + '</div><textarea readonly style="width:100%;height:110px;font:inherit;font-size:.8em" onclick="this.select()">' + esc(txt) + '</textarea>'; };
  if (!ids.length) return show('아직 틀린 문제가 없어요.');
  try { navigator.clipboard.writeText(txt).then(() => show('복사했어요. Claude 채팅에 붙여 넣으세요.'), () => show('아래 글을 길게 눌러 전체 선택 → 복사하세요.')); }
  catch (e) { show('아래 글을 길게 눌러 전체 선택 → 복사하세요.'); }
}
function setFs(d) { S.opt.fs = Math.max(13, Math.min(22, (S.opt.fs || 16) + d)); save(); applyOpt(); }
function render() { APP.innerHTML = sess ? quiz() : home(); }

// ---------- 잠금 해제 ----------
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(pass) {
  const e = await (await fetch('data.enc.json', { cache: 'no-cache' })).json();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(e.salt), iterations: e.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(e.iv) }, key, b64(e.ct))));
}
function lockScreen(msg) {
  APP.innerHTML = '<div class="top"><h1>🔥 새 핵심문제</h1></div><div class="card"><b>열쇠가 필요해요</b>' +
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
  Qm = Object.fromEntries(D.questions.map(q => [q.id, q]));
  history.replaceState(null, '', location.pathname);
  applyOpt(); render();
}
(function boot() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (m) ls(KKEY, decodeURIComponent(m[1]));
  const k = ls(KKEY);
  if (k) unlock(k); else lockScreen();
})();
