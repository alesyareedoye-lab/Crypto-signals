// app.js
// Связка UI + источники + простая логика сигналов.

import { normalizeSymbol, subscribeTicker, unsubscribeTicker, fetch24h, fetchFuturesInfo, onSourceStatus } from "./dataSources.js";

// Элементы UI
const pairsInput = document.querySelector("#pair-input");
const addBtn = document.querySelector("#add-pair");
const signalsList = document.querySelector("#signals-list");
const sourceStatus = document.querySelector("#source-status");

// Состояние
const pairs = new Map(); // symbol -> {price, changePct, funding, score, signal}

// Подпишемся на статусы источников
onSourceStatus(({source, status, message}) => {
  const row = document.createElement("div");
  row.textContent = `[${new Date().toLocaleTimeString()}] ${source} — ${status}${message ? " — " + message : ""}`;
  sourceStatus.prepend(row);
  // не раздуваем лог бесконечно
  while (sourceStatus.children.length > 20) sourceStatus.removeChild(sourceStatus.lastChild);
});

// Вспомогательная отрисовка
function render() {
  signalsList.innerHTML = "";
  [...pairs.values()].forEach(p => {
    const li = document.createElement("li");
    li.style.margin = "8px 0";
    li.style.padding = "12px";
    li.style.border = "1px solid #ddd";
    li.style.borderRadius = "8px";

    const signalColor = p.signal === "LONG" ? "#16a34a" : p.signal === "SHORT" ? "#dc2626" : "#6b7280";

    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <strong style="font-size:16px">${p.symbol}</strong>
        <span>Цена: <b>${p.price ? p.price.toLocaleString() : "—"}</b></span>
        <span>24h: <b style="color:${(p.changePct||0) >= 0 ? '#16a34a' : '#dc2626'}">${p.changePct?.toFixed?.(2) ?? "—"}%</b></span>
        <span>Funding: <b>${p.funding != null ? (p.funding * 100).toFixed(4) + "%" : "—"}</b></span>
        <span>Score: <b>${p.score?.toFixed?.(2) ?? "—"}</b></span>
        <span style="padding:4px 8px;border-radius:6px;background:${signalColor}20;border:1px solid ${signalColor};color:${signalColor}">
          ${p.signal ?? "NEUTRAL"}
        </span>
        <button data-remove="${p.symbol}" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:#fafafa">Удалить</button>
      </div>
    `;
    signalsList.appendChild(li);
  });
}

// Простая логика оценки сигнала
function computeScore({ changePct, funding }) {
  // базовая идея: рост 24h и умеренно отрицательный фандинг -> лонговый сигнал
  const cp = isFinite(changePct) ? changePct : 0;
  const fr = isFinite(funding) ? funding : 0;

  // нормируем и складываем
  const score = (cp / 5) - (fr * 50); // tweakable
  return Math.max(-5, Math.min(5, score));
}

function scoreToSignal(score) {
  if (score >= 1) return "LONG";
  if (score <= -1) return "SHORT";
  return "NEUTRAL";
}

// Добавление новой пары
async function addPair(raw) {
  const symbol = normalizeSymbol(raw);
  if (!symbol) return;
  if (pairs.has(symbol)) return;

  // заготовка
  pairs.set(symbol, { symbol, price: null, changePct: null, funding: null, score: null, signal: "NEUTRAL" });
  render();

  // REST: 24h + funding
  try {
    const [day, fut] = await Promise.all([
      fetch24h(symbol),
      fetchFuturesInfo(symbol)
    ]);
    const p = pairs.get(symbol);
    if (!p) return;
    p.changePct = parseFloat(day.priceChangePercent);
    p.funding = fut.lastFundingRate;
    // первичный score
    p.score = computeScore({ changePct: p.changePct, funding: p.funding });
    p.signal = scoreToSignal(p.score);
    render();
  } catch (e) {
    console.warn("REST fail", symbol, e.message);
  }

  // WS цены
  subscribeTicker(symbol, tick => {
    const p = pairs.get(symbol);
    if (!p) return;
    p.price = tick.price;
    // пересчёт скоров на каждом тике не обязателен, но можно
    p.score = computeScore({ changePct: p.changePct, funding: p.funding });
    p.signal = scoreToSignal(p.score);
    render();
  });
}

function removePair(symbol) {
  unsubscribeTicker(symbol);
  pairs.delete(symbol);
  render();
}

// UI события
addBtn?.addEventListener("click", () => {
  const val = pairsInput?.value?.trim();
  if (!val) return;
  addPair(val);
  pairsInput.value = "";
});

signalsList.addEventListener("click", (e) => {
  const btn
