const Anthropic = require('@anthropic-ai/sdk');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const nonkyc = require('./nonkycClient');
const { buildCandlestickChart } = require('./chartService');

const CHART_FILENAME = 'ta-chart.png';

const NARRATIVE_MODEL = 'claude-haiku-4-5';
const PIVOT_WINDOW = 3; // bars on each side that must be lower/higher for a pivot

function findPivotLevels(candles) {
  const pivotHighs = [];
  const pivotLows = [];

  for (let i = PIVOT_WINDOW; i < candles.length - PIVOT_WINDOW; i++) {
    const window = candles.slice(i - PIVOT_WINDOW, i + PIVOT_WINDOW + 1);
    const candle = candles[i];
    if (window.every((c) => c.high <= candle.high)) pivotHighs.push(candle.high);
    if (window.every((c) => c.low >= candle.low)) pivotLows.push(candle.low);
  }

  return { pivotHighs, pivotLows };
}

/**
 * Picks up to two support levels below the current price and two resistance
 * levels above it, nearest first, from detected swing pivots. Falls back to
 * the session high/low when pivots are too sparse (e.g. a quiet market).
 */
function computeKeyLevels(candles, ticker) {
  const { pivotHighs, pivotLows } = findPivotLevels(candles);
  const price = ticker.lastPrice;

  const resistance = [...new Set(pivotHighs)]
    .filter((level) => level > price)
    .sort((a, b) => a - b)
    .slice(0, 2);

  const support = [...new Set(pivotLows)]
    .filter((level) => level < price)
    .sort((a, b) => b - a)
    .slice(0, 2);

  if (resistance.length === 0) resistance.push(ticker.high);
  if (support.length === 0) support.push(ticker.low);

  return { support, resistance };
}

async function generateNarrative(stats) {
  const client = new Anthropic({ apiKey: config.ta.anthropicApiKey });

  const response = await client.messages.create({
    model: NARRATIVE_MODEL,
    max_tokens: 400,
    system:
      'You write short, punchy crypto technical-analysis commentary for a Discord channel, in the ' +
      'style of an experienced chart-watching trader. You are given exact price statistics as JSON - ' +
      'treat every number in it as ground truth and do not invent new numbers or price levels. ' +
      'Respond with ONLY a raw JSON object (no markdown fences, no commentary outside the JSON) with ' +
      'exactly two string fields: "structureMomentum" (1-2 sentences describing chart structure, ' +
      'recent move, and momentum) and "outlook" (1 sentence on what to expect next). Do not restate ' +
      'the exact price or level numbers in your text - refer to them qualitatively (e.g. "near session ' +
      'lows", "after a sharp spike"). Do not mention that you are an AI.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify(stats),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('No text content in Claude response');

  // Claude sometimes wraps the JSON in a ```json ... ``` fence despite being
  // told not to - strip it before parsing rather than fail the whole post.
  const fenced = textBlock.text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : textBlock.text);
}

function buildTaEmbed({ ticker, levels, narrative, market, resolutionMinutes }) {
  const [base, quote] = market.split('_');
  const changeSign = ticker.changePercent >= 0 ? '+' : '';
  const priceAction =
    `Trading at ${ticker.lastPrice} ${quote}, showing a ${changeSign}${ticker.changePercent.toFixed(2)}% ` +
    `move over the session (24h range: ${ticker.low} - ${ticker.high} ${quote}).`;

  const keyLevels =
    `**Support:** ~${levels.support.join(' / ')} ${quote}\n` +
    `**Resistance:** ~${levels.resistance.join(' / ')} ${quote}`;

  return new EmbedBuilder()
    .setTitle(`${base}/${quote} Technical Update (${resolutionMinutes}m Chart)`)
    .addFields(
      { name: 'Current Price Action', value: priceAction },
      { name: 'Structure & Momentum', value: narrative.structureMomentum },
      { name: 'Key Levels to Watch', value: keyLevels },
      { name: 'Outlook', value: narrative.outlook }
    )
    .setImage(`attachment://${CHART_FILENAME}`)
    .setFooter({ text: `Chart via NonKYC (${market})` })
    .setColor(0xf7931a)
    .setTimestamp();
}

async function buildDailyUpdate() {
  const { market, resolutionMinutes, lookbackHours } = config.ta;

  const [ticker, candles] = await Promise.all([
    nonkyc.getTicker(market),
    nonkyc.getCandles(market, resolutionMinutes, lookbackHours),
  ]);

  const levels = computeKeyLevels(candles, ticker);

  const [narrative, chartBuffer] = await Promise.all([
    generateNarrative({
      market,
      resolutionMinutes,
      currentPrice: ticker.lastPrice,
      changePercent: ticker.changePercent,
      sessionHigh: ticker.high,
      sessionLow: ticker.low,
      support: levels.support,
      resistance: levels.resistance,
    }),
    buildCandlestickChart(candles, { market, resolutionMinutes }),
  ]);

  const embed = buildTaEmbed({ ticker, levels, narrative, market, resolutionMinutes });
  const attachment = new AttachmentBuilder(chartBuffer, { name: CHART_FILENAME });

  return { embed, attachment };
}

async function postDailyUpdate(client) {
  if (!config.ta.enabled) {
    throw new Error('TA feature is not configured (missing TA_CHANNEL_ID or ANTHROPIC_API_KEY)');
  }

  const { embed, attachment } = await buildDailyUpdate();
  const channel = await client.channels.fetch(config.ta.channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`TA_CHANNEL_ID (${config.ta.channelId}) is not a text channel`);
  }

  await channel.send({ embeds: [embed], files: [attachment] });
  logger.info(`Posted daily TA update to channel ${config.ta.channelId}`);
}

module.exports = { postDailyUpdate, buildDailyUpdate, computeKeyLevels };
