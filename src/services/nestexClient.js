const BASE_URL = 'https://api.nestex.one/cg';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NestEx API request failed (${res.status}): ${url}`);
  }
  return res.json();
}

/**
 * @param {string} market - e.g. "BTCS_USDT"
 */
async function getTicker(market) {
  const data = await fetchJson(`${BASE_URL}/tickers/${market}`);

  const lastPrice = Number(data.last_price);
  const previousPrice = Number(data.oldltp24h);
  const changePercent = previousPrice > 0 ? ((lastPrice - previousPrice) / previousPrice) * 100 : 0;

  return {
    lastPrice,
    high: Number(data.high),
    low: Number(data.low),
    changePercent,
    baseVolume: Number(data.base_volume),
    quoteVolume: Number(data.target_volume),
  };
}

module.exports = { getTicker };
