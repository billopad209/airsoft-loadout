# Loadout Bench (web)

Deploy on Vercel:
1. Put this folder in a GitHub repository (index.html, api/, package.json at the top level).
2. vercel.com > Add New > Project > pick the repo > Deploy.
3. Optional: Settings > Domains to attach your own domain.

Shops live in api/_shops.js. Use the Shops panel in the page: after a search, each shop shows a tick with a
result count, or a cross if its search method is not supported. Remove or fix crosses in _shops.js.
For real abuse protection add a rate-limit rule in Vercel (Firewall).
