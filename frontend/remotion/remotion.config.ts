import path from "node:path";

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");

// Share the Next.js public/ folder so staticFile('fonts/...') resolves to the
// same .woff2 files served on the web side. Avoids duplicating font assets.
Config.setPublicDir(path.resolve(__dirname, "../public"));
