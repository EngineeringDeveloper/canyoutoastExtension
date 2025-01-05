/* global Strava, pageView */
console.log("Running Canyoutoast Extension");
// Have Global object Strava

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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

async function getEfforts(params) {
    let powerData;
    try {
        powerData = (await fetchStreams(["watts"]))[0];
    } catch (e) {
        console.error(e);
        updateToastBadge(null);
    }

    if (powerData == undefined) {
        return { bestEffort: null, efforts: [], powerData: [] };
    }

    console.log("CanyoutoastExtension - Power Data", powerData);

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
    if (bestEffort == null) {
        console.log("CanyoutoastExtension - No Toastable Effort Found");
        return { bestEffort: "No Effort", efforts: [], powerData };
    }
    console.log(powerData, bestEffort, efforts);
    return { bestEffort, efforts, powerData };
}

async function plotEfforts(efforts, powerData, bestEffort) {
    if (efforts.length == 0) {
        return;
    }

    let chart = document.querySelectorAll('section[class="chart"]');
    while (chart.length == 0) {
        console.log("CanyoutoastExtension - Waiting for chart to load");
        chart = document.querySelectorAll('section[class="chart"]');
        // wait for the page to load otherwise this loop will block the page from loading
        await delay(500);
    }
    chart = chart[0];

    // create a div with text content
    let graphDiv = document.createElement("div");
    graphDiv.style = "display: flex;width: auto;justify-content: center;";
    
    // display the best effort as a filled in area
    const traces = [{
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
        legendgroup: "Best Effort",
        legendgrouptitle: {text:"Best Effort"},
    },
    // display all the power as a 50% opacity line
    {
        x: powerData.map((_, i) => i),
        y: powerData,
        type: "scatter",
        mode: "lines",
        name: "Power",
        opacity: 0.5,
        legendgroup: "Power",
        // showlegend: false,
        }
    ]
    
    efforts.map((effort, i) => {
        traces.push({
            x: Array.from(
                { length: effort.endIndex - effort.startIndex },
                (v, k) => effort.startIndex + k
            ),
            y: Array.from(
                { length: effort.endIndex - effort.startIndex },
                (v, k) => powerData[effort.startIndex + k]
            ),
            type: "scatter",
            mode: "lines",
            name: `Effort ${i + 1}`,
            legendgroup: `${toastSrc[effort.bin].text}`,
            legendgrouptitle: { text: `${toastSrc[effort.bin].text}` },
            // showlegend: false,
        });
    });

    const maxLength = powerData.length;

    // get the extension id from the img tag with the toast-extension attribute
    const extensionId = await getExtensionId();

    // add images for each trace from the toastSrc array
    const images = []
    const annotations = []
    efforts.map((effort) => {
        const x = (effort.startIndex + effort.endIndex) / 2
        const y = powerData[Math.round(x)]

        const sizeX = (effort.endIndex - effort.startIndex) * 0.8;

        images.push({
            source: `chrome-extension://${extensionId}${
                toastSrc[effort.bin].src
            }`,
            xref: "x",
            yref: "y",
            x: x,
            y: y,
            sizex: sizeX,            
            sizey: 10000,
            sizing: "contain",
            xanchor: "center",
            yanchor: "middle",
            opacity: 0.5,
        });
        annotations.push(
            {
                x: x,
                y: y,
                text: `${toastSrc[effort.bin].text}`,
                showarrow: true,
                xanchor: "left",
                yanchor: "middle",
            }
        )
    })

    const layout = {
        title: {
            text: "CanYouToast - Power Analysis",
        },
        autosize: true,
        images,
        annotations,
    };

    const config = { responsive: true };
    Plotly.newPlot(graphDiv, traces, layout, config);
    chart.insertBefore(graphDiv, chart.children[5]);

    // event listener to to resize and position the the toasts when the graph changes
    // this is because the images are fixed position relative to the page
    graphDiv.on('plotly_relayout',
        function (eventdata) {
            if (eventdata.autosize == true) { 
                return;
            }
            // if the xaxis is autorange then just reset all the annotations
            if (eventdata["xaxis.autorange"] == true) {
                for (let i = 0; i < layout.images.length; i++) {
                    layout.images[i].sizey = 10000;
                    layout.annotations[i].xanchor = "left";
                    layout.annotations[i].showarrow = true;
                }
            } else {
                // show the text in the centre of the image and limit its size if needed 
    
                // handles x axis adjustment only (no y axis range provided)
                if (eventdata["yaxis.range[1]"] == null) {
                    eventdata["yaxis.range[0]"] = layout.yaxis.range[0]
                    eventdata["yaxis.range[1]"] = layout.yaxis.range[1]
                }
                const yAxisWidth = eventdata['yaxis.range[1]'] - eventdata['yaxis.range[0]'];
                // const yCentre = (eventdata['yaxis.range[0]'] + eventdata['yaxis.range[1]']) / 2;
                
                for (let i = 0; i < layout.images.length; i++) {
                    // layout.images[i].y = yCentre; // if the image should be moved to the centre of the axis
                    layout.images[i].sizey = yAxisWidth;
                    layout.annotations[i].xanchor = "center";
                    layout.annotations[i].showarrow = false;
                }
            }

            Plotly.relayout(graphDiv, layout);
            console.log("can you toast - relayout Complete", eventdata, layout);

        });


    // observer to force a resize of the plotly chart when the div is added to the page
    const observer = new MutationObserver(() => {
        if (document.contains(graphDiv)) {
            Plotly.Plots.resize(graphDiv);
        }
    });
    observer.observe(document, {
        attributes: false,
        childList: true,
        characterData: false,
        subtree: true,
    });
}

let extensionId = null;
async function getExtensionId() {
    if (extensionId != null) {
        return extensionId;
    }
    const span = document.querySelector('span[toast-extension="true"]');
    if (span == null) {
        await delay(500);
        return getExtensionId();
    }

    return span.getAttribute("toast-extension-id");
}

function secondsToMMSS(number) {
    const mins = number / 60;
    const seconds = number % 60;

    let str = "";
    if (mins > 0) {
        str += Math.floor(mins).toFixed(0);
        str += "Min";
        if (mins >= 2) {
            str += "s";
        }
        str += " ";
    }
    str += seconds.toFixed(0);
    str += "s";
    return str;
}

let eventSet = false;
// effort type or null if no data available
async function updateToastBadge(bestEffort) {
    const extensionId = await getExtensionId();
    const badges = document.querySelectorAll('span[class = "toast-badge"]');
    for (const badge of badges) {
        if (bestEffort == null) {
            badge.querySelector("span").textContent = "No Power Data Available";
            continue;
        }
        if (bestEffort == "No Effort") {
            badge.querySelector("span").textContent = "Thats just Bread - No Toastable efforts";
            continue;
        }
        const img = badge.querySelector("img[class = 'toast-badge-img']");
        const text = badge.querySelector("span");
        img.src = `chrome-extension://${extensionId}${
            toastSrc[bestEffort.bin].src
        }`;
        img.alt = toastSrc[bestEffort.bin].altText;
        text.textContent = `${
            toastSrc[bestEffort.bin].text
        } - ${bestEffort.power.toFixed(0)}W for ${secondsToMMSS(
            bestEffort.timeS
        )}`;
    }

    // check for existing event listener
    if (!eventSet) {
        // add an event listener to update if a new badge appears
        document.addEventListener("toast-badge-added", async () => {
            updateToastBadge(bestEffort);
        });
        eventSet = true;
    }
}

// Runners

async function runFrontendAnalysis() {
    if (checkForPlotly()) {
        return;
    }

    const { bestEffort, efforts, powerData } = await getEfforts();

    await updateToastBadge(bestEffort);

    // add a custom plotlyjs chart to the page
    await plotEfforts(efforts, powerData, bestEffort);
}

async function runFrontendFrontpage() {
    const { bestEffort, efforts, powerData } = await getEfforts();

    await updateToastBadge(bestEffort);
}

function checkURL() {
    // if the url is "*/activities" then add an onclick event to the a tag with data-menu="activity"
    if (window.location.href.includes("activities")) {
        runFrontendFrontpage();
        
        // add an onclick event to the a tag with data-menu="activity"
        let activity = document.querySelector('a[data-menu="analysis"]');
        activity.addEventListener("click", runFrontendAnalysis);
        console.log("CanyoutoastExtension - Added click event to analysis");

        let overview = document.querySelector('a[data-menu="overview"]');
        activity.addEventListener("click", runFrontendFrontpage);
    }
    // if the url is "*/activities/*/analysis" then run the run function immediately
    if (
        window.location.href.includes("activities") &&
        window.location.href.includes("analysis")
    ) {
        console.log("CanyoutoastExtension - Running Immediately");
        runFrontendAnalysis();
    }
}

checkURL();
