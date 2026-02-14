# Hosting RecordPro on Render.com (Free Tier)

Render offers a free tier for hosting web services like our Flask API.

## Steps

1.  **Sign Up**: Create an account at [render.com](https://render.com).
2.  **New Web Service**:
    -   Click "New +" -> "Web Service".
    -   Connect your GitHub repository containing the efficient `RecordPro` code.
3.  **Configuration**:
    -   **Name**: `recordpro-api`
    -   **Runtime**: Python 3
    -   **Build Command**: `pip install -r backend/requirements.txt`
    -   **Start Command**: `python backend/api.py`
    -   **Root Directory**: `.` (or leave blank)
4.  **Environment Variables**:
    -   Add `PYTHON_VERSION`: `3.9.0` (optional)
5.  **Deploy**: Click "Create Web Service".

Render will automatically build and deploy your API. You will get a URL like `https://recordpro-api.onrender.com`.

## Docker Alternative (Recommended)

If you prefer using Docker:
1.  **Dockerfile Path**: `backend/Dockerfile`
2.  **Context**: `.`

This ensures the exact environment we tested is used.
