# Deployment Guide

## 🌐 Landing Page
Deploy the `index.html`, `styles.css`, and `script.js` to any static host:
-   **Vercel/Netlify**: Drag and drop the folder.
-   **GitHub Pages**: Push to a repository and enable Pages.

## 🧩 Chrome Extension
1.  Zip the `chrome-extension` folder.
2.  Register for a Chrome Web Store Developer account.
3.  Upload the zip file and complete the listing details.

## 🖥️ Windows App (Executable)
To create a standalone `.exe`:
1.  Install PyInstaller: `pip install pyinstaller`.
2.  Run: `pyinstaller --onefile --windowed --name="RecordPro" recordpro.py`.
3.  The executable will be in the `dist` folder.

## ☁️ Backend API
1.  **Docker**:
    ```bash
    docker build -t recordpro-api .
    docker tag recordpro-api registry.your-cloud.com/recordpro-api
    docker push registry.your-cloud.com/recordpro-api
    ```
2.  **Deploy** to AWS ECS, Google Cloud Run, or DigitalOcean App Platform using the container image.
