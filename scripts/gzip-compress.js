const fs = require("fs/promises");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);
const distDir = path.join(__dirname, "..", "dist");

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

async function walk(directory) {
  const stats = {
    html: { count: 0, before: 0, after: 0, saved: 0 },
    css: { count: 0, before: 0, after: 0, saved: 0 },
    js: { count: 0, before: 0, after: 0, saved: 0 },
  };

  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const childStats = await walk(entryPath);
      for (const key in stats) {
        stats[key].count += childStats[key].count;
        stats[key].before += childStats[key].before;
        stats[key].after += childStats[key].after;
        stats[key].saved += childStats[key].saved;
      }
      continue;
    }

    const isCompressible = 
      entry.name.endsWith(".html") || 
      entry.name.endsWith(".css") || 
      entry.name.endsWith(".js");

    if (isCompressible) {
      const content = await fs.readFile(entryPath);
      const beforeBytes = content.length;

      const compressed = await gzip(content, { level: 9 });
      const afterBytes = compressed.length;
      const saved = ((1 - afterBytes / beforeBytes) * 100).toFixed(1);

      const gzPath = `${entryPath}.gz`;
      await fs.writeFile(gzPath, compressed);

      let type = "js";
      if (entry.name.endsWith(".html")) type = "html";
      else if (entry.name.endsWith(".css")) type = "css";

      stats[type].count += 1;
      stats[type].before += beforeBytes;
      stats[type].after += afterBytes;
      stats[type].saved += (beforeBytes - afterBytes);
    }
  }

  return stats;
}

async function main() {
  console.log("[gzip] Starting compression of dist files...\n");

  try {
    const stats = await walk(distDir);

    console.log("\n[gzip] Compression summary:");
    for (const [type, bucket] of Object.entries(stats)) {
      if (bucket.count > 0) {
        const savedPercent = ((bucket.saved / bucket.before) * 100).toFixed(1);
        console.log(
          `[gzip] ${type.toUpperCase()}: ${formatBytes(bucket.before)} -> ${formatBytes(bucket.after)} across ${bucket.count} files (-${formatBytes(bucket.saved)}, ${savedPercent}%)`
        );
      }
    }

    const totalBefore = Object.values(stats).reduce((sum, s) => sum + s.before, 0);
    const totalAfter = Object.values(stats).reduce((sum, s) => sum + s.after, 0);
    const totalSaved = totalBefore - totalAfter;
    const totalPercent = ((totalSaved / totalBefore) * 100).toFixed(1);
    
    console.log(
      `\n[gzip] TOTAL: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} (-${formatBytes(totalSaved)}, ${totalPercent}%)\n`
    );
  } catch (error) {
    console.error("[gzip] Error during compression:", error);
    process.exit(1);
  }
}

main();
