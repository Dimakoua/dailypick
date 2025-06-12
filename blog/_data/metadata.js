module.exports = {
  siteTitle: "Daily Pick - Fun & Fair Team Decision Tools",
  siteDescription: "Make your daily stand-ups and team decisions more engaging with Daily Pick! Choose from fun games like the Decision Wheel, Speedway Racer, and Trap! to fairly pick names or set order.",
  url: "https://dailypick.dev", // Your production URL
  authorName: "Daily Pick",
  defaultOgImage: "/assets/og-image-main.webp",
  defaultTwitterImage: "/assets/twitter-image-main.png",
  get currentYear() {
    return new Date().getFullYear();
  }
};
