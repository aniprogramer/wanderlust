const { execFile } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../../models/user");
const { connectDb, disconnectDb, clearDb, createUser } = require("../helpers");

const SCRIPT = path.join(__dirname, "../../scripts/make-admin.js");

const run = (args, env = {}, script = SCRIPT) =>
  new Promise((resolve) => {
    const { host, name } = mongoose.connection;
    const port = mongoose.connection.port;
    execFile(
      process.execPath,
      [script, ...args],
      { env: { ...process.env, NODE_ENV: "test", ATLAS: `mongodb://${host}:${port}/${name}`, ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

test("grants and revokes admin, and names the database", async () => {
  await createUser("alice");
  const granted = await run(["alice"]);
  expect(granted.code).toBe(0);
  expect(granted.stdout).toContain(mongoose.connection.name);
  expect(granted.stdout).not.toContain("[object");
  expect((await User.findOne({ username: "alice" })).isAdmin).toBe(true);

  expect((await run(["alice", "--revoke"])).code).toBe(0);
  expect((await User.findOne({ username: "alice" })).isAdmin).toBe(false);
});

test("reports an unknown user and missing arguments", async () => {
  expect((await run(["nobody"])).stderr).toContain("No user named nobody");
  expect((await run([])).code).toBe(1);
});

test("production needs --yes", async () => {
  await createUser("alice");
  const refused = await run(["alice"], { NODE_ENV: "production" });
  expect(refused.code).toBe(1);
  expect(refused.stderr).toContain("--yes");
  expect((await User.findOne({ username: "alice" })).isAdmin).toBe(false);
});

test("the migrate script names the database too", async () => {
  const { code, stdout } = await run(["status"], {}, path.join(__dirname, "../../scripts/migrate.js"));
  expect(code).toBe(0);
  expect(stdout).toContain(mongoose.connection.name);
  expect(stdout).not.toContain("[object");
});
