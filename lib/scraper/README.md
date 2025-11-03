# Harvard Q Guide Scraper

Python-based scraper for Harvard's Q Guide course evaluation data.

## Overview

This scraper processes Harvard Q Guide HTML files and extracts comprehensive course evaluation data including:
- Course ratings (1-5 scale)
- Workload (hours per week)
- Enrollment numbers
- Professor information
- Course codes and titles

## Directory Structure

```
scraper/
├── scraper.py           # Scrapes Q Reports HTML to extract course listings
├── analyzer.py          # Analyzes Q Guide HTML files and exports to CSV
├── requirements.txt     # Python dependencies
├── README.md           # This file
├── data/               # Input data (create this)
│   ├── old_html/       # Place Q Reports HTML files here
│   └── QGuides/        # Place Q Guide HTML files here
└── output/             # Generated output files
    ├── courses_by_fas_id.json
    └── qguide_data.csv
```

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create data directories:**
   ```bash
   mkdir -p data/old_html data/QGuides
   ```

3. **Add your data files:**
   - Place Q Reports HTML files in `data/old_html/`
   - Place Q Guide HTML files in `data/QGuides/`

## Usage

### Step 1: Scrape Course Listings

First, scrape the Q Reports pages to get course codes and FAS IDs:

```bash
python scraper.py
```

This will:
- Parse Q Reports HTML files from `data/old_html/`
- Extract course codes, titles, professors, and FAS IDs
- Generate `output/courses_by_fas_id.json`

### Step 2: Analyze Q Guide Data

Next, analyze the detailed Q Guide evaluation files:

```bash
python analyzer.py
```

This will:
- Parse all Q Guide HTML files from `data/QGuides/`
- Extract ratings, workload, and enrollment data
- Use parallel processing for faster analysis
- Export results to `output/qguide_data.csv`

## Output Format

### CSV Output (`qguide_data.csv`)

The main output file contains the following columns:

| Column | Description |
|--------|-------------|
| `fas_id` | Unique FAS course identifier |
| `course_code` | Course code (e.g., "COMPSCI 50") |
| `course_title` | Course title |
| `department` | Department code (extracted from course code) |
| `professor` | Professor name |
| `semester` | Semester (e.g., "2024Fall") |
| `course_rating` | Overall course rating (0-5.00) |
| `hours_per_week` | Average hours per week workload |
| `num_students` | Number of students enrolled |
| `rating_category` | Categorized rating (Excellent/Good/Satisfactory/Below Average) |
| `workload_category` | Categorized workload (Light/Moderate/Heavy) |
| `size_category` | Categorized class size (Small/Medium/Large) |

## How to Get Q Guide Data

1. **Navigate to Q Reports:**
   - Go to `https://qreports.fas.harvard.edu/browse/index?school=FAS&calTerm=YEAR%20SEMESTER`
   - Replace `YEAR` with year (e.g., `2025`) and `SEMESTER` with `Spring` or `Fall`
   - Login with Harvard credentials

2. **Download the Q Reports page:**
   - Save the page as HTML-only (Ctrl+S or Cmd+S)
   - Place in `data/old_html/` directory

3. **Download individual Q Guides:**
   - Click on individual course links to get detailed Q Guide pages
   - Save each as HTML in `data/QGuides/` directory
   - Or use an automated downloader (requires authentication cookies)

## Performance

- Uses parallel processing (up to 8 workers)
- Processes ~8,000 files in approximately 2-3 minutes on modern hardware
- Progress bar shows real-time analysis status

## Requirements

- Python 3.7+
- BeautifulSoup4 for HTML parsing
- tqdm for progress bars
- Multiprocessing support (built-in)

## Troubleshooting

**Error: "No HTML files found"**
- Make sure you've placed HTML files in the correct directories
- Check that files have `.html` or `.htm` extensions

**Error: "courses_by_fas_id.json not found"**
- Run `scraper.py` first before running `analyzer.py`

**Low extraction rate:**
- Check that HTML files are complete downloads
- Verify that Q Guide HTML structure matches expected format

## Notes

- The scraper expects Harvard Q Guide HTML structure (as of 2024-2025)
- HTML structure changes may require code updates
- CSV output is UTF-8 encoded to support international characters


