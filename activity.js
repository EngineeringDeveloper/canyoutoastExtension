/* global Strava, pageView */
console.log("Running Canyoutoast Extension");
// Have Global object Strava

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function noData() {
    let chart = document.getElementsByClassName("chart")[0];
    // create a div with text content
    let div = document.createElement("div");
    div.textContent =
        "Canyoutoast - No Power Data Available - Can't toast with that!";
    chart.insertBefore(div, chart.lastElementChild);
}

const _attemptedFetch = new Set();
const _pendingFetches = new Map();
async function fetchStreams(streamTypes) {
    if (pageView.streamsRequest.pending) {
        // We must wait until the pageView.streamsRequest has completed.
        // Stream transform functions fail otherwise.
        await pageView.streamsRequest.pending;
    }
    const streams = pageView.streams();
    const attempted = _attemptedFetch;
    const pending = _pendingFetches;
    const available = new Set(Object.keys(streams.availableStreams()));
    const fetched = new Set(streams.requestedTypes);
    const todo = streamTypes.filter(x => !attempted.has(x) && !available.has(x) && !fetched.has(x));
    if (todo.length) {
        const waitfor = [];
        const fetching = [];
        for (const x of todo) {
            if (pending.has(x)) {
                // This stream is in flight, wait for existing promise.
                waitfor.push(pending.get(x));
            } else {
                fetching.push(x);
            }
        }
        if (fetching.length) {
            const p = new Promise((resolve, reject) => {
                streams.fetchStreams(fetching, {
                    success: resolve,
                    error: (streams, ajax) => {
                        let e;
                        if (ajax.status === 429) {
                            e = new ThrottledNetworkError();
                        } else {
                            e = new Error(`Fetch streams failed: ${ajax.status} ${ajax.statusText}`);
                        }
                        reject(e);
                    }
                });
            });
            for (const x of fetching) {
                pending.set(x, p);
            }
            try {
                await p;
            } finally {
                for (const x of fetching) {
                    pending.delete(x);
                }
            }
            for (const x of fetching) {
                attempted.add(x);
            }
        }
        if (waitfor.length) {
            await Promise.all(waitfor);
        }
    }
    return streamTypes.map(x => streams.getStream(x));
}

function idxMax(array) {
	return array.reduce((prev, current, currentIndex, array) => {
		return current > array[prev] ? currentIndex : prev;
	}, 0);
}

function findEfforts(watts, powerMinimum, period, minJoules) {
	// create the moving average Power
	// padding the extents with 0's
	const movingAverage = watts.map((value, index, array) => {
		// ends cut to 0
		if (index < period - 1) {
			return 0;
		}
		if (index > array.length - period) {
			return 0;
		}
		let total = 0;
		array.slice(index - period, index + 1).forEach((value) => (total += value));
		return total / period;
	});

	const effortValue = [];
	const efforts = [];
    let thisEffort = [];
    let thisEffortStartIndex = 0;
    let thisEffortEndIndex = 0;
	// Split the movingAverage into efforts > powerMinimum
	movingAverage.forEach((value, index) => {
		// push to this effort
		if (value >= powerMinimum) {
            thisEffort.push(value);
            if (thisEffort.length == 1) {
                thisEffortStartIndex = index;
            }
			return;
		}
        // effort has ended
        thisEffortEndIndex = index
		let effortJoules = 0;
		// because Watts * seconds = Joules and sampling is 1hz
        thisEffort.forEach((value) => (effortJoules += value));
        if (effortJoules >= minJoules) {
            effortValue.push(effortJoules);
            efforts.push({
                power: effortJoules / thisEffort.length,
                timeS: thisEffort.length,
                joules: effortJoules,
                startIndex: thisEffortStartIndex,
                endIndex: thisEffortEndIndex
            });
        }
		thisEffort = [];
	});

	// return the best effort
	const bestEffort = idxMax(effortValue);
	return {bestEffort: efforts[bestEffort], efforts};
}

async function run() {
    let powerData;
    try {
        powerData = (await fetchStreams(["watts"]))[0];
        
    }
    catch (e) {
        console.error(e)
        noData()
    }
    
    console.log(powerData)

    // find efforts
    const powerMinimum = 350;
    const period = 30;
    const minJoules = 5000;
    const {bestEffort, efforts}  = findEfforts(powerData, powerMinimum, period, minJoules);
    console.log(bestEffort);
    console.log(efforts);

    // add a custom plotlyjs chart to the page
    let chart = document.getElementsByClassName("chart")[0];
    // create a div with text content
    let div = document.createElement("div");
    // div.textContent = "Canyoutoast - With Power!";
    div.style.width = "100%";

    // Plotly.newPlot( div, [{
    //     x: powerData.map((_, i) => i),
    //     y: powerData }], {
    //     margin: { t: 0 } } );#

    const traces = efforts.map((value, i) => { 
        return {
            x: Array.from({ length: value.endIndex - value.startIndex }, (v, k) => value.startIndex + k),
            y: Array.from({ length: value.endIndex - value.startIndex }, (v, k) => powerData[value.startIndex + k]),
            type: 'scatter',
            mode: 'lines',
            name: `Effort ${i + 1}`
        }
    })
    // display all the power as a 50% opacity line
    traces.push({
        x: powerData.map((_, i) => i),
        y: powerData,
        type: 'scatter',
        mode: 'lines',
        name: 'Power',
        opacity: 0.5
    });

    // display the best effort as a filled in area
    traces.push({
        x: Array.from({ length: bestEffort.endIndex - bestEffort.startIndex }, (v, k) => bestEffort.startIndex + k),
        y: Array.from({ length: bestEffort.endIndex - bestEffort.startIndex }, (v, k) => powerData[bestEffort.startIndex + k]),
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        name: 'Best Effort'
    });

    console.log(traces)

    Plotly.newPlot( div, traces,
        {
        margin: { t: 0 } } );

    chart.insertBefore(div, chart.lastElementChild);
}

run();
