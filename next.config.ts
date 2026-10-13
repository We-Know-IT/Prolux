import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The first customer portal (prototype) was replaced by the webshop's own
  // pages; old links and bookmarks land on the new ones.
  async redirects() {
    return [
      { source: '/portal/dashboard', destination: '/portal', permanent: false },
      { source: '/portal/catalog', destination: '/produkter', permanent: false },
      { source: '/portal/checkout', destination: '/kassa', permanent: false },
      { source: '/portal/orders', destination: '/portal?tab=orders', permanent: false },
      { source: '/portal/orders/:id', destination: '/portal?tab=orders', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'proluxshine.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
