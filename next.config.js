/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // domains only (no https://)
      allowedOrigins: [
        "capstone-pg.onrender.com",
        "demo.uae-prep.app.jaggaer.com",
      ],
    },
  },
};

module.exports = nextConfig;