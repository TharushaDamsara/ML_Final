// API communication layer for the Online Shoppers Purchase Prediction backend.
// Talks to the FastAPI service in backend/main.py — no other module should call fetch() directly.

const Api = (() => {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (networkError) {
      throw new ApiError(
        "Could not reach the prediction server. Make sure the backend is running and reachable.",
        0,
        null
      );
    }

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      // Response had no JSON body (e.g. plain 500 HTML) — leave body as null.
    }

    if (!response.ok) {
      throw new ApiError(messageForStatus(response.status, body), response.status, body);
    }

    return body;
  }

  function messageForStatus(status, body) {
    const detail = describeDetail(body && body.detail);

    switch (status) {
      case 400:
        return detail || "The submitted data was invalid. Please review the form.";
      case 401:
      case 403:
        return "You are not authorized to perform this action.";
      case 404:
        return "The prediction endpoint could not be found.";
      case 422:
        return detail || "The submitted data was invalid. Please review the form.";
      case 500:
        return "The prediction server ran into an error processing this session.";
      default:
        return detail || `Unexpected error (HTTP ${status}).`;
    }
  }

  // FastAPI's `detail` is a plain string for HTTPException, but an array of
  // { loc, msg } objects for Pydantic validation errors (422s) — normalize both.
  function describeDetail(detail) {
    if (!detail) return null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "field";
          return `${field}: ${item.msg}`;
        })
        .join(" | ");
    }
    return null;
  }

  function predict(sessionData) {
    return request("/predict", {
      method: "POST",
      body: JSON.stringify(sessionData),
    });
  }

  function health() {
    return request("/health", { method: "GET" });
  }

  return { predict, health };
})();

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
