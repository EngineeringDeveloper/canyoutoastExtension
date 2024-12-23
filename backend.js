// "Backend" is injected in the extension enviroment so it has access to the chrome runtime
// the main purpose is to pass the extension Id to the front end

const delay = (ms) => new Promise((res) => setTimeout(res, ms));


async function runBackend() {
    console.log("CanyoutoastExtension - running backend")

    let actions = []

    if (document.querySelector('div.activity-stats') && document.querySelector('div.activity-stats span.toast-badge') == null) { 
        console.log("will add to stats")
        actions.push(document.querySelector("div.activity-stats"))
    }

    // analysis page gets destoryed and recreated when you click on it
    // its also loading slower than this function can run
    await delay(1000)
    if (window.location.href.includes("analysis")) {
        while (document.querySelector("section.chart") == null) {
            console.log("waiting for chart")
            await delay(500);
        }
        console.log("chart found")
        if (document.querySelector('section.chart') && document.querySelector('section.chart span.toast-badge') == null) {
            console.log("will add to chart")
            actions.push(document.querySelector("section.chart"))
        }
    }

    for (let div of actions) {
        // this is the badge definition
        let badge = document.createElement("span");

        badge.setAttribute("toast-extension", "true");
        badge.setAttribute("toast-extension-id", chrome.runtime.id);
        badge.className = "toast-badge"
    
        badge.style.display = "grid"
        badge.style.gridTemplateColumns = "7.5% 40% 5% 40% 7.5%"
        badge.style.alignItems = "center"
        badge.style.justifyContent = "center"
        badge.style.justifyItems = "center"
    
        let title = document.createElement("div");
        title.textContent = "Can you Toast?";
        title.style.gridArea = "1 / span 5"
        title.style.textAlign = "center"
        badge.appendChild(title)
        
        let img = document.createElement("img");
        img.src = chrome.runtime.getURL("/images/toast/0.png");
        img.style.width = "50px"
        img.className = "toast-badge-img"
        img.style.gridColumn = 2
        img.style.gridRow = 2
        badge.appendChild(img)
    
        // badge.appendChild(document.createElement('<div style="width:10%"/>'))
    
        let text = document.createElement("span");
        text.textContent = "Toast Extension - data here";
        // use this to change the text on the front end
        text.className = "toast-badge-text"
        text.style.gridColumn = 4
        text.style.gridRow = 2
        badge.appendChild(text);

        console.log("appending badge", div)
        // differerent append depending on the div
        if (div.className == "activity-stats") {
            div.appendChild(badge);
        }
        else {
            div.insertBefore(badge, div.children[5])
        }
    }    
    
}

function setup() {
    // rerun the backend when the user clicks on the analysis tab
    let activity = document.querySelector('a[data-menu="analysis"]');
    activity.addEventListener("click", runBackend);
    let overview = document.querySelector('a[data-menu="overview"]');
    overview.addEventListener("click", runBackend);
    // always run the backend
    runBackend();
}

setup();
