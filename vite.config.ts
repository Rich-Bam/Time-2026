import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// Simple plugin to inject version into HTML
const injectVersionPlugin = () => {
  // Generate version based on timestamp (always unique per build)
  const version = `2.0.${Date.now()}`;
  return {
    name: 'inject-version',
    transformIndexHtml(html: string) {
      return html.replace('__APP_VERSION__', version);
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    injectVersionPlugin(), // Add this BEFORE VitePWA
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false // Disable PWA in development
      },
      includeAssets: ['Bampro_Logo_klein.png', 'favicon.ico'],
      manifest: {
        name: 'BAMPRO MARINE - Urenregistratie',
        short_name: 'BAMPRO Uren',
        description: 'BAMPRO MARINE urenregistratie systeem',
        theme_color: '#ea580c',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/Bampro_Logo_klein.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/Bampro_Logo_klein.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Weekly Entry',
            short_name: 'Weekly',
            description: 'Open Weekly Entry',
            url: '/?tab=weekly',
            icons: [{ src: '/Bampro_Logo_klein.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /^\/Handleiding_Weekly_Only\.pdf$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB instead of default 2 MB
        // Clean up old caches automatically
        cleanupOutdatedCaches: true,
        // Skip waiting so updates activate immediately without requiring page reload
        skipWaiting: true,
        clientsClaim: true,
        // Use NetworkFirst for navigation requests (HTML) to always get latest version
        // This ensures the HTML always references the latest JS/CSS files
        runtimeCaching: [
          {
            urlPattern: /\.(?:html)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 5 // Only cache HTML for 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache Supabase API calls, but exclude auth/login queries
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/users.*/i,
            handler: 'NetworkOnly', // Never cache user queries (login, etc.)
            options: {
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache other Supabase API calls
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
