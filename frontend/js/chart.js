

var xValues = ["Marked", "Unmarked"];
var yValues = [3,3];
var barColors = ["green", "red"];

new Chart("myChart1", {
    type: "doughnut",
    data: {
        labels: xValues,
        datasets: [{
            backgroundColor: barColors,
            data: yValues
        }]
    },
    options: {
        cutoutPercentage: 80,
    }
});

var xValues2 = ["Pending"];
var yValues2 = [100];
var barColors2 = ["grey"];



new Chart("myChart2", {
    type: "doughnut",
    data: {
        labels: xValues2,
        datasets: [{
            backgroundColor: barColors2,
            data: yValues2
        }]
    },
    options: {
        cutoutPercentage: 80,
    }
});
