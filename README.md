# BigQuery Release Notes Tracker

A modern, glassmorphic single-page web dashboard that aggregates, parses, filters, and displays Google Cloud BigQuery release notes. It parses the official Atom feed, splits combined daily updates into individual items, and provides dynamic search, filters, and Tweet sharing tools.

---

## Features

- **Sleek Space-Tech Theme:** Glowing glassmorphism UI with subtle radial mesh gradient background animations.
- **Dual Sync Options:** Serves cached notes locally for fast loads and lets you perform a live sync using a dedicated **Refresh** button.
- **Granular Filter Badges:** Interactively toggle categories (Features, Deprecations, Issues, Changes, Announcements, General).
- **Sub-Item Splitting:** Parses lumped daily entries from the source feed, separating them into individually typed change updates.
- **Live Search & Highlights:** Search by keywords across dates, titles, and descriptions with real-time text highlight tags.
- **One-Click X/Twitter Share:** Truncates updates to fit within 280 characters, includes hashtags, and opens Twitter's web intent share page.
- **Interactive Skeleton Screen:** Displays placeholder animated nodes while loading data from the API.

---

## Directory Structure

```
├── .git-portable/          # Portable Git version for Windows (excluded)
├── .venv/                  # Python virtual environment (excluded)
├── static/
│   ├── css/
│   │   └── style.css       # Visual styles, animations, layouts
│   └── js/
│       └── app.js          # Search logic, filters, event listeners, state
├── templates/
│   └── index.html          # Main HTML structure and layouts
├── app.py                  # Flask backend server, XML feed parsers, JSON APIs
├── requirements.txt        # Frozen Python package requirements
├── news.txt                # Sample world news feed file
├── summary.txt             # Summary of world news headlines
└── README.md               # Project documentation
```

---

## Installation & Running Locally

### Prerequisites
- Python 3.10+ installed.

### Setup Steps
1. **Clone/Download the repository** to your local workspace.
2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   ```
3. **Activate the virtual environment:**
   - **On Windows (cmd):**
     ```cmd
     .venv\Scripts\activate.bat
     ```
   - **On Windows (PowerShell):**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **On macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```
4. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
5. **Run the Flask application:**
   ```bash
   python app.py
   ```
6. **Open your web browser** and navigate to:
   [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Caching Strategy
- The application stores parsed release notes locally in a file named `release_notes_cache.json`.
- Subsequent visits to the dashboard will load from this local cache to ensure high-performance loading times.
- Clicking the **Refresh** button in the header triggers `GET /api/release-notes?refresh=true` which bypasses the cache, pulls down the live Atom feed from Google Cloud, parses the entries, and overwrites the local cache file.
