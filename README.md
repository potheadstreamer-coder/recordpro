# RecordPro

A professional screen recording suite including a Landing Page, Chrome Extension, Windows Desktop App, and Backend API.

## 📦 What's Included

1.  **Landing Page**: Beautiful, Apple-inspired presentation.
2.  **Chrome Extension**: Browser tab recording (manifest V3).
3.  **Windows App**: Full desktop recording with PyQt6.
4.  **Backend API**: Flask server for AI enhancement.

## 🚀 Quick Start

### Landing Page
Open `index.html` in any browser to view the product page.

### Chrome Extension
1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode**.
3.  Click **Load unpacked** and select the `chrome-extension` folder.
4.  Pin the extension and click the icon to test.

### Windows App
Ensure you have Python installed.

```bash
cd windows-app
pip install -r requirements.txt
python recordpro.py
```

### Backend API
```bash
cd backend
pip install -r requirements.txt
python api.py
```
Or with Docker:
```bash
cd backend
docker build -t recordpro-api .
docker run -p 5000:5000 recordpro-api
```

## 🎨 Design
The project follows a "Glassmorphism" design language with:
-   **Primary Color**: `#0071e3` (Blue)
-   **Gradients**: Purple/Pink accents
-   **Fonts**: Inter / System UI

## 📄 License
MIT License.
