/** @type {import('next').NextConfig} */
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverActions: {
    // IMPORTANT: domains only — no https://
    allowedOrigins: [
      "capstone-pg.onrender.com",
      "demo.uae-prep.app.jaggaer.com",
      // add any other customer portal domains here
    ],
  },
};

module.exports = nextConfig;