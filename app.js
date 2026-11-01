document.addEventListener("DOMContentLoaded", () => {
  const sectionLinks = document.querySelectorAll('a[href^="#"]');
  const contactForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  const currentYear = document.getElementById("currentYear");
  const chatPopup = document.getElementById("chatPopup");
  const chatLauncher = document.getElementById("chatLauncher");
  const chatClose = document.getElementById("chatClose");
  const chatMessages = document.getElementById("chatMessages");
  const chatbotForm = document.getElementById("chatbotForm");
  const chatbotInput = document.getElementById("chatbotInput");
  const suggestionButtons = document.querySelectorAll(".suggestion-btn");

  const addMessage = (text, sender = "bot") => {
    if (!chatMessages) return;
    const message = document.createElement("div");
    message.className = `message ${sender}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;
    message.appendChild(bubble);
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const constructAnswer = (question) => {
    const lower = question.toLowerCase();
    const skills = ["Python", "SQL", "Azure", "Neo4j", "LLM", "RAG", "Power BI", "Pandas", "NumPy"];
    const projects = [
      "RAG chatbot with knowledge graph retrieval",
      "Natural language enterprise search framework",
      "Intersect for 3D simulation dataset analysis",
      "Customer and campaign analytics"
    ];

    if (lower.includes("project") || lower.includes("work") || lower.includes("case study") || lower.includes("build")) {
      return `Jayesh has worked on projects including: ${projects.join(", ")}. His work focuses on AI systems, enterprise search, analytics, and decision support for real business problems.`;
    }

    if (lower.includes("skill") || lower.includes("stack") || lower.includes("tools") || lower.includes("technology") || lower.includes("web") || lower.includes("development")) {
      return `His core stack includes ${skills.join(", ")}. He works across web development, Generative AI, analytics, and business-facing product solutions.`;
    }

    if (lower.includes("role") || lower.includes("current") || lower.includes("job") || lower.includes("experience") || lower.includes("profile")) {
      return `Jayesh is a Decision Scientist based in Bengaluru, working at the intersection of AI, analytics, and practical business solutions.`;
    }

    if (lower.includes("who") || lower.includes("about") || lower.includes("jayesh")) {
      return `Jayesh Kaushalya builds practical AI and web solutions that help businesses improve decisions, automate work, and turn complex information into usable systems.`;
    }

    if (lower.includes("contact") || lower.includes("reach") || lower.includes("email") || lower.includes("hire") || lower.includes("consult")) {
      return `You can reach out through the contact form on this page to discuss a web project, GenAI solution, or custom product idea.`;
    }

    if (lower.includes("ai") || lower.includes("genai") || lower.includes("rag") || lower.includes("llm") || lower.includes("solution")) {
      return `Jayesh’s work centers on Generative AI, RAG systems, enterprise assistants, and custom AI workflows that solve real operational problems.`;
    }

    if (lower.includes("location") || lower.includes("based")) {
      return `Jayesh is based in Bengaluru, Karnataka, India.`;
    }

    return `Based on this portfolio, Jayesh focuses on practical AI, web solutions, and business analytics. His experience spans GenAI, enterprise search, dashboards, and product-driven problem solving.`;
  };

  const toggleChat = () => {
    if (!chatPopup || !chatLauncher) return;
    const isHidden = chatPopup.classList.toggle("hidden");
    chatLauncher.setAttribute("aria-expanded", String(!isHidden));
  };

  const handleChatSubmit = (question) => {
    const trimmed = question.trim();
    if (!trimmed || !chatMessages) return;

    addMessage(trimmed, "user");
    const answer = constructAnswer(trimmed);
    setTimeout(() => addMessage(answer, "bot"), 220);
  };

  if (chatLauncher) {
    chatLauncher.addEventListener("click", () => {
      toggleChat();
      if (!chatPopup.classList.contains("hidden") && chatbotInput) {
        chatbotInput.focus();
      }
    });
  }

  if (chatClose) {
    chatClose.addEventListener("click", toggleChat);
  }

  if (chatbotForm && chatbotInput) {
    chatbotForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleChatSubmit(chatbotInput.value);
      chatbotInput.value = "";
      chatbotInput.focus();
    });
  }

  suggestionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.textContent.trim();
      if (chatbotInput) {
        chatbotInput.value = value;
      }
      handleChatSubmit(value);
    });
  });

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
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
