const CHART_CANDLE_COUNT = 96; // ~24h of 15m bars - keeps the image readable

// Matches nonkyc.io's own TradingView-based charting widget (dark theme,
// teal-green up / coral-red down candles) so the generated chart looks
// consistent with the manual screenshots this replaces.
const CANDLE_COLORS = { up: '#26a69a', down: '#ef5350', unchanged: '#888888' };

async function buildCandlestickChart(candles, { market, resolutionMinutes }) {
  const recent = candles.slice(-CHART_CANDLE_COUNT);
  const data = recent.map((c) => ({ x: c.time, o: c.open, h: c.high, l: c.low, c: c.close }));

  const config = {
    type: 'candlestick',
    data: {
      datasets: [
        {
          label: market,
          data,
          color: CANDLE_COLORS,
          borderColor: CANDLE_COLORS,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${market.replace('_', '/')} - ${resolutionMinutes}m Chart`,
          color: '#d1d4dc',
        },
      },
      scales: {
        x: { type: 'time', ticks: { color: '#787b86' }, grid: { color: '#2a2e39' } },
        y: { ticks: { color: '#787b86' }, grid: { color: '#2a2e39' } },
      },
    },
  };

  const res = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '3',
      chart: config,
      width: 800,
      height: 400,
      backgroundColor: '#131722',
      format: 'png',
    }),
  });

  if (!res.ok) {
    throw new Error(`QuickChart request failed (${res.status})`);
  }

  return Buffer.from(await res.arrayBuffer());
}

module.exports = { buildCandlestickChart };
