function timestamp() {
  return new Date().toISOString();
}

function line(level, args) {
  return [`[${timestamp()}] [${level}]`, ...args];
}

module.exports = {
  info: (...args) => console.log(...line('INFO', args)),
  warn: (...args) => console.warn(...line('WARN', args)),
  error: (...args) => console.error(...line('ERROR', args)),
};
