// Sign-in, sign-up and password-reset forms: inline validation, password reveal,
// and a guard against double submits. The server still validates everything.
(() => {
  "use strict";

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // The password rules are read from the checklist on the page, which the server renders from the
  // same list it enforces, so the browser and the server agree.
  const rulesFor = (input) => document.querySelector(`[data-password-rules="${input.id}"]`);
  const missingRules = (input) => {
    const list = rulesFor(input);
    if (!list) return [];
    return [...list.querySelectorAll("[data-rule]")]
      .filter((item) => !new RegExp(item.dataset.pattern).test(input.value))
      .map((item) => item.querySelector("span").textContent.trim());
  };

  const paintRules = (input) => {
    const list = rulesFor(input);
    if (!list) return;
    list.querySelectorAll("[data-rule]").forEach((item) => {
      const met = new RegExp(item.dataset.pattern).test(input.value);
      item.classList.toggle("is-met", met);
      item.querySelector("i").className = `${met ? "fa-solid fa-circle-check" : "fa-regular fa-circle"} wl-rules__icon`;
      item.querySelector("[data-rule-state]").textContent = met ? ", met" : ", not met yet";
    });
  };

  const message = (input) => {
    const noun = input.dataset.label || "this field";
    const value = input.value.trim();
    if (!value && !input.required) return "";
    if (!value) return input.dataset.empty || `Enter your ${noun}.`;
    if (input.type === "email" && !EMAIL.test(value))
      return "Enter a valid email address.";
    if (input.name === "username" && input.form?.action?.endsWith("/signup") && !/^\w+$/.test(value))
      return "Username may only contain letters, numbers and underscores.";
    if (input.minLength > 0 && input.value.length < input.minLength)
      return `Use at least ${input.minLength} characters.`;
    if ("newPassword" in input.dataset) {
      const missing = missingRules(input);
      if (missing.length)
        return `Password needs ${missing.map((label) => label.toLowerCase()).join(", ")}.`;
    }
    return "";
  };

  const setError = (input, text) => {
    const note = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", text ? "true" : "false");
    const hint = input.dataset.hintId;
    const described = [hint, text && note.id].filter(Boolean).join(" ");
    if (described) input.setAttribute("aria-describedby", described);
    else input.removeAttribute("aria-describedby");
    input.closest(".wl-input")?.classList.toggle("is-invalid", Boolean(text));
    note.textContent = text;
    note.classList.remove("is-ok");
    note.hidden = !text;
  };

  // A positive note in the same slot as the error (username free, passwords match)
  const setOk = (input, text) => {
    const note = document.getElementById(`${input.id}-error`);
    setError(input, "");
    note.textContent = text;
    note.classList.add("is-ok");
    note.hidden = !text;
  };

  const checkBoxes = (form) =>
    form.querySelectorAll("[data-required-check]").forEach((box) => {
      box.addEventListener("change", () => {
        const note = document.getElementById(`${box.id}-error`);
        if (box.checked) {
          note.hidden = true;
          box.removeAttribute("aria-invalid");
          box.removeAttribute("aria-describedby");
        }
      });
    });

  // A required radio group: no option is chosen for you, so it is checked on submit
  const radioGroup = (group) => {
    const chosen = group.querySelector("input[type=radio]:checked");
    const note = document.getElementById(`${group.id}-error`);
    note.textContent = chosen ? "" : group.dataset.requiredRadio;
    note.hidden = Boolean(chosen);
    if (chosen) group.removeAttribute("aria-describedby");
    else group.setAttribute("aria-describedby", note.id);
    return chosen;
  };

  const check = (form, input) => {
    let text = message(input);
    const matchName = form.dataset.match;
    if (!text && matchName && input.name === matchName) {
      const other = form.elements.password;
      if (input.value !== other.value) text = "Passwords do not match.";
    }
    setError(input, text);
    if (!text && matchName && input.name === matchName && input.value)
      setOk(input, "Passwords match.");
    return !text;
  };

  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    const inputs = [
      ...form.querySelectorAll(
        ".wl-input input, .wl-input select, .wl-input textarea",
      ),
    ];
    checkBoxes(form);
    const radioGroups = [...form.querySelectorAll("[data-required-radio]")];
    radioGroups.forEach((group) =>
      group.addEventListener("change", () => radioGroup(group)),
    );
    const button = form.querySelector("button[type=submit]");
    const label = button.querySelector("[data-btn-label]");
    const idle = label.textContent;
    button.dataset.idle = idle;

    const reset = () => {
      delete form.dataset.submitting;
      button.removeAttribute("aria-disabled");
      button.classList.remove("is-loading");
      label.textContent = idle;
    };

    inputs.forEach((input) => {
      // Re-check as people fix a field they were already told about
      input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true") check(form, input);
      });
      input.addEventListener("blur", () => {
        if (input.value) check(form, input);
      });
    });

    // Requirements tick off as the password is typed; the confirmation re-checks against it
    inputs.filter((input) => "newPassword" in input.dataset).forEach((input) => {
      paintRules(input);
      input.addEventListener("input", () => {
        paintRules(input);
        const confirm = form.elements[form.dataset.match];
        if (confirm && confirm.value) check(form, confirm);
      });
    });
    const confirmField = form.dataset.match && form.elements[form.dataset.match];
    if (confirmField)
      confirmField.addEventListener("input", () => {
        if (confirmField.value) check(form, confirmField);
      });

    // Username availability, asked of the server once the name is well formed
    const nameField = form.querySelector("[data-check-username]");
    if (nameField) {
      let ask = 0;
      const status = async () => {
        const name = nameField.value.trim();
        if (!/^\w{3,30}$/.test(name)) return;
        const mine = ++ask;
        try {
          const res = await fetch(`/signup/username-available?username=${encodeURIComponent(name)}`, {
            headers: { Accept: "application/json" },
          });
          if (!res.ok || mine !== ask) return;
          const { available } = await res.json();
          if (nameField.value.trim() !== name) return;
          if (available) setOk(nameField, "That username is free.");
          else setError(nameField, "That username is taken.");
        } catch {
          // The server checks again on submit
        }
      };
      let timer;
      nameField.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(status, 400);
      });
      nameField.addEventListener("blur", status);
    }

    form.addEventListener("submit", (event) => {
      if (form.dataset.submitting) return event.preventDefault();
      const bad = inputs.filter((input) => !check(form, input));
      form.querySelectorAll("[data-required-check]").forEach((box) => {
        const note = document.getElementById(`${box.id}-error`);
        note.textContent = box.checked ? "" : box.dataset.requiredCheck;
        note.hidden = box.checked;
        box.setAttribute("aria-invalid", String(!box.checked));
        if (box.checked) box.removeAttribute("aria-describedby");
        else box.setAttribute("aria-describedby", note.id);
        if (!box.checked) bad.push(box);
      });
      radioGroups.forEach((group) => {
        if (!radioGroup(group)) bad.push(group.querySelector("input[type=radio]"));
      });
      if (bad.length) {
        event.preventDefault();
        bad[0].focus();
        return;
      }
      // aria-disabled (not disabled) keeps the button focusable and the submit intact
      form.dataset.submitting = "true";
      button.setAttribute("aria-disabled", "true");
      button.classList.add("is-loading");
      label.textContent = form.dataset.busyLabel || "Please wait…";
    });
  });

  // Blocks the click while a submit is in flight
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[aria-disabled=true]");
    if (button) event.preventDefault();
  });

  document.querySelectorAll("[data-toggle-password], [data-toggle-confirm-password]").forEach((toggle) => {
    const input = document.getElementById(toggle.getAttribute("aria-controls"));
    const icon = toggle.querySelector("i");
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
      icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    });
  });

  // Back/forward cache can restore a page frozen in its "busy" state
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    document.querySelectorAll("[data-auth-form]").forEach((form) => {
      delete form.dataset.submitting;
      const button = form.querySelector("button[type=submit]");
      button.removeAttribute("aria-disabled");
      button.classList.remove("is-loading");
      button.querySelector("[data-btn-label]").textContent =
        button.dataset.idle;
    });
  });

  const error = document.getElementById("form-error");
  if (error) error.focus();
})();
