// "Backend" is injected in the extension enviroment so it has access to the chrome runtime
// the main purpose is to pass the extension Id to the front end

function runBackend() {
    console.log("CAn you toast Extsnsion - running backend")
    // TODO style this better so that it looks seemless with the graph
    // Can be a generic toast element that works on both the activities and the activities/*/analysis page
    // on 
    
    let chart = document.querySelector('section[class="chart"]')
    let stats = document.getElementsByClassName("activity-stats")[0]
    let badge = document.createElement("span");

    let div
    if (chart != null) {
        div = chart
        div.insertBefore(badge, chart.children[5]) 
    }
    else if (stats != null) {
        div = stats
        div.appendChild(badge);
    }
    else {
        console.log("can you toast extension backend - nothing to attach to")
        return
    }

    badge.setAttribute("toast-extension", "true");
    badge.setAttribute("toast-extension-id", chrome.runtime.id);
    badge.style.display = "flex"
    badge.style.flexDirection = "row"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "center"
    badge.className = "toast-badge" 
    
    let img = document.createElement("img");
    img.src = chrome.runtime.getURL("/images/toast/0.png");
    img.style.width = "50px"
    img.className = "toast-badge-img"
    badge.appendChild(img)

    let text = document.createElement("span");
    text.textContent = "Toast Extension - data here";
    // use this to change the text on the front end
    text.className = "toast-badge-text"
    badge.appendChild(text);
}

function setup() {
    // rerun the backend when the user clicks on the analysis tab
    let activity = document.querySelector('a[data-menu="analysis"]');
    activity.addEventListener("click", runBackend);
    // always run the backend
    runBackend();
}

setup();
