/* Dragging feature using the vertical page divider */

document.addEventListener("DOMContentLoaded", () => {
	const dragbar = document.getElementById("drag-bar");
	const leftPanel = document.querySelector(".left-panel");
	const rightPanel = document.querySelector(".right-panel");
	let dragging = false;

	dragbar.addEventListener("mousedown", (e) => {
		dragging = true;
		document.body.style.cursor = "col-resize";
		e.preventDefault();
	});

	document.addEventListener("mousemove", (e) => {
		if (!dragging) return;

		const containerWidth = dragbar.parentElement.offsetWidth;

		let leftWidth = e.clientX;
		let rightWidth = containerWidth - leftWidth - dragbar.offsetWidth;

		const minWidth = 100;
		if (leftWidth < minWidth) leftWidth = minWidth;
		if (rightWidth < minWidth)
			leftWidth = containerWidth - minWidth - dragbar.offsetWidth;

		leftPanel.style.width = `${leftWidth}px`;
		rightPanel.style.width = `${containerWidth - leftWidth - dragbar.offsetWidth}px`;
	});

	document.addEventListener("mouseup", () => {
		if (dragging) {
			dragging = false;
			document.body.style.cursor = "default";
		}
	});
});
