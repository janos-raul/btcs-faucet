async function fetchStatus() {
  try {
    const res = await fetch('/faucet/status');
    const data = await res.json();

    if (!data.ok) {
      throw new Error('status endpoint returned ok:false');
    }

    document.getElementById('service-status').className = 'status-indicator online';

    const rulesHtml = `
      <div class="stat-row">
        <span class="stat-label">Amount</span>
        <span class="stat-value">${data.minAmount} - ${data.maxAmount} BTCS</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Limit</span>
        <span class="stat-value">1 per account/address, every ${data.cooldownHours}h</span>
      </div>
    `;
    document.getElementById('rules-info-web').innerHTML = rulesHtml;
    document.getElementById('rules-info-discord').innerHTML = rulesHtml;

    const hasBalance = data.balance !== null;
    document.getElementById('faucet-status').className = 'status-indicator ' + (hasBalance ? 'online' : 'offline');

    const balanceValue = hasBalance ? `${data.balance} BTCS` : 'Unavailable';
    let faucetInfo = `
      <div class="stat-row">
        <span class="stat-label">Balance</span>
        <span class="stat-value">${balanceValue}</span>
      </div>
    `;
    if (data.topupAddress) {
      faucetInfo += `
        <div class="stat-row">
          <span class="stat-label">Refill address</span>
          <span class="stat-value"><code>${data.topupAddress}</code></span>
        </div>
      `;
    }
    document.getElementById('faucet-info').innerHTML = faucetInfo;

    const devFundCard = document.getElementById('dev-fund-card');
    const devFundAddresses = [
      ['BTCS', data.devFundAddress],
      ['BTC', data.devFundBtcAddress],
      ['BCH', data.devFundBchAddress],
    ].filter(([, address]) => address);

    if (devFundAddresses.length > 0) {
      document.getElementById('dev-fund-info').innerHTML = devFundAddresses
        .map(
          ([label, address]) => `
            <div class="stat-row">
              <span class="stat-label">${label}</span>
              <span class="stat-value"><code>${address}</code></span>
            </div>
          `
        )
        .join('');
      devFundCard.hidden = false;
    } else {
      devFundCard.hidden = true;
    }

    document.getElementById('update-time').textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Failed to fetch faucet status:', err);
    document.getElementById('service-status').className = 'status-indicator offline';
    document.getElementById('faucet-status').className = 'status-indicator offline';
    document.getElementById('faucet-info').innerHTML =
      '<div style="color: #f44336;">Failed to load faucet status</div>';
    const failedHtml = '<div style="color: #f44336;">Failed to load</div>';
    document.getElementById('rules-info-web').innerHTML = failedHtml;
    document.getElementById('rules-info-discord').innerHTML = failedHtml;
  }
}

fetchStatus();
setInterval(fetchStatus, 30000);
