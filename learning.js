(() => {
  const state = {
    csrf: "",
    user: null,
    activeView: "dashboard",
    currentWeek: 1,
    selectedTopic: null,
    selectedNote: null,
    notes: [],
    editingJob: null,
    dashboard: null
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const dateLabel = (value) => {
    if (!value) return "";
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
  };
  const statusClass = (value) => String(value || "").toLowerCase().replace(/\s+/g, "-");

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (["POST", "PUT", "PATCH", "DELETE"].includes(options.method || "GET")) {
      headers["X-CSRF-Token"] = state.csrf;
    }
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        state.user = null;
        showAuth(false);
      }
      throw new Error(result.error || `Request failed (${response.status}).`);
    }
    if (result.csrf_token) state.csrf = result.csrf_token;
    return result;
  }

  let toastTimer;
  function toast(message, error = false) {
    let node = $("#toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      node.setAttribute("role", "status");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.style.background = error ? "#8f3028" : "#24201d";
    node.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { node.hidden = true; }, 3500);
  }

  function showAuth() {
    $("#authView").hidden = false;
    $("#appView").hidden = true;
    $("#authHeading").textContent = "Welcome back.";
    $("#authIntro").textContent = "Sign in to continue your private preparation plan.";
    $("#authSubmit").textContent = "Sign in";
  }

  function showApp(loginId) {
    state.user = loginId;
    $("#authView").hidden = true;
    $("#appView").hidden = false;
    $("#signedInId").textContent = `Signed in as ${loginId}`;
    $("#headerDate").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
    loadView("dashboard");
  }

  function markdownPreview(text) {
    let html = escapeHtml(text || "");
    html = html.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^# (.+)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|\n)- (.+)/g, "$1• $2")
      .replace(/\n/g, "<br>");
    return html || '<span class="muted">Markdown preview appears here.</span>';
  }

  function renderDashboard(data) {
    state.dashboard = data;
    const progressPercent = data.week_progress.total
      ? Math.round((data.week_progress.completed / data.week_progress.total) * 100) : 0;
    const overallPercent = data.overall.total
      ? Math.round((data.overall.completed / data.overall.total) * 100) : 0;
    const topics = data.next_topics.map((topic) => `
      <article class="topic-row">
        <div><strong>${escapeHtml(topic.title)}</strong><p>${escapeHtml(topic.topic_id)} · ${escapeHtml(topic.estimated_hours)}h · ${escapeHtml(topic.priority)} priority</p></div>
        <button class="button button-soft" data-open-topic="${escapeHtml(topic.topic_id)}">Open lesson</button>
      </article>`).join("") || '<div class="empty-state">All topics in this week are complete. Review or explore the next week.</div>';
    const weakTopics = data.weak_topics.length
      ? data.weak_topics.map((topic) => `<span class="status-pill in-progress">${escapeHtml(topic)}</span>`).join(" ")
      : '<span class="muted small">No weak topics recorded yet. Add them after a quiz.</span>';
    const today = data.today || {};
    const loggedHours = data.today_log?.actual_hours ?? 0;
    $("#view-dashboard").innerHTML = `
      <div class="page-heading">
        <div><p class="eyebrow">32-WEEK INTERVIEW PLAN</p><h1>Your learning, in focus.</h1>
        <p class="muted">A steady practice loop for AI, ML, Data Science, GenAI and forward-deployed engineering.</p></div>
        <button class="button button-dark" data-go="lessons">Open this week's lessons →</button>
      </div>
      <div class="metric-grid">
        <article class="metric"><div class="metric-label">CURRENT WEEK</div><div class="metric-value">${escapeHtml(today.week_no ?? data.week?.week_no ?? "—")}/32</div><div class="metric-note">${escapeHtml(data.week?.phase || "Curriculum")}</div></article>
        <article class="metric"><div class="metric-label">WEEKLY PROGRESS</div><div class="metric-value">${progressPercent}%</div><div class="metric-note">${data.week_progress.completed} of ${data.week_progress.total} topics completed</div></article>
        <article class="metric"><div class="metric-label">STUDY HOURS THIS WEEK</div><div class="metric-value">${Number(data.week_progress.hours).toFixed(1)}h</div><div class="metric-note">Target: ${escapeHtml(data.week?.target_hours ?? 0)}h</div></article>
        <article class="metric"><div class="metric-label">TOPICS MASTERED</div><div class="metric-value">${data.overall.completed}/${data.overall.total}</div><div class="metric-note">${overallPercent}% of curriculum complete</div></article>
      </div>
      <div class="two-column">
        <div class="panel">
          <div class="panel-heading"><div><p class="eyebrow">TODAY'S STUDY SESSION</p><h2>${escapeHtml(dateLabel(today.plan_date))}</h2></div><span class="status-pill">${escapeHtml(today.day_name || "Planned")}</span></div>
          <div class="today-session">
            <p class="session-copy muted"><strong>${escapeHtml(today.focus || data.week?.focus || "Study session")}</strong><br>${escapeHtml(today.suggested_session || "Choose a topic and record your study time.")}</p>
            <div class="inline-fields">
              <label class="field-label">Actual hours<input id="actualHours" type="number" min="0" max="24" step="0.25" value="${escapeHtml(loggedHours)}"></label>
              <label class="field-label">Session note<input id="studyNotes" maxlength="4000" value="${escapeHtml(data.today_log?.notes || "")}" placeholder="What did you work on?"></label>
            </div>
            <button id="saveStudy" class="button button-accent">Save study log</button>
          </div>
          <div style="margin-top:22px"><div class="panel-heading"><h3>Week ${escapeHtml(data.week?.week_no)} · ${escapeHtml(data.week?.focus)}</h3><span class="muted small">${progressPercent}%</span></div><div class="progress-track"><span style="width:${progressPercent}%"></span></div></div>
        </div>
        <div class="panel">
          <div class="panel-heading"><div><p class="eyebrow">REVISION QUEUE</p><h2>Topics to revisit</h2></div></div>
          <div class="inline-actions">${weakTopics}</div>
          <p class="muted small" style="margin-top:16px">Record quiz scores and weak topics in Interview practice to build this list.</p>
          <button class="button button-soft" data-go="interviews">Practice a question</button>
        </div>
      </div>
      <div class="panel" style="margin-top:18px">
        <div class="panel-heading"><div><p class="eyebrow">NEXT UP</p><h2>Today's learning goals</h2></div><span class="muted small">${escapeHtml(dateLabel(today.plan_date))}</span></div>
        <div class="topic-list">${topics}</div>
      </div>
      <div class="panel" style="margin-top:18px">
        <div class="panel-heading"><div><p class="eyebrow">32-WEEK ROADMAP</p><h2>Weekly milestones</h2></div><button class="button button-soft" data-go="lessons">Browse curriculum</button></div>
        <div id="weekOverview" class="week-list"><div class="empty-state">Loading roadmap…</div></div>
      </div>`;
    $("#saveStudy").addEventListener("click", async () => {
      try {
        await api(`/api/study-sessions/${encodeURIComponent(today.plan_date)}`, {
          method: "PUT",
          body: JSON.stringify({
            actual_hours: Number($("#actualHours").value),
            notes: $("#studyNotes").value
          })
        });
        toast("Study session saved.");
        await refreshDashboard();
      } catch (error) { toast(error.message, true); }
    });
    $$("[data-open-topic]").forEach((button) => button.addEventListener("click", () => {
      state.selectedTopic = button.dataset.openTopic;
      state.currentWeek = Number(state.selectedTopic.match(/^W(\d+)/)?.[1] || state.currentWeek);
      loadView("lessons");
    }));
    api("/api/weeks").then(({ weeks }) => {
      $("#weekOverview").innerHTML = weeks.map((week) => {
        const pct = week.topic_count ? Math.round(week.completed_topics / week.topic_count * 100) : 0;
        return `<button class="week-row" data-week="${week.week_no}" style="text-align:left">
          <div><strong>Week ${week.week_no} · ${escapeHtml(week.focus)}</strong><p>${escapeHtml(week.phase)} · ${escapeHtml(week.start_date)} – ${escapeHtml(week.end_date)} · ${Number(week.actual_hours).toFixed(1)} study hours</p><div class="progress-track" style="margin-top:8px"><span style="width:${pct}%"></span></div></div>
          <span class="status-pill">${week.completed_topics}/${week.topic_count} topics</span>
        </button>`;
      }).join("");
      $$("[data-week]").forEach((button) => button.addEventListener("click", () => {
        state.currentWeek = Number(button.dataset.week);
        state.selectedTopic = null;
        loadView("lessons");
      }));
    }).catch((error) => toast(error.message, true));
  }

  async function refreshDashboard() {
    renderDashboard(await api("/api/dashboard"));
  }

  async function renderLessons() {
    const [{ weeks }, { notes }] = await Promise.all([api("/api/weeks"), api("/api/notes")]);
    state.notes = notes;
    const weekOptions = weeks.map((week) => `<option value="${week.week_no}" ${week.week_no === state.currentWeek ? "selected" : ""}>Week ${week.week_no} · ${escapeHtml(week.focus)}</option>`).join("");
    $("#view-lessons").innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">LEARN · PRACTICE · EXPLAIN</p><h1>Curriculum & notes</h1><p class="muted">Turn each lesson into something you can explain, implement and revisit.</p></div></div>
      <div class="toolbar"><label class="field-label">Roadmap week<select id="weekSelect">${weekOptions}</select></label><button id="newNote" class="button button-dark">＋ New note</button></div>
      <div class="split-layout">
        <div><div id="weekSummary" class="panel" style="margin-bottom:14px"></div><div id="topicList" class="topic-list"></div>
          <div class="panel" style="margin-top:14px"><p class="eyebrow">YOUR NOTES</p><div id="noteList" class="topic-list"></div></div>
        </div>
        <div id="lessonWorkspace" class="panel"><div id="noteEditor"><div class="empty-state">Choose a topic to open its lesson workspace, or start a standalone note.</div></div></div>
      </div>
      <div class="panel" style="margin-top:18px"><div class="panel-heading"><div><p class="eyebrow">REFERENCE LIBRARY</p><h2>Learning resources</h2></div></div><div id="resources" class="resource-list"></div></div>`;
    $("#weekSelect").addEventListener("change", (event) => {
      state.currentWeek = Number(event.target.value);
      state.selectedTopic = null;
      loadView("lessons");
    });
    $("#newNote").addEventListener("click", () => openNoteEditor(null));
    const [weekData, resourcesData] = await Promise.all([
      api(`/api/weeks/${state.currentWeek}/topics`),
      api("/api/resources")
    ]);
    $("#weekSummary").innerHTML = `<p class="eyebrow">${escapeHtml(weekData.week.phase)} · WEEK ${weekData.week.week_no}</p><h2>${escapeHtml(weekData.week.focus)}</h2><p class="muted">${escapeHtml(weekData.week.syllabus)}</p><p><strong>Practical deliverable</strong><br>${escapeHtml(weekData.week.deliverable)}</p><p><strong>Interview checkpoint</strong><br>${escapeHtml(weekData.week.checkpoint)}</p><span class="status-pill">${escapeHtml(weekData.week.target_hours)}h planned</span>`;
    $("#topicList").innerHTML = weekData.topics.map((topic) => `
      <article class="topic-row selectable ${topic.topic_id === state.selectedTopic ? "selected" : ""}" data-topic="${escapeHtml(topic.topic_id)}">
        <div><strong>${escapeHtml(topic.title)}</strong><p>${escapeHtml(topic.topic_id)} · ${escapeHtml(topic.estimated_hours)}h · ${escapeHtml(topic.priority)}</p></div>
        <span class="status-pill ${statusClass(topic.status)}">${escapeHtml(topic.status)}</span>
      </article>`).join("");
    $$("[data-topic]").forEach((element) => element.addEventListener("click", () => {
      state.selectedTopic = element.dataset.topic;
      renderTopicWorkspace(weekData.topics.find((topic) => topic.topic_id === state.selectedTopic));
      $$(".topic-row[data-topic]").forEach((row) => row.classList.toggle("selected", row.dataset.topic === state.selectedTopic));
    }));
    $("#noteList").innerHTML = notes.map((note) => `
      <button class="topic-row selectable ${note.id === state.selectedNote ? "selected" : ""}" data-note="${note.id}" style="text-align:left">
        <span><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.topic_title || "Unlinked note")} · updated ${escapeHtml(note.updated_at.slice(0, 10))}</p></span><span class="status-pill">Note</span>
      </button>`).join("") || '<p class="muted small">Saved lesson notes appear here.</p>';
    $$("[data-note]").forEach((button) => button.addEventListener("click", () => {
      const note = notes.find((item) => item.id === Number(button.dataset.note));
      if (!note) return;
      state.selectedNote = note.id;
      const linkedWeek = note.topic_id?.match(/^W(\d+)/);
      if (linkedWeek && Number(linkedWeek[1]) !== state.currentWeek) {
        state.currentWeek = Number(linkedWeek[1]);
        state.selectedTopic = note.topic_id;
        loadView("lessons");
        return;
      }
      if (note.topic_id) {
        const topic = weekData.topics.find((item) => item.topic_id === note.topic_id);
        if (topic) {
          state.selectedTopic = note.topic_id;
          renderTopicWorkspace(topic);
          return;
        }
      }
      state.selectedTopic = null;
      $("#lessonWorkspace").innerHTML = `<div class="lesson-content"><p class="eyebrow">PRIVATE NOTE</p><h2>${escapeHtml(note.title)}</h2><div id="noteEditor"></div></div>`;
      openNoteEditor(note);
    }));
    $("#resources").innerHTML = resourcesData.resources.map((resource) => `
      <article class="resource-item"><strong>${escapeHtml(resource.reference)}</strong><p>${escapeHtml(resource.domain)} · ${escapeHtml(resource.when_to_use)}</p><p>${escapeHtml(resource.how_to_use)}</p><a class="text-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a></article>`).join("") || '<div class="empty-state">No resources were imported.</div>';
    if (state.selectedTopic) {
      const selected = weekData.topics.find((topic) => topic.topic_id === state.selectedTopic);
      if (selected) renderTopicWorkspace(selected);
      else state.selectedTopic = null;
    }
  }

  function renderTopicWorkspace(topic) {
    if (!topic) return;
    const linkedNote = state.notes.find((note) => note.topic_id === topic.topic_id);
    state.selectedNote = linkedNote?.id || null;
    $("#lessonWorkspace").innerHTML = `
      <div class="lesson-content">
        <div><p class="eyebrow">${escapeHtml(topic.topic_id)} · ${escapeHtml(topic.phase)}</p><h2>${escapeHtml(topic.title)}</h2><p class="muted">${escapeHtml(topic.applies_to)} · ${escapeHtml(topic.estimated_hours)} estimated hours</p></div>
        <div class="lesson-details"><strong>Mastery check</strong><br>${escapeHtml(topic.mastery_check)}<br><br><strong>Weekly practical</strong><br>${escapeHtml(topic.weekly_practical)}</div>
        <div class="toolbar"><label class="field-label">Progress<select id="topicStatus"><option ${topic.status === "Not Started" ? "selected" : ""}>Not Started</option><option ${topic.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${topic.status === "Completed" ? "selected" : ""}>Completed</option><option ${topic.status === "Needs Review" ? "selected" : ""}>Needs Review</option></select></label><label class="field-label">Mastery / 5<select id="topicMastery"><option value="">Not scored</option>${[1,2,3,4,5].map((score) => `<option value="${score}" ${topic.mastery_score === score ? "selected" : ""}>${score}</option>`).join("")}</select></label><button id="saveProgress" class="button button-soft">Save progress</button></div>
        <div id="noteEditor"></div>
      </div>`;
    $("#saveProgress").addEventListener("click", async () => {
      try {
        const score = $("#topicMastery").value;
        await api(`/api/topics/${encodeURIComponent(topic.topic_id)}/progress`, {
          method: "PUT",
          body: JSON.stringify({ status: $("#topicStatus").value, mastery_score: score ? Number(score) : null })
        });
        toast("Topic progress saved.");
        renderLessons();
      } catch (error) { toast(error.message, true); }
    });
    openNoteEditor(linkedNote || null, topic.topic_id);
  }

  function openNoteEditor(note, topicId = "") {
    state.selectedNote = note?.id || null;
    const title = note?.title || "";
    const content = note?.content || "";
    const workspace = $("#noteEditor");
    if (!workspace) return;
    workspace.innerHTML = `
      <div class="panel-heading"><div><p class="eyebrow">YOUR PRIVATE NOTES</p><h3>${note ? "Continue your notes" : "Create lesson notes"}</h3></div>${note ? `<button id="showRevisions" class="text-button">Revision history</button>` : ""}</div>
      <label class="field-label">Note title<input id="noteTitle" maxlength="200" value="${escapeHtml(title)}" placeholder="Key ideas, examples, questions…"></label>
      <label class="field-label" style="margin-top:12px">Markdown notes, code snippets and worked examples<textarea id="noteContent" rows="12" maxlength="100000" placeholder="# Core idea&#10;&#10;Explain it in your own words.&#10;&#10;&#96;&#96;&#96;python&#10;# Add a code example&#10;&#96;&#96;&#96;">${escapeHtml(content)}</textarea></label>
      <div class="editor-grid" style="margin-top:12px"><div><p class="editor-preview-label">EXERCISE PROMPT</p><p class="muted small">Add a question or mini exercise to your note, then solve it without looking at the explanation.</p></div><div><p class="editor-preview-label">LIVE MARKDOWN PREVIEW</p><div id="markdownPreview" class="markdown-preview">${markdownPreview(content)}</div></div></div>
      <div class="inline-actions" style="margin-top:12px"><button id="saveNote" class="button button-dark">Save private note</button><span class="muted small">Only visible in your account.</span></div>
      <div id="revisionHistory" class="history-list"></div>`;
    $("#noteContent").addEventListener("input", (event) => {
      $("#markdownPreview").innerHTML = markdownPreview(event.target.value);
    });
    $("#saveNote").addEventListener("click", async () => {
      try {
        const payload = {
          title: $("#noteTitle").value,
          content: $("#noteContent").value,
          topic_id: topicId || note?.topic_id || null
        };
        if (state.selectedNote) {
          await api(`/api/notes/${state.selectedNote}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          const created = await api("/api/notes", { method: "POST", body: JSON.stringify(payload) });
          state.selectedNote = created.id;
        }
        toast("Private note saved.");
        const result = await api("/api/notes");
        state.notes = result.notes;
        const current = state.notes.find((item) => item.id === state.selectedNote);
        await renderLessons();
        if (current && !current.topic_id) {
          $("#lessonWorkspace").innerHTML = `<div class="lesson-content"><p class="eyebrow">PRIVATE NOTE</p><h2>${escapeHtml(current.title)}</h2><div id="noteEditor"></div></div>`;
          openNoteEditor(current);
        }
      } catch (error) { toast(error.message, true); }
    });
    if (note) {
      $("#showRevisions").addEventListener("click", async () => {
        try {
          const { revisions } = await api(`/api/notes/${note.id}/revisions`);
          $("#revisionHistory").innerHTML = revisions.length ? `<h3>Previous versions</h3>${revisions.map((revision) => `
            <article class="resource-item"><strong>${escapeHtml(revision.title)}</strong><p>${escapeHtml(new Date(revision.saved_at).toLocaleString())}</p><details><summary>View saved content</summary><pre>${escapeHtml(revision.content)}</pre></details></article>`).join("")}` : '<p class="muted small">No earlier revisions yet.</p>';
        } catch (error) { toast(error.message, true); }
      });
    }
  }

  async function renderInterviews() {
    const [data, quizData, interviewData] = await Promise.all([
      api("/api/interviews"), api("/api/quizzes"), api("/api/interviews/history")
    ]);
    $("#view-interviews").innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">RECALL · REASON · REFLECT</p><h1>Interview practice</h1><p class="muted">Practice the workbook question bank, score your attempts and record quiz results for revision.</p></div></div>
      <div class="toolbar"><label class="field-label">Question category<select id="categoryFilter"><option value="">All categories (${data.questions.length})</option>${data.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></label><input id="questionSearch" type="search" placeholder="Search the question bank…" style="max-width:320px"></div>
      <div id="questionList" class="topic-list"></div>
      <div class="two-column" style="margin-top:18px">
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">QUIZ SCORE LOG</p><h2>Track weak areas</h2></div></div>
          <form id="quizForm" class="job-form">
            <label class="field-label">Category<input name="category" required maxlength="100" placeholder="SQL, ML, GenAI…"></label>
            <label class="field-label">Score / total<div class="inline-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input name="score" type="number" min="0" step="0.1" required placeholder="Score"><input name="total" type="number" min="0.1" step="0.1" required placeholder="Total"></div></label>
            <label class="field-label full">Weak topics<input name="weak_topics" placeholder="Separate topics with commas"></label>
            <label class="field-label full">Reflection<textarea name="notes" rows="3" maxlength="4000" placeholder="What needs another review?"></textarea></label>
            <button class="button button-dark full" type="submit">Save quiz result</button>
          </form>
          <div class="history-list" style="margin-top:18px">${quizData.attempts.map((attempt) => `<article class="resource-item"><strong>${escapeHtml(attempt.category)} · ${attempt.score}/${attempt.total} (${Math.round(attempt.score / attempt.total * 100)}%)</strong><p>${escapeHtml(new Date(attempt.taken_at).toLocaleString())}</p><p>Review: ${escapeHtml(attempt.weak_topics.join(", ") || "No weak topics recorded")}</p></article>`).join("") || '<p class="muted small">No quiz results logged yet.</p>'}</div>
        </div>
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">MOCK INTERVIEW HISTORY</p><h2>Your attempts</h2></div></div>
          <div class="history-list">${interviewData.attempts.map((attempt) => `<article class="resource-item"><strong>${escapeHtml(attempt.category)} · ${escapeHtml(attempt.score)}/5</strong><p>${escapeHtml(attempt.question)}</p><p>${escapeHtml(new Date(attempt.practiced_at).toLocaleString())}</p></article>`).join("") || '<div class="empty-state">Complete a practice question to start your interview history.</div>'}</div>
        </div>
      </div>`;
    function showQuestions(list) {
      $("#questionList").innerHTML = list.map((question) => `
        <article class="question-card">
          <div class="question-meta"><span class="status-pill">${escapeHtml(question.category)}</span><span>${escapeHtml(question.role_group)}</span><span>${escapeHtml(question.question_id)}</span>${question.last_score !== null ? `<span class="status-pill ${question.last_score >= 4 ? "completed" : "in-progress"}">Last score ${question.last_score}/5</span>` : ""}</div>
          <h3>${escapeHtml(question.question)}</h3>
          <details><summary>What a strong answer covers</summary><p class="muted">${escapeHtml(question.strong_answer)}</p></details>
          <details><summary>Practice and score this answer</summary>
            <form class="answer-form" data-question="${escapeHtml(question.question_id)}">
              <label class="field-label">Your answer<textarea name="answer" maxlength="20000" placeholder="Structure your answer and capture the reasoning…"></textarea></label>
              <label class="field-label">Self-score (0–5)<input class="score-input" type="number" name="score" min="0" max="5" required></label>
              <label class="field-label">Reflection<textarea name="practice_notes" rows="2" maxlength="4000" placeholder="What to improve next time"></textarea></label>
              <button class="button button-soft" type="submit">Save practice attempt</button>
            </form>
          </details>
        </article>`).join("") || '<div class="empty-state">No interview questions match this filter.</div>';
      $$(".answer-form").forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        try {
          await api(`/api/interviews/${encodeURIComponent(form.dataset.question)}/attempts`, {
            method: "POST",
            body: JSON.stringify({
              score: Number(formData.get("score")),
              answer: formData.get("answer"),
              practice_notes: formData.get("practice_notes")
            })
          });
          toast("Practice attempt saved.");
          renderInterviews();
        } catch (error) { toast(error.message, true); }
      }));
    }
    showQuestions(data.questions);
    $("#categoryFilter").addEventListener("change", async (event) => {
      try {
        const filtered = await api(`/api/interviews?category=${encodeURIComponent(event.target.value)}`);
        showQuestions(filtered.questions);
      } catch (error) { toast(error.message, true); }
    });
    $("#questionSearch").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      const category = $("#categoryFilter").value;
      api(`/api/interviews?category=${encodeURIComponent(category)}`).then(({ questions }) => {
        showQuestions(questions.filter((question) => `${question.question} ${question.category} ${question.strong_answer}`.toLowerCase().includes(query)));
      }).catch((error) => toast(error.message, true));
    });
    $("#quizForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      try {
        await api("/api/quizzes", {
          method: "POST",
          body: JSON.stringify({
            category: values.get("category"), score: values.get("score"), total: values.get("total"),
            weak_topics: values.get("weak_topics").split(",").map((topic) => topic.trim()).filter(Boolean),
            notes: values.get("notes")
          })
        });
        toast("Quiz result saved.");
        renderInterviews();
      } catch (error) { toast(error.message, true); }
    });
  }

  async function renderProjects() {
    const { projects } = await api("/api/projects");
    $("#view-projects").innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">BUILD PROOF, NOT JUST NOTES</p><h1>Portfolio projects</h1><p class="muted">Track each project milestone, record evidence and connect your work to interview stories.</p></div></div>
      <div class="project-list">${projects.map((project) => {
        const completed = project.milestones.filter((item) => item.status === "Completed").length;
        const percent = project.milestones.length ? Math.round(completed / project.milestones.length * 100) : 0;
        return `<article class="project-card">
          <div><p class="eyebrow">${escapeHtml(project.project_id)} · ${escapeHtml(project.roles)}</p><h2>${escapeHtml(project.project_name)}</h2><p class="muted small">${escapeHtml(project.suggested_stack)}</p><div class="progress-track"><span style="width:${percent}%"></span></div><p class="muted small">${completed}/${project.milestones.length} milestones complete</p></div>
          <div>${project.milestones.map((milestone) => `
            <div class="milestone">
              <div><strong>Milestone ${milestone.milestone}</strong><p>${escapeHtml(milestone.deliverable)}</p></div>
              <div class="milestone-tools"><select data-project-status="${escapeHtml(project.project_id)}" data-milestone="${milestone.milestone}"><option ${milestone.status === "Not Started" ? "selected" : ""}>Not Started</option><option ${milestone.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${milestone.status === "Completed" ? "selected" : ""}>Completed</option><option ${milestone.status === "Blocked" ? "selected" : ""}>Blocked</option></select><input data-project-proof="${escapeHtml(project.project_id)}" data-milestone="${milestone.milestone}" maxlength="2000" value="${escapeHtml(milestone.proof_url)}" placeholder="Proof / repo URL"></div>
              <label class="field-label" style="grid-column:1/-1">Milestone notes<textarea data-project-notes="${escapeHtml(project.project_id)}" data-milestone="${milestone.milestone}" rows="2" maxlength="4000" placeholder="Evidence, decisions, or blockers">${escapeHtml(milestone.notes)}</textarea></label>
              <button class="button button-soft" data-save-milestone="${escapeHtml(project.project_id)}" data-milestone="${milestone.milestone}">Save milestone</button>
            </div>`).join("")}</div>
          <p class="muted small"><strong>Data policy:</strong> ${escapeHtml(project.data_policy)}</p>
        </article>`;
      }).join("")}</div>`;
    $$("[data-save-milestone]").forEach((button) => button.addEventListener("click", async () => {
      const projectId = button.dataset.saveMilestone;
      const milestone = button.dataset.milestone;
      const status = $(`[data-project-status="${CSS.escape(projectId)}"][data-milestone="${milestone}"]`).value;
      const proofUrl = $(`[data-project-proof="${CSS.escape(projectId)}"][data-milestone="${milestone}"]`).value;
      const notes = $(`[data-project-notes="${CSS.escape(projectId)}"][data-milestone="${milestone}"]`).value;
      try {
        await api(`/api/projects/${encodeURIComponent(projectId)}/milestones/${milestone}`, {
          method: "PUT",
          body: JSON.stringify({ status, proof_url: proofUrl, notes })
        });
        toast("Project milestone saved.");
        renderProjects();
      } catch (error) { toast(error.message, true); }
    }));
  }

  function jobFormMarkup(job = {}) {
    const fields = [
      ["company", "Company", true], ["job_title", "Job title", true],
      ["job_url", "Job URL"], ["location", "Location"],
      ["applied_on", "Applied on (YYYY-MM-DD)"], ["stage", "Stage"],
      ["last_contact", "Last contact (YYYY-MM-DD)"], ["next_action", "Next action"],
      ["recruiter", "Recruiter / referral"], ["salary_range", "Salary range"],
      ["notes", "Notes"]
    ];
    return fields.map(([name, label, required]) => {
      const full = ["next_action", "notes"].includes(name) ? "full" : "";
      if (name === "notes") {
        return `<label class="field-label ${full}">${label}<textarea name="${name}" rows="3" maxlength="4000">${escapeHtml(job[name])}</textarea></label>`;
      }
      return `<label class="field-label ${full}">${label}<input name="${name}" ${required ? "required" : ""} maxlength="4000" value="${escapeHtml(job[name])}" ${name === "job_url" ? 'type="url"' : ""}></label>`;
    }).join("");
  }

  async function renderJobs() {
    const { jobs } = await api("/api/jobs");
    $("#view-jobs").innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">A THOUGHTFUL, TARGETED SEARCH</p><h1>Job applications</h1><p class="muted">Keep role details, interview stages and next actions together. These records are private to your account.</p></div></div>
      <div class="two-column">
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">APPLICATION PIPELINE</p><h2>${jobs.length} tracked roles</h2></div></div><div class="job-list" style="grid-template-columns:1fr">${jobs.map((job) => `
          <article class="job-card"><div class="job-card-header"><div><h3>${escapeHtml(job.job_title)}</h3><p>${escapeHtml(job.company)} · ${escapeHtml(job.location)}</p></div><span class="status-pill in-progress">${escapeHtml(job.stage)}</span></div>
          ${job.job_url ? `<a class="text-link" href="${escapeHtml(job.job_url)}" target="_blank" rel="noopener noreferrer">Open role ↗</a>` : ""}
          <p><strong>Next action:</strong> ${escapeHtml(job.next_action || "—")}</p><p><strong>Applied:</strong> ${escapeHtml(job.applied_on || "Not recorded")} · <strong>Last contact:</strong> ${escapeHtml(job.last_contact || "—")}</p><p>${escapeHtml(job.notes)}</p>
          <div class="inline-actions"><button class="button button-soft" data-edit-job="${job.id}">Edit</button><button class="text-button danger-link" data-delete-job="${job.id}">Delete</button></div></article>`).join("") || '<div class="empty-state">No applications yet. Add a role to begin tracking your search.</div>'}</div></div>
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">TRACK A ROLE</p><h2 id="jobFormTitle">Add application</h2></div></div>
          <form id="jobForm" class="job-form">${jobFormMarkup()}<button class="button button-dark full" type="submit">Save application</button><button id="cancelJobEdit" class="button button-soft full" type="button" hidden>Cancel edit</button></form>
        </div>
      </div>`;
    $("#jobForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form));
      try {
        const id = state.editingJob;
        await api(id ? `/api/jobs/${id}` : "/api/jobs", {
          method: id ? "PUT" : "POST", body: JSON.stringify(payload)
        });
        state.editingJob = null;
        toast(id ? "Application updated." : "Application added.");
        renderJobs();
      } catch (error) { toast(error.message, true); }
    });
    $("#cancelJobEdit").addEventListener("click", () => {
      state.editingJob = null;
      renderJobs();
    });
    $$("[data-edit-job]").forEach((button) => button.addEventListener("click", () => {
      const job = jobs.find((item) => item.id === Number(button.dataset.editJob));
      state.editingJob = job?.id || null;
      if (!job) return;
      $("#jobFormTitle").textContent = "Edit application";
      $("#jobForm").innerHTML = `${jobFormMarkup(job)}<button class="button button-dark full" type="submit">Save changes</button><button id="cancelJobEdit" class="button button-soft full" type="button">Cancel edit</button>`;
      $("#cancelJobEdit").addEventListener("click", () => { state.editingJob = null; renderJobs(); });
      $("#jobForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-delete-job]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Delete this application? This cannot be undone.")) return;
      try {
        await api(`/api/jobs/${button.dataset.deleteJob}`, { method: "DELETE" });
        toast("Application deleted.");
        renderJobs();
      } catch (error) { toast(error.message, true); }
    }));
  }

  async function renderTutor() {
    const { notes } = await api("/api/notes");
    $("#view-tutor").innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">YOUR CONTEXT, YOUR CHOICE</p><h1>AI learning tutor</h1><p class="muted">Ask for explanations, practice prompts or a tailored review plan grounded in your curriculum and learning progress.</p></div></div>
      <div class="two-column">
        <div class="panel tutor-chat">
          <p class="muted">The tutor is not configured until the server has an AI provider key and model. Your question and progress context are sent to that provider only after you confirm below.</p>
          <label class="field-label">What would you like help with?<textarea id="tutorPrompt" rows="6" maxlength="8000" placeholder="Explain precision vs. recall using a product example, then quiz me…"></textarea></label>
          <div class="panel" style="padding:14px"><p class="editor-preview-label">OPTIONAL PRIVATE NOTES</p><p class="muted small">Only the notes you select below are included. They are never attached automatically.</p>
            <div class="resource-list">${notes.map((note) => `<label class="checkbox-row"><input type="checkbox" name="tutorNote" value="${note.id}"><span><strong>${escapeHtml(note.title)}</strong><br>${escapeHtml(note.topic_title || "Unlinked note")}</span></label>`).join("") || '<span class="muted small">No notes saved yet.</span>'}</div>
          </div>
          <label class="checkbox-row"><input id="tutorConsent" type="checkbox"><span>I agree to send my question, curriculum context, completed topics, quiz weak areas and any selected private notes to the AI provider configured by the site owner for this response.</span></label>
          <button id="askTutor" class="button button-dark">Ask the tutor</button>
          <div id="tutorResponse" class="tutor-answer" hidden></div>
        </div>
        <div class="panel"><p class="eyebrow">PRIVACY BY DESIGN</p><h2>Context stays scoped to you</h2><ul class="muted"><li>Progress and notes are queried for your signed-in account only.</li><li>No note is selected by default.</li><li>Nothing is sent unless you tick the explicit consent box and ask a question.</li><li>The provider key stays on the server and is not included in this page.</li></ul></div>
      </div>`;
    $("#askTutor").addEventListener("click", async () => {
      const responseNode = $("#tutorResponse");
      responseNode.hidden = false;
      responseNode.textContent = "Thinking…";
      try {
        const noteIds = $$('input[name="tutorNote"]:checked').map((input) => Number(input.value));
        const result = await api("/api/tutor", {
          method: "POST",
          body: JSON.stringify({
            prompt: $("#tutorPrompt").value,
            note_ids: noteIds,
            consent: $("#tutorConsent").checked
          })
        });
        responseNode.textContent = result.answer;
      } catch (error) {
        responseNode.textContent = error.message;
      }
    });
  }

  async function loadView(name) {
    if (!state.user) return;
    state.activeView = name;
    $$(".side-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    $$(".view-panel").forEach((panel) => { panel.hidden = panel.id !== `view-${name}`; });
    const renderers = {
      dashboard: refreshDashboard,
      lessons: renderLessons,
      interviews: renderInterviews,
      projects: renderProjects,
      jobs: renderJobs,
      tutor: renderTutor
    };
    try {
      await renderers[name]();
      $("#appNotice").hidden = true;
    } catch (error) {
      $("#appNotice").textContent = error.message;
      $("#appNotice").className = "notice error";
      $("#appNotice").hidden = false;
    }
  }

  $("#mainNav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) loadView(button.dataset.view);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-go]");
    if (button) loadView(button.dataset.go);
  });
  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorNode = $("#authError");
    errorNode.hidden = true;
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          login_id: $("#authLoginId").value,
          password: $("#authPassword").value
        })
      });
      showApp(result.login_id);
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
    }
  });
  $("#logoutButton").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      state.user = null;
      await bootstrap();
    } catch (error) { toast(error.message, true); }
  });

  async function bootstrap() {
    const csrf = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
    if (!csrf.ok) throw new Error("Unable to initialize the private workspace.");
    state.csrf = (await csrf.json()).csrf_token;
    const user = await api("/api/auth/me");
    if (user.authenticated) showApp(user.login_id);
    else showAuth();
  }

  bootstrap().catch((error) => {
    $("#authView").hidden = false;
    $("#appView").hidden = true;
    $("#authError").textContent = error.message;
    $("#authError").hidden = false;
  });
})();
