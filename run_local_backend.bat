@echo off
echo Starting NAUNCE Backend...
cd /d "%~dp0backend"
if not exist "venv" (
    echo Virtual environment not found. Creating one...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing/Updating dependencies...
pip install -r requirements.txt
echo.
echo Backend is starting on http://127.0.0.1:8000
echo KEEP THIS WINDOW OPEN while you are using the app.
echo.
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
