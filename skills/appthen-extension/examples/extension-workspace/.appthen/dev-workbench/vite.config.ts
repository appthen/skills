import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ["/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/examples/extension-workspace", "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace"],
    },
  },
  resolve: {
    alias: [
      { find: "@appthen/vibe-workspace/extension-dev-workbench", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/extension-dev-workbench/index.js" },
      { find: "@appthen/vibe-workspace/plugins/base", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/plugins/base/index.js" },
      { find: "@appthen/vibe-workspace/overlay", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/overlay/index.js" },
      { find: "@appthen/vibe-workspace/coding-kit", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/coding-kit/index.js" },
      { find: "@appthen/vibe-workspace/styles.css", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/vibe-workspace.css" },
      { find: "@appthen/vibe-workspace", replacement: "/Users/huanglei/Documents/work/mengti/nest-server/vibe-workspace/dist/index.js" }
    ],
    dedupe: ['react', 'react-dom'],
  },
});
