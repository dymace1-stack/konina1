import { spawnSync } from "node:child_process";

const buildEnv = {
  ...process.env,
  // Prisma Client generation does not need a live database connection.
  // Keep Vercel builds independent from runtime DATABASE_URL configuration.
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://build:build@localhost:5432/build?schema=public"
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"], buildEnv);
run("npx", ["next", "build"], buildEnv);
