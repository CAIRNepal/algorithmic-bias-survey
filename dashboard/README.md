# Bias Research Dashboard

A dynamic dashboard for visualizing research trends, domains, and regions using CSV data. Built with Next.js, Recharts, and react-simple-maps.

## Features
- Interactive charts and world map
- Dynamic CSV data loading
- Searchable, filterable, and sortable papers table
- Export to CSV
- Responsive UI

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run locally:**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) (or your configured port).

## Deployment

### Vercel (Recommended)
- Push your repo to GitHub and import into [Vercel](https://vercel.com/).
- Vercel auto-detects Next.js and deploys instantly.

### Static Export (GitHub Pages, Netlify, etc.)
1. **Update `next.config.js` for static export:**
   ```js
   // next.config.js
   module.exports = {
     output: 'export',
     // ...other config
   };
   ```
2. **Build and export:**
   ```bash
   npm run build
   npm run export
   ```
   The static site will be in the `out/` directory.
3. **Deploy `out/` to GitHub Pages or any static host.**

### GitHub Pages
- You can use [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) or similar GitHub Actions to deploy the `out/` folder.

## Adding Data for Other Use Cases

- Place your CSV file in the `public/` directory (e.g., `public/yourdata.csv`).
- Update the fetch path in the dashboard code:
  ```js
  fetch('/yourdata.csv')
  ```
- Adjust the parsing logic if your CSV structure is different.
- (Optional) Add a dataset selector in the UI for multiple use cases.

## License

Content and code: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and MIT.

---

For questions or contributions, contact [cair-nepal.org](https://cair-nepal.org).
