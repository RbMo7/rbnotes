import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Restores the pre-15.0 default (dynamic pages -- like a note buffer --
    // used to be kept in the client router cache for 30s; 15.0 changed the
    // default to 0, meaning every re-visit to a note you'd just left
    // refetched from the server even a second later). This is a
    // long-standing, narrowly-scoped flag (since 14.2), not the newer
    // Cache Components system -- switching back to a recently-open note
    // now costs nothing for 30s, on top of whatever's been prefetched.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
