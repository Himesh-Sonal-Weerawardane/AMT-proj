const chartWrappers = document.querySelectorAll(".chart-wrapper");

chartWrappers.forEach((wrapper) => {
	const canvas = wrapper.querySelector("canvas");
	if (!canvas) {
		return;
	}

	const marked = parseInt(wrapper.dataset.marked, 10) || 0;
	const unmarked = parseInt(wrapper.dataset.unmarked, 10) || 0;
	const total = marked + unmarked;

	new Chart(canvas, {
		type: "doughnut",
		data: {
			labels: ["Marked", "Unmarked"],
			datasets: [
				{
					backgroundColor: ["#1B998B", "#E94F37"],
					borderWidth: 0,
					hoverOffset: 6,
					data: [marked, unmarked],
				},
			],
		},
		options: {
			cutoutPercentage: 72,
			legend: {
				display: false,
			},
			tooltips: {
				callbacks: {
					label: function (tooltipItem, data) {
						const label = data.labels[tooltipItem.index] || "";
						const value =
							data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
						return `${label}: ${value}`;
					},
				},
			},
			maintainAspectRatio: false,
		},
	});

	const countEl = wrapper.querySelector(".chart-count");
	const labelEl = wrapper.querySelector(".chart-center-label");
	if (countEl) {
		if (marked === 0 && labelEl) {
			countEl.textContent = "Pending";
			countEl.classList.add("pending");
			labelEl.textContent = "";
		} else {
			countEl.textContent = marked;
			if (labelEl) {
				labelEl.textContent = "Marked";
			}
		}
	}

	const parent = wrapper.closest(".moderation-progress");
	if (!parent) {
		return;
	}

	const markedDetail = parent.querySelector('[data-detail="marked"]');
	const unmarkedDetail = parent.querySelector('[data-detail="unmarked"]');
	const totalDetail = parent.querySelector('[data-detail="total"]');

	if (markedDetail) {
		markedDetail.textContent = marked;
	}
	if (unmarkedDetail) {
		unmarkedDetail.textContent = unmarked;
	}
	if (totalDetail) {
		totalDetail.textContent = total;
	}
});
