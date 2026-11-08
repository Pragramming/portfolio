Jayesh Kaushalya Portfolio and Learning Studio

## Run locally

The public portfolio remains a static page. The authenticated Learning Studio
uses a small Flask API and a local SQLite database.

1. Install Python 3.10 or later.
2. From the project root, install dependencies with `python -m pip install -r requirements.txt`.
3. Optionally set `LEARNING_WORKBOOK` to the full path of
   `AI_ML_DataScience_FDE_GenAI_32_Week_Interview_Plan.xlsx`. If omitted, the
   app looks in your Downloads folder and imports the workbook on first startup.
4. Start the app with `python portfolio/server.py`.
5. Open `http://127.0.0.1:5000/` for the portfolio or
   `http://127.0.0.1:5000/learn` for the private Learning Studio.
6. Sign in with login ID `jayesh` and password `jayesh`. Registration is
   disabled; the app seeds this single account in its local database.

The requested default password is intentionally weak. Before exposing this
app to any network, set `LEARNING_LOGIN_PASSWORD` to a strong private value
before its first startup. The password is stored as a one-way hash. If the
account already exists, changing `LEARNING_LOGIN_PASSWORD` updates the stored
hash at the next startup. Do not expose this app using the default password.

The database and generated session-signing key live in `portfolio/instance/`.
Back up that directory to preserve local learning data. Do not expose the
development server directly to the internet. For a production deployment,
change the default password, use HTTPS, set `LEARNING_COOKIE_SECURE=1`,
configure a strong `LEARNING_SECRET_KEY`, and run behind a production WSGI
server.

## AI tutor configuration

The tutor is disabled until configured. Set `AI_API_KEY` and `AI_MODEL` on the
server. `AI_BASE_URL` defaults to `https://api.openai.com/v1` and can be set for
an OpenAI-compatible API. Tutor requests require an explicit confirmation in
the UI before the selected question, progress context, and any selected private
notes are sent to that provider. Never put provider keys in browser code.

## Workbook import

On an empty database, the workbook is imported automatically if found. To
re-import it explicitly, set `LEARNING_WORKBOOK` and run:

`flask --app portfolio.server import-workbook`

Re-importing updates the shared curriculum, but does not overwrite personal
progress, notes, quizzes, interview attempts, project progress, or applications.
