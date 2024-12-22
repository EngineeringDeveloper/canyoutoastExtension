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
    const todo = streamTypes.filter(
        (x) => !attempted.has(x) && !available.has(x) && !fetched.has(x)
    );
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
                            e = new Error(
                                `Fetch streams failed: ${ajax.status} ${ajax.statusText}`
                            );
                        }
                        reject(e);
                    },
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
    return streamTypes.map((x) => streams.getStream(x));
}

function idxMax(array) {
    return array.reduce((prev, current, currentIndex, array) => {
        return current > array[prev] ? currentIndex : prev;
    }, 0);
}

const bins = [
    30000, 43200, 64800, 86400, 97200, 108000, 129600, 151200, 162000, 172800,
    194400,
];

const toastSrc = [
    {
        text: "Thats just Bread",
        altText: "Thats just Bread",
        src: "/images/toast/0.png",
        idx: 0,
    }, // 0 Bread
    {
        text: "I guess it's warm?",
        altText: "Warmed Bread",
        src: "/images/toast/1.png",
        idx: 1,
    },
    {
        text: "If you look closely",
        altText: "Slightly cooked if you look closely",
        src: "/images/toast/2.png",
        idx: 2,
    },
    {
        text: "Just about!",
        altText: "Just about toast",
        src: "/images/toast/3.png",
        idx: 3,
    }, // 3
    {
        text: "Keep Trying",
        altText: "almost toast keep trying",
        src: "/images/toast/4.png",
        idx: 4,
    },
    {
        text: "Not quite there",
        altText: "Almost Done Toast",
        src: "/images/toast/5.png",
        idx: 5,
    },
    {
        text: "Now thats Toast",
        altText: "Builders Brew Toast",
        src: "/images/toast/6.png",
        idx: 6,
    }, // 6
    {
        text: "A little over done",
        altText: "a litte overdone Toast",
        src: "/images/toast/7.png",
        idx: 7,
    },
    {
        text: "That'll do",
        altText: "overdone Toast",
        src: "/images/toast/8.png",
        idx: 8,
    },
    {
        text: "Half way to dust",
        altText: "half burnt",
        src: "/images/toast/9.png",
        idx: 9,
    },
    {
        text: "Maybe edible",
        altText: "almost burnt",
        src: "/images/toast/10.png",
        idx: 10,
    }, // 10
    {
        text: "On Fire!",
        altText: "Toast on Fire",
        src: "/images/toast/11.png",
        idx: 11,
    }, // Burnt
];

function binValue(value) {
    for (const [i, bin] of bins.entries()) {
        // return the index of the bin which the value sits
        switch (i) {
            case 0:
                if (value <= bin) {
                    return i;
                }
            default:
                if (value < bin) {
                    return i;
                }
        }
    }
    // Greater than all bins
    return 11;
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
        array
            .slice(index - period, index + 1)
            .forEach((value) => (total += value));
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
        thisEffortEndIndex = index;
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
                endIndex: thisEffortEndIndex,
                bin: binValue(effortJoules),
            });
        }
        thisEffort = [];
    });

    // return the best effort
    const bestEffort = idxMax(effortValue);
    return { bestEffort: efforts[bestEffort], efforts };
}

// check to see if this function has run before by the existance of the plotly class="js-plotly-plot"
function checkForPlotly() {
    if (document.getElementsByClassName("js-plotly-plot").length > 0) {
        console.log("CanyoutoastExtension - found existing plot");
        return true;
    }
    console.log("CanyoutoastExtension - no existing plot");
    return false;
}

async function runFrontend() {
    if (checkForPlotly()) {
        return;
    }

    let powerData;
    try {
        powerData = (await fetchStreams(["watts"]))[0];
    } catch (e) {
        console.error(e);
        noData();
    }

    console.log(powerData);

    // find efforts
    const powerMinimum = 350;
    const period = 30;
    const minJoules = 5000;
    const { bestEffort, efforts } = findEfforts(
        powerData,
        powerMinimum,
        period,
        minJoules
    );
    console.log(bestEffort);
    console.log(efforts);

    // add a custom plotlyjs chart to the page
    let chart = document.querySelectorAll('section[class="chart"]');
    while (chart.length == 0) {
        console.log("CanyoutoastExtension - Waiting for chart to load");
        chart = document.querySelectorAll('section[class="chart"]');
        // wait for the page to load otherwise this loop will block the page from loading
        await delay(500);
    }
    chart = chart[0];

    // create a div with text content
    let div = document.createElement("div");
    div.style = "display: flex;width: auto;justify-content: center;";

    const traces = efforts.map((value, i) => {
        return {
            x: Array.from(
                { length: value.endIndex - value.startIndex },
                (v, k) => value.startIndex + k
            ),
            y: Array.from(
                { length: value.endIndex - value.startIndex },
                (v, k) => powerData[value.startIndex + k]
            ),
            type: "scatter",
            mode: "lines",
            name: `Effort ${i + 1}`,
        };
    });
    // display all the power as a 50% opacity line
    traces.push({
        x: powerData.map((_, i) => i),
        y: powerData,
        type: "scatter",
        mode: "lines",
        name: "Power",
        opacity: 0.5,
    });

    // display the best effort as a filled in area
    traces.push({
        x: Array.from(
            { length: bestEffort.endIndex - bestEffort.startIndex },
            (v, k) => bestEffort.startIndex + k
        ),
        y: Array.from(
            { length: bestEffort.endIndex - bestEffort.startIndex },
            (v, k) => powerData[bestEffort.startIndex + k]
        ),
        type: "scatter",
        mode: "lines",
        fill: "tozeroy",
        name: "Best Effort",
    });

    console.log(traces);

    const maxLength = powerData.length;

    // get the extension id from the img tag with the toast-extension attribute
    const extensionId = document
        .querySelector('span[toast-extension="true"]')
        .getAttribute("toast-extension-id");

    // add images for each trace from the toastSrc array
    const layout = {
        title: {
            text: "CanYouToast - Power Analysis",
        },
        autosize: true,
        images: efforts.map((effort) => {
            console.log(toastSrc[effort.bin]);
            return {
                source: `chrome-extension://${extensionId}${
                    toastSrc[effort.bin].src
                }`,
                xref: "paper",
                yref: "paper",
                x: (effort.startIndex + effort.endIndex) / (2 * maxLength),
                y: 0.6,
                sizex: ((effort.endIndex - effort.startIndex) * 3) / maxLength,
                sizey: ((effort.endIndex - effort.startIndex) * 3) / maxLength,
                xanchor: "center",
                yanchor: "middle",
                opacity: 0.5,
            };
        }),
    };

    const config = { responsive: true };
    Plotly.newPlot(div, traces, layout, config);
    chart.insertBefore(div, chart.children[5]);

    // TODO add an event handler which resizes the images when the plotly chart is resized

    // TODO get the toast-badge span and update its img and text to the best effort
    const badge = document.querySelector('span[class = "toast-badge"]');
    console.log(badge)
    const img = badge.querySelector("img");
    const text = badge.querySelector("span");
    img.src = `chrome-extension://${extensionId}${
                    toastSrc[bestEffort.bin].src
                }`;
    img.alt = toastSrc[bestEffort.bin].altText;
    text.textContent = toastSrc[bestEffort.bin].text;


    // observer to force a resize of the plotly chart when the div is added to the page
    const observer = new MutationObserver(() => {
        if (document.contains(div)) {
            Plotly.Plots.resize(div);
        }
    });
    observer.observe(document, {
        attributes: false,
        childList: true,
        characterData: false,
        subtree: true,
    });
}

function checkURL() {
    // if the url is "*/activities" then add an onclick event to the a tag with data-menu="activity"
    if (window.location.href.includes("activities")) {
        // add an onclick event to the a tag with data-menu="activity"
        let activity = document.querySelector('a[data-menu="analysis"]');
        activity.addEventListener("click", runFrontend);
        console.log("CanyoutoastExtension - Added click event to analysis");
    }
    // if the url is "*/activities/*/analysis" then run the run function immediately
    if (
        window.location.href.includes("activities") &&
        window.location.href.includes("analysis")
    ) {
        console.log("CanyoutoastExtension - Running Immediately");
        runFrontend();
    }
}

checkURL();
