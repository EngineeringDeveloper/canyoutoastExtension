const toastSrc = [
    { text: 'Thats just Bread', altText: 'Thats just Bread', src: '/images/toast/0.png', idx: 0 }, // 0 Bread
    { text: "I guess it's warm?", altText: 'Warmed Bread', src: '/images/toast/1.png', idx: 1 },
    {
        text: 'If you look closely',
        altText: 'Slightly cooked if you look closely',
        src: '/images/toast/2.png',
        idx: 2
    },
    { text: 'Just about!', altText: 'Just about toast', src: '/images/toast/3.png', idx: 3 }, // 3
    {
        text: 'Keep Trying',
        altText: 'almost toast keep trying',
        src: '/images/toast/4.png',
        idx: 4
    },
    { text: 'Not quite there', altText: 'Almost Done Toast', src: '/images/toast/5.png', idx: 5 },
    { text: 'Now thats Toast', altText: 'Builders Brew Toast', src: '/images/toast/6.png', idx: 6 }, // 6
    {
        text: 'A little over done',
        altText: 'a litte overdone Toast',
        src: '/images/toast/7.png',
        idx: 7
    },
    { text: "That'll do", altText: 'overdone Toast', src: '/images/toast/8.png', idx: 8 },
    { text: 'Half way to dust', altText: 'half burnt', src: '/images/toast/9.png', idx: 9 },
    { text: 'Maybe edible', altText: 'almost burnt', src: '/images/toast/10.png', idx: 10 }, // 10
    { text: 'On Fire!', altText: 'Toast on Fire', src: '/images/toast/11.png', idx: 11 } // Burnt
];

let div = document.getElementsByClassName("chart")[0]

// TODO add a header image to the page as a title
// this image can have a data tag with the runtime Id, then we can use that to get the image

let img = document.createElement("img")
img.src = chrome.runtime.getURL(toastSrc[0].src)
div.appendChild(img)
img.alt = chrome.runtime.id

console.log(div)
console.log(Plotly)

