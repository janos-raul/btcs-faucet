async function fetchStatus() {
  try {
    const res = await fetch('/faucet/status');
    const data = await res.json();

    if (!data.ok) {
      throw new Error('status endpoint returned ok:false');
    }

    document.getElementById('rules-info').innerHTML = `
      <div class="stat-row">
        <span class="stat-label">Amount</span>
        <span class="stat-value">${data.minAmount} - ${data.maxAmount} BTCS</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Limit</span>
        <span class="stat-value">1 per account/address, every ${data.cooldownHours}h</span>
      </div>
    `;

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

    document.getElementById('update-time').textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Failed to fetch faucet status:', err);
    document.getElementById('faucet-status').className = 'status-indicator offline';
    document.getElementById('faucet-info').innerHTML =
      '<div style="color: #f44336;">Failed to load faucet status</div>';
    document.getElementById('rules-info').innerHTML =
      '<div style="color: #f44336;">Failed to load</div>';
  }
}

fetchStatus();
setInterval(fetchStatus, 30000);
