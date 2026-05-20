PHANTOM — Font setup
====================

The site is wired for self-hosted Clash Display + Satoshi + JetBrains Mono.
Until the .woff2 files exist here, the browser falls back to system fonts.

To finish the install:

1. Clash Display (display headlines)
   → https://www.fontshare.com/fonts/clash-display
   Download the family. Drop these into this folder:
     clash-display-500.woff2
     clash-display-600.woff2
     clash-display-700.woff2

2. Satoshi (body + nav)
   → https://www.fontshare.com/fonts/satoshi
   Drop into this folder:
     satoshi-400.woff2
     satoshi-500.woff2
     satoshi-700.woff2

3. JetBrains Mono (code blocks, terminal feed)
   → https://www.jetbrains.com/lp/mono/
   Drop into this folder:
     jetbrains-mono-400.woff2
     jetbrains-mono-500.woff2
     jetbrains-mono-700.woff2

No code change needed once the files exist — the @font-face declarations
in src/styles/globals.css already point at /fonts/<filename>.woff2.
