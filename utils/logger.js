// JSON lines on standard output; the host collects them. Fields that could identify a
// person or open an account are dropped here, so a careless caller cannot leak them.
const BLOCKED = /pass|token|secret|session|cookie|email|authorization|body/i;

const clean = (fields) =>
  Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) => !BLOCKED.test(key) && value !== undefined,
    ),
  );

const write = (level, message, fields = {}) => {
  // Tests stay quiet unless a test asks for the output
  if (process.env.NODE_ENV === "test" && !process.env.LOG_IN_TEST) return;
  process.stdout.write(
    `${JSON.stringify({
      level,
      time: new Date().toISOString(),
      message,
      ...clean(fields),
    })}\n`,
  );
};

module.exports = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields),
  clean,
};
