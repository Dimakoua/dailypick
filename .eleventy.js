const sitemap = require("@quasibit/eleventy-plugin-sitemap");

module.exports = function(eleventyConfig) {
  // Tell Eleventy to watch your CSS changes for live reload.
  eleventyConfig.addWatchTarget("./content/blog/css/");
  // Passthrough copy for static assets. Eleventy will copy these directly.
  // Copy blog's CSS to the root `css` folder in the output.
  eleventyConfig.addPassthroughCopy({ "content/blog/css": "css" });
  eleventyConfig.addPassthroughCopy("assets"); // For root favicons, game assets, OG images

  // Add passthrough copy for public assets and game directories
  eleventyConfig.addPassthroughCopy({ "public": "." });
  eleventyConfig.addPassthroughCopy({ "apps": "apps" });

  // Sitemap Plugin
  eleventyConfig.addPlugin(sitemap, {
    sitemap: {
      hostname: "https://dailypick.dev",
      lastmodDateOnly: true,
      xmlns: {
        news: false,
        xhtml: false,
        image: false,
        video: false,
      },
    },
  });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Collections: Create a 'post' collection from all markdown files in 'blog/posts'
  eleventyConfig.addCollection("post", function(collectionApi) {
    // The input directory is already set to "./blog", so "posts/*.md" is relative to that.
    return collectionApi.getFilteredByGlob("./content/blog/posts/**/*.md");
    // With input dir as root, the glob needs to be relative to root.
    // return collectionApi.getFilteredByGlob("./blog/posts/**/*.md"); // This remains correct
  });

  // Provide a default layout for any file inside the blog posts folder that
  // doesn't explicitly specify one. Previously many posts had a `layout:`
  // frontmatter, but the new entry created on 2026-02-20 lacked it which caused
  // Eleventy to emit only the raw HTML with an empty <head>. The computed data
  // below ensures every post is wrapped in `post.njk` automatically.
  eleventyConfig.addGlobalData("eleventyComputed", {
    layout: data => {
      if (data.layout) {
        return data.layout; // honor explicit choice
      }
      if (
        data.page &&
        data.page.inputPath &&
        data.page.inputPath.includes("/content/blog/posts/")
      ) {
        return "post.njk";
      }
      return data.layout;
    }
  });

  // Create a custom collection for the sitemap that excludes the README.md file.
  eleventyConfig.addCollection("sitemap", function(collectionApi) {
    // Define a list of file paths to exclude from the sitemap.
    const excludedPaths = [
      './README.md',
      './Readme.md',
      './content/blog/prompt.md',
      './BLOG_OVERHAUL_PHASE_2_COMPLETE.md',
      './BLOG_OVERHAUL_STRATEGY.md'
    ];

    const items = collectionApi.getAll().filter(item => {
      return !excludedPaths.includes(item.inputPath);
    });

    for (const item of items) {
      if (!item.data.sitemap) {
        item.data.sitemap = {};
      }

      if (item.url === '/') {
        item.data.sitemap.changefreq = 'daily';
        item.data.sitemap.priority = 1.0;
      } else if (item.inputPath.startsWith('./content/blog/posts/')) {
        item.data.sitemap.changefreq = 'weekly';
        item.data.sitemap.priority = 0.8;
      } else {
        item.data.sitemap.changefreq = 'monthly';
        item.data.sitemap.priority = 0.5;
      }
    }

    return items;
  });

  return {
    dir: {
      input: ".", // Process files from the project root
      includes: "_includes", // Layouts are in _includes
      data: "content/blog/_data", // Global data is in content/blog/_data
      output: "dist" // Default output folder
    },
    // Template engines to process
    templateFormats: [
      "md",
      "njk", // Nunjucks, a popular templating language for Eleventy
      "html" // Allow plain HTML files from root and game folders
    ],
    // Pre-process markdown files with Nunjucks for more power
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
