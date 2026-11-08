import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from portfolio import server


class LearningAppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(self.temp_dir.name) / "test.sqlite3"
        with patch.dict("os.environ", {"LEARNING_LOGIN_PASSWORD": "jayesh"}):
            server.initialize_database()
        server.app.config.update(TESTING=True, SECRET_KEY="test-secret-key-for-learning-app")
        self.client = server.app.test_client()
        self.csrf = self.client.get("/api/auth/csrf").get_json()["csrf_token"]
        response = self.post_json(
            "/api/auth/login",
            {"login_id": "jayesh", "password": "jayesh"},
        )
        self.assertEqual(response.status_code, 200)

    def tearDown(self):
        self.temp_dir.cleanup()

    def post_json(self, path, payload, csrf=None):
        response = self.client.post(
            path,
            json=payload,
            headers={"X-CSRF-Token": csrf or self.csrf},
        )
        body = response.get_json(silent=True) or {}
        if body.get("csrf_token"):
            self.csrf = body["csrf_token"]
        return response

    def test_only_fixed_account_can_login_and_registration_is_disabled(self):
        current_user = self.client.get("/api/auth/me").get_json()
        self.assertTrue(current_user["authenticated"])
        self.assertEqual(current_user["login_id"], "jayesh")
        denied = self.post_json(
            "/api/auth/login",
            {"login_id": "other", "password": "jayesh"},
        )
        self.assertEqual(denied.status_code, 401)
        registration = self.post_json("/api/auth/register", {})
        self.assertEqual(registration.status_code, 410)

    def test_mutations_require_csrf_and_auth(self):
        no_token = self.client.post("/api/jobs", json={"company": "No", "job_title": "No"})
        self.assertEqual(no_token.status_code, 403)
        self.post_json("/api/auth/logout", {})
        protected = self.client.get("/api/jobs")
        self.assertEqual(protected.status_code, 401)

    def test_notes_are_scoped_to_the_owner(self):
        note = self.post_json("/api/notes", {"title": "Private", "content": "Only for owner"})
        self.assertEqual(note.status_code, 201)
        note_id = note.get_json()["id"]
        self.post_json("/api/auth/logout", {})

        with server.app.app_context():
            db = server.connect_db()
            db.execute(
                "INSERT INTO users (email,password_hash,created_at) VALUES (?,?,?)",
                ("synthetic-test-account", "not-a-login-hash", "2026-01-01T00:00:00+00:00"),
            )
            other_id = db.execute(
                "SELECT id FROM users WHERE email=?",
                ("synthetic-test-account",),
            ).fetchone()[0]
            db.commit()
            db.close()

        with self.client.session_transaction() as browser_session:
            browser_session["user_id"] = other_id
            browser_session["csrf_token"] = "another-session-csrf-token"
        self.assertEqual(self.client.get("/api/notes").get_json()["notes"], [])
        denied = self.client.put(
            f"/api/notes/{note_id}",
            json={"title": "Changed", "content": "Not authorized"},
            headers={"X-CSRF-Token": "another-session-csrf-token"},
        )
        self.assertEqual(denied.status_code, 404)

    def test_job_crud_is_owner_scoped(self):
        created = self.post_json(
            "/api/jobs",
            {"company": "Example Co", "job_title": "Data Scientist"},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(len(self.client.get("/api/jobs").get_json()["jobs"]), 1)

    def test_dashboard_progress_study_quiz_interview_and_project_tracking(self):
        dashboard = self.client.get("/api/dashboard")
        self.assertEqual(dashboard.status_code, 200)
        plan = dashboard.get_json()["today"]
        topic_id = dashboard.get_json()["next_topics"][0]["topic_id"]
        self.assertEqual(
            self.client.put(
                f"/api/topics/{topic_id}/progress",
                json={"status": "Completed", "mastery_score": 4},
                headers={"X-CSRF-Token": self.csrf},
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.put(
                f"/api/study-sessions/{plan['plan_date']}",
                json={"actual_hours": 0.5, "notes": "Worked through a practice example."},
                headers={"X-CSRF-Token": self.csrf},
            ).status_code,
            200,
        )
        self.assertEqual(
            self.post_json(
                "/api/quizzes",
                {"category": "SQL", "score": 3, "total": 5, "weak_topics": ["joins"]},
            ).status_code,
            201,
        )
        self.assertEqual(
            self.post_json(
                "/api/interviews/Q001/attempts",
                {"score": 4, "answer": "Compare their use cases."},
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client.put(
                "/api/projects/P1/milestones/1",
                json={"status": "In Progress", "notes": "Defined the business metric."},
                headers={"X-CSRF-Token": self.csrf},
            ).status_code,
            200,
        )
        self.assertEqual(len(self.client.get("/api/quizzes").get_json()["attempts"]), 1)
        self.assertEqual(len(self.client.get("/api/interviews/history").get_json()["attempts"]), 1)
        project = next(project for project in self.client.get("/api/projects").get_json()["projects"] if project["project_id"] == "P1")
        self.assertEqual(project["milestones"][0]["status"], "In Progress")

    def test_tutor_requires_explicit_consent(self):
        response = self.post_json("/api/tutor", {"prompt": "Explain SQL joins"})
        self.assertEqual(response.status_code, 400)

    def test_workbook_import_counts_and_refresh_preserves_progress(self):
        with server.app.app_context():
            db = server.connect_db()
            counts = {
                "weeks": db.execute("SELECT COUNT(*) FROM curriculum_weeks").fetchone()[0],
                "topics": db.execute("SELECT COUNT(*) FROM curriculum_topics").fetchone()[0],
                "study_days": db.execute("SELECT COUNT(*) FROM study_plan").fetchone()[0],
                "questions": db.execute("SELECT COUNT(*) FROM interview_questions").fetchone()[0],
            }
            topic_id = db.execute("SELECT topic_id FROM curriculum_topics ORDER BY topic_id LIMIT 1").fetchone()[0]
            db.close()
        self.assertEqual(counts, {"weeks": 32, "topics": 160, "study_days": 224, "questions": 68})

        self.client.put(
            f"/api/topics/{topic_id}/progress",
            json={"status": "Completed", "mastery_score": 4},
            headers={"X-CSRF-Token": self.csrf},
        )
        server.import_workbook(server.DEFAULT_WORKBOOK)
        with server.app.app_context():
            db = server.connect_db()
            progress = db.execute(
                "SELECT status,mastery_score FROM topic_progress WHERE user_id=? AND topic_id=?",
                (1, topic_id),
            ).fetchone()
            db.close()
        self.assertEqual(tuple(progress), ("Completed", 4))

if __name__ == "__main__":
    unittest.main()
