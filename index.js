var routes;
var inactiveRoutes = [];
var stops;
var buses;
var alerts;

var excludeList = ['Blue Event Detour', 'Orange Event Detour', 'Red Event Detour']
var excludeMyIDs = ['36235', '42408', '42980', '43015', '45753', '43017']
var routeItem = "popupItem route";
var busItem = "popupItem bus"
var stopItem = "popupItem stop"
var alertItem = "popupItem alert"

var routesReal = {};
var stopsReal = {};
var busesReal = {};
var alertsReal = [];

var routesLoaded = false;
var stopsLoaded = false;
var busesLoaded = false;
var alertsLoaded = false;

var selectedRoutes = {};
var currentRoutes = [];
var stopsOrdered = [];
var hasBuses = [];
map.on('load', initialise.bind(this));

var stopsHashMap = {};
var errorMessage = "PassioGO! is being slow :)\nIt's still loading.";

function stillLoading() { alert(this.errorMessage) };

var deviceId = (Math.floor(Math.random() * (10 ** 8))).toString()

function failure() {
    $("#status").show();
    this.errorMessage = 'Passio servers dead, ggwp :(';
    document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>We Don't Know Why</h3></br>But basically their service is down.</div>`;
}

async function initialise() {
    this.renderAllStops = this.renderAllStops.bind(this);

    document.getElementById('busSearch').addEventListener('input', function(event) { filterBuses(event.data) });
    document.getElementById('stopSearch').addEventListener('input', function(event) { filterStops(event.data) });
    $.ajaxSetup({
        type: 'POST',
        timeout: 30000,
        error: function(xhr) {
            this.errorMessage = ("Timed Out. Passio dead :(");
        }
    })
    let tempScope = this;
    document.getElementById('routesButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('stopsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('alertsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('busesButton').addEventListener('click', stillLoading.bind(tempScope));

    await $.post("https://passio3.com/www/mapGetData.php?getRoutes=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"systemSelected0":"2343","amount":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone")
            }
            setRoutes(JSON.parse(data));
            loadRoutes();
        }.bind(this)).fail(failure.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getStops=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone");
            }
            setStops(JSON.parse(data));
            loadStops();
        }.bind(this)).fail(failure.bind(this));
    await $.post("https://passio3.com/www/goServices.php?getAlertMessages=1&deviceId=" + deviceId, { json: '{"systemSelected0":"2343", "amount":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone");
            }
            setAlerts(JSON.parse(data));
            loadAlerts();
        }.bind(this)).fail(failure.bind(this));
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone");
            }
            setBusesFirst.call(this, JSON.parse(data));
        }.bind(this)).fail(failure.bind(this));

    document.getElementById('routesButton').replaceWith(document.getElementById('routesButton').cloneNode(true));
    document.getElementById('stopsButton').replaceWith(document.getElementById('stopsButton').cloneNode(true));
    document.getElementById('busesButton').replaceWith(document.getElementById('busesButton').cloneNode(true));
    document.getElementById('alertsButton').replaceWith(document.getElementById('alertsButton').cloneNode(true));
    document.getElementById('routesButton').addEventListener('click', openRoutes.bind(this));
    document.getElementById('stopsButton').addEventListener('click', openStops.bind(this));
    document.getElementById('alertsButton').addEventListener('click', openAlerts.bind(this));
    document.getElementById('busesButton').addEventListener('click', openBuses.bind(this));

    var userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('Android')) {
        $("#stylesheet").attr("href", "styleMobile.css");
        console.info("mobile");
    } else {
        console.info("pc");
    }
    map.on('zoomend', fixSizes.bind(this));
    $("#status").hide();

    console.log("Initial map center:", map.getCenter(), "zoom:", map.getZoom());
    map.on('style.load', () => {
        console.log("Map style fully loaded");
        if (this.stopsLoaded) {
            console.log("Calling renderAllStops");
            renderAllStops.call(this);
        } else {
            console.log("Stops not loaded yet");
        }
    });
    console.log("Mapbox GL JS version:", mapboxgl.version);
    if (map.loaded()) {
        console.log("Map already loaded, calling renderAllStops immediately");
        this.renderAllStops();
    }

    map.on('load', () => {
        console.log("Map 'load' event fired");
        console.log("stopsLoaded value:", this.stopsLoaded);
        if (this.stopsLoaded) {
            console.log("Calling renderAllStops");
            this.renderAllStops();
        } else {
            console.log("Stops not loaded yet");
        }
    });

    if (map.loaded()) {
        console.log("Map loaded, calling renderAllStops from loadStops");
        setTimeout(() => {
            this.renderAllStops();
        }, 100);
    }

    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
    });
}

function setStops(what) {
    this.stops = what;
}

function setRoutes(what) {
    this.routes = what;
}

function setAlerts(what) {
    this.alerts = what;
}

function setBuses(what) {
    this.trueSetBuses.call(this, what);
}

function trueSetBuses(what) {
    this.buses = what;
    var busesExclusively = this.buses['buses'];
    var busIds = Object.keys(busesExclusively);
    for (var routs of Object.keys(this.routesReal)) {
        this.routesReal[routs].active = false;
    }
    var news = busIds.filter((word) => !(Object.keys(this.busesReal).includes(busesExclusively[word][0]['busName'])));
    var existing = busIds.filter((word) => (Object.keys(this.busesReal).includes(busesExclusively[word][0]['busName'])));

    for (var busId of existing) {
        let currentBus = busesExclusively[busId][0];
        this.busesReal[currentBus['busName']].num = currentBus['busName'];
        this.busesReal[currentBus['busName']].route = currentBus['route'];
        this.busesReal[currentBus['busName']].routeId = currentBus['routeId'];
        this.busesReal[currentBus['busName']].active = !Boolean(currentBus['outOfService']);
        this.busesReal[currentBus['busName']].fullness = parseInt(currentBus['paxLoad'] * 100 / currentBus['totalCap']);
        this.busesReal[currentBus['busName']].id = currentBus['busId'];
        var temp1 = [parseFloat(currentBus['longitude']), parseFloat(currentBus['latitude'])];
        var temp2 = this.busesReal[currentBus['busName']].position;
        var temp3 = turf.lineString([temp1, temp2])
        console.log(turf.length(temp3, { units: 'kilometers' }).toFixed(1) + "km distance between old and new")
        var leng = (turf.length(temp3, { units: 'kilometers' }) * 1000) / 10;
        this.busesReal[currentBus['busName']].speed = leng;
        this.busesReal[currentBus['busName']].position = [parseFloat(currentBus['longitude']), parseFloat(currentBus['latitude'])];
        this.busesReal[currentBus['busName']].bearing = currentBus['calculatedCourse'];
    }
    for (var busId of news) {
        let currentBus = busesExclusively[busId][0];
        this.busesReal[currentBus['busName']] = {
            num: currentBus['busName'],
            route: currentBus['route'],
            routeId: currentBus['routeId'],
            active: !Boolean(currentBus['outOfService']),
            fullness: parseInt(currentBus['paxLoad'] / currentBus['totalCap']),
            id: currentBus['busId'],
            position: [parseFloat(currentBus['longitude']), parseFloat(currentBus['latitude'])],
            bearing: currentBus['calculatedCourse'],
            speed: 0,
            ttn: 0
        }
    }
}

function showBusOnMap(which) {
    $("#stopsList").hide();
    $("#routesList").hide();
    $("#busesList").hide();
    map.setCenter(this.busesReal[which].position);
    map.setZoom(16);
}

async function setBusesFirst(what) {
    this.renderAllStops = this.renderAllStops.bind(this);

    this.trueSetBuses.call(this, what);
    this.bussyDeletion.call(this);
    for (var rout of Object.keys(this.routesReal).toSorted()) {
        this.routesReal[rout].active = (this.routesReal[rout].buses.length > 0);
    }
    if (!stopsHaveBuses) {
        for (var key of Object.keys(this.stopsReal)) {
            for (var route of this.stopsReal[key].routes) {
                this.stopsReal[key].buses = this.stopsReal[key].buses.concat(this.routesReal[route].buses)
            }
        }
        this.stopsOrdered = Object.keys(this.stopsReal);
        this.stopsOrdered.sort();

        if (map.loaded()) {
            for (var stoppe of this.stopsOrdered) {
                this.renderCircle.call(this, this.stopsReal[stoppe].routes, stoppe);
            }
            checkStopMarkersInView();
        } else {
            map.on('load', () => {
                console.log("Map 'load' event fired");
                for (var stoppe of this.stopsOrdered) {
                    this.renderCircle.call(this, this.stopsReal[stoppe].routes, stoppe);
                }
                checkStopMarkersInView();
            });
        }

        stopsHaveBuses = true;
    }

    var current = $("#busesList").find('[class="popupList withSearch"]')[0];
    for (let rout of Object.keys(this.routesReal).toSorted()) {
        if (this.routesReal[rout].active) {
            this.routesReal[rout].buses.sort();
            for (let x = 0; x < this.routesReal[rout].buses.length; x++) {
                if (this.busesReal[this.routesReal[rout].buses[x]].active) {
                    current.append(document.createElement('div'))
                    current.lastChild.className = this.busItem;
                    current.lastChild.id = this.routesReal[rout].buses[x];
                    current.lastChild.innerHTML = this.routesReal[rout].buses[x] + " | " + this.busesReal[this.routesReal[rout].buses[x]].route
                    let bruh = (this.routesReal[rout].buses[x]);
                    current.lastChild.addEventListener('click', function() { showBusOnMap(bruh) }.bind(this));
                }
            }
        }
    }
    stopsOrdered = Object.keys(stopsReal);
    stopsOrdered.sort();
    var current = $("#stopsList").find('[class="popupList withSearch"]')[0];
    keys = this.stopsOrdered;
    var inactiveNames = [];
    for (var inactive of inactiveRoutes) {
        inactiveNames.push(inactive.nameOrig);
    }
    for (let i = 0; i < keys.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = stopItem;
        let servicedByRoute = "";
        for (var route of this.stopsReal[keys[i]].routes) {
            if (this.routesReal[route].active) {
                servicedByRoute += "| " + route + " |";
            }
        }
        current.lastChild.innerHTML = keys[i] + "</br><p style='font-size: 1.5vh; font-weight: normal;'>" + servicedByRoute + "</p>";
        $(current.lastChild).on('click', function() { showStopOnMap(`${keys[i]}`) })
    }
    $(document.getElementById('routesList')).find('[class="popupList"]')[0].innerHTML = "";
    var current = $(document.getElementById('routesList')).find('[class="popupList"]')[0];
    for (var rout of Object.keys(this.routesReal).toSorted()) {
        if (this.routesReal[rout].active) {
            current.append(document.createElement("div"));
            current.lastChild.className = routeItem;
            current.lastChild.id = this.routesReal[rout].full;
            current.lastChild.innerHTML = this.routesReal[rout].full + " | " + this.routesReal[rout].short.toUpperCase();
            current.lastChild.append(document.createElement('div'));
            current.lastChild.lastChild.className = 'routeSelector';
            let nam = this.routesReal[rout].full;
            current.lastChild.style.borderColor = this.routesReal[rout].color;
            let hihi = current.lastChild.lastChild;
            let hi = current.lastChild;
            hihi.addEventListener('click', function(e) { selectRoute(nam) }.bind(this));
            hi.addEventListener("click", function(e) { if (hi === e.target) { showRoute(nam) } }.bind(this));
            this.renderRoute(this.routesReal[rout].full);
        }
    }
    current.append(document.createElement("div"));
    current.lastChild.className = "popupItem bus";
    current.lastChild.innerText = "-- Inactive Routes --"
    for (var rout of Object.keys(this.routesReal).toSorted()) {
        if (!this.routesReal[rout].active) {
            current.append(document.createElement("div"));
            current.lastChild.className = routeItem;
            current.lastChild.id = this.routesReal[rout].full;
            current.lastChild.innerHTML = this.routesReal[rout].full + " | " + this.routesReal[rout].short.toUpperCase();
            current.lastChild.append(document.createElement('div'));
            current.lastChild.lastChild.className = 'routeSelector';
            let nam = this.routesReal[rout].full;
            current.lastChild.style.borderColor = this.routesReal[rout].color;
            let hihi = current.lastChild.lastChild;
            let hi = current.lastChild;
            hihi.addEventListener('click', function(e) { selectRoute(nam) }.bind(this));
            hi.addEventListener("click", function(e) { if (hi === e.target) { showRoute(nam) } }.bind(this));
            this.renderRoute(this.routesReal[rout].full)
        }
    }
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone");
            }
            this.setBuses.call(this, JSON.parse(data));
            updateBuses.call(this);
        }.bind(this)).fail(failure.bind(this));
    setInterval(async function() {
        await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
            function(data) {
                if (Object.keys(JSON.parse(data)).length === 1) {
                    this.errorMessage = "Passio servers dead, ggwp :(";
                    document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                    throw new Error("Passio Gone");
                }
                this.setBuses.call(this, JSON.parse(data));
                updateBuses.call(this);
            }.bind(this)).fail(failure.bind(this));
    }, 10000);
    //setInterval.call(this, cleanup.bind(this), 10000);
    updateBusVisibility();
}

function cleanup() {
    for (var bussy of Object.keys(busesReal)) {
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }
        var shortest = 1000;
        var indi = 0;
        for (var i = 0; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
            if (turf.distance(turf.point(this.busesReal[bussy].position), turf.point([parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])])) < shortest) {
                shortest = turf.distance(turf.point(this.busesReal[bussy].position), turf.point([parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])]));
                indi = i;
            }
        }
        this.busesReal[bussy].pointOnPath = indi;
        for (var x = indi; x < this.routesReal[this.busesReal[bussy].route].coords.length; x++) {
            if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(x)) {
                this.busesReal[bussy].nextStop = [x.toString, this.routesReal[this.busesReal[bussy].route].stopIndices[x]];
                break;
            }
        }
    }
}


function bussyDeletion() {
    var toDelete = [];
    for (let busReal of Object.keys(this.busesReal)) {
        let flag = true;
        if (Object.keys(this.routesReal).includes(this.busesReal[busReal].route)) {
            this.routesReal[this.busesReal[busReal].route].buses.push(busReal);
            this.routesReal[this.busesReal[busReal].route]['active'] = true;
            this.hasBuses.push(this.busesReal[busReal].route);
            this.busesReal[busReal].pointOnPath = 0;
            this.busesReal[busReal].nextStop = [Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).length - 1], this.routesReal[this.busesReal[busReal].route].stopIndices[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).length - 1]]];
            flag = false;
            var shortestDist = 1000;
            var shortInd = 0;
            for (var i = 0; i < this.routesReal[this.busesReal[busReal].route].coords.length; i++) {
                if (turf.distance(turf.point(this.busesReal[busReal].position), turf.point([parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][0])])) < shortestDist) {
                    shortestDist = turf.distance(turf.point(this.busesReal[busReal].position), turf.point([parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][0])]));
                    shortInd = i;
                }
            }
            this.busesReal[busReal].pointOnPath = shortInd;
            for (var x = this.busesReal[busReal].pointOnPath; x < this.routesReal[this.busesReal[busReal].route].coords.length; x++) {
                if (Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).includes(x)) {
                    this.busesReal[busReal].nextStop = [x.toString, this.routesReal[this.busesReal[busReal].route].stopIndices[x]];
                    break;
                }
            }
        }
        if (flag) {
            toDelete.push(busReal);
        }
    }
}



function openStops() {
    closeAll();
    $("#stopsList").show();
}

function openRoutes() {
    closeAll();
    $("#routesList").show();
}

function openBuses() {
    closeAll();
    $("#busesList").show();
}

function openAlerts() {
    closeAll();
    $('#alertsList').show();
}

function closeAll() {
    $(".popup").hide();
}

var busMarkers = {};

var stopsHaveBuses = false;

function updateBuses() {
    for (var rout of Object.keys(this.routesReal)) {
        this.routesReal[rout].buses = [];
    }
    for (var bussy of Object.keys(busesReal)) {
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }
        var shortest = 1000;
        var indi = 0;
        var final = (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).length - 1])
        if (busesReal[bussy].pointOnPath < final) {
            for (var i = busesReal[bussy].pointOnPath; i < final; i++) {
                if (turf.distance(turf.point(this.busesReal[bussy].position), turf.point(this.routesReal[this.busesReal[bussy].route].coords[i])) < shortest) {
                    shortest = turf.distance(turf.point(this.busesReal[bussy].position), turf.point(this.routesReal[this.busesReal[bussy].route].coords[i]));
                    indi = i;
                }
            }
            this.busesReal[bussy].pointOnPath = indi;
            if (indi < final) {
                for (var i = this.busesReal[bussy].pointOnPath; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
                    if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(i.toString())) {
                        this.busesReal[bussy].nextStop = [i, this.routesReal[this.busesReal[bussy].route].stopIndices[i]]
                        break;
                    }
                }
            }
        } else {
            for (var i = 0; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
                if (turf.distance(turf.point(this.busesReal[bussy].position), turf.point([parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])])) < shortest) {
                    shortest = turf.distance(turf.point(this.busesReal[bussy].position), turf.point([parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]), parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])]));
                    indi = i;
                }
            }
            for (var x = this.busesReal[bussy].pointOnPath; x < this.routesReal[this.busesReal[bussy].route].coords.length; x++) {
                if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(x)) {
                    this.busesReal[bussy].nextStop = [x.toString, this.routesReal[this.busesReal[bussy].route].stopIndices[x]];
                    break;
                }
            }
        }
    }

    for (let bus of Object.keys(this.busesReal).toSorted()) {
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }
        if (this.busesReal[bus].active && Object.keys(this.routesReal).includes(busesReal[bus].route)) {
            this.routesReal[this.busesReal[bus].route].buses.push(bus);
            if (document.getElementById("bus" + bus) === null) {
                let div = document.createElement('div');
                div.id = "bus" + bus;
                div.className = 'busMarker';
                let inner = "";
                inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" stroke="#FFFFFF" fill="${this.routesReal[this.busesReal[bus].route].color}" stroke-width="1em">\n`
                inner += "<path d='" + arc({ x: 0, y: 0, r: 45 }) + "'></path>\n";
                inner += '</svg>\n';
                inner += `<img style="transform: rotate(${this.busesReal[bus].bearing}deg);" src="assets/busPointer.svg?sanitize=true" height='20px' width='20px'>`
                div.innerHTML = inner;
                div.appendChild(document.createElement('div'))
                div.lastChild.className = 'busDetail';
                div.lastChild.innerHTML = `<h4>${bus}: ${this.busesReal[bus].route}</h4><ul><li>Next Stop: ${this.busesReal[bus].nextStop[1]}</li><li>Occupancy: ${this.busesReal[bus].fullness}%</li></ul>`
                div.addEventListener('click', function(e) {; if (e.target === div || Array.from(div.childNodes).includes(e.target)) { showBusDetails(bus) } }.bind(this));
                busMarkers[bus] = [new mapboxgl.Marker(div), []];
                busMarkers[bus][0].setLngLat(this.busesReal[bus].position)
                busMarkers[bus][0].addTo(map);
                div.lastChild.style.display = "none";
                div.lastChild.appendChild(document.createElement('div'));
                div.lastChild.lastChild.className = 'x';
                div.lastChild.lastChild.innerHTML = "<img src='assets/x.svg' class='SVGicon'></img>"
                let bruh = div.lastChild.lastChild;
                div.lastChild.lastChild.addEventListener('click', function(e) { if (e.target === bruh || Array.from(bruh.childNodes).includes(e.target)) { div.lastChild.style.display = 'none'; } }.bind(this));
            } else {
                this.busMarkers[bus][1] = generateMovement([this.busMarkers[bus][0].getLngLat().lng, this.busMarkers[bus][0].getLngLat().lat], this.busesReal[bus].position);
                $($(this.busMarkers[bus][0].getElement().lastChild).find("ul")).find('li')[0].innerText = `Next Stop: ${this.busesReal[bus].nextStop[1]}`;
                $($(this.busMarkers[bus][0].getElement().lastChild).find("ul")).find('li')[1].innerText = `Occupancy: ${this.busesReal[bus].fullness}%`;
            }
            this.frame = 0;
            schmooveBus(bus, busMarkers[bus][1]);
            document.getElementById("bus" + bus).childNodes[2].setAttribute('style', `padding: ${0.2 * (zoomb * busRatio)}px; transform: rotate(${this.busesReal[bus].bearing}deg);`);
        }
    }
    for (var bus of Object.keys(this.busesReal)) {
        var key = this.busesReal[bus].route;

        if (!Object.keys(this.routesReal).includes(key)) {
            continue
        }

        if (document.getElementById('stopContainer').style.display !== "none") {
            this.showStopDetails(document.getElementById('stopContainer').firstElementChild.innerText)
        }
        console.log(this.busesReal[bus].route)
        this.busesReal[bus].ttn = getETA(this.busesReal[bus].route, this.busesReal[bus].speed, this.busesReal[bus].pointOnPath, this.busesReal[bus].nextStop[0], bus)
    }
}

async function schmooveBus(bus, frames) {
    for (let frame of frames) {
        this.busMarkers[bus][0].setLngLat(frame);
        await sleep(16);
    }
}

function showBusDetails(which) {
    busMarkers[which][0].getElement().lastChild.style.display = "inline-block";
}

function loadRoutes() {
    let current = $("#routesList").find('[class="popupList"]')[0];
    var temp = [];
    this.routes.sort(function(a, b) {
        return a['nameOrig'].localeCompare(b['nameOrig']);
    });
    for (var i = 0; i < this.routes.length; i++) {
        if (!(excludeMyIDs.includes(this.routes[i].myid))) {
            if (Object.keys(this.routes[i]).includes("serviceTime")) {
                this.inactiveRoutes.push(this.routes[i]);
            } else {
                temp.push(this.routes[i]);
            }
        }
    }
    this.routes = temp;
    for (let i = 0; i < this.routes.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.routes[i].nameOrig;
        try {
            current.lastChild.innerHTML = this.routes[i].nameOrig + " | " + this.routes[i].shortName.toUpperCase();
        } catch (e) {
            if (e instanceof TypeError) {
                current.lastChild.innerHTML = this.routes[i].nameOrig + " | Special Route";
            }
        }
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.routes[i].nameOrig;
        current.lastChild.style.borderColor = this.routes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function(e) { selectRoute(nam) }.bind(this));
        hi.addEventListener("click", function(e) { if (hi === e.target) { showRoute(this.routes[i].nameOrig) } }.bind(this));
        this.routesReal[this.routes[i].nameOrig] = {
            id: this.routes[i].myid.toString(),
            short: this.routes[i].shortName,
            full: this.routes[i].nameOrig,
            path: [],
            buses: [],
            coords: [],
            centre: [parseFloat(this.routes[i].longitude), parseFloat(this.routes[i].latitude)],
            zoom: this.routes[i].distance,
            active: true,
            color: this.routes[i].color
        };
        if (this.routesReal[this.routes[i].nameOrig].short === null) {
            this.routesReal[this.routes[i].nameOrig].short = "SP Route";
        }
    }
    for (let i = 0; i < this.inactiveRoutes.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.inactiveRoutes[i].nameOrig;
        current.lastChild.innerHTML = this.inactiveRoutes[i].nameOrig + " | " + this.inactiveRoutes[i].shortName.toUpperCase();
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.inactiveRoutes[i].nameOrig;
        current.lastChild.style.borderColor = this.inactiveRoutes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function(e) { selectRoute(nam) }.bind(this));
        hi.addEventListener("click", function(e) { if (hi === e.target) { showRoute(this.inactiveRoutes[i].nameOrig) } }.bind(this));
        this.routesReal[this.inactiveRoutes[i].nameOrig] = {
            id: this.inactiveRoutes[i].myid.toString(),
            short: this.inactiveRoutes[i].shortName,
            full: this.inactiveRoutes[i].nameOrig,
            path: [],
            buses: [],
            coords: [],
            centre: [parseFloat(this.inactiveRoutes[i].longitude), parseFloat(this.inactiveRoutes[i].latitude)],
            zoom: this.inactiveRoutes[i].distance,
            active: false,
            color: this.inactiveRoutes[i].color
        };
        if (this.routesReal[this.inactiveRoutes[i].nameOrig].short === null) {
            this.routesReal[this.inactiveRoutes[i].nameOrig].short = "SP Route";
        }
    };
    for (var el of document.getElementsByClassName('route')) {
        el.onclick = function() {
            $(el.lastChild).show();
        }
    }
    this.routesLoaded = true;
}

function loadStops() {
    console.log("Starting loadStops function");
    console.log("Initial stopsReal:", this.stopsReal);

    this.stopsReal = {};
    this.stopsOrdered = [];
    this.stopsHashMap = {};

    if (!this.stops || !this.stops['routes'] || !this.stops['stops']) {
        console.error("Invalid stops data:", this.stops);
        return;
    }

    var routeKeys = Object.keys(this.stops['routes']);
    for (var i = 0; i < routeKeys.length; i++) {
        var routeName = this.stops['routes'][routeKeys[i]][0];
        if (this.routesReal && this.routesReal[routeName]) {
            this.routesReal[routeName].path = this.stops['routes'][routeKeys[i]].slice(2);
        } else {
            console.warn("Route not found in routesReal:", routeName);
            console.log("Available routes in routesReal:", Object.keys(this.routesReal));
        }
    }

    var stopKeys = Object.keys(this.stops['stops']);
    console.log("Number of stops in this.stops['stops']:", stopKeys.length);

    for (var key of stopKeys) {
        var stopData = this.stops['stops'][key];
        var stopName = stopData['name'];

        this.stopsReal[stopName] = {
            id: stopData['id'],
            lat: parseFloat(stopData['latitude']),
            long: parseFloat(stopData['longitude']),
            routes: [],
            buses: [],
            full: stopName,
            iAmThisPoint: {}
        };

        this.stopsHashMap[stopData['id']] = stopName;
        this.stopsOrdered.push(stopName);
    }

    console.log("Populating stop routes...");
    for (var routeName of Object.keys(this.routesReal)) {
        if (!this.routesReal[routeName].path) {
            console.warn("No path for route:", routeName);
            continue;
        }
        for (var i = 0; i < this.routesReal[routeName].path.length; i++) {
            var stopId = this.routesReal[routeName].path[i][1];
            var stopName = this.stopsHashMap[stopId];
            if (this.stopsReal[stopName]) {
                this.stopsReal[stopName].routes.push(routeName);
            } else {
                console.warn("Stop not found:", stopName);
            }
        }
    }

    console.log("Processing route points...");
    for (var routeName of Object.keys(this.routesReal)) {
        var routeId = this.routesReal[routeName].id;
        if (this.stops.routePoints && this.stops.routePoints[routeId]) {
            this.routesReal[routeName].coords = this.stops.routePoints[routeId].map(point => [point.lng, point.lat]);
        } else {
            console.warn("No route points for route:", routeName);
        }
        this.routesReal[routeName].stopIndices = {};
        this.renderRoute(routeName);
    }

    console.log("Calculating stop indices...");
    for (var routeName of Object.keys(this.routesReal)) {
        for (var stopData of this.routesReal[routeName].path) {
            var stopName = this.stopsHashMap[stopData[1]];
            if (!stopName || !this.stopsReal[stopName]) {
                console.warn("Invalid stop:", stopData[1]);
                continue;
            }

            var stopPoint = turf.point([this.stopsReal[stopName].long, this.stopsReal[stopName].lat]);
            var closestIndex = 0;
            var shortestDistance = Infinity;

            for (var i = 0; i < this.routesReal[routeName].coords.length; i++) {
                var routePoint = turf.point(this.routesReal[routeName].coords[i]);
                var distance = turf.distance(stopPoint, routePoint, { units: "kilometers" });
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestIndex = i;
                }
            }

            if (Object.keys(this.stopsReal[stopName].iAmThisPoint).includes(routeName)) {
                this.stopsReal[stopName].iAmThisPoint[routeName + " again"] = closestIndex;
            } else {
                this.stopsReal[stopName].iAmThisPoint[routeName] = closestIndex;
            }

            this.routesReal[routeName].stopIndices[closestIndex] = stopName;
        }
    }

    console.log("Filtering stops...");
    for (var stopName of Object.keys(this.stopsReal)) {
        let stop = this.stopsReal[stopName];
        console.log("Checking stop:", stopName, "Coordinates:", stop.long, stop.lat);
        if (stop.long < -82.6 || stop.long > -82.2 || stop.lat > 28.1 || stop.lat < 27.8) {
            delete this.stopsReal[stopName];
            console.log("Removed stop outside bounds:", stopName);
        } else {
            console.log("Kept stop:", stopName);
        }
    }

    this.stopsOrdered = Object.keys(this.stopsReal).sort();

    console.log("Number of stops loaded:", this.stopsOrdered.length);
    console.log("stopsOrdered:", this.stopsOrdered);
    console.log("Sample stop data:", this.stopsReal[this.stopsOrdered[0]]);

    console.log("Final stopsReal:", this.stopsReal);
    console.log("Final stopsOrdered:", this.stopsOrdered);

    this.stopsLoaded = true;
    console.log("loadStops function completed, stopsLoaded set to true");

    if (map.loaded()) {
        console.log("Map loaded, calling renderAllStops from loadStops");
        setTimeout(() => {
            this.renderAllStops();
        }, 100);
    }
}

function renderAllStops() {
    console.log("renderAllStops function called");
    console.log("this object:", this);
    console.log("stopsOrdered:", this.stopsOrdered);
    console.log("stopsReal:", this.stopsReal);

    if (!this.stopsOrdered || this.stopsOrdered.length === 0) {
        console.error("No stops to render");
        return;
    }

    for (var stoppe of this.stopsOrdered) {
        console.log("Attempting to render stop:", stoppe);
        console.log("Stop data:", this.stopsReal[stoppe]);
        if (this.stopsReal[stoppe] && this.stopsReal[stoppe].routes) {
            console.log("Rendering circle for stop:", stoppe);
            this.renderCircle(this.stopsReal[stoppe].routes, stoppe);
        } else {
            console.error("Invalid stop data for:", stoppe);
        }
    }

    console.log("Finished renderAllStops function");
    this.checkStopMarkersInView();
}

function loadAlerts() {
    for (var msg of this.alerts.msgs) {
        this.alertsReal.push({
            id: msg.id,
            heading: msg.name,
            message: msg.html,
            time: msg.createdF
        });
    }
    var current = $("#alertsList").find('[class="popupList"]')[0];
    for (var alert of this.alertsReal) {
        current.append(document.createElement('div'));
        current.lastChild.className = alertItem;
        current.lastChild.innerHTML = alert.heading + " | <span style='font-size: 1.5vh;'>" + alert.time + "</span></br><p style='font-size: 1.5vh';>" + alert.message + "</p>";
    }
}

function showRoute(which) {
    let toEdit = document.getElementById(which).lastChild;
    $(toEdit).slideToggle();
}

function selectRoute(which) {
    console.log("Selecting route:", which);
    var routeElement = document.getElementById(which);
    if (!routeElement) {
        console.error("Route element not found:", which);
        return;
    }
    var box = $(routeElement).find('[class="routeSelector"]')[0];
    if (!box) {
        console.error("Route selector not found for:", which);
        return;
    }
    if (Object.keys(selectedRoutes).includes(which)) {
        delete selectedRoutes[which];
        box.style.backgroundColor = "";
    } else {
        selectedRoutes[which] = this.routesReal[which];
        box.style.backgroundColor = box.parentNode.style.borderColor;
    }
    displayRoutes();
    updateBusVisibility();
}

function displayRoutes() {

    for (var key of this.currentRoutes) {
        if (map.getLayer(key)) {
            map.removeLayer(key);
        }
        if (map.getLayer(key + "bg")) {
            map.removeLayer(key + "bg");
        }
        if (map.getSource(key)) {
            map.removeSource(key);
        }
    }

    this.currentRoutes = Object.keys(this.selectedRoutes);

    for (var toShow of this.currentRoutes) {
        if (!map.getSource(toShow)) {
            try {
                map.addSource(toShow, {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': this.selectedRoutes[toShow].coords
                        }
                    }
                });
            } catch (error) {
                console.error("Error adding source for route:", toShow, error);
                continue;
            }
        }

        var color = this.selectedRoutes[toShow].color;
        var lightColor = lighten(color);

        map.addLayer({
            'id': toShow + "bg",
            'type': 'line',
            'source': toShow,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': lightColor,
                'line-width': 7
            }
        });

        map.addLayer({
            'id': toShow,
            'type': 'line',
            'source': toShow,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': color,
                'line-width': 5
            }
        });
    }
}

function updateBusVisibility() {
    for (var bus of Object.keys(this.busesReal)) {
        var busElement = document.getElementById("bus" + bus);
        if (busElement) {
            if (Object.keys(selectedRoutes).includes(this.busesReal[bus].route)) {
                busElement.style.display = "block";
            } else {
                busElement.style.display = "none";
            }
        }
    }
}

// this.currentRoutes = Object.keys(this.selectedRoutes);
// for(var rout of this.currentRoutes){
//     for(var cord = 0; cord<this.routesReal[rout].coords.length; cord++){
//         var dov = document.createElement('div');
//         dov.innerText = cord;
//         dov.id = cord;
//         new mapboxgl.Marker(dov).setLngLat(this.routesReal[rout].coords[cord]).addTo(map)
//         console.log(dov);
//     }
// }


const ratio = 2;
const busRatio = 3;
var zoomb = map.getZoom();

function fixSizes() {
    for (var mapRoute of this.currentRoutes) {
        map.setPaintProperty(mapRoute, 'line-width', (ratio * zoomb) / 5);
        map.setPaintProperty(mapRoute + "bg", 'line-width', (ratio * zoomb) / 5);
    }

    // Set a fixed size for stop markers in pixels
    for (var marker of document.querySelectorAll('.stopMarker')) {
        marker.style.width = '20px'; // Set fixed width
        marker.style.height = '20px'; // Set fixed height
    }

    for (var marker of document.querySelectorAll('.busMarker')) {
        marker.style.height = `${(zoomb * busRatio).toString()}px`;
        marker.style.width = `${(zoomb * busRatio).toString()}px`;
        $(marker.firstChild).attr('height', (zoomb * busRatio).toString() + "px");
        $(marker.firstChild).attr('width', (zoomb * busRatio).toString() + "px");
        marker.childNodes[2].style.height = (0.8 * (zoomb * busRatio)).toString() + "px";
        marker.childNodes[2].style.width = (0.8 * (zoomb * busRatio)).toString() + "px";
        marker.childNodes[2].style.padding = `${0.1 * (zoomb * busRatio)}px`;
    }
}

function lighten(color) {
    color = color.replace('#', '');

    // Convert to RGB
    var r = parseInt(color.substr(0, 2), 16);
    var g = parseInt(color.substr(2, 2), 16);
    var b = parseInt(color.substr(4, 2), 16);

    // Lighten
    r = Math.min(255, r + 120);
    g = Math.min(255, g + 120);
    b = Math.min(255, b + 120);

    // Convert back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function updateBusVisibility() {
    for (var bus of Object.keys(this.busesReal)) {
        var busElement = document.getElementById("bus" + bus);
        if (busElement) {
            if (Object.keys(selectedRoutes).includes(this.busesReal[bus].route)) {
                busElement.style.display = "block";
            } else {
                busElement.style.display = "none";
            }
        }
    }
}

function renderRoute(routeName) {
    var newNode = document.getElementById(routeName).appendChild(document.createElement('div'))
    var inner = newNode.appendChild(document.createElement('ol'));
    inner.setAttribute('style', 'font-weight: lighter; font-size: 2.25vh');
    var paath = this.routesReal[routeName].path;
    for (let stop of paath) {
        inner.appendChild(document.createElement('li'));
        inner.lastChild.addEventListener('click', function() { showStopOnMap(this.stopsHashMap[stop[1]]) }.bind(this));
        inner.lastChild.innerText = this.stopsHashMap[stop[1]];
    }
    $(newNode).hide();
}

var stopMarkers = []

function renderCircle(routeList, stopName) {
    console.log("Beginning renderCircle for stop:", stopName);
    console.log("Route list for this stop:", routeList);

    if (!this.stopsReal[stopName]) {
        console.error("Stop not found in stopsReal:", stopName);
        return;
    }

    if (!map.loaded()) {
        console.error("Map not loaded yet, cannot render stop:", stopName);
        return;
    }

    console.log("Stop data:", this.stopsReal[stopName]);
    console.log("Creating marker for stop:", stopName, "at position:", [this.stopsReal[stopName].long, this.stopsReal[stopName].lat]);

    let routList = [];
    let bruhMoment = JSON.parse(JSON.stringify(this.routesReal));
    for (var routte of routeList) {
        var hello = bruhMoment[routte].active;
        if (hello) {
            routList.push(routte);
        }
    }
    console.log("Active routes for this stop:", routList);

    let svg = document.createElement('div');
    svg.className = 'stopMarker';
    svg.id = 'stop: ' + stopName;
    let inner = '';
    if (routList.length > 0) {
        for (var i = 0; i < routList.length; i++) {
            inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "${bruhMoment[routList[i]].color}" stroke="#FFFFFF" stroke-width="0.3em">\n`
            inner += "<path d='" + arc({ x: 0, y: 0, r: 50, start: ((360 / routList.length) * i), end: ((360 / routList.length) * (i + 1)) }) + "'></path>\n";
            inner += '</svg>\n';
        }
    } else {
        inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "#888888" stroke="#FFFFFF" stroke-width="0.3em">\n`
        inner += "<path d='" + arc({ x: 0, y: 0, r: 50 }) + "'></path>\n";
        inner += '</svg>\n';
    }
    svg.innerHTML = inner;
    console.log("Created SVG element for stop:", stopName);

    svg.addEventListener('click', () => {
        console.log("Stop marker clicked:", stopName);
        showStopDetails(stopName);
    });

    try {
        let marker = new mapboxgl.Marker(svg)
            .setLngLat([this.stopsReal[stopName].long, this.stopsReal[stopName].lat])
            .addTo(map);
        this.stopMarkers.push(marker);
        console.log("Stop marker added for:", stopName);
    } catch (error) {
        console.error("Error adding marker for stop:", stopName, error);
    }

    console.log("Finished renderCircle for stop:", stopName);
}

function checkStopMarkersInView() {
    if (!map.getBounds) {
        console.error("Map bounds not available");
        return;
    }
    let bounds = map.getBounds();
    let inViewCount = 0;
    for (let marker of this.stopMarkers) {
        if (marker && marker.getLngLat && bounds.contains(marker.getLngLat())) {
            inViewCount++;
        }
    }
    console.log("Stop markers in current view:", inViewCount);
}

function showStopDetails(stopName) {
    $("#stopContainer").show();
    var closestBuses = {};
    for (var rout of this.stopsReal[stopName].routes) {
        var stobbe = this.stopsReal[stopName].iAmThisPoint[rout];
        if (this.routesReal[rout].buses.length > 0) {
            closestBuses[rout] = {
                timeTill: getETA(rout, this.busesReal[this.routesReal[rout].buses[0]].speed, this.busesReal[this.routesReal[rout].buses[0]].pointOnPath, stobbe, this.routesReal[rout].buses[0]).toFixed(1),
                bus: this.routesReal[rout].buses[0],
            };
            for (var bussy of this.routesReal[rout].buses) {
                var oldde = this.busesReal[closestBuses[rout].bus].pointOnPath;
                var newwe = this.busesReal[bussy].pointOnPath;
                if ((oldde < stobbe && newwe < stobbe) || (oldde > stobbe && newwe > stobbe)) {
                    if (newwe > oldde) {
                        console.log('I S')
                        closestBuses[rout].timeTill = getETA(rout, this.busesReal[bussy].speed, newwe, stobbe, bussy).toFixed(1);
                        closestBuses[rout].bus = bussy;
                    }
                } else if (oldde > stobbe && newwe < stobbe) {
                    closestBuses[rout].timeTill = getETA(rout, this.busesReal[bussy].speed, newwe, stobbe, bussy).toFixed(1);
                    closestBuses[rout].bus = bussy;
                }
            }
        }
    }
    var conty = document.getElementById('stopContainer');
    $(conty.firstElementChild).html(stopName);
    conty.lastElementChild.innerHTML = "";
    for (let bu of Object.keys(closestBuses)) {
        conty.childNodes[6].appendChild(document.createElement('div'));
        conty.childNodes[6].lastChild.className = busItem;
        conty.childNodes[6].lastChild.style.borderColor = this.routesReal[bu].color;
        if (closestBuses[bu].timeTill == 0) {
            conty.childNodes[6].lastChild.innerText = bu + ": " + closestBuses[bu].bus + " has arrived.";
        } else {
            conty.childNodes[6].lastChild.innerText = bu + ": " + closestBuses[bu].bus + " in " + (closestBuses[bu].timeTill / 60).toFixed(1) + " mins @ " + (busesReal[closestBuses[bu].bus].speed * 2.23694).toFixed(2) + "mph"
        }
        conty.childNodes[6].lastChild.addEventListener('click', function() { showBusOnMap(closestBuses[bu].bus) }.bind(this))
    }
}

function showStopOnMap(stopName) {
    $("#stopsList").hide();
    $("#routesList").hide();


    console.log("stopName:", stopName);
    console.log("this.stopsReal[stopName]:", this.stopsReal[stopName]);


    if (this.stopsReal[stopName]) {
        map.setCenter([this.stopsReal[stopName].long, this.stopsReal[stopName].lat]);
        map.setZoom(16);
    } else {
        console.error("Stop not found:", stopName);
    }
}

function filterBuses(bus) {
    var bussy = document.getElementById('busSearch').value;
    var busess = $($("#busesList").find('[class="popupList withSearch"]')[0]).find('div');
    if (bussy === "") {
        for (var item of Object.keys(busess)) {
            if (typeof busess[item] === "object") {
                $(busess[item]).show();
            }
        }
    } else {
        for (var item of Object.keys(busess).slice(0, Object.keys(busess).length - 4)) {
            if (typeof busess[item] === "object") {
                if (!busess[item].innerText.toLowerCase().includes(bussy.toLowerCase())) {
                    $(busess[item]).hide();
                } else {
                    $(busess[item]).show();
                }
            }
        }
    }
}

function filterStops(stop) {
    stop = document.getElementById('stopSearch').value;
    var stopss = $($("#stopsList").find('[class="popupList withSearch"]')[0]).find('div');
    var stop = document.getElementById('stopSearch').value;
    if (stop === "") {
        for (var item of Object.keys(stopss)) {
            if (typeof stopss[item] === "object") {
                $(stopss[item]).show();
            }
        }
    } else {
        for (var item of Object.keys(stopss).slice(0, Object.keys(stopss).length - 4)) {
            if (typeof stopss[item] === "object") {
                if (!stopss[item].innerText.toLowerCase().includes(stop.toLowerCase())) {
                    $(stopss[item]).hide();
                } else {
                    $(stopss[item]).show();
                }
            }
        }
    }
}

var trafficData = {};
var allLines = [];
var madeLines = false;

function getETA(route, speed, start, end, bus) {
    console.log(`getETA called for bus ${bus}: route=${route}, speed=${speed}, start=${start}, end=${end}`);
    if (!this.routesReal[route] || !this.routesReal[route].coords) {
        console.error("Invalid route data for:", route, "routesReal:", this.routesReal);
        return 0;
    }
    if (start === undefined || end === undefined || start < 0 || end < 0 ||
        start >= this.routesReal[route].coords.length ||
        end >= this.routesReal[route].coords.length) {
        console.error("Invalid start or end for bus:", bus, "start:", start, "end:", end);
        return 0;
    }
    var toRet;
    if (start === end) {
        return 0;
    }
    console.log(turf.distance(turf.point(this.routesReal[route].coords[start]), turf.point(this.routesReal[route].coords[end]), { units: 'kilometers' }).toFixed(1) + "km distance betweeen start and stop of bus " + bus + 'points: ' + start + " " + end);
    if (turf.distance(turf.point(this.routesReal[route].coords[start]), turf.point(this.routesReal[route].coords[end]), { units: 'kilometers' }) < 0.05) {
        return 0;
    }
    try {
        if (end < start) {
            toRet = (turf.length(turf.lineString(this.routesReal[route].coords.slice(start, this.routesReal[route].coords.length - 1).concat(this.routesReal[route].coords.slice(0, end))), { units: 'kilometers' }) * 1000) / speed;
        } else {
            toRet = (turf.length(turf.lineString(this.routesReal[route].coords.slice(start, end + 1)), { units: 'kilometers' }) * 1000) / speed;
        }
    } catch (e) {
        if (e.message == "coordinates must be an array of two or more positions") {
            toRet = 0;
        }
    }
    return toRet;
}
// --------------------------------------------------------------------------

const point = (x, y, r, angel) => [
    (x + Math.sin(angel) * r).toFixed(2),
    (y - Math.cos(angel) * r).toFixed(2),
];

const full = (x, y, R, r) => {
    if (r <= 0) {
        return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} Z`;
    }
    return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 1 1 1 ${x - r} ${y} Z`;
};

const part = (x, y, R, r, start, end) => {
    const [s, e] = [(start / 360) * 2 * Math.PI, (end / 360) * 2 * Math.PI];
    const P = [
        point(x, y, r, s),
        point(x, y, R, s),
        point(x, y, R, e),
        point(x, y, r, e),
    ];
    const flag = e - s > Math.PI ? '1' : '0';
    return `M ${P[0][0]} ${P[0][1]} L ${P[1][0]} ${P[1][1]} A ${R} ${R} 0 ${flag} 1 ${P[2][0]} ${P[2][1]} L ${P[3][0]} ${P[3][1]} A ${r} ${r}  0 ${flag} 0 ${P[0][0]} ${P[0][1]} Z`;
};

const arc = (opts = {}) => {
    const { x = 0, y = 0 } = opts;
    let {
        R = 0, r = 0, start, end,
    } = opts;

    [R, r] = [Math.max(R, r), Math.min(R, r)];
    if (R <= 0) return '';
    if (start !== +start || end !== +end) return full(x, y, R, r);
    if (Math.abs(start - end) < 0.000001) return '';
    if (Math.abs(start - end) % 360 < 0.000001) return full(x, y, R, r);

    [start, end] = [start % 360, end % 360];

    if (start > end) end += 360;
    return part(x, y, R, r, start, end);
};

function colorToHex(color) {
    var hexadecimal = color.toString(16);
    return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
}

const RGBtoHex = (red, green, blue) => {
    return "#" + colorToHex(red) + colorToHex(green) + colorToHex(blue);
}

const dashArraySequence = [
    [0, 4, 3],
    [0.5, 4, 2.5],
    [1, 4, 2],
    [1.5, 4, 1.5],
    [2, 4, 1],
    [2.5, 4, 0.5],
    [3, 4, 0],
    [0, 0.5, 3, 3.5],
    [0, 1, 3, 3],
    [0, 1.5, 3, 2.5],
    [0, 2, 3, 2],
    [0, 2.5, 3, 1.5],
    [0, 3, 3, 1],
    [0, 3.5, 3, 0.5]
];

let step = 0;

function animateDashArray(timestamp) {
    // Update line-dasharray using the next value in dashArraySequence. The
    // divisor in the expression `timestamp / 50` controls the animation speed.
    const newStep = parseInt(
        (timestamp / 125) % dashArraySequence.length
    );

    if (newStep !== step) {
        for (var mapRoute of this.currentRoutes) {
            map.setPaintProperty(
                mapRoute,
                'line-dasharray',
                dashArraySequence[step]
            );
        }
        step = newStep;
    }

    // Request the next frame of the animation.
    requestAnimationFrame(animateDashArray);
}

// start the animation
animateDashArray(0);

Array.prototype.removeAt = function(iIndex) {
    var vItem = this[iIndex];
    if (vItem) {
        this.splice(iIndex, 1);
    }
    return vItem;
};

function generateMovement(startPoint, endPoint) {
    var speedFactor = 100;
    var difflong = endPoint[0] - startPoint[0];
    var difflat = endPoint[1] - startPoint[1];

    var sflong = difflong / speedFactor;
    var sflat = difflat / speedFactor;

    var lineCoordinates = [];

    for (let i = 0; i < 100; i++) {
        lineCoordinates.push([startPoint[0] + (sflong * (i + 1)), startPoint[1] + (sflat * (i + 1))])
    }

    return lineCoordinates;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}