Jayesh Kaushalya Portfolio and Learning Studio

## Run locally

The public portfolio remains a static page. The authenticated Learning Studio
uses a small Flask API and a local SQLite database.

1. Install Python 3.10 or later.
2. From the project root, install dependencies with `python -m pip install -r requirements.txt`.
3. Optionally set `LEARNING_WORKBOOK` to the full path of
   `AI_ML_DataScience_FDE_GenAI_32_Week_Interview_Plan.xlsx`. If omitted, the
   app imports the bundled workbook in `portfolio/data/` on first startup.
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

## Free Render deployment

The repository includes `render.yaml` for a free Render **Web Service** using
SQLite only. In Render, create a Blueprint from this repository and deploy the
`jayesh-learning-studio` service. Set `LEARNING_LOGIN_PASSWORD` to a strong
private password; do not use `jayesh` for a public service. Render generates
`LEARNING_SECRET_KEY`, and the SQLite database is written to `/tmp/learning.sqlite3`.

Wait for `/healthz` to report healthy, then open
`https://jayesh-learning-studio.onrender.com/learn`.

The bundled workbook imports into SQLite the first time the app starts. The
current portfolio Static Site cannot run Flask, so the new Web Service has its
own `onrender.com` address. The portfolio navigation links to the new
`jayesh-learning-studio` service; redeploy the Static Site after committing the
updated `index.html`. If Render assigns a different service hostname, update
that link to the hostname shown in the Render dashboard.

Important: Render's free web service has an ephemeral filesystem. SQLite data
can be erased when the service sleeps, restarts, or redeploys. The app will
recreate its account and import the workbook, but personal notes, progress,
quiz results, and applications can be lost. This option is free and requires no
database service, but it is suitable only if you accept that risk and keep
manual backups. For durable online data, a persistent database or paid disk is
required. The first request after inactivity can also take about a minute. AI
tutor usage is separate and may cost money if you configure a paid AI provider;
it stays disabled by default.
