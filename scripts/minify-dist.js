const fs = require("fs/promises");
const path = require("path");
const { minify: minifyHtml } = require("html-minifier-terser");
const { transform } = require("lightningcss");
const { minify } = require("terser");

const distDir = path.join(__dirname, "..", "dist");

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(entryPath);
      continue;
    }

    if (entry.name.endsWith(".html")) {
      const content = await fs.readFile(entryPath, "utf8");
      const result = await minifyHtml(content, {
        collapseWhitespace: true,
        conservativeCollapse: true,
        decodeEntities: true,
        minifyCSS: true,
        minifyJS: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        useShortDoctype: true,
      });

      await fs.writeFile(entryPath, result);
      continue;
    }

    if (entry.name.endsWith(".css")) {
      const content = await fs.readFile(entryPath);
      const result = transform({
        filename: entryPath,
        code: content,
        minify: true,
      });

      await fs.writeFile(entryPath, Buffer.from(result.code));
      continue;
    }

    if (entry.name.endsWith(".js") && !entry.name.endsWith(".min.js")) {
      const content = await fs.readFile(entryPath, "utf8");
      const result = await minify(content, {
        compress: {
          passes: 2,
        },
        format: {
          comments: false,
        },
        mangle: true,
      });

      if (result.code) {
        await fs.writeFile(entryPath, result.code);
      }
    }
  }
}

async function main() {
  try {
    await fs.access(distDir);
  } catch {
    console.error(`Missing dist directory: ${distDir}`);
    process.exit(1);
  }

  await walk(distDir);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});