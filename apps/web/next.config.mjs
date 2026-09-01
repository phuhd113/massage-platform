/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Trang public phải render ở server; standalone để image production nhẹ.
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
