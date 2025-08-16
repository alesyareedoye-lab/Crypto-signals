// Источники данных: Binance (цены/объёмы, WebSocket), заглушки для on-chain/ETF/опционов
export class BinanceFeed {
  constructor({ enableWS=true }={}) {
    this.ws = null;
    this.enableWS = enableWS;
    this.listeners = new Map(); // symbol -> callback
  }
  subscribe(symbol, cb) {
    const s = symbol.toLowerCase();
    this.listeners.set(s, cb);
    if (this.enableWS) this.openWS();
    // Первичный REST-тик
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      .then(r=>r.json()).then(j=>{
        cb({
          symbol, price: Number(j.lastPrice), priceChangePercent: Number(j.priceChangePercent),
          volume: Number(j.volume), bid: Number(j.bidPrice), ask: Number(j.askPrice), ts: Date.now()
        });
      }).catch(()=>{});
  }
  openWS(){
    if (this.ws) return;
    const streams = Array.from(this.listeners.keys()).map(s=>`${s}@ticker`).join('/');
    if (!streams) return;
    this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    this.ws.onmessage = ev=>{
      const msg = JSON.parse(ev.data);
      const d = msg.data;
      const cb = this.listeners.get(d.s.toLowerCase());
      if (cb) cb({
        symbol: d.s, price: Number(d.c), bid: Number(d.b), ask: Number(d.a),
        volume: Number(d.v), priceChangePercent: Number(d.P), ts: d.E
      });
    };
    this.ws.onclose = ()=>{ this.ws = null; setTimeout(()=>this.openWS(), 3000); };
  }
}

// Заглушки под твои ключи — потом подключишь реальные эндпоинты:
export async function getGlassnodeMetrics(_key){ return { exchangeNetPos:null, realizedPL:null, dormancy:null }; }
export async function getNansenStablecoinFlows(_key){ return { inflow:null, outflow:null }; }
export async function getETFSpotFlows(_key){ return { btc:null, eth:null }; }
export async function getGammaWalls(_key){ return { strikes:[], pin:null }; }
export async function getCOTDealerPositioning(){ return { dealersNet: null }; }
