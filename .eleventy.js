const sitemap = require("@quasibit/eleventy-plugin-sitemap");

module.exports = function(eleventyConfig) {
  // Tell Eleventy to watch your CSS changes for live reload.
  eleventyConfig.addWatchTarget("./blog/css/");

  // Passthrough copy for static assets. Eleventy will copy these directly.
  // Copy blog's CSS to the root `css` folder in the output.
  eleventyConfig.addPassthroughCopy({ "blog/css": "css" });
  eleventyConfig.addPassthroughCopy("assets"); // For root favicons, game assets, OG images
  
  // Add passthrough copy for game directories and their assets
  eleventyConfig.addPassthroughCopy("wheel");
  eleventyConfig.addPassthroughCopy({ "public": "." });
  eleventyConfig.addPassthroughCopy("speedway");
  eleventyConfig.addPassthroughCopy("trap");
  eleventyConfig.addPassthroughCopy("letters");
  eleventyConfig.addPassthroughCopy("gravity-drift");
  eleventyConfig.addPassthroughCopy("ballgame");
  // If you have other static assets like JS files for your games, add them here too.
  // eleventyConfig.addPassthroughCopy("js");

  // Sitemap Plugin
  eleventyConfig.addPlugin(sitemap, {
    sitemap: {
      hostname: "https://dailypick.dev",
      lastmodDateOnly: true,
    },
  });

  // Collections: Create a 'post' collection from all markdown files in 'blog/posts'
  eleventyConfig.addCollection("post", function(collectionApi) {
    // The input directory is already set to "./blog", so "posts/*.md" is relative to that.
    return collectionApi.getFilteredByGlob("./blog/posts/**/*.md");
    // With input dir as root, the glob needs to be relative to root.
    // return collectionApi.getFilteredByGlob("./blog/posts/**/*.md"); // This remains correct
  });

  // Create a custom collection for the sitemap that excludes the README.md file.
  eleventyConfig.addCollection("sitemap", function(collectionApi) {
    // Define a list of file paths to exclude from the sitemap.
    const excludedPaths = ['./Readme.md', './blog/prompt.md'];

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
      } else if (item.inputPath.startsWith('./blog/posts/')) {
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
      includes: "blog/_includes", // Layouts are in blog/_includes
      data: "blog/_data", // Global data is in blog/_data
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
