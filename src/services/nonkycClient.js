const BASE_URL = 'https://api.nonkyc.io/api/v2';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NonKYC API request failed (${res.status}): ${url}`);
  }
  return res.json();
}

/**
 * @param {string} market - e.g. "BTCS_USDC"
 */
async function getTicker(market) {
  const data = await fetchJson(`${BASE_URL}/ticker/${market}`);
  return {
    lastPrice: Number(data.last_price),
    high: Number(data.high),
    low: Number(data.low),
    changePercent: Number(data.change_percent),
    baseVolume: Number(data.base_volume),
    quoteVolume: Number(data.target_volume),
  };
}

/**
 * @param {string} market - e.g. "BTCS_USDC"
 * @param {number} resolutionMinutes - candle size, e.g. 15
 * @param {number} lookbackHours - how far back to fetch candles
 */
async function getCandles(market, resolutionMinutes, lookbackHours) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - lookbackHours * 3600;
  const url = `${BASE_URL}/market/candles?symbol=${market}&resolution=${resolutionMinutes}&from=${from}&to=${to}`;
  const data = await fetchJson(url);
  const bars = data.bars || [];
  return bars
    .map((bar) => ({
      time: bar.time,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number(bar.volume),
    }))
    .sort((a, b) => a.time - b.time);
}

module.exports = { getTicker, getCandles };
