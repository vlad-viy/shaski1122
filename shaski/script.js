/* ============================================================
   ДВИЖОК — РУССКИЕ ШАШКИ
   ============================================================ */
const N = 8;
const playable = (r,c) => (r+c)%2===1;
const inb = (r,c) => r>=0&&r<N&&c>=0&&c<N;
const opp = col => col==='w'?'b':'w';
const DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const clone = b => b.map(row=>row.map(p=>p?{...p}:null));

function initBoard(){
  const b = Array.from({length:N},()=>Array(N).fill(null));
  for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(playable(r,c)){
    if(r<3) b[r][c]={c:'b',k:false};
    else if(r>4) b[r][c]={c:'w',k:false};
  }
  return b;
}
function withPiece(b,r,c,piece){const nb=clone(b);nb[r][c]={...piece};return nb;}

// одиночные взятия фигуры (captured — Set "r,c" уже взятых в серии, остаются как блок)
function pieceCaptures(b,r,c,captured){
  const p=b[r][c]; if(!p) return [];
  const res=[];
  for(const [dr,dc] of DIRS){
    if(!p.k){
      const er=r+dr,ec=c+dc,lr=r+2*dr,lc=c+2*dc;
      if(!inb(lr,lc)) continue;
      const e=b[er][ec]; const key=er+','+ec;
      if(e&&e.c===opp(p.c)&&!captured.has(key)&&!b[lr][lc]&&playable(lr,lc))
        res.push({to:[lr,lc],cap:[er,ec]});
    } else {
      let i=1,enemy=null;
      while(true){
        const cr=r+dr*i,cc=c+dc*i;
        if(!inb(cr,cc)) break;
        const cell=b[cr][cc]; const key=cr+','+cc;
        if(!cell){ if(enemy) res.push({to:[cr,cc],cap:enemy}); i++; continue; }
        if(captured.has(key)) break;
        if(cell.c===p.c) break;
        if(enemy) break;
        enemy=[cr,cc]; i++;
      }
    }
  }
  return res;
}
function pieceQuietMoves(b,r,c){
  const p=b[r][c]; const res=[];
  if(!p.k){
    const fdr = p.c==='w'?-1:1;
    for(const dc of [-1,1]){
      const nr=r+fdr,nc=c+dc;
      if(inb(nr,nc)&&playable(nr,nc)&&!b[nr][nc]) res.push({to:[nr,nc]});
    }
  } else {
    for(const [dr,dc] of DIRS){
      let i=1;
      while(true){const cr=r+dr*i,cc=c+dc*i;if(!inb(cr,cc)||b[cr][cc])break;res.push({to:[cr,cc]});i++;}
    }
  }
  return res;
}
// полные серии взятий
function buildCaptureSequences(b,r,c,captured,path){
  const p=b[r][c];
  const lastRow=p.c==='w'?0:7;
  let piece=p;
  if(!p.k&&r===lastRow) piece={...p,k:true};
  const single=pieceCaptures(withPiece(b,r,c,piece),r,c,captured);
  if(single.length===0) return [{path:[...path,[r,c]],captured:new Set(captured),king:piece.k}];
  let seqs=[];
  for(const m of single){
    const nb=clone(b); nb[r][c]=null; nb[m.to[0]][m.to[1]]={...piece};
    const ncap=new Set(captured); ncap.add(m.cap[0]+','+m.cap[1]);
    seqs=seqs.concat(buildCaptureSequences(nb,m.to[0],m.to[1],ncap,[...path,[r,c]]));
  }
  return seqs;
}
function generateMoves(b,color){
  const caps=[];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const p=b[r][c]; if(!p||p.c!==color) continue;
    const seqs=buildCaptureSequences(b,r,c,new Set(),[]);
    for(const s of seqs) if(s.captured.size>0){
      const fin=s.path[s.path.length-1];
      caps.push({from:[r,c],path:s.path,to:fin,captured:[...s.captured].map(k=>k.split(',').map(Number)),king:s.king});
    }
  }
  if(caps.length>0) return caps;
  const q=[];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const p=b[r][c]; if(!p||p.c!==color) continue;
    for(const m of pieceQuietMoves(b,r,c)) q.push({from:[r,c],to:m.to,captured:[]});
  }
  return q;
}
function applyMove(b,mv){
  const nb=clone(b); const [fr,fc]=mv.from; const piece={...nb[fr][fc]};
  nb[fr][fc]=null;
  for(const [cr,cc] of mv.captured) nb[cr][cc]=null;
  const [tr,tc]=mv.to; const lastRow=piece.c==='w'?0:7;
  if(tr===lastRow) piece.k=true;
  nb[tr][tc]=piece;
  return nb;
}
function countPieces(b,color){let n=0;for(const row of b)for(const p of row)if(p&&p.c===color)n++;return n;}

/* ============================================================
   ИИ — минимакс с альфа-бета
   ============================================================ */
function evaluate(b){ // плюс — выгода чёрных (ИИ)
  let s=0;
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const p=b[r][c]; if(!p) continue;
    let v = p.k?340:100;
    if(!p.k){ // продвижение
      const adv = p.c==='b'? r : (7-r);
      v += adv*4;
    }
    // центр
    const center = 3.5-Math.abs(3.5-c);
    v += center*1.5;
    s += p.c==='b'? v : -v;
  }
  return s;
}
function minimax(b,color,depth,alpha,beta){
  const moves=generateMoves(b,color);
  if(moves.length===0) return color==='b'? -1e6-depth : 1e6+depth; // у кого нет ходов — тот проиграл
  if(depth===0) return evaluate(b);
  if(color==='b'){
    let best=-Infinity;
    for(const m of moves){
      const v=minimax(applyMove(b,m),'w',depth-1,alpha,beta);
      if(v>best)best=v; if(best>alpha)alpha=best; if(beta<=alpha)break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      const v=minimax(applyMove(b,m),'b',depth-1,alpha,beta);
      if(v<best)best=v; if(best<beta)beta=best; if(beta<=alpha)break;
    }
    return best;
  }
}
function aiChooseMove(b,depthByDiff){
  const moves=generateMoves(b,'b');
  if(moves.length===0) return null;
  if(depthByDiff==='easy'){
    // лёгкий: половина случайностей, иначе depth 1
    if(Math.random()<0.45) return moves[Math.floor(Math.random()*moves.length)];
  }
  const depth = depthByDiff==='easy'?1 : depthByDiff==='medium'?3 : 5;
  let best=-Infinity, bestMoves=[];
  for(const m of moves){
    const v=minimax(applyMove(b,m),'w',depth-1,-Infinity,Infinity);
    if(v>best){best=v;bestMoves=[m];}
    else if(v===best)bestMoves.push(m);
  }
  return bestMoves[Math.floor(Math.random()*bestMoves.length)];
}

/* ============================================================
   АККАУНТЫ / УРОВНИ / МОНЕТЫ  (localStorage)
   ============================================================ */
const DB_KEY='shashki_accounts_v1';
const SESSION_KEY='shashki_session_v1';
const LEVELS=[
  {t:'Новичок',min:0},{t:'Любитель',min:100},{t:'Уверенный',min:250},
  {t:'Опытный',min:500},{t:'Мастер',min:900},{t:'Гроссмейстер',min:1500},{t:'Легенда',min:2500}
];
function loadDB(){try{return JSON.parse(localStorage.getItem(DB_KEY))||{};}catch(e){return {};}}
function saveDB(db){localStorage.setItem(DB_KEY,JSON.stringify(db));}
let currentUser=null; // {name, ...} ссылка кэш

function levelInfo(rating){
  let idx=0;
  for(let i=0;i<LEVELS.length;i++) if(rating>=LEVELS[i].min) idx=i;
  const cur=LEVELS[idx], next=LEVELS[idx+1];
  const level=idx+1;
  let progress=1;
  if(next){progress=(rating-cur.min)/(next.min-cur.min);}
  return {level,title:cur.t,progress:Math.max(0,Math.min(1,progress)),next:next?next.min:null};
}
function getUser(){ if(!currentUser) return null; const db=loadDB(); return db[currentUser]; }
function updateUser(fn){ const db=loadDB(); if(!db[currentUser]) return; fn(db[currentUser]); saveDB(db); renderAccount(); }

function renderAccount(){
  const el=document.getElementById('account');
  const u=getUser();
  if(!u){
    el.innerHTML=`<button class="btn dark small" onclick="goOnline()">Войти / Регистрация</button>`;
    return;
  }
  const li=levelInfo(u.rating);
  const total=u.wins+u.losses;
  const wr=total?Math.round(u.wins/total*100):0;
  el.innerHTML=`
    <div class="acc-stat"><b>${u.name}</b><span>${li.title} · ур.${li.level}</span></div>
    <span class="chip">🏅 ${u.rating} <small style="color:var(--muted)">(${u.wins}П/${u.losses}П · ${wr}%)</small></span>
    <span class="chip coins">🪙 ${u.coins}</span>
    <button class="btn ghost small" onclick="logout()">Выйти</button>`;
}

/* ============================================================
   НАВИГАЦИЯ / UI
   ============================================================ */
function show(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}
// выбор сложности
let difficulty='medium';
document.getElementById('diffSeg').addEventListener('click',e=>{
  const b=e.target.closest('button[data-d]'); if(!b)return;
  difficulty=b.dataset.d;
  document.querySelectorAll('#diffSeg button').forEach(x=>x.classList.toggle('sel',x===b));
});
// выбор ставки
let stake=100;
document.getElementById('stakeGrid').addEventListener('click',e=>{
  const b=e.target.closest('button[data-s]'); if(!b)return;
  stake=+b.dataset.s;
  document.querySelectorAll('#stakeGrid button').forEach(x=>x.classList.toggle('sel',x===b));
  validateStake();
});

/* ---- Авторизация ---- */
let authMode='login';
function switchTab(m){
  authMode=m;
  document.getElementById('tab-login').classList.toggle('sel',m==='login');
  document.getElementById('tab-reg').classList.toggle('sel',m==='reg');
  document.getElementById('field-pass2').style.display=m==='reg'?'block':'none';
  document.getElementById('auth-submit').textContent=m==='reg'?'Зарегистрироваться':'Войти';
  authMsg('');
}
function authMsg(t,ok){const m=document.getElementById('auth-msg');m.textContent=t;m.className='msg '+(ok?'ok':'err');}
function goOnline(){
  if(getUser()){ openLobby(); }
  else { show('auth'); switchTab('login'); }
}
function submitAuth(){
  const name=document.getElementById('in-login').value.trim();
  const pass=document.getElementById('in-pass').value;
  if(name.length<3) return authMsg('Логин — минимум 3 символа');
  if(pass.length<4) return authMsg('Пароль — минимум 4 символа');
  const db=loadDB();
  if(authMode==='reg'){
    const pass2=document.getElementById('in-pass2').value;
    if(pass!==pass2) return authMsg('Пароли не совпадают');
    if(db[name]) return authMsg('Такой логин уже занят');
    db[name]={name,pass,rating:0,wins:0,losses:0,draws:0,coins:1000,lastBonus:0};
    saveDB(db);
    currentUser=name; localStorage.setItem(SESSION_KEY,name);
    authMsg('Аккаунт создан!',true);
    setTimeout(()=>{renderAccount();openLobby();},400);
  } else {
    if(!db[name]) return authMsg('Аккаунт не найден');
    if(db[name].pass!==pass) return authMsg('Неверный пароль');
    currentUser=name; localStorage.setItem(SESSION_KEY,name);
    renderAccount(); openLobby();
  }
}
function logout(){currentUser=null;localStorage.removeItem(SESSION_KEY);renderAccount();show('menu');}

/* ---- Лобби ставок ---- */
function openLobby(){
  const u=getUser();
  const li=levelInfo(u.rating);
  document.getElementById('lobby-stats').innerHTML=`
    <div style="display:flex;justify-content:space-between"><span>Игрок</span><b>${u.name}</b></div>
    <div style="display:flex;justify-content:space-between"><span>Уровень</span><b>${li.title} (ур.${li.level})</b></div>
    <div class="level-bar"><i style="width:${Math.round(li.progress*100)}%"></i></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><span>Баланс</span><b>🪙 ${u.coins}</b></div>`;
  validateStake();
  show('lobby');
}
function validateStake(){
  const u=getUser(); const m=document.getElementById('lobby-msg'); const btn=document.getElementById('findBtn');
  if(u.coins<stake){m.textContent='Недостаточно монет для этой ставки. Возьмите бонус или уменьшите ставку.';m.className='msg err';btn.disabled=true;}
  else {m.textContent='';btn.disabled=false;}
}
function claimBonus(){
  const now=Date.now();
  const u=getUser();
  if(now-u.lastBonus < 1000*60*60*8){
    const m=document.getElementById('lobby-msg');
    const left=Math.ceil((1000*60*60*8-(now-u.lastBonus))/(1000*60*60));
    m.textContent=`Бонус уже получен. Следующий через ~${left} ч.`;m.className='msg err';return;
  }
  updateUser(x=>{x.coins+=200;x.lastBonus=now;});
  openLobby();
}

/* ============================================================
   ИГРОВОЙ ПРОЦЕСС
   ============================================================ */
let G=null; // состояние партии
function newGameState(mode){
  return {
    mode,                       // 'computer' | 'local' | 'online'
    board:initBoard(),
    turn:'w',                   // человек = белые
    selected:null,             // [r,c] выбранной фигуры
    legal:[],                  // легальные ходы текущего цвета (полные)
    selDests:[],               // доступные клетки для выбранной фигуры (текущий шаг)
    capturedThisTurn:new Set(),// взятые в текущей серии (остаются как блок)
    midCapture:false,          // продолжается серия взятий
    capturePiece:null,         // [r,c] фигуры в процессе цепочки
    history:[],                // для отмены
    noProgress:0,              // для ничьей
    over:false,
    aiThinking:false,
  };
}
function startVsComputer(){ G=newGameState('computer'); enterGame('С компьютером · '+diffName()); }
function startLocal(){ G=newGameState('local'); enterGame('Вдвоём'); }
function startOnlineMatch(){
  const u=getUser();
  if(u.coins<stake){validateStake();return;}
  updateUser(x=>x.coins-=stake); // ставка резервируется
  onlineSettled=false;
  G=newGameState('online');
  G.stake=stake;
  enterGame('Онлайн · ставка '+stake);
}
function diffName(){return difficulty==='easy'?'Лёгкий':difficulty==='medium'?'Средний':'Сложный';}

function enterGame(title){
  document.getElementById('mode-title').textContent=title;
  const isOnline=G.mode==='online';
  document.getElementById('stake-row').style.display=isOnline?'flex':'none';
  if(isOnline) document.getElementById('stake-val').textContent='🪙 '+G.stake;
  // надписи сторон
  if(G.mode==='local'){document.getElementById('lbl-white').textContent='Белые (игрок 1)';document.getElementById('lbl-black').textContent='Чёрные (игрок 2)';}
  else {document.getElementById('lbl-white').textContent='Вы (белые)';document.getElementById('lbl-black').textContent='Соперник (чёрные)';}
  document.getElementById('drawBtn').style.display=G.mode==='online'?'none':'block';
  show('game');
  recomputeLegal();
  renderBoard();
  updateTurnUI();
}

function recomputeLegal(){
  G.legal=generateMoves(G.board,G.turn);
}
function isHumanTurn(){
  if(G.mode==='local') return true;
  return G.turn==='w'; // в computer/online человек всегда белые
}

function buildBoardDOM(){
  const el=document.getElementById('board'); el.innerHTML='';
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const cell=document.createElement('div');
    cell.className='cell '+((r+c)%2===0?'light':'dark');
    cell.dataset.r=r; cell.dataset.c=c;
    if(playable(r,c)){cell.classList.add('playable');cell.addEventListener('click',onCellClick);}
    el.appendChild(cell);
  }
}
function renderBoard(){
  const el=document.getElementById('board');
  // очистить пометки и фигуры
  [...el.children].forEach(cell=>{
    cell.classList.remove('sel','move','cap','from');
    cell.querySelector('.piece')?.remove();
  });
  // фигуры
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const p=G.board[r][c]; if(!p) continue;
    const cell=el.children[r*N+c];
    const pc=document.createElement('div');
    pc.className='piece '+p.c+(p.k?' king':'');
    // можно ли двигать
    if(!G.over && isHumanTurn() && p.c===G.turn){
      const movable = G.midCapture
        ? (G.capturePiece && G.capturePiece[0]===r && G.capturePiece[1]===c)
        : G.legal.some(m=>m.from[0]===r&&m.from[1]===c);
      if(movable) pc.classList.add('movable');
    }
    cell.appendChild(pc);
  }
  // подсветка выбора
  if(G.selected){
    const [sr,sc]=G.selected;
    el.children[sr*N+sc].classList.add('sel','from');
    for(const d of G.selDests){
      const cell=el.children[d.to[0]*N+d.to[1]];
      cell.classList.add(d.cap?'cap':'move');
    }
  }
  // счётчики
  document.getElementById('cnt-white').textContent=countPieces(G.board,'w');
  document.getElementById('cnt-black').textContent=countPieces(G.board,'b');
}
function updateTurnUI(){
  const dot=document.getElementById('turn-dot'); const txt=document.getElementById('turn-text');
  dot.className='dot '+G.turn;
  if(G.over){txt.textContent='Партия завершена';return;}
  if(G.aiThinking){txt.textContent='Соперник думает…';return;}
  if(G.mode==='local') txt.textContent='Ход '+(G.turn==='w'?'белых (игрок 1)':'чёрных (игрок 2)');
  else txt.textContent = G.turn==='w'?'Ваш ход':'Ход соперника';
}

// клик по клетке
function onCellClick(e){
  if(G.over||G.aiThinking||!isHumanTurn()) return;
  const r=+e.currentTarget.dataset.r, c=+e.currentTarget.dataset.c;
  // клик по доступной клетке-назначению?
  if(G.selected){
    const dest=G.selDests.find(d=>d.to[0]===r&&d.to[1]===c);
    if(dest){ doHumanStep(dest); return; }
  }
  // выбор фигуры
  const p=G.board[r][c];
  if(p&&p.c===G.turn){
    if(G.midCapture){ // в цепочке можно только продолжать текущей фигурой
      if(G.capturePiece[0]===r&&G.capturePiece[1]===c) selectPiece(r,c);
      return;
    }
    // только фигуры, у которых есть легальные ходы
    if(G.legal.some(m=>m.from[0]===r&&m.from[1]===c)) selectPiece(r,c);
  } else {
    G.selected=null;G.selDests=[];renderBoard();
  }
}
function selectPiece(r,c){
  G.selected=[r,c];
  const capsExist=G.legal.length>0 && G.legal[0].captured.length>0;
  if(G.midCapture||capsExist){
    // показываем одиночные взятия из текущей позиции
    const single=pieceCaptures(G.board,r,c,G.capturedThisTurn);
    G.selDests=single.map(s=>({to:s.to,cap:s.cap}));
  } else {
    G.selDests=pieceQuietMoves(G.board,r,c).map(m=>({to:m.to,cap:null}));
  }
  renderBoard();
}
function doHumanStep(dest){
  const [sr,sc]=G.selected;
  if(!dest.cap){
    // тихий ход
    pushHistory();
    movePiece(sr,sc,dest.to[0],dest.to[1]);
    G.noProgress = G.board[dest.to[0]][dest.to[1]].k ? G.noProgress+1 : 0;
    endTurn();
    return;
  }
  // взятие
  if(!G.midCapture) pushHistory();
  movePieceCapture(sr,sc,dest);
}
function pushHistory(){
  G.history.push({board:clone(G.board),turn:G.turn,noProgress:G.noProgress});
  if(G.history.length>40) G.history.shift();
}
function movePiece(fr,fc,tr,tc){
  const p={...G.board[fr][fc]}; G.board[fr][fc]=null;
  const lastRow=p.c==='w'?0:7; if(tr===lastRow)p.k=true;
  G.board[tr][tc]=p;
}
function movePieceCapture(fr,fc,dest){
  const [tr,tc]=dest.to; const [cr,cc]=dest.cap;
  const p={...G.board[fr][fc]}; G.board[fr][fc]=null;
  const lastRow=p.c==='w'?0:7; let promoted=false;
  if(!p.k&&tr===lastRow){p.k=true;promoted=true;}
  G.board[tr][tc]=p;
  G.capturedThisTurn.add(cr+','+cc);
  G.noProgress=0;
  // продолжение цепочки той же фигурой?
  const more=pieceCaptures(G.board,tr,tc,G.capturedThisTurn);
  if(more.length>0){
    G.midCapture=true; G.capturePiece=[tr,tc];
    selectPiece(tr,tc);
    updateTurnUI();
    return;
  }
  // серия завершена — снять взятые
  finalizeCaptures();
  endTurn();
}
function finalizeCaptures(){
  for(const key of G.capturedThisTurn){const [r,c]=key.split(',').map(Number);G.board[r][c]=null;}
  G.capturedThisTurn=new Set();
  G.midCapture=false;G.capturePiece=null;
}
function endTurn(){
  G.selected=null;G.selDests=[];
  G.turn=opp(G.turn);
  recomputeLegal();
  renderBoard();
  updateTurnUI();
  // ничья по бездействию
  if(G.noProgress>=30){ return finishGame('draw'); }
  // проверка конца
  if(G.legal.length===0){
    // у текущего нет ходов — он проиграл
    const loser=G.turn;
    return finishGame(loser==='w'?'black':'white');
  }
  // ход ИИ?
  if(G.mode!=='local' && G.turn==='b'){
    G.aiThinking=true; updateTurnUI();
    setTimeout(aiTurn, 350);
  }
}
function aiTurn(){
  if(G.over) return;
  const mv=aiChooseMove(G.board, G.mode==='online'?'medium':difficulty);
  if(!mv){G.aiThinking=false;return finishGame('white');}
  // анимация: применяем полный ход разом
  G.board=applyMove(G.board,mv);
  G.noProgress = mv.captured.length>0 ? 0 : (G.board[mv.to[0]][mv.to[1]].k?G.noProgress+1:0);
  G.aiThinking=false;
  G.turn='w';
  recomputeLegal();
  renderBoard();
  updateTurnUI();
  if(G.noProgress>=30) return finishGame('draw');
  if(G.legal.length===0) return finishGame('black'); // у белых нет ходов — победа чёрных
}

/* ---- управление партией ---- */
function undoMove(){
  if(G.over||G.aiThinking) return;
  if(G.midCapture){ // отменяем незаконченную серию
    const last=G.history[G.history.length-1];
    if(last){G.board=clone(last.board);G.turn=last.turn;G.noProgress=last.noProgress;G.history.pop();}
    G.capturedThisTurn=new Set();G.midCapture=false;G.capturePiece=null;G.selected=null;G.selDests=[];
    recomputeLegal();renderBoard();updateTurnUI();return;
  }
  if(G.history.length===0) return;
  // откатываем на ход человека (в режиме с ИИ — на 1 запись, т.к. ход ИИ отдельной истории не пишет)
  const last=G.history.pop();
  G.board=clone(last.board);G.turn=last.turn;G.noProgress=last.noProgress;
  G.selected=null;G.selDests=[];G.capturedThisTurn=new Set();G.midCapture=false;
  recomputeLegal();renderBoard();updateTurnUI();
}
function offerDraw(){
  if(G.over) return;
  if(G.mode==='computer'){
    // ИИ соглашается на ничью только при примерном равенстве
    const e=evaluate(G.board);
    if(Math.abs(e)<60) finishGame('draw');
    else { const t=document.getElementById('turn-text'); t.textContent='Соперник отклонил ничью'; setTimeout(updateTurnUI,1500); }
  } else if(G.mode==='local'){ finishGame('draw'); }
}
function resign(){
  if(G.over) return;
  if(G.mode==='local'){ finishGame(G.turn==='w'?'black':'white'); return; }
  finishGame('black'); // человек (белые) сдаётся → побеждают чёрные
}
function confirmQuit(){
  if(G && !G.over && G.mode==='online'){
    if(!confirm('Выход из онлайн-партии засчитывается как поражение. Ставка не возвращается. Выйти?')) return;
    settleOnline('black');
  }
  G=null; show('menu');
}

/* ---- завершение и начисления ---- */
function finishGame(result){ // 'white' | 'black' | 'draw'
  G.over=true;
  let icon,title,text,reward=null;
  if(G.mode==='online'){
    settleOnline(result);
    const u=getUser();
    if(result==='white'){icon='🏆';title='Победа!';text='Рейтинг +25';reward={cls:'plus',text:`+🪙 ${G.stake} · баланс ${u.coins}`};}
    else if(result==='black'){icon='💀';title='Поражение';text='Рейтинг −15';reward={cls:'minus',text:`−🪙 ${G.stake} · баланс ${u.coins}`};}
    else {icon='🤝';title='Ничья';text='Ставка возвращена';reward={cls:'',text:`🪙 баланс ${u.coins}`};}
  } else if(G.mode==='computer'){
    if(result==='white'){icon='🏆';title='Победа!';text='Вы обыграли компьютер ('+diffName()+').';}
    else if(result==='black'){icon='🤖';title='Поражение';text='Компьютер ('+diffName()+') победил.';}
    else {icon='🤝';title='Ничья';text='Силы равны.';}
  } else { // local
    if(result==='white'){icon='🏆';title='Победили белые!';text='Игрок 1 выигрывает партию.';}
    else if(result==='black'){icon='🏆';title='Победили чёрные!';text='Игрок 2 выигрывает партию.';}
    else {icon='🤝';title='Ничья';text='Партия завершена вничью.';}
  }
  openModal(icon,title,text,reward);
}
let onlineSettled=false;
function settleOnline(result){
  if(onlineSettled) return; onlineSettled=true;
  updateUser(u=>{
    if(result==='white'){u.coins+=G.stake*2;u.rating+=25;u.wins++;}      // ставка была списана → возвращаем + выигрыш
    else if(result==='draw'){u.coins+=G.stake;u.draws++;}                 // возврат ставки
    else {u.rating=Math.max(0,u.rating-15);u.losses++;}                   // ставка уже списана
  });
}
function openModal(icon,title,text,reward){
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-text').textContent=text;
  const rw=document.getElementById('m-reward');
  if(reward){rw.style.display='block';rw.className='reward '+reward.cls;rw.textContent=reward.text;}
  else {rw.style.display='none';rw.className='reward';rw.textContent='';}
  document.getElementById('overlay').classList.add('show');
}
function closeModal(){document.getElementById('overlay').classList.remove('show');}
function playAgain(){
  closeModal();
  const mode=G.mode;
  onlineSettled=false;
  if(mode==='online'){ openLobby(); }
  else if(mode==='computer'){ startVsComputer(); }
  else { startLocal(); }
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
(function init(){
  buildBoardDOM();
  const s=localStorage.getItem(SESSION_KEY);
  if(s && loadDB()[s]) currentUser=s;
  renderAccount();
})();