const fs = require("fs/promises");
const path = require("path");
const { minify: minifyHtml } = require("html-minifier-terser");
const { transform } = require("lightningcss");
const { minify } = require("terser");
const sharp = require("sharp");

const distDir = path.join(__dirname, "..", "dist");

function createStats() {
  return {
    html: { count: 0, before: 0, after: 0 },
    css: { count: 0, before: 0, after: 0 },
    js: { count: 0, before: 0, after: 0 },
    image: { count: 0, before: 0, after: 0 },
  };
}

function recordStat(stats, type, beforeBytes, afterBytes) {
  const bucket = stats[type];
  bucket.count += 1;
  bucket.before += beforeBytes;
  bucket.after += afterBytes;
}

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

function formatSummaryLine(type, bucket) {
  const savedBytes = bucket.before - bucket.after;
  const savedPercent = bucket.before === 0 ? 0 : ((savedBytes / bucket.before) * 100).toFixed(1);
  return `[minify] ${type}: ${formatBytes(bucket.before)} -> ${formatBytes(bucket.after)} across ${bucket.count} files (-${formatBytes(savedBytes)}, ${savedPercent}%)`;
}

function mergeStats(target, source) {
  for (const key of Object.keys(target)) {
    target[key].count += source[key].count;
    target[key].before += source[key].before;
    target[key].after += source[key].after;
  }
}

async function walk(directory) {
  const stats = createStats();
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const childStats = await walk(entryPath);
      mergeStats(stats, childStats);
      continue;
    }

    if (entry.name.endsWith(".html")) {
      const content = await fs.readFile(entryPath, "utf8");
      const beforeBytes = Buffer.byteLength(content);
      const result = await minifyHtml(content, {
        collapseWhitespace: true,
        conservativeCollapse: true,
        decodeEntities: true,
        minifyCSS: true,
        minifyJS: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        collapseBooleanAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        useShortDoctype: true,
        minifyURLs: true,
        keepClosingSlash: false,
      });

      await fs.writeFile(entryPath, result);
      recordStat(stats, "html", beforeBytes, Buffer.byteLength(result));
      continue;
    }

    if (entry.name.endsWith(".css")) {
      const content = await fs.readFile(entryPath);
      const beforeBytes = content.length;
      const result = transform({
        filename: entryPath,
        code: content,
        minify: true,
      });

      const output = Buffer.from(result.code);
      await fs.writeFile(entryPath, output);
      recordStat(stats, "css", beforeBytes, output.length);
      continue;
    }

    if (entry.name.endsWith(".png") || entry.name.endsWith(".jpg") || entry.name.endsWith(".jpeg") || entry.name.endsWith(".gif")) {
      const input = await fs.readFile(entryPath);
      const beforeBytes = input.length;
      const image = sharp(input).rotate();
      const output = entry.name.endsWith(".png")
        ? await image.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: true, colors: 256 }).toBuffer()
        : entry.name.endsWith(".gif")
        ? await image.gif({ effort: 10 }).toBuffer()
        : await image.jpeg({ quality: 75, mozjpeg: true, progressive: true }).toBuffer();

      await fs.writeFile(entryPath, output);
      recordStat(stats, "image", beforeBytes, output.length);
      continue;
    }

    if (entry.name.endsWith(".webp")) {
      const input = await fs.readFile(entryPath);
      const beforeBytes = input.length;
      const output = await sharp(input)
        .rotate()
        .webp({ quality: 70, effort: 6, alphaQuality: 80 })
        .toBuffer();

      await fs.writeFile(entryPath, output);
      recordStat(stats, "image", beforeBytes, output.length);
      continue;
    }

    if (entry.name.endsWith(".svg")) {
      const content = await fs.readFile(entryPath, "utf8");
      const beforeBytes = Buffer.byteLength(content);
      const optimized = content
        .replace(/<!--([\s\S]*?)-->/g, "")
        .replace(/>\s+</g, "><")
        .replace(/\s{2,}/g, " ")
        .replace(/\n+/g, "")
        .trim();

      await fs.writeFile(entryPath, optimized);
      recordStat(stats, "image", beforeBytes, Buffer.byteLength(optimized));
      continue;
    }

    if (entry.name.endsWith(".js") && !entry.name.endsWith(".min.js")) {
      const content = await fs.readFile(entryPath, "utf8");
      const beforeBytes = Buffer.byteLength(content);
      const result = await minify(content, {
        ecma: 2020,
        compress: {
          ecma: 2020,
          passes: 3,
          pure_getters: true,
          keep_fargs: false,
          unsafe_math: true,
        },
        format: {
          comments: false,
        },
        mangle: true,
      });

      if (result.code) {
        await fs.writeFile(entryPath, result.code);
        recordStat(stats, "js", beforeBytes, Buffer.byteLength(result.code));
      }
    }
  }

  return stats;
}

async function main() {
  if (process.argv.includes('--no-minify') || process.env.NODE_ENV === 'development') {
    console.log('[minify] skipped (development mode)');
    return;
  }

  try {
    await fs.access(distDir);
  } catch {
    console.error(`Missing dist directory: ${distDir}`);
    process.exit(1);
  }

  const startedAt = process.hrtime.bigint();
  const stats = await walk(distDir);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  const total = Object.values(stats).reduce(
    (accumulator, bucket) => {
      accumulator.count += bucket.count;
      accumulator.before += bucket.before;
      accumulator.after += bucket.after;
      return accumulator;
    },
    { count: 0, before: 0, after: 0 }
  );

  console.log("[minify] summary");
  console.log(formatSummaryLine("html", stats.html));
  console.log(formatSummaryLine("css", stats.css));
  console.log(formatSummaryLine("js", stats.js));
  console.log(formatSummaryLine("image", stats.image));
  console.log(formatSummaryLine("total", total));

  const averageMs = total.count === 0 ? 0 : elapsedMs / total.count;
  console.log(
    `[minify] Processed ${total.count} files in ${(elapsedMs / 1000).toFixed(2)} seconds (${averageMs.toFixed(1)}ms each)`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});