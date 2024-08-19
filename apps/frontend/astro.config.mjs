import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
    output: "server",
    adapter: netlify(),
    integrations: [react(), tailwind()],
    vite: {
        optimizeDeps: {
            exclude: [
                "brotli-dec-wasm",
                "brotli-dec-wasm/pkg/brotli_dec_wasm_bg.wasm",
            ],
        },
    },
});
