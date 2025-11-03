# CSV Data Files

Place your large CSV data files in this directory.

## Usage

Files in this directory are served via API route: `/api/data?file=yourfile.csv`

This approach is better for large files because:
- ✅ Files are not bundled with your app
- ✅ Files are loaded on-demand
- ✅ Better performance and smaller bundle size
- ✅ Server-side processing available if needed

## Example Usage in Components

```typescript
// Client-side fetch
const response = await fetch('/api/data?file=yourdata.csv');
const csvText = await response.text();

// Or with PapaParse
import Papa from 'papaparse';
const response = await fetch('/api/data?file=yourdata.csv');
const csvText = await response.text();
const parsed = Papa.parse(csvText, { header: true });
```

