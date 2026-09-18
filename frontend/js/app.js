// Application logic: builds the form from FIELD_GROUPS, wires up validation,
// drives the idle/loading/success/error UI states, and talks to Api.

document.addEventListener("DOMContentLoaded", () => {
  const formGroupsEl = document.getElementById("form-groups");
  const formEl = document.getElementById("prediction-form");
  const formFieldsetEl = document.getElementById("form-fieldset");
  const submitBtn = document.getElementById("submit-btn");
  const submitBtnLabel = submitBtn.querySelector(".btn-label");

  const formSection = document.getElementById("form-section");
  const resultSection = document.getElementById("result-section");
  const errorBanner = document.getElementById("error-banner");
  const errorMessageEl = document.getElementById("error-message");

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  renderForm();
  checkBackendHealth();

  document.getElementById("dismiss-error-btn").addEventListener("click", () => {
    errorBanner.classList.add("hidden");
  });

  document.getElementById("reset-btn").addEventListener("click", resetToForm);

  formEl.addEventListener("submit", handleSubmit);

  // ── form rendering ──────────────────────────────────────────────────────
  function renderForm() {
    FIELD_GROUPS.forEach((group) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "form-group";

      const legend = document.createElement("legend");
      legend.textContent = group.title;
      fieldset.appendChild(legend);

      if (group.description) {
        const desc = document.createElement("p");
        desc.className = "group-description";
        desc.textContent = group.description;
        fieldset.appendChild(desc);
      }

      const grid = document.createElement("div");
      grid.className = "field-grid";

      group.fields.forEach((field) => grid.appendChild(renderField(field)));

      fieldset.appendChild(grid);
      formGroupsEl.appendChild(fieldset);
    });
  }

  function renderField(field) {
    const wrapper = document.createElement("div");
    wrapper.className = field.type === "checkbox" ? "field field--checkbox" : "field";

    const label = document.createElement("label");
    label.setAttribute("for", field.name);
    label.innerHTML = `${field.label}${field.required ? ' <span class="required" aria-hidden="true">*</span>' : ""}`;

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      input.appendChild(new Option(`Select ${field.label}…`, ""));
      field.options.forEach((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const text = typeof opt === "string" ? opt : opt.label;
        input.appendChild(new Option(text, value));
      });
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
    } else {
      input = document.createElement("input");
      input.type = "number";
      if (field.step !== undefined) input.step = field.step;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.placeholder) input.placeholder = field.placeholder;
    }

    input.id = field.name;
    input.name = field.name;
    if (field.required && field.type !== "checkbox") input.required = true;
    input.addEventListener("blur", () => validateSingleField(field));
    input.addEventListener("input", () => clearFieldError(field));

    const help = document.createElement("p");
    help.className = "field-help";
    help.textContent = field.help || "";

    const errorEl = document.createElement("p");
    errorEl.className = "field-error";
    errorEl.id = `${field.name}-error`;
    errorEl.setAttribute("role", "alert");

    if (field.type === "checkbox") {
      const checkboxRow = document.createElement("div");
      checkboxRow.className = "checkbox-row";
      checkboxRow.appendChild(input);
      checkboxRow.appendChild(label);
      wrapper.appendChild(checkboxRow);
      wrapper.appendChild(help);
    } else {
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      wrapper.appendChild(help);
      wrapper.appendChild(errorEl);
    }

    return wrapper;
  }

  // ── validation ──────────────────────────────────────────────────────────
  function validateSingleField(field) {
    const input = document.getElementById(field.name);
    const result = Validation.validateField(field, input.value);
    const errorEl = document.getElementById(`${field.name}-error`);

    if (!result.valid) {
      input.classList.add("invalid");
      if (errorEl) errorEl.textContent = result.message;
    } else {
      input.classList.remove("invalid");
      if (errorEl) errorEl.textContent = "";
    }
    return result.valid;
  }

  function clearFieldError(field) {
    const input = document.getElementById(field.name);
    const errorEl = document.getElementById(`${field.name}-error`);
    input.classList.remove("invalid");
    if (errorEl) errorEl.textContent = "";
  }

  function validateForm() {
    let firstInvalid = null;
    let allValid = true;

    Validation.allFields().forEach((field) => {
      const valid = validateSingleField(field);
      if (!valid) {
        allValid = false;
        if (!firstInvalid) firstInvalid = document.getElementById(field.name);
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return allValid;
  }

  // ── data collection ─────────────────────────────────────────────────────
  function collectFormData() {
    const data = {};
    Validation.allFields().forEach((field) => {
      const input = document.getElementById(field.name);
      if (field.type === "checkbox") {
        data[field.name] = input.checked;
      } else if (field.type === "number") {
        data[field.name] = Number(input.value);
      } else {
        data[field.name] = input.value;
      }
    });
    return data;
  }

  // ── submit / states ─────────────────────────────────────────────────────
  async function handleSubmit(event) {
    event.preventDefault();
    errorBanner.classList.add("hidden");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const sessionData = collectFormData();
      const result = await Api.predict(sessionData);
      renderResult(result);
      showResultState();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    formFieldsetEl.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtnLabel.textContent = isLoading ? "Analyzing your data…" : "Predict Purchase Likelihood";
  }

  function showError(message) {
    errorMessageEl.textContent = message;
    errorBanner.classList.remove("hidden");
    errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showResultState() {
    formSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetToForm() {
    formEl.reset();
    Validation.allFields().forEach(clearFieldError);
    resultSection.classList.add("hidden");
    errorBanner.classList.add("hidden");
    formSection.classList.remove("hidden");
    formSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── result rendering ─────────────────────────────────────────────────────
  function renderResult(result) {
    const isPurchase = result.prediction === 1;

    const badge = document.getElementById("result-badge");
    badge.textContent = result.result;
    badge.className = `result-badge ${isPurchase ? "result-badge--positive" : "result-badge--negative"}`;

    document.getElementById("result-summary").textContent = isPurchase
      ? "This session shows behavior consistent with a completed purchase."
      : "This session is unlikely to result in a purchase.";

    const purchaseBar = document.getElementById("purchase-bar");
    const noPurchaseBar = document.getElementById("no-purchase-bar");
    purchaseBar.style.width = `${result.purchase_probability}%`;
    noPurchaseBar.style.width = `${result.no_purchase_probability}%`;

    document.getElementById("purchase-probability-value").textContent = `${result.purchase_probability}%`;
    document.getElementById("no-purchase-probability-value").textContent = `${result.no_purchase_probability}%`;

    document.getElementById("result-model").textContent = result.model;
  }

  // ── backend connection status ───────────────────────────────────────────
  async function checkBackendHealth() {
    try {
      const health = await Api.health();
      statusDot.classList.add("status-dot--online");
      statusText.textContent = `Connected · ${health.model}`;
    } catch (_) {
      statusDot.classList.add("status-dot--offline");
      statusText.textContent = "Backend unreachable";
    }
  }
});
