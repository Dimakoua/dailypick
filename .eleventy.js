module.exports = function(eleventyConfig) {
  // Tell Eleventy to watch your CSS changes for live reload.
  eleventyConfig.addWatchTarget("./blog/css/");

  // Passthrough copy for static assets.
  // Eleventy will copy these files/folders directly to your output folder (_site).
  eleventyConfig.addPassthroughCopy("./blog/css/");
  eleventyConfig.addPassthroughCopy("assets"); // For your favicons and images
  // If you have other static assets like JS files for your games, add them here too.
  // eleventyConfig.addPassthroughCopy("js");

  // Collections: Create a 'post' collection from all markdown files in 'blog/posts'
  eleventyConfig.addCollection("post", function(collectionApi) {
    // The input directory is already set to "./blog", so "posts/*.md" is relative to that.
    return collectionApi.getFilteredByGlob("./blog/posts/**/*.md");
  });

  return {
    // Define the input directory.
    // If your source files are in the root, you can often omit this or set it to "."
    // For more complex projects, you might use "src" or "app"
    dir: {
      input: "./blog", // Root directory for input files
      includes: "_includes", // Folder for layouts, partials
      data: "_data", // Folder for global data files
      output: "_site" // Default output folder
    },
    // Template engines to process
    templateFormats: [
      "md",
      "njk", // Nunjucks, a popular templating language for Eleventy
      "html" // Allow plain HTML files too
    ],
    // Pre-process markdown files with Nunjucks for more power
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
