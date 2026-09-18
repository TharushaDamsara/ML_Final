// Field definitions + validation rules, mirrored 1:1 from backend/main.py's SessionInput schema.
// This is the single source of truth the form is generated from and validated against.

const FIELD_GROUPS = [
  {
    title: "Page Visit Behavior",
    description: "How many pages of each type the visitor viewed, and how long they spent on them.",
    fields: [
      {
        name: "Administrative",
        label: "Administrative Pages Visited",
        type: "number",
        step: "1",
        min: 0,
        required: true,
        placeholder: "e.g. 2",
        help: "Number of account/administrative pages viewed this session.",
      },
      {
        name: "Administrative_Duration",
        label: "Administrative Duration (seconds)",
        type: "number",
        step: "0.01",
        min: 0,
        required: true,
        placeholder: "e.g. 45.5",
        help: "Total time spent on administrative pages.",
      },
      {
        name: "Informational",
        label: "Informational Pages Visited",
        type: "number",
        step: "1",
        min: 0,
        required: true,
        placeholder: "e.g. 0",
        help: "Number of informational pages viewed this session.",
      },
      {
        name: "Informational_Duration",
        label: "Informational Duration (seconds)",
        type: "number",
        step: "0.01",
        min: 0,
        required: true,
        placeholder: "e.g. 0",
        help: "Total time spent on informational pages.",
      },
      {
        name: "ProductRelated",
        label: "Product-Related Pages Visited",
        type: "number",
        step: "1",
        min: 0,
        required: true,
        placeholder: "e.g. 12",
        help: "Number of product pages viewed this session.",
      },
      {
        name: "ProductRelated_Duration",
        label: "Product-Related Duration (seconds)",
        type: "number",
        step: "0.01",
        min: 0,
        required: true,
        placeholder: "e.g. 320.75",
        help: "Total time spent on product-related pages.",
      },
    ],
  },
  {
    title: "Engagement Metrics",
    description: "Behavioral signals captured by Google Analytics-style tracking for the session.",
    fields: [
      {
        name: "BounceRates",
        label: "Bounce Rate",
        type: "number",
        step: "0.01",
        min: 0,
        max: 1,
        required: true,
        placeholder: "0.00 – 1.00",
        help: "Average bounce rate of the pages visited (0 = none, 1 = all single-page exits).",
      },
      {
        name: "ExitRates",
        label: "Exit Rate",
        type: "number",
        step: "0.01",
        min: 0,
        max: 1,
        required: true,
        placeholder: "0.00 – 1.00",
        help: "Average exit rate of the pages visited.",
      },
      {
        name: "PageValues",
        label: "Page Values",
        type: "number",
        step: "0.01",
        min: 0,
        required: true,
        placeholder: "e.g. 15.20",
        help: "Average value of the pages visited prior to a transaction.",
      },
      {
        name: "SpecialDay",
        label: "Special Day Closeness",
        type: "number",
        step: "0.01",
        min: 0,
        max: 1,
        required: true,
        placeholder: "0.00 – 1.00",
        help: "Closeness of the visit to a special day (e.g. Valentine's Day), 0–1.",
      },
    ],
  },
  {
    title: "Session Context",
    description: "When and how the visitor arrived at the site.",
    fields: [
      {
        name: "Month",
        label: "Month",
        type: "select",
        required: true,
        options: ["Jan", "Feb", "Mar", "Apr", "May", "June", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        help: "Month the session occurred in.",
      },
      {
        name: "VisitorType",
        label: "Visitor Type",
        type: "select",
        required: true,
        options: [
          { value: "New_Visitor", label: "New Visitor" },
          { value: "Returning_Visitor", label: "Returning Visitor" },
          { value: "Other", label: "Other" },
        ],
        help: "Whether the visitor is new, returning, or classified as other.",
      },
      {
        name: "OperatingSystems",
        label: "Operating System Code",
        type: "number",
        step: "1",
        min: 1,
        max: 8,
        required: true,
        placeholder: "1 – 8",
        help: "Anonymized operating system identifier (1–8) as recorded by the source dataset.",
      },
      {
        name: "Browser",
        label: "Browser Code",
        type: "number",
        step: "1",
        min: 1,
        max: 13,
        required: true,
        placeholder: "1 – 13",
        help: "Anonymized browser identifier (1–13) as recorded by the source dataset.",
      },
      {
        name: "Region",
        label: "Region Code",
        type: "number",
        step: "1",
        min: 1,
        max: 9,
        required: true,
        placeholder: "1 – 9",
        help: "Anonymized geographic region identifier (1–9) as recorded by the source dataset.",
      },
      {
        name: "Weekend",
        label: "Session occurred on a weekend",
        type: "checkbox",
        required: false,
        help: "Check if the visit took place on a Saturday or Sunday.",
      },
    ],
  },
];

const Validation = (() => {
  function validateField(field, rawValue) {
    if (field.type === "checkbox") return { valid: true };

    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      if (field.required) return { valid: false, message: `${field.label} is required.` };
      return { valid: true };
    }

    if (field.type === "number") {
      const value = Number(rawValue);
      if (Number.isNaN(value)) {
        return { valid: false, message: `${field.label} must be a number.` };
      }
      if (field.min !== undefined && value < field.min) {
        return { valid: false, message: `${field.label} must be at least ${field.min}.` };
      }
      if (field.max !== undefined && value > field.max) {
        return { valid: false, message: `${field.label} must be at most ${field.max}.` };
      }
    }

    if (field.type === "select" && field.required && rawValue === "") {
      return { valid: false, message: `Please select a ${field.label}.` };
    }

    return { valid: true };
  }

  function allFields() {
    return FIELD_GROUPS.flatMap((group) => group.fields);
  }

  return { validateField, allFields };
})();
