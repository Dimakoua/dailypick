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
  eleventyConfig.addPassthroughCopy("gravity_drift");
  // If you have other static assets like JS files for your games, add them here too.
  // eleventyConfig.addPassthroughCopy("js");

  // Collections: Create a 'post' collection from all markdown files in 'blog/posts'
  eleventyConfig.addCollection("post", function(collectionApi) {
    // The input directory is already set to "./blog", so "posts/*.md" is relative to that.
    return collectionApi.getFilteredByGlob("./blog/posts/**/*.md");
    // With input dir as root, the glob needs to be relative to root.
    // return collectionApi.getFilteredByGlob("./blog/posts/**/*.md"); // This remains correct
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
