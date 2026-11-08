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

The repository includes `render.yaml` for a free Render **Web Service**. The
app supports both local SQLite and PostgreSQL; set `DATABASE_URL` to use an
external PostgreSQL database. This lets the free Render web service sleep
without losing notes and progress to its ephemeral filesystem.

1. Create a free PostgreSQL project with a provider such as
   [Neon](https://neon.tech/pricing). Copy its PostgreSQL connection string.
2. In Render, create a Blueprint from this repository and deploy the
   `jayesh-learning-studio` free Web Service.
3. In the Render service's environment settings, add `DATABASE_URL` and paste
   the connection string. Set `LEARNING_LOGIN_PASSWORD` to a strong private
   password; do not use `jayesh` for a public service. Render generates
   `LEARNING_SECRET_KEY`, and `LEARNING_COOKIE_SECURE` is enabled in the
   Blueprint.
4. Wait for `/healthz` to report healthy, then open
   `https://jayesh-learning-studio.onrender.com/learn`.

The bundled workbook imports into PostgreSQL the first time the app starts. The
current portfolio Static Site cannot run Flask, so the new Web Service has its
own `onrender.com` address. The portfolio navigation links to the new
`jayesh-learning-studio` service; redeploy the Static Site after committing the
updated `index.html`. If Render assigns a different service hostname, update
that link to the hostname shown in the Render dashboard.

The Render free web service spins down after inactivity, so its first request
after a pause can take about a minute. It has no persistent local disk; do not
use SQLite there. Neon Free also has usage and storage limits, and its compute
can pause when idle. Review both providers' current free-tier limits and export
backups regularly. Render's free Postgres expires after 30 days, so it is not
the long-term free database choice here. AI tutor usage is separate and may
cost money if you configure a paid AI provider; it stays disabled by default.
