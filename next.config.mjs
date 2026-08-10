/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生成自包含产物，Docker 镜像更小
  output: 'standalone',
  experimental: {
    // 允许 Server Actions 上传较大的图片
    serverActions: { bodySizeLimit: '10mb' },
  },
};
export default nextConfig;
