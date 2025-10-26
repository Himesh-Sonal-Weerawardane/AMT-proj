const formatDate = (isoString) => {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (err) {
    console.error("Failed to format date", err);
    return "-";
  }
};

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  return NaN;
};

const compareYears = (a, b) => {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numB - numA;
  return String(b).localeCompare(String(a));
};

const compareSemesters = (a, b) => {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return String(a).localeCompare(String(b));
};

const compareAssignments = (a, b) => {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return String(a).localeCompare(String(b));
};

const compareModerations = (a, b) => {
  const numA = toNumber(a.moderation_number);
  const numB = toNumber(b.moderation_number);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return String(a.name || "").localeCompare(String(b.name || ""));
};

const normalizeModerations = (modules) => {
  const grouped = new Map();

  modules.forEach((module) => {
    const yearKey = module.year ?? "Other";
    const semesterKey = module.semester ?? "Other";

    if (!grouped.has(yearKey)) {
      grouped.set(yearKey, new Map());
    }
    const semesterMap = grouped.get(yearKey);
    if (!semesterMap.has(semesterKey)) {
      semesterMap.set(semesterKey, []);
    }
    semesterMap.get(semesterKey).push(module);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => compareYears(a[0], b[0]))
    .map(([year, semesterMap]) => ({
      year,
      semesters: Array.from(semesterMap.entries())
        .sort((a, b) => compareSemesters(a[0], b[0]))
        .map(([semester, mods]) => ({
          semester,
          modules: mods.sort(compareModerations),
        })),
    }));
};

const createStatusMessage = (message, state = "info") => {
  const paragraph = document.createElement("p");
  paragraph.className = "modules-status";
  paragraph.dataset.state = state;
  paragraph.textContent = message;
  return paragraph;
};

const appendRow = (table, label, value, options = {}) => {
  const row = document.createElement("tr");
  const labelCell = document.createElement("td");
  labelCell.textContent = label;
  row.appendChild(labelCell);

  const valueCell = document.createElement("td");
  if (options.link) {
    const link = document.createElement("a");
    link.href = options.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = value || "Open";
    valueCell.appendChild(link);
  } else if (options.wrap instanceof HTMLElement) {
    valueCell.appendChild(options.wrap);
  } else {
    valueCell.textContent = value || "-";
  }

  if (options.dataset && typeof options.dataset === "object") {
    Object.entries(options.dataset).forEach(([key, val]) => {
      if (val !== undefined) {
        valueCell.dataset[key] = String(val);
      }
    });
  }

  row.appendChild(valueCell);
  table.appendChild(row);
};

const createVisibilityIndicator = (hidden) => {
  const indicator = document.createElement("span");
  indicator.dataset.visibilityLabel = "true";
  indicator.textContent = hidden ? "Hidden from markers" : "Visible to markers";
  return indicator;
};

const createModuleColumn = (module, role) => {
  const column = document.createElement("div");
  column.className = "column";
  column.dataset.moduleId = module.id ?? "";
  column.dataset.moduleName = module.name ?? "";
  column.dataset.moduleModeration = module.moderation_number ?? "";
  column.dataset.moduleYear = module.year ?? "";
  column.dataset.moduleSemester = module.semester ?? "";
  column.dataset.hiddenFromMarkers = module.hidden_from_markers
    ? "true"
    : "false";
  column.__moduleData = module;

  if (module.hidden_from_markers) {
    column.classList.add("column--hidden");
  }

  const table = document.createElement("table");
  table.className = "moderation-table";

  const headerRow = document.createElement("tr");
  const headerCell = document.createElement("th");
  headerCell.colSpan = 2;

  const headerWrapper = document.createElement("span");
  headerWrapper.className = "table-header";

  const title =
    module.name ||
    (module.moderation_number
      ? `Moderation ${module.moderation_number}`
      : "Moderation");
  const moduleUrl =
    role === "admin"
      ? `/admin/module-detail.html?id=${encodeURIComponent(module.id)}`
      : `/marker/moderation-page.html?id=${encodeURIComponent(module.id)}`;

  const link = document.createElement("span");
  link.className = "moderation-link";
  link.textContent = title;
  link.addEventListener("click", () => {
    window.location.href = moduleUrl;
  });

  headerWrapper.appendChild(link);

  if (role === "admin") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "table-checkbox";
    checkbox.style.display = "none";
    headerWrapper.appendChild(checkbox);
  }

  headerCell.appendChild(headerWrapper);
  headerRow.appendChild(headerCell);
  table.appendChild(headerRow);

  if (role === "admin") {
    appendRow(table, "Moderation", module.moderation_number ?? "-");
    appendRow(table, "Deadline", formatDate(module.due_date));
    appendRow(table, "Uploaded", formatDate(module.upload_date));
    appendRow(table, "Visibility", "", {
      wrap: createVisibilityIndicator(module.hidden_from_markers),
    });
    appendRow(
      table,
      "Description",
      module.description || "No description provided."
    );
  } else {
    appendRow(table, "Deadline", formatDate(module.due_date));
    appendRow(table, "Uploaded", formatDate(module.upload_date));
    appendRow(
      table,
      "Description",
      module.description || "No description provided."
    );
  }

  if (module.assignment_public_url) {
    appendRow(table, "Assignment", "Download", {
      link: module.assignment_public_url,
    });
  }

  if (module.rubric_public_url) {
    appendRow(table, "Rubric", "Download", { link: module.rubric_public_url });
  }

  column.appendChild(table);
  return column;
};

const renderModerations = (groupedData, role, container) => {
  groupedData.forEach(({ year, semesters }) => {
    const yearButton = document.createElement("button");
    yearButton.className = "accordion";
    yearButton.textContent =
      year === "Other" ? "Year not specified" : `Year ${year}`;

    const yearPanel = document.createElement("div");
    yearPanel.className = "panel";

    semesters.forEach(({ semester, modules }) => {
      const semesterButton = document.createElement("button");
      semesterButton.className = "accordion1";
      semesterButton.textContent =
        semester === "Other"
          ? "Semester not specified"
          : `Semester ${semester}`;

      const semesterPanel = document.createElement("div");
      semesterPanel.className = "panel";

      const row = document.createElement("div");
      row.className = "row";

      modules.forEach((module) => {
        row.appendChild(createModuleColumn(module, role));
      });

      semesterPanel.appendChild(row);
      yearPanel.appendChild(semesterButton);
      yearPanel.appendChild(semesterPanel);
      yearPanel.appendChild(document.createElement("br"));
    });

    container.appendChild(yearButton);
    container.appendChild(yearPanel);
    container.appendChild(document.createElement("br"));
  });

  const accordion = document.getElementsByClassName("accordion");
  const accordion1 = document.getElementsByClassName("accordion1");
  if (typeof toggleAccordion === "function") {
    toggleAccordion(accordion);
    toggleAccordion(accordion1);
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("accordions");
  if (!container) return;

  const role = document.body.dataset.role || "admin";

  container.textContent = "";
  container.appendChild(createStatusMessage("Loading modules…"));

  const headers = {};
  if (typeof token !== "undefined" && token) {
    headers["Authorization"] = "Bearer " + token;
  }

  try {
    const url = new URL("/api/moderations", window.location.origin);
    url.searchParams.set("role", role);
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch modules: ${res.status}`);
    }

    const payload = await res.json();
    const modules = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.moderations)
        ? payload.moderations
        : [];

    container.textContent = "";

    if (modules.length === 0) {
      container.appendChild(
        createStatusMessage("No modules have been published yet.")
      );
      return;
    }

    const grouped = normalizeModerations(modules);
    renderModerations(grouped, role, container);
  } catch (err) {
    console.error("Failed to load moderations", err);
    container.textContent = "";
    container.appendChild(
      createStatusMessage(
        "We couldn't load the modules right now. Please try again later.",
        "error"
      )
    );
  }
});
