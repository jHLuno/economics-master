/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "openai"],
  },
  webpack: (config, { isServer }) => {
    // `@xenova/transformers` ships with optional `sharp` / `onnxruntime-node`
    // bindings; ignore them in client bundles to keep things small.
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
