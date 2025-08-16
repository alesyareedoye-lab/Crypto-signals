import { BinanceFeed, getGlassnodeMetrics, getNansenStablecoinFlows, getETFSpotFlows, getGammaWalls, getCOTDealerPositioning } from './dataSources.js';
import { DEFAULT_WEIGHTS, scoreSignal } from './indicators.js';

const els = {
  pairsList: document.getElementById('pairs-list'),
  signals: document.getElementById('signals-list'),
  sources: document.getElementById('sources-status'),
  addPair: document.getElementById('btn-add-pair'),
  pairInput: document.getElementById('pair-input'),
  dlg: document.getElementById('dlg-settings'),
  btnSettings: document.getElementById('btn-settings'),
  btnSave: document.getElementById('btn-save'),
  btnClose: document.getElementById('btn-close'),
  btnClear: document.getElementById('btn-clear'),
  weightsPanel: document.getElementById('weights-panel'),
  enableWS: document.getElementById('enable-ws'),
  binanceKey: document.getElementById('binance-key'),
  binanceSecret: document.getElementById('binance-secret'),
  glassnodeKey: document.getElementById('glassnode-key'),
  nansenKey: document.getElementById('nansen-key'),
  gammaKey: document.getElementById('gamma-key'),
  etfKey: document.getElementById('etf-key'),
};

const state = {
  pairs: JSON.parse(localStorage.getItem('pairs')||'["BTCUSDT","ETHUSDT"]'),
  settings: JSON.parse(localStorage.getItem('settings')||JSON.stringify({
    weights: DEFAULT_WEIGHTS, enableWS: true,
    binanceKey:"", binanceSecret:"", glassnodeKey:"", nansenKey:"", gammaKey:"", etfKey:""
  })),
  lastTick: new Map() // symbol -> data
};

renderWeights(state.settings.weights);

// Инициализация каналов
let binance = new BinanceFeed({ enableWS: state.settings.enableWS });

function subscribeAll(){
  els.pairsList.innerHTML = "";
  state.pairs.forEach(p=>{
    addPairRow(p);
    binance.subscribe(p, data=>{
      state.lastTick.set(p, data);
      updateSignalFor(p);
    });
  });
}
subscribeAll();
renderSources();

els.addPair.onclick = ()=>{
  const p = els.pairInput.value.trim().toUpperCase();
  if (!p) return;
  if (!state.pairs.includes(p)){ state.pairs.push(p); savePairs(); subscribeAll(); }
  els.pairInput.value="";
};

function addPairRow(p){
  const li = document.createElement('li');
  li.textContent = p;
  const del = document.createElement('button'); del.textContent = "✖"; del.className="btn ghost"; del.style.marginLeft="8px";
  del.onclick = ()=>{ state.pairs = state.pairs.filter(x=>x!==p); savePairs(); subscribeAll(); };
  li.appendChild(del);
  els.pairsList.appendChild(li);
}

function savePairs(){ localStorage.setItem('pairs', JSON.stringify(state.pairs)); }

function updateSignalFor(symbol){
  const t = state.lastTick.get(symbol);
  if (!t) return;
  // Заглушечные входы — на реальных API подставишь фактические значения
  const inputs = {
    priceChangePercent: t.priceChangePercent,
    volume: t.volume>0?1:0,
    orderbookImb: 0, fundingSkew: 0, basis: 0,
    onchainBias: 0, sentiment: 0, mempool: 0
  };
  const {score, side} = scoreSignal(inputs, state.settings.weights);

  let li = document.querySelector(`li[data-sym="${symbol}"]`);
  if (!li){
    li = document.createElement('li');
    li.dataset.sym = symbol;
    els.signals.appendChild(li);
  }
  li.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div><strong>${symbol}</strong> <span class="muted">цена:</span> ${t.price}</div>
      <div>
        <span class="badge ${side.toLowerCase()}">${side}</span>
        <span class="muted" style="margin-left:8px">score: ${score}</span>
      </div>
    </div>
    <div class="muted" style="font-size:12px">Δ24ч: ${t.priceChangePercent}% · об.: ${Number(t.volume).toFixed(0)}</div>
  `;
}

// Настройки
els.btnSettings.onclick = ()=> openDlg();
els.btnClose.onclick = ()=> els.dlg.close();
els.btnClear.onclick = ()=>{
  localStorage.clear(); location.reload();
};
els.btnSave.onclick = ()=>{
  const w = readWeights();
  state.settings.weights = w;
  state.settings.enableWS = els.enableWS.checked;
  state.settings.binanceKey = els.binanceKey.value.trim();
  state.settings.binanceSecret = els.binanceSecret.value.trim();
  state.settings.glassnodeKey = els.glassnodeKey.value.trim();
  state.settings.nansenKey = els.nansenKey.value.trim();
  state.settings.gammaKey = els.gammaKey.value.trim();
  state.settings.etfKey = els.etfKey.value.trim();
  localStorage.setItem('settings', JSON.stringify(state.settings));
  // пересоздаём фид, если менялся WS
  binance = new BinanceFeed({ enableWS: state.settings.enableWS });
  subscribeAll();
  els.dlg.close();
};

function openDlg(){
  els.enableWS.checked = state.settings.enableWS;
  els.binanceKey.value = state.settings.binanceKey||"";
  els.binanceSecret.value = state.settings.binanceSecret||"";
  els.glassnodeKey.value = state.settings.glassnodeKey||"";
  els.nansenKey.value = state.settings.nansenKey||"";
  els.gammaKey.value = state.settings.gammaKey||"";
  els.etfKey.value = state.settings.etfKey||"";
  renderWeights(state.settings.weights);
  els.dlg.showModal();
}

function renderWeights(w){
  els.weightsPanel.innerHTML = "";
  for (const k of Object.keys(DEFAULT_WEIGHTS)){
    const row = document.createElement('div');
    row.className = "row";
    row.innerHTML = `
      <label style="flex:1">${k}</label>
      <input type="range" min="1" max="5" step="1" value="${w[k]}" data-k="${k}" style="flex:3" />
      <span class="muted" style="width:32px;text-align:center">${w[k]}</span>
    `;
    row.querySelector('input').oninput = (e)=>{ row.querySelector('span').textContent = e.target.value; };
    els.weightsPanel.appendChild(row);
  }
}
function readWeights(){
  const w = {...DEFAULT_WEIGHTS};
  els.weightsPanel.querySelectorAll('input[type="range"]').forEach(inp=>{
    w[inp.dataset.k] = Number(inp.value);
  });
  return w;
}

function renderSources(){
  els.sources.innerHTML = "";
  ["Binance (WS/REST)", "On-chain (Glassnode/Nansen)", "ETF flows", "Gamma walls", "COT"].forEach(name=>{
    const li = document.createElement('li');
    li.textContent = `⏳ ${name}`;
    els.sources.appendChild(li);
  });
}

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
