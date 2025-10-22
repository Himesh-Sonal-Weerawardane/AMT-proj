// Created by William Alexander Tang Wai on 09/10/2025

let editMode = false;

const getAuthHeaders = () => {
  if (typeof token !== "undefined" && token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

const getSelectedCheckboxes = () =>
  Array.from(document.querySelectorAll(".table-checkbox:checked"));

const getSelectedColumns = () =>
  getSelectedCheckboxes()
    .map((cb) => cb.closest(".column"))
    .filter((col) => col);

const collectModuleIds = (columns) =>
  columns
    .map((column) => column?.dataset?.moduleId)
    .filter((id) => Boolean(id));

const updateVisibilityLabel = (column, hidden) => {
  const label = column.querySelector("[data-visibility-label]");
  if (label) {
    label.textContent = hidden ? "Hidden from markers" : "Visible to markers";
  }
  column.dataset.hiddenFromMarkers = hidden ? "true" : "false";
  column.classList.toggle("column--hidden", hidden);
  if (column.__moduleData) {
    column.__moduleData.hidden_from_markers = hidden;
  }
};

const resetSelection = () => {
  document.querySelectorAll(".table-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });
};

function toggleEditViewings() {
  editMode = !editMode; // Toggle between ON and OFF

  // Get all checkboxes and toggle their visibility
  const checkboxes = document.querySelectorAll(".table-checkbox");
  checkboxes.forEach((cb) => {
    if (editMode) {
      cb.style.display = "inline-flex";
    } else {
      cb.checked = false;
      cb.style.display = "none";
    }
  });

  // Get the buttons to display/hide and toggle their visibility
  const topButtonsContainer = document.getElementById("top-buttons-container");
  topButtonsContainer.style.display = editMode ? "none" : "flex";

  const footer = document.querySelector(".page-footer");
  footer.style.display = editMode ? "flex" : "none";
}

const confirmAction = (message) => window.confirm(message);

const requestJson = async (url, options = {}) => {
  const baseHeaders = options.headers || {};
  const headers = {
    "Content-Type": "application/json",
    ...baseHeaders,
    ...getAuthHeaders()
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const errorMessage = payload.error || response.statusText;
    throw new Error(errorMessage);
  }

  return response.json().catch(() => ({}));
};

async function deleteSelected() {
  const selectedColumns = getSelectedColumns();
  if (selectedColumns.length === 0) {
    alert("Please select at least one module to delete.");
    return;
  }

  const ids = collectModuleIds(selectedColumns);
  if (ids.length === 0) {
    alert("The selected items cannot be deleted.");
    return;
  }

  const shouldDelete = confirmAction(
    `Delete ${ids.length} selected module${ids.length === 1 ? "" : "s"}? This cannot be undone.`
  );
  if (!shouldDelete) return;

  try {
    await requestJson("/api/moderations/batch-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });

    selectedColumns.forEach((column) => {
      column.remove();
    });

    resetSelection();
    alert(`Deleted ${ids.length} module${ids.length === 1 ? "" : "s"}.`);
  } catch (err) {
    console.error("Failed to delete modules", err);
    alert(`Failed to delete modules: ${err.message}`);
  }
}

async function hideFromMarkers() {
  const selectedColumns = getSelectedColumns();
  if (selectedColumns.length === 0) {
    alert("Please select at least one module to update.");
    return;
  }

  const ids = collectModuleIds(selectedColumns);
  if (ids.length === 0) {
    alert("The selected items cannot be updated.");
    return;
  }

  const hasVisibleModule = selectedColumns.some(
    (column) => column.dataset.hiddenFromMarkers !== "true"
  );
  const nextHiddenState = hasVisibleModule;
  const actionText = nextHiddenState ? "hide" : "unhide";

  const shouldProceed = confirmAction(
    `Are you sure you want to ${actionText} ${ids.length} module${ids.length === 1 ? "" : "s"} from markers?`
  );
  if (!shouldProceed) return;

  try {
    await requestJson("/api/moderations/batch-visibility", {
      method: "POST",
      body: JSON.stringify({ ids, hidden: nextHiddenState }),
    });

    selectedColumns.forEach((column) => {
      updateVisibilityLabel(column, nextHiddenState);
    });

    resetSelection();
    alert(
      `${nextHiddenState ? "Hidden" : "Unhidden"} ${ids.length} module${
        ids.length === 1 ? "" : "s"
      } from markers.`
    );
  } catch (err) {
    console.error("Failed to update visibility", err);
    alert(`Failed to update module visibility: ${err.message}`);
  }
}

const formatDateForCsv = (value) => {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString();
  } catch (err) {
    return value;
  }
};

function downloadStats() {
  const selectedColumns = getSelectedColumns();
  if (selectedColumns.length === 0) {
    alert("Please select at least one module to download statistics for.");
    return;
  }

  const modules = selectedColumns
    .map((column) => column.__moduleData)
    .filter((module) => module);

  if (modules.length === 0) {
    alert("No data available for the selected modules.");
    return;
  }

  const headers = [
    "Module Name",
    "Moderation",
    "Year",
    "Semester",
    "Deadline",
    "Uploaded",
    "Hidden From Markers",
  ];

  const csvRows = modules.map((module) => [
    module.name || "",
    module.moderation_number ?? "",
    module.year ?? "",
    module.semester ?? "",
    formatDateForCsv(module.due_date),
    formatDateForCsv(module.upload_date),
    module.hidden_from_markers ? "Yes" : "No",
  ]);

  const csvContent = [headers, ...csvRows]
    .map((row) =>
      row
        .map((value) => {
          const stringValue = value == null ? "" : String(value);
          if (stringValue.includes(",") || stringValue.includes("\"")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `moderation-stats-${Date.now()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

window.toggleEditViewings = toggleEditViewings;
window.deleteSelected = deleteSelected;
window.hideFromMarkers = hideFromMarkers;
window.downloadStats = downloadStats;
