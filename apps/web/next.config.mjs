/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev and production builds get separate output directories.
  //
  // Sharing one `.next` lets a production build's chunks (including the
  // pages-router `_document.js`) collide with the dev server's app-router
  // chunks, which surfaces as `Cannot find module './901.js'` or
  // `Cannot find module for page: /_not-found`. Both look like source errors
  // and are not. Separating the directories makes the collision impossible
  // rather than something you clear by hand when it bites.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next has to compile them. This is what makes `node --test` on the services
  // and `next dev` here read the exact same files.
  transpilePackages: [
    "@teenbuddy/contracts",
    "@teenbuddy/content",
    "@teenbuddy/progress",
    "@teenbuddy/safety",
    "@teenbuddy/coach",
    "@teenbuddy/llm",
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
