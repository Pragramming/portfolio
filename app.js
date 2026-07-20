document.addEventListener("DOMContentLoaded", () => {
  const sectionLinks = document.querySelectorAll('a[href^="#"]');
  const contactForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  const currentYear = document.getElementById("currentYear");
  const themeToggle = document.getElementById("themeToggle");
  const themeToggleLabel = themeToggle?.querySelector(".theme-toggle-label");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const storedTheme = localStorage.getItem("portfolio-theme");
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const applyTheme = (theme) => {
    const resolvedTheme = theme === "dark" ? "dark" : "light";
    document.body.setAttribute("data-theme", resolvedTheme);
    localStorage.setItem("portfolio-theme", resolvedTheme);

    if (themeToggle) {
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
      themeToggle.setAttribute("aria-pressed", String(resolvedTheme === "dark"));
      themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    }

    if (themeToggleLabel) {
      themeToggleLabel.textContent = resolvedTheme === "dark" ? "Light" : "Dark";
    }

    if (themeMeta) {
      themeMeta.setAttribute("content", resolvedTheme === "dark" ? "#08101d" : "#07111f");
    }
  };

  applyTheme(storedTheme || (preferredDark ? "dark" : "light"));

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
  }

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") {
        return;
      }

      const target = document.querySelector(targetId);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(contactForm);
      const accessKey = String(formData.get("access_key") || "").trim();
      const submitButton = contactForm.querySelector('button[type="submit"]');

      if (formStatus) {
        formStatus.textContent = "Sending your request...";
        formStatus.className = "form-status";
      }

      if (!accessKey || accessKey === "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY") {
        if (formStatus) {
          formStatus.textContent = "Add your Web3Forms access key in the contact form before sending requests.";
          formStatus.className = "form-status error";
        }
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: formData
        });
        const rawText = await response.text();
        const result = rawText ? JSON.parse(rawText) : {};

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to send your request right now.");
        }

        contactForm.reset();
        if (formStatus) {
          formStatus.textContent = "Thanks. Your request was sent successfully.";
          formStatus.className = "form-status success";
        }
      } catch (error) {
        if (formStatus) {
          formStatus.textContent = error.message || "Something went wrong while sending your request.";
          formStatus.className = "form-status error";
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send Request";
        }
      }
    });
  }
});
