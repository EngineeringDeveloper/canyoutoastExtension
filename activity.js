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

    // add a custom plotlyjs chart to the page
    let chart = document.getElementsByClassName("chart")[0];
    // create a div with text content
    let div = document.createElement("div");
    // div.textContent = "Canyoutoast - With Power!";
    div.style.width = "100%";

    Plotly.newPlot( div, [{
        x: powerData.map((_, i) => i),
        y: powerData }], {
        margin: { t: 0 } } );

    chart.insertBefore(div, chart.lastElementChild);
}

run();
