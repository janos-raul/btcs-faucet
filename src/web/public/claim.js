function waitForTurnstile() {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve();
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function formatDuration(ms) {
  const totalMinutes = Math.ceil((ms || 0) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function describeError(reason, retryAfterMs) {
  switch (reason) {
    case 'cooldown':
      return `You (or that address) already claimed recently. Try again in ${formatDuration(retryAfterMs)}.`;
    case 'rate_limited':
      return `You're going a bit fast - try again in ${Math.ceil((retryAfterMs || 0) / 1000)}s.`;
    case 'invalid_address':
      return "That doesn't look like a valid BTCS address.";
    case 'faucet_empty':
      return 'The faucet is empty right now - check back later!';
    case 'captcha_failed':
      return 'Verification failed - please try the checkbox again.';
    case 'captcha_unavailable':
      return 'Verification service is unavailable right now. Please try again shortly.';
    case 'web_claims_disabled':
      return "Web claiming isn't enabled yet - use Discord for now.";
    default:
      return 'Something went wrong sending your coins. Please try again shortly.';
  }
}

async function initClaimForm() {
  const container = document.getElementById('web-claim-content');

  let status;
  try {
    const res = await fetch('/faucet/status');
    status = await res.json();
  } catch (err) {
    container.innerHTML = '<p style="color: #f44336;">Could not load the claim form.</p>';
    return;
  }

  if (!status.ok || !status.webClaimEnabled) {
    container.innerHTML = '<p>Web claiming isn\'t enabled yet - use <code>/faucet</code> in Discord for now.</p>';
    return;
  }

  container.innerHTML = `
    <form id="claim-form" class="claim-form">
      <input type="text" id="claim-address" class="claim-input" placeholder="Your BTCS address"
        autocomplete="off" required />
      <div id="turnstile-container"></div>
      <button type="submit" id="claim-submit" class="claim-button" disabled>Claim BTCS</button>
    </form>
    <div id="claim-result" class="claim-result"></div>
  `;

  await waitForTurnstile();

  let currentToken = null;
  const submitBtn = document.getElementById('claim-submit');

  const widgetId = window.turnstile.render('#turnstile-container', {
    sitekey: status.turnstileSiteKey,
    theme: 'dark',
    callback: (token) => {
      currentToken = token;
      submitBtn.disabled = false;
    },
    'expired-callback': () => {
      currentToken = null;
      submitBtn.disabled = true;
    },
  });

  document.getElementById('claim-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentToken) return;

    const address = document.getElementById('claim-address').value.trim();
    const resultEl = document.getElementById('claim-result');

    submitBtn.disabled = true;
    resultEl.className = 'claim-result';
    resultEl.textContent = 'Submitting...';

    try {
      const res = await fetch('/faucet/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, turnstileToken: currentToken }),
      });
      const data = await res.json();

      if (data.ok) {
        resultEl.className = 'claim-result success';
        resultEl.innerHTML = `Sent <strong>${data.amount} BTCS</strong> to <code>${data.address}</code>.<br>Tx: <code>${data.txid}</code>`;
        document.getElementById('claim-form').reset();
      } else {
        resultEl.className = 'claim-result error';
        resultEl.textContent = describeError(data.reason, data.retryAfterMs);
      }
    } catch (err) {
      resultEl.className = 'claim-result error';
      resultEl.textContent = 'Something went wrong. Please try again.';
    } finally {
      currentToken = null;
      window.turnstile.reset(widgetId);
      submitBtn.disabled = true;
    }
  });
}

initClaimForm();
