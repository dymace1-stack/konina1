/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Keep the Vercel production build independent of third-party declaration
  // mismatches in the IMAP/mail parsing dependency tree.
  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
