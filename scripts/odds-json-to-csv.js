#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { inputPath: null, outputDir: process.cwd(), prefix: "players" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--out-dir") {
      args.outputDir = argv[index + 1]
        ? path.resolve(argv[index + 1])
        : process.cwd();
      index += 1;
      continue;
    }

    if (arg === "--prefix") {
      args.prefix = argv[index + 1] || "players";
      index += 1;
      continue;
    }

    if (!args.inputPath) {
      args.inputPath = path.resolve(arg);
    }
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/odds-json-to-csv.js <input.json> [--out-dir ./output] [--prefix masters]",
    "  cat input.json | node scripts/odds-json-to-csv.js [--out-dir ./output] [--prefix masters]",
    "",
    "Outputs:",
    "  <prefix>.csv          Flat player CSV sorted by odds",
    "  <prefix>.buckets.csv  Same players grouped into 5-player odds buckets",
  ].join("\n");
}

function parseOdds(odds) {
  if (typeof odds === "number") return odds;
  if (typeof odds !== "string") return Number.NaN;

  const normalized = odds.trim().replace(/,/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
}

function sortPlayers(players) {
  return [...players].sort((left, right) => {
    const leftOdds = parseOdds(left.odds);
    const rightOdds = parseOdds(right.odds);

    if (leftOdds !== rightOdds) {
      return leftOdds - rightOdds;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildPlayerRows(players) {
  return [
    ["rank", "id", "name", "odds", "bookmakerCount"],
    ...players.map((player, index) => [
      index + 1,
      player.id,
      player.name,
      parseOdds(player.odds),
      player.bookmakerCount,
    ]),
  ];
}

function buildBucketRows(players, bucketSize) {
  const rows = [
    [
      "bucket",
      "bucketPosition",
      "globalRank",
      "id",
      "name",
      "odds",
      "bookmakerCount",
      "bucketStartOdds",
      "bucketEndOdds",
    ],
  ];

  for (let index = 0; index < players.length; index += bucketSize) {
    const bucketPlayers = players.slice(index, index + bucketSize);
    const bucketNumber = Math.floor(index / bucketSize) + 1;
    const bucketStartOdds = parseOdds(bucketPlayers[0].odds);
    const bucketEndOdds = parseOdds(
      bucketPlayers[bucketPlayers.length - 1].odds,
    );

    bucketPlayers.forEach((player, bucketIndex) => {
      rows.push([
        bucketNumber,
        bucketIndex + 1,
        index + bucketIndex + 1,
        player.id,
        player.name,
        parseOdds(player.odds),
        player.bookmakerCount,
        bucketStartOdds,
        bucketEndOdds,
      ]);
    });
  }

  return rows;
}

async function readInput(inputPath) {
  if (inputPath) {
    return fs.promises.readFile(inputPath, "utf8");
  }

  if (process.stdin.isTTY) {
    throw new Error(usage());
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const { inputPath, outputDir, prefix } = parseArgs(process.argv.slice(2));
  const raw = await readInput(inputPath);
  const payload = JSON.parse(raw);

  if (!payload || !Array.isArray(payload.players)) {
    throw new Error('Expected JSON shaped like { "players": [...] }');
  }

  const players = sortPlayers(payload.players);
  const bucketSize = 5;
  const flatCsv = toCsv(buildPlayerRows(players));
  const bucketCsv = toCsv(buildBucketRows(players, bucketSize));

  await fs.promises.mkdir(outputDir, { recursive: true });

  const flatPath = path.join(outputDir, `${prefix}.csv`);
  const bucketPath = path.join(outputDir, `${prefix}.buckets.csv`);

  await fs.promises.writeFile(flatPath, flatCsv, "utf8");
  await fs.promises.writeFile(bucketPath, bucketCsv, "utf8");

  const bucketCount = Math.ceil(players.length / bucketSize);
  process.stdout.write(
    [
      `Wrote ${players.length} players to ${flatPath}`,
      `Wrote ${bucketCount} buckets to ${bucketPath}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
