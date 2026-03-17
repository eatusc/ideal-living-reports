/** @type {import('next').NextConfig} */
const basePath = process.env.NODE_ENV === 'production' ? '/slackdash' : '';

const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
