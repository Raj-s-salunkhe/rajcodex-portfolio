# Raj / @rajcodex portfolio

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To verify a production build, run `npm run typecheck && npm run build`, then `npm run preview`.

## Portrait source

`public/images/raj-portrait.jpeg` is Raj's supplied portrait. The page and WebGL texture both use this exact file; it has not been replaced or altered. The WebGL effect only reads this static image and pointer coordinates. There is no camera access or biometric processing.

## Portfolio content

Confirmed project, social, and technology content lives in `src/data/portfolio.ts`; section copy and layout live in `src/App.tsx`. Keep future edits grounded in details Raj has supplied. Invoax AI's supplied `/operations/reflow` path currently returns 404, so its card links to the responding site root.
