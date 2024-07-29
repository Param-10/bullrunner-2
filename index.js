// Global variables for routes, stops, buses, and alerts
var routes;
var inactiveRoutes = [];
var stops;
var buses;
var alerts;

// Lists for excluding certain routes and IDs
var excludeList = ['cam', 'ccexp', 'connect', 'penn', 'pennexpr']
var excludeMyIDs = ['41231', '4088', '4063', '4056', '4098']

// CSS classes for different item types
var routeItem = "popupItem route";
var busItem = "popupItem bus"
var stopItem = "popupItem stop"
var alertItem = "popupItem alert"

// Objects to store processed data
var routesReal = {};
var stopsReal = {};
var busesReal = {};
var alertsReal = [];

// Flags to check if data is loaded
var routesLoaded = false;
var stopsLoaded = false;
var busesLoaded = false;
var alertsLoaded = false;

// Objects to store selected and current routes
var selectedRoutes = {};
var currentRoutes = [];
var stopsOrdered = [];
var hasBuses = [];

// Event listener for map load
addEventListener(map.load, initialise());

// HashMap for stops and error message
var stopsHashMap = {};
var errorMessage = "PassioGO! is being slow :)\nIt's still loading.";

// Function to show loading message
function stillLoading() { alert(this.errorMessage) };

// Generate a random device ID
var deviceId = (Math.floor(Math.random() * (10 ** 8))).toString()

// Function to handle failure in data loading
function failure() {
    $("#status").show();
    this.errorMessage = 'Passio servers dead, ggwp :(';
    document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>We Don't Know Why</h3></br>But basically their service is down.</div>`;
}

// Main initialization function
async function initialise() {
    // Add event listeners for search inputs to filter buses and stops
    document.getElementById('busSearch').addEventListener('input', function(event) { filterBuses(event.data) });
    document.getElementById('stopSearch').addEventListener('input', function(event) { filterStops(event.data) });

    // Set up AJAX defaults
    $.ajaxSetup({
        type: 'POST',
        timeout: 30000,
        error: function(xhr) {
            this.errorMessage = ("Timed Out. Passio dead :(");
        }
    })

    // Add event listeners for buttons to show loading message
    let tempScope = this;
    document.getElementById('routesButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('stopsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('alertsButton').addEventListener('click', stillLoading.bind(tempScope));
    document.getElementById('busesButton').addEventListener('click', stillLoading.bind(tempScope));

    // Load routes data
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

    // Load stops data
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

    // Load alerts data
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

    // Load buses data
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`
                throw new Error("Passio Gone");
            }
            setBusesFirst.call(this, JSON.parse(data));
        }.bind(this)).fail(failure.bind(this));

    // Replace button event listeners with new event listeners
    document.getElementById('routesButton').replaceWith(document.getElementById('routesButton').cloneNode(true));
    document.getElementById('stopsButton').replaceWith(document.getElementById('stopsButton').cloneNode(true));
    document.getElementById('busesButton').replaceWith(document.getElementById('busesButton').cloneNode(true));
    document.getElementById('alertsButton').replaceWith(document.getElementById('alertsButton').cloneNode(true));
    document.getElementById('routesButton').addEventListener('click', openRoutes.bind(this));
    document.getElementById('stopsButton').addEventListener('click', openStops.bind(this));
    document.getElementById('alertsButton').addEventListener('click', openAlerts.bind(this));
    document.getElementById('busesButton').addEventListener('click', openBuses.bind(this));

    // Check for mobile devices and set appropriate stylesheet
    var userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('Android')) {
        $("#stylesheet").attr("href", "styleMobile.css");
        console.info("mobile");
    } else {
        console.info("pc");
    }

    // Add event listener for map zoom
    map.on('zoomend', fixSizes.bind(this));
    $("#status").hide();
};

// Function to set routes data
function setRoutes(what) {
    this.routes = what;
}

// Function to set alerts data
function setAlerts(what) {
    this.alerts = what;
}

// Function to set buses data
function setBuses(what) {
    this.trueSetBuses.call(this, what);
}
// Function to process and set buses data
function trueSetBuses(what) {
    // Assign the input data to the buses property
    this.buses = what;

    // Extract the buses data from the response
    var busesExclusively = this.buses['buses'];

    // Get the list of bus IDs
    var busIds = Object.keys(busesExclusively);

    // Set all routes to inactive initially
    for (var routs of Object.keys(this.routesReal)) {
        this.routesReal[routs].active = false;
    }

    // Separate new and existing buses based on whether their names are already in busesReal
    var news = busIds.filter((word) => !(Object.keys(this.busesReal).includes(busesExclusively[word][0]['busName'])));
    var existing = busIds.filter((word) => (Object.keys(this.busesReal).includes(busesExclusively[word][0]['busName'])));

    // Process existing buses
    for (var busId of existing) {
        let currentBus = busesExclusively[busId][0];
        this.busesReal[currentBus['busName']].num = currentBus['busName'];
        this.busesReal[currentBus['busName']].route = currentBus['route'];
        this.busesReal[currentBus['busName']].routeId = currentBus['routeId'];
        this.busesReal[currentBus['busName']].active = !Boolean(currentBus['outOfService']);
        this.busesReal[currentBus['busName']].fullness = parseInt(currentBus['paxLoad'] * 100 / currentBus['totalCap']);
        this.busesReal[currentBus['busName']].id = currentBus['busId'];

        // Calculate distance and speed based on previous and current positions
        var temp1 = [parseFloat(currentBus['longitude']), parseFloat(currentBus['latitude'])];
        var temp2 = this.busesReal[currentBus['busName']].position;
        var temp3 = turf.lineString([temp1, temp2]);
        console.log(turf.length(temp3, { units: 'kilometers' }).toFixed(1) + "km distance between old and new");
        var leng = (turf.length(temp3, { units: 'kilometers' }) * 1000) / 10;
        this.busesReal[currentBus['busName']].speed = leng;

        // Update the position and bearing of the bus
        this.busesReal[currentBus['busName']].position = [parseFloat(currentBus['longitude']), parseFloat(currentBus['latitude'])];
        this.busesReal[currentBus['busName']].bearing = currentBus['calculatedCourse'];
    }

    // Process new buses
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
            speed: 0, // Speed is set to 0 initially for new buses
            ttn: 0 // Initialize 'time to next stop' or similar property
        }
    }
}
// Function to show a specific bus on the map
function showBusOnMap(which) {
    $("#stopsList").hide();
    $("#routesList").hide();
    $("#busesList").hide();
    map.setCenter(this.busesReal[which].position);
    map.setZoom(16);
}

// This async function sets up the buses first and then handles various updates and renderings.
async function setBusesFirst(what) {
    // Call the trueSetBuses method with 'what' as the parameter
    this.trueSetBuses.call(this, what);

    // Call the bussyDeletion method to clean up the buses
    this.bussyDeletion.call(this);

    // Loop through each route and set the active property based on whether the route has buses
    for (var rout of Object.keys(this.routesReal).toSorted()) {
        this.routesReal[rout].active = (this.routesReal[rout].buses.length > 0);
    }

    // If stops do not have buses, add buses to the stops
    if (!stopsHaveBuses) {
        for (var key of Object.keys(this.stopsReal)) {
            for (var route of this.stopsReal[key].routes) {
                this.stopsReal[key].buses = this.stopsReal[key].buses.concat(this.routesReal[route].buses);
            }
        }
        // Sort the stops and render them
        this.stopsOrdered = Object.keys(this.stopsReal);
        this.stopsOrdered.sort();
        for (var stoppe of this.stopsOrdered) {
            this.renderCircle.call(this, this.stopsReal[stoppe].routes, stoppe);
        }
        stopsHaveBuses = true;
    }

    // Get the current bus list container
    var current = $("#busesList").find('[class="popupList withSearch"]')[0];

    // Loop through each route and add active buses to the bus list
    for (let rout of Object.keys(this.routesReal).toSorted()) {
        if (this.routesReal[rout].active) {
            this.routesReal[rout].buses.sort();
            for (let x = 0; x < this.routesReal[rout].buses.length; x++) {
                if (this.busesReal[this.routesReal[rout].buses[x]].active) {
                    current.append(document.createElement('div'));
                    current.lastChild.className = this.busItem;
                    current.lastChild.id = this.routesReal[rout].buses[x];
                    current.lastChild.innerHTML = this.routesReal[rout].buses[x] + " | " + this.busesReal[this.routesReal[rout].buses[x]].route;
                    let bruh = (this.routesReal[rout].buses[x]);
                    current.lastChild.addEventListener('click', function() { showBusOnMap(bruh) }.bind(this));
                }
            }
        }
    }

    // Sort stops and render them
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
        $(current.lastChild).on('click', function() { showStopOnMap(`${keys[i]}`) });
    }

    // Render active routes
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

    // Render inactive routes
    current.append(document.createElement("div"));
    current.lastChild.className = "popupItem bus";
    current.lastChild.innerText = "-- Inactive Routes --";
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
            this.renderRoute(this.routesReal[rout].full);
        }
    }

    // Fetch buses data from Passio server and update
    await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
        function(data) {
            if (Object.keys(JSON.parse(data)).length === 1) {
                this.errorMessage = "Passio servers dead, ggwp :(";
                document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`;
                throw new Error("Passio Gone");
            }
            this.setBuses.call(this, JSON.parse(data));
            updateBuses.call(this);
        }.bind(this)).fail(failure.bind(this));

    // Set interval to update buses every 10 seconds
    setInterval(async function() {
        await $.post("https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=" + deviceId + "&wTransloc=1", { json: '{"s0":"2343","sA":1}' },
            function(data) {
                if (Object.keys(JSON.parse(data)).length === 1) {
                    this.errorMessage = "Passio servers dead, ggwp :(";
                    document.getElementById('status').innerHTML = `<h3 class="popupTitle">Something Went Wrong</h3></br><div class="popupItem"><h3>From Passio Official</h3></br>"${JSON.parse(data)['error']}"</div>`;
                    throw new Error("Passio Gone");
                }
                this.setBuses.call(this, JSON.parse(data));
                updateBuses.call(this);
            }.bind(this)).fail(failure.bind(this));
    }, 10000);
}

// Function to clean up and update busesReal data
function cleanup() {
    // Iterate through each bus in busesReal
    for (var bussy of Object.keys(busesReal)) {
        // If the bus's route is not in routesReal, skip this bus
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }

        // Initialize variables to find the closest point on the route
        var shortest = 1000;
        var indi = 0;

        // Iterate through the coordinates of the bus's route to find the closest point
        for (var i = 0; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
            // Calculate the distance between the bus's position and the current route coordinate
            var distance = turf.distance(
                turf.point(this.busesReal[bussy].position),
                turf.point([
                    parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]),
                    parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])
                ])
            );

            // If this distance is shorter than the previous shortest, update shortest and indi
            if (distance < shortest) {
                shortest = distance;
                indi = i;
            }
        }

        // Set the pointOnPath property to the index of the closest point
        this.busesReal[bussy].pointOnPath = indi;

        // Find the next stop along the route after the closest point
        for (var x = indi; x < this.routesReal[this.busesReal[bussy].route].coords.length; x++) {
            // If the current point is a stop, update nextStop property and break the loop
            if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(x.toString())) {
                this.busesReal[bussy].nextStop = [x.toString(), this.routesReal[this.busesReal[bussy].route].stopIndices[x]];
                break;
            }
        }
    }
}

// Function to delete inactive buses and update routes with active buses
function bussyDeletion() {
    var toDelete = [];

    // Iterate through each bus in busesReal
    for (let busReal of Object.keys(this.busesReal)) {
        let flag = true;

        // If the bus's route is in routesReal, update route data
        if (Object.keys(this.routesReal).includes(this.busesReal[busReal].route)) {
            // Add bus to the route's list of buses
            this.routesReal[this.busesReal[busReal].route].buses.push(busReal);
            // Mark the route as active
            this.routesReal[this.busesReal[busReal].route]['active'] = true;
            // Add the route to the list of routes that have buses
            this.hasBuses.push(this.busesReal[busReal].route);
            // Set the bus's pointOnPath to 0
            this.busesReal[busReal].pointOnPath = 0;
            // Set the bus's next stop to the last stop on the route
            this.busesReal[busReal].nextStop = [
                Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).length - 1],
                this.routesReal[this.busesReal[busReal].route].stopIndices[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).length - 1]]
            ];
            flag = false;

            // Initialize variables to find the closest point on the route
            var shortestDist = 1000;
            var shortInd = 0;

            // Iterate through the coordinates of the bus's route to find the closest point
            for (var i = 0; i < this.routesReal[this.busesReal[busReal].route].coords.length; i++) {
                var distance = turf.distance(
                    turf.point(this.busesReal[busReal].position),
                    turf.point([
                        parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][1]),
                        parseFloat(this.routesReal[this.busesReal[busReal].route].coords[i][0])
                    ])
                );

                // If this distance is shorter than the previous shortest, update shortestDist and shortInd
                if (distance < shortestDist) {
                    shortestDist = distance;
                    shortInd = i;
                }
            }

            // Set the bus's pointOnPath to the index of the closest point
            this.busesReal[busReal].pointOnPath = shortInd;

            // Find the next stop along the route after the closest point
            for (var x = this.busesReal[busReal].pointOnPath; x < this.routesReal[this.busesReal[busReal].route].coords.length; x++) {
                if (Object.keys(this.routesReal[this.busesReal[busReal].route].stopIndices).includes(x.toString())) {
                    this.busesReal[busReal].nextStop = [
                        x.toString(),
                        this.routesReal[this.busesReal[busReal].route].stopIndices[x]
                    ];
                    break;
                }
            }
        }

        // If the bus's route was not in routesReal, mark it for deletion
        if (flag) {
            toDelete.push(busReal);
        }
    }
}

// Function to set the stops data
function setStops(what) {
    this.stops = what;
}

// Function to open the stops list popup
function openStops() {
    closeAll();
    $("#stopsList").show();
}

// Function to open the routes list popup
function openRoutes() {
    closeAll();
    $("#routesList").show();
}

// Function to open the buses list popup
function openBuses() {
    closeAll();
    $("#busesList").show();
}

// Function to open the alerts list popup
function openAlerts() {
    closeAll();
    $('#alertsList').show();
}

// Function to close all popups
function closeAll() {
    $(".popup").hide();
}
var busMarkers = {}; // Object to store bus markers on the map

var stopsHaveBuses = false; // Flag to indicate if stops have buses

// Function to update the positions and statuses of buses
function updateBuses() {
    // Reset the buses array for each route in routesReal
    for (var rout of Object.keys(this.routesReal)) {
        this.routesReal[rout].buses = [];
    }

    // Iterate through each bus in busesReal
    for (var bussy of Object.keys(busesReal)) {
        // Skip the bus if its route is not in routesReal
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }

        var shortest = 1000; // Variable to store the shortest distance
        var indi = 0; // Variable to store the index of the closest point
        var final = Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices)[Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).length - 1];

        // Check if the bus's point on the path is before the final stop
        if (busesReal[bussy].pointOnPath < final) {
            // Find the closest point on the path from the current position to the final stop
            for (var i = busesReal[bussy].pointOnPath; i < final; i++) {
                var distance = turf.distance(
                    turf.point(this.busesReal[bussy].position),
                    turf.point(this.routesReal[this.busesReal[bussy].route].coords[i])
                );

                if (distance < shortest) {
                    shortest = distance;
                    indi = i;
                }
            }

            this.busesReal[bussy].pointOnPath = indi;

            // Find the next stop after the closest point
            if (indi < final) {
                for (var i = this.busesReal[bussy].pointOnPath; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
                    if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(i.toString())) {
                        this.busesReal[bussy].nextStop = [i, this.routesReal[this.busesReal[bussy].route].stopIndices[i]];
                        break;
                    }
                }
            }
        } else {
            // If the bus is past the final stop, find the closest point from the beginning
            for (var i = 0; i < this.routesReal[this.busesReal[bussy].route].coords.length; i++) {
                var distance = turf.distance(
                    turf.point(this.busesReal[bussy].position),
                    turf.point([
                        parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][1]),
                        parseFloat(this.routesReal[this.busesReal[bussy].route].coords[i][0])
                    ])
                );

                if (distance < shortest) {
                    shortest = distance;
                    indi = i;
                }
            }

            // Find the next stop after the closest point
            for (var x = this.busesReal[bussy].pointOnPath; x < this.routesReal[this.busesReal[bussy].route].coords.length; x++) {
                if (Object.keys(this.routesReal[this.busesReal[bussy].route].stopIndices).includes(x)) {
                    this.busesReal[bussy].nextStop = [x.toString(), this.routesReal[this.busesReal[bussy].route].stopIndices[x]];
                    break;
                }
            }
        }
    }

    // Iterate through each bus in busesReal to update the markers and details
    for (let bus of Object.keys(this.busesReal).toSorted()) {
        // Skip the bus if its route is not in routesReal
        if (!(Object.keys(this.routesReal).includes(this.busesReal[bussy].route))) {
            continue;
        }

        // If the bus is active and its route is in routesReal
        if (this.busesReal[bus].active && Object.keys(this.routesReal).includes(busesReal[bus].route)) {
            // Add the bus to the route's list of buses
            this.routesReal[this.busesReal[bus].route].buses.push(bus);

            // If the bus marker does not exist, create a new marker
            if (document.getElementById("bus" + bus) === null) {
                let div = document.createElement('div');
                div.id = "bus" + bus;
                div.className = 'busMarker';

                let inner = "";
                inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" stroke="#FFFFFF" fill="${this.routesReal[this.busesReal[bus].route].color}" stroke-width="1em">\n`;
                inner += "<path d='" + arc({ x: 0, y: 0, r: 45 }) + "'></path>\n";
                inner += '</svg>\n';
                inner += `<img style="transform: rotate(${this.busesReal[bus].bearing}deg);" src="assets/busPointer.svg?sanitize=true" height='20px' width='20px'>`;

                div.innerHTML = inner;
                div.appendChild(document.createElement('div'));
                div.lastChild.className = 'busDetail';
                div.lastChild.innerHTML = `<h4>${bus}: ${this.busesReal[bus].route}</h4><ul><li>Next Stop: ${this.busesReal[bus].nextStop[1]}</li><li>Occupancy: ${this.busesReal[bus].fullness}%</li></ul>`;
                div.addEventListener('click', function(e) {
                    if (e.target === div || Array.from(div.childNodes).includes(e.target)) {
                        showBusDetails(bus);
                    }
                }.bind(this));

                busMarkers[bus] = [new mapboxgl.Marker(div), []];
                busMarkers[bus][0].setLngLat(this.busesReal[bus].position);
                busMarkers[bus][0].addTo(map);
                div.lastChild.style.display = "none";
                div.lastChild.appendChild(document.createElement('div'));
                div.lastChild.lastChild.className = 'x';
                div.lastChild.lastChild.innerHTML = "<img src='assets/x.svg' class='SVGicon'></img>";

                let bruh = div.lastChild.lastChild;
                div.lastChild.lastChild.addEventListener('click', function(e) {
                    if (e.target === bruh || Array.from(bruh.childNodes).includes(e.target)) {
                        div.lastChild.style.display = 'none';
                    }
                }.bind(this));
            } else {
                // If the bus marker exists, update its position and details
                this.busMarkers[bus][1] = generateMovement([this.busMarkers[bus][0].getLngLat().lng, this.busMarkers[bus][0].getLngLat().lat], this.busesReal[bus].position);
                $($(this.busMarkers[bus][0].getElement().lastChild).find("ul")).find('li')[0].innerText = `Next Stop: ${this.busesReal[bus].nextStop[1]}`;
                $($(this.busMarkers[bus][0].getElement().lastChild).find("ul")).find('li')[1].innerText = `Occupancy: ${this.busesReal[bus].fullness}%`;
            }

            this.frame = 0;
            schmooveBus(bus, busMarkers[bus][1]);
            document.getElementById("bus" + bus).childNodes[2].setAttribute('style', `padding: ${0.2 * (zoomb * busRatio)}px; transform: rotate(${this.busesReal[bus].bearing}deg);`);
        }
    }

    // Iterate through each bus in busesReal to update ETA and other details
    for (var bus of Object.keys(this.busesReal)) {
        var key = this.busesReal[bus].route;

        // Skip the bus if its route is not in routesReal
        if (!Object.keys(this.routesReal).includes(key)) {
            continue;
        }

        // Show stop details if the stop container is displayed
        if (document.getElementById('stopContainer').style.display !== "none") {
            this.showStopDetails(document.getElementById('stopContainer').firstElementChild.innerText);
        }

        // Log the bus's route
        console.log(this.busesReal[bus].route);

        // Update the bus's ETA
        this.busesReal[bus].ttn = getETA(this.busesReal[bus].route, this.busesReal[bus].speed, this.busesReal[bus].pointOnPath, this.busesReal[bus].nextStop[0], bus);
    }
}

// Function to smoothly move the bus marker on the map
async function schmooveBus(bus, frames) {
    for (let frame of frames) {
        this.busMarkers[bus][0].setLngLat(frame);
        await sleep(16); // Sleep for 16 milliseconds to create smooth animation
    }
}

// Function to display bus details for a specific bus
function showBusDetails(which) {
    busMarkers[which][0].getElement().lastChild.style.display = "inline-block";
}

// Function to load and display route information
function loadRoutes() {
    // Get the container for the route list
    let current = $("#routesList").find('[class="popupList"]')[0];
    var temp = [];

    // Sort routes alphabetically by original name
    this.routes.sort(function(a, b) {
        return a['nameOrig'].localeCompare(b['nameOrig']);
    });

    // Separate active and inactive routes
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

    // Create and populate list items for active routes
    for (let i = 0; i < this.routes.length; i++) {
        current.append(document.createElement("div"));
        current.lastChild.className = routeItem;
        current.lastChild.id = this.routes[i].nameOrig;

        // Set route name and short name, handle special routes
        try {
            current.lastChild.innerHTML = this.routes[i].nameOrig + " | " + this.routes[i].shortName.toUpperCase();
        } catch (e) {
            if (e instanceof TypeError) {
                current.lastChild.innerHTML = this.routes[i].nameOrig + " | Special Route";
            }
        }

        // Add route selector and set up event listeners
        current.lastChild.append(document.createElement('div'));
        current.lastChild.lastChild.className = 'routeSelector';
        let nam = this.routes[i].nameOrig;
        current.lastChild.style.borderColor = this.routes[i].color;
        let hihi = current.lastChild.lastChild;
        let hi = current.lastChild;
        hihi.addEventListener('click', function(e) { selectRoute(nam) }.bind(this));
        hi.addEventListener("click", function(e) { if (hi === e.target) { showRoute(this.routes[i].nameOrig) } }.bind(this));

        // Store route information in routesReal object
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

        // Set default short name for special routes
        if (this.routesReal[this.routes[i].nameOrig].short === null) {
            this.routesReal[this.routes[i].nameOrig].short = "SP Route";
        }
    }

    // Create and populate list items for inactive routes
    for (let i = 0; i < this.inactiveRoutes.length; i++) {
        // ... (Similar process as active routes, but marked as inactive)
    }

    // Add click event to show route details
    for (var el of document.getElementsByClassName('route')) {
        el.onclick = function() {
            $(el.lastChild).show();
        }
    }

    // Mark routes as loaded
    this.routesLoaded = true;
}

function loadStops() {
    // Process route paths
    var keys = Object.keys(this.stops['routes']);
    for (var i = 0; i < keys.length; i++) {
        // Check if the route exists in routesReal and add its path
        if (Object.keys(this.routesReal).includes(this.stops['routes'][keys[i]][0])) {
            // Slice is used to remove the first two elements (probably route ID and name)
            this.routesReal[this.stops['routes'][keys[i]][0]].path = this.stops['routes'][keys[i]].slice(2);
        };
    };

    // Process stop information
    keys = Object.keys(this.stops['stops']);
    for (var key of keys) {
        // This block seems incomplete or incorrect. It's trying to check for existing stops,
        // but the logic is not fully implemented.
        for (var madeKey of Object.keys(stopsReal)) {
            if (stopsReal.lat == this.stops['stops'][key]['latitude'] && stopsReal.long == this.stops['stops'][key]['longitude']) {
                this.stopsReal[this.stops['stops']]
            }
        }

        // Create stop object with relevant information
        this.stopsReal[this.stops['stops'][key]['name']] = {
                id: this.stops['stops'][key]['id'],
                lat: parseFloat(this.stops['stops'][key]['latitude']),
                long: parseFloat(this.stops['stops'][key]['longitude']),
                routes: [], // Will be populated later
                buses: [], // Will be populated later
                full: this.stops['stops'][key]['name'],
                iAmThisPoint: {} // Will store route-specific information
            }
            // Create a hash map for quick access to stop names by ID
        this.stopsHashMap[this.stops['stops'][key]['id']] = this.stops['stops'][key]['name'];
    }

    // Create a sorted list of stop names
    this.stopsOrdered = Object.keys(this.stopsReal);
    this.stopsOrdered.sort();

    // Associate routes with stops
    keys = Object.keys(this.routesReal);
    for (var key of keys) {
        for (var i = 0; i < this.routesReal[key].path.length; i++) {
            var currentStop = this.routesReal[key].path[i][1];
            for (var j = 0; j < this.stopsOrdered.length; j++) {
                var stopToEdit = this.stopsReal[this.stopsOrdered[j]].id;
                if (stopToEdit === currentStop) {
                    // Add the route to the stop's list of routes
                    this.stopsReal[this.stopsOrdered[j]].routes.push(key);
                }
            }
        }
    }

    // Process route coordinates
    keys = Object.keys(this.routesReal);
    console.info(Date.now()); // Log timestamp for performance measurement
    for (var key of keys) {
        var subkeys = Object.keys(this.stops.routePoints);
        for (var subkey of subkeys) {
            if (this.routesReal[key].id == subkey) {
                // Add coordinates to the route
                for (var pointe of this.stops.routePoints[subkey]) {
                    this.routesReal[key].coords.push([pointe.lng, pointe.lat]);
                }
            }
        }
        this.routesReal[key].stopIndices = {};
        renderRoute(key); // Assuming this function renders the route on a map
    }

    // Match stops to route coordinates using the Turf.js library for distance calculations
    var last = 0;
    var shortest = Infinity;
    var stopNum = 0;
    for (var key of Object.keys(this.routesReal)) {
        for (var stoppe of this.routesReal[key].path) {
            var actual = stopsHashMap[stoppe[1]];
            var hasSauce = false;
            var stobbe = turf.point([this.stopsReal[actual].long, this.stopsReal[actual].lat]);
            for (var i = last; i < this.routesReal[key].coords.length; i++) {
                var cPoint = turf.point(this.routesReal[key].coords[i]);
                var drist = turf.distance(stobbe, cPoint, { units: "kilometers" });
                // Find the closest point on the route to the stop
                if (drist > 0.15) { // If distance is greater than 150 meters
                    if (hasSauce) {
                        shortest = Infinity;
                        hasSauce = false;
                        break;
                    }
                    continue;
                }
                if (shortest < drist) {
                    continue;
                }
                console.log(actual, i);
                shortest = drist;
                last = i;
                // Store the index of the closest point for this stop and route
                if (Object.keys(this.stopsReal[actual].iAmThisPoint).includes(key)) {
                    this.stopsReal[actual].iAmThisPoint[key + " again"] = i;
                } else {
                    this.stopsReal[actual].iAmThisPoint[key] = i;
                }
                hasSauce = true;
            }
        }
        last = 0;
        shortest = Infinity;
        console.log(key)
            // Create a mapping of coordinate indices to stop names for each route
        for (var stoop of this.routesReal[key].path) {
            var stooop = stopsHashMap[stoop[1]];
            this.routesReal[key].stopIndices[this.stopsReal[stooop].iAmThisPoint[key]] = stooop;
        }
    }
    console.log(this.routesReal);
    console.log(Date.now()); // Log timestamp to measure performance

    // Remove stops outside a specific geographical area (likely the service area)
    for (var stop of Object.keys(this.stopsReal)) {
        let stoppe = stopsReal[stop];
        if (stoppe.long < -75.6 || stoppe.long > -74.3 || stoppe.lat > 40.6 || stoppe.lat < 40.4) {
            delete stopsReal[stop];
        }
    }

    this.stopsLoaded = true; // Mark stops as loaded
}

function loadAlerts() {
    // Process alerts from the raw data into a more usable format
    for (var msg of this.alerts.msgs) {
        this.alertsReal.push({
            id: msg.id,
            heading: msg.name,
            message: msg.html,
            time: msg.createdF
        });
    }

    // Display alerts in the UI
    var current = $("#alertsList").find('[class="popupList"]')[0];
    for (var alert of this.alertsReal) {
        // Create a new div for each alert
        current.append(document.createElement('div'));
        current.lastChild.className = alertItem;
        // Populate the div with alert information, including heading, time, and message
        current.lastChild.innerHTML = alert.heading + " | <span style='font-size: 1.5vh;'>" + alert.time + "</span></br><p style='font-size: 1.5vh';>" + alert.message + "</p>";
    }
}

// Function to toggle the visibility of route details
function showRoute(which) {
    let toEdit = document.getElementById(which).lastChild;
    $(toEdit).slideToggle();
}

// Function to select or deselect a route
function selectRoute(which) {
    var box = $(document.getElementById(which)).find('[class="routeSelector"]')[0];
    if (Object.keys(selectedRoutes).includes(which)) {
        // If route is already selected, deselect it
        delete selectedRoutes[which];
        box.style.backgroundColor = "";
    } else {
        // If route is not selected, select it
        selectedRoutes[which] = this.routesReal[which];
        box.style.backgroundColor = box.parentNode.style.borderColor;
    }
    // Update the display of routes on the map
    displayRoutes();

    // Hide all buses initially
    for (var bus of Object.keys(this.busesReal)) {
        try {
            document.getElementById("bus" + bus).style.display = "none";
        } catch (e) {
            console.info(e);
        }
    }

    // Show buses only for selected routes
    for (let route of Object.keys(selectedRoutes)) {
        for (var bus of this.routesReal[route].buses) {
            document.getElementById("bus" + bus).style.display = "block";
        }
    }
}

// Function to display selected routes on the map
function displayRoutes() {
    // Remove previously displayed routes
    for (var key of this.currentRoutes) {
        try {
            map.removeLayer(key);
            map.removeLayer(key + "bg");
            map.removeSource(key);
        } catch {
            // Ignore errors if layer or source doesn't exist
        }
    }

    // Add and display newly selected routes
    for (var toShow of Object.keys(this.selectedRoutes)) {
        // Add route as a source
        map.addSource(this.selectedRoutes[toShow].full, {
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

        // Calculate a lighter color for the route background
        var color = this.selectedRoutes[toShow].color;
        var red = lighten(parseInt(color.substring(1, 3), 16));
        var green = lighten(parseInt(color.substring(3, 5), 16));
        var blue = lighten(parseInt(color.substring(5, 7), 16));
        color = RGBtoHex(red, green, blue);

        // Add background layer for the route
        map.addLayer({
            'id': this.selectedRoutes[toShow].full + "bg",
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': color,
                'line-width': 5
            }
        })

        // Add main layer for the route
        map.addLayer({
            'id': this.selectedRoutes[toShow].full,
            'type': 'line',
            'source': this.selectedRoutes[toShow].full,
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': this.selectedRoutes[toShow].color,
                'line-width': 5
            }
        })
    }

    // Commented out code for adding markers at each coordinate of the route
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
}

// Constants for sizing
const ratio = 2;
const busRatio = 3;
var zoomb = map.getZoom();

// Function to adjust sizes of map elements based on zoom level
function fixSizes() {
    // Adjust route line widths
    for (var mapRoute of this.currentRoutes) {
        map.setPaintProperty(mapRoute, 'line-width', (ratio * zoomb) / 5);
        map.setPaintProperty(mapRoute + "bg", 'line-width', (ratio * zoomb) / 5);
    }

    // Adjust stop marker sizes
    for (var marker of document.querySelectorAll('.stopMarker')) {
        for (var svug of marker.childNodes) {
            marker.setAttribute('style', `height: ${(zoomb * ratio).toString()}px; width: ${(zoomb * ratio).toString()}px;`)
            $(svug).attr('height', (zoomb * ratio).toString() + "px");
            $(svug).attr('width', (ratio * zoomb).toString() + "px")
        }
    }

    // Adjust bus marker sizes
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

// Function to lighten a color value
function lighten(what) {
    var temp = what;
    temp += 120;
    if (temp > 255) {
        temp = 255;
    }
    return temp;
}

// Function to render the route details in the UI
function renderRoute(routeName) {
    // Create a new div to hold the route details
    var newNode = document.getElementById(routeName).appendChild(document.createElement('div'))
    var inner = newNode.appendChild(document.createElement('ol'));
    inner.setAttribute('style', 'font-weight: lighter; font-size: 2.25vh');
    var paath = this.routesReal[routeName].path;

    // Add each stop in the route as a list item
    for (let stop of paath) {
        inner.appendChild(document.createElement('li'));
        // Add click event to show the stop on the map
        inner.lastChild.addEventListener('click', function() { showStopOnMap(this.stopsHashMap[stop[1]]) }.bind(this));
        inner.lastChild.innerText = this.stopsHashMap[stop[1]];
    }
    // Hide the route details initially
    $(newNode).hide();
}

var stopMarkers = []

// Function to render a circular marker for a stop on the map
function renderCircle(routeList, stopName) {
    let routList = [];
    // Create a deep copy of routesReal to avoid modifying the original
    let bruhMoment = JSON.parse(JSON.stringify(this.routesReal));

    // Filter for active routes
    for (var routte of routeList) {
        var hello = bruhMoment[routte].active;
        if (hello) {
            routList.push(routte);
        }
    }

    // Create the marker element
    let svg = document.createElement('div');
    svg.className = 'stopMarker';
    svg.id = 'stop: ' + stopName;
    let inner = '';

    // Generate SVG for the marker
    if (routList.length > 0) {
        // Create a pie chart-like SVG if there are active routes
        for (var i = 0; i < routList.length; i++) {
            inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "${bruhMoment[routList[i]].color}" stroke="#FFFFFF" stroke-width="0.3em">\n`
            inner += "<path d='" + arc({ x: 0, y: 0, r: 50, start: ((360 / routList.length) * i), end: ((360 / routList.length) * (i + 1)) }) + "'></path>\n";
            inner += '</svg>\n';
        }
    } else {
        // Create a grey circle if there are no active routes
        inner += `<svg height='20px' width='20px' style="position: absolute;" viewbox="-50 -50 100 100" fill= "#888888" stroke="#FFFFFF" stroke-width="0.3em">\n`
        inner += "<path d='" + arc({ x: 0, y: 0, r: 50 }) + "'></path>\n";
        inner += '</svg>\n';
    }
    svg.innerHTML = inner;

    // Add click event to show stop details
    svg.addEventListener('click', function() { showStopDetails(stopName) }.bind(this));

    // Check if a marker already exists at this location
    for (var marekr of stopMarkers) {
        if (marekr.getLngLat().lng === stopsReal[stopName].long && marekr.getLngLat().lat === stopsReal[stopName].lat) {
            // If exists, add new marker with slight offset
            this.stopMarkers.push(new mapboxgl.Marker(svg).setLngLat([stopsReal[stopName].long + 0.00003, stopsReal[stopName].lat]).addTo(map));
            return;
        }
    }
    // If no existing marker, add new marker at exact location
    this.stopMarkers.push(new mapboxgl.Marker(svg).setLngLat([stopsReal[stopName].long, stopsReal[stopName].lat]).addTo(map));
}

// Function to display details of a selected stop
function showStopDetails(stopName) {
    $("#stopContainer").show();
    var closestBuses = {};

    // Find the closest bus for each route serving this stop
    for (var rout of this.stopsReal[stopName].routes) {
        var stobbe = this.stopsReal[stopName].iAmThisPoint[rout];
        if (this.routesReal[rout].buses.length > 0) {
            // Initialize with the first bus on the route
            closestBuses[rout] = {
                timeTill: getETA(rout, this.busesReal[this.routesReal[rout].buses[0]].speed, this.busesReal[this.routesReal[rout].buses[0]].pointOnPath, stobbe, this.routesReal[rout].buses[0]).toFixed(1),
                bus: this.routesReal[rout].buses[0],
            };
            // Check all buses on the route to find the closest one
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

    // Update the UI with stop details
    var conty = document.getElementById('stopContainer');
    $(conty.firstElementChild).html(stopName);
    conty.lastElementChild.innerHTML = "";

    // Add information for each closest bus
    for (let bu of Object.keys(closestBuses)) {
        conty.childNodes[6].appendChild(document.createElement('div'));
        conty.childNodes[6].lastChild.className = busItem;
        conty.childNodes[6].lastChild.style.borderColor = this.routesReal[bu].color;
        if (closestBuses[bu].timeTill == 0) {
            conty.childNodes[6].lastChild.innerText = bu + ": " + closestBuses[bu].bus + " has arrived.";
        } else {
            conty.childNodes[6].lastChild.innerText = bu + ": " + closestBuses[bu].bus + " in " + (closestBuses[bu].timeTill / 60).toFixed(1) + " mins @ " + (busesReal[closestBuses[bu].bus].speed * 2.23694).toFixed(2) + "mph"
        }
        // Add click event to show the bus on the map
        conty.childNodes[6].lastChild.addEventListener('click', function() { showBusOnMap(closestBuses[bu].bus) }.bind(this))
    }
}
// Function to center the map on a specific stop
function showStopOnMap(stopName) {
    // Hide the stops and routes lists
    $("#stopsList").hide();
    $("#routesList").hide();
    // Set the map center to the selected stop's coordinates
    map.setCenter([this.stopsReal[stopName].long, this.stopsReal[stopName].lat])
        // Zoom in on the stop
    map.setZoom(16);
}

// Function to filter the buses list based on user input
function filterBuses(bus) {
    var bussy = document.getElementById('busSearch').value;
    var busess = $($("#busesList").find('[class="popupList withSearch"]')[0]).find('div');
    if (bussy === "") {
        // If search input is empty, show all buses
        for (var item of Object.keys(busess)) {
            if (typeof busess[item] === "object") {
                $(busess[item]).show();
            }
        }
    } else {
        // If there's a search term, filter buses
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

// Function to filter the stops list based on user input
function filterStops(stop) {
    stop = document.getElementById('stopSearch').value;
    var stopss = $($("#stopsList").find('[class="popupList withSearch"]')[0]).find('div');
    if (stop === "") {
        // If search input is empty, show all stops
        for (var item of Object.keys(stopss)) {
            if (typeof stopss[item] === "object") {
                $(stopss[item]).show();
            }
        }
    } else {
        // If there's a search term, filter stops
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

// Variables for traffic data and route lines
var trafficData = {};
var allLines = [];
var madeLines = false;

// Function to calculate Estimated Time of Arrival (ETA) for a bus
function getETA(route, speed, start, end, bus) {
    var toRet;
    if (start === end) {
        return 0;
    }
    console.log(turf.distance(turf.point(this.routesReal[route].coords[start]), turf.point(this.routesReal[route].coords[end]), { units: 'kilometers' }).toFixed(1) + "km distance betweeen start and stop of bus " + bus + 'points: ' + start + " " + end);

    // If the distance is very small, consider it as arrived
    if (turf.distance(turf.point(this.routesReal[route].coords[start]), turf.point(this.routesReal[route].coords[end]), { units: 'kilometers' }) < 0.05) {
        return 0;
    }
    try {
        if (end < start) {
            // If end point is before start point, calculate distance going through the end of the route
            toRet = (turf.length(turf.lineString(this.routesReal[route].coords.slice(start, this.routesReal[route].coords.length - 1).concat(this.routesReal[route].coords.slice(0, end))), { units: 'kilometers' }) * 1000) / speed;
        } else {
            // Calculate distance directly from start to end
            toRet = (turf.length(turf.lineString(this.routesReal[route].coords.slice(start, end + 1)), { units: 'kilometers' }) * 1000) / speed;
        }
    } catch (e) {
        if (e.message == "coordinates must be an array of two or more positions") {
            toRet = 0;
        }
    }
    return toRet;
}
//--------------------------------------------------------------------------------------------------

// Function to calculate a point on a circle given center (x, y), radius r, and angle
const point = (x, y, r, angel) => [
    (x + Math.sin(angel) * r).toFixed(2),
    (y - Math.cos(angel) * r).toFixed(2),
];

// Function to create a full circle SVG path
const full = (x, y, R, r) => {
    if (r <= 0) {
        // If inner radius is 0 or negative, create a full circle
        return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} Z`;
    }
    // Create a donut shape (circle with inner circle cut out)
    return `M ${x - R} ${y} A ${R} ${R} 0 1 1 ${x + R} ${y} A ${R} ${R} 1 1 1 ${x - R} ${y} M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 1 1 1 ${x - r} ${y} Z`;
};

// Function to create a partial arc SVG path
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

// Main function to generate an arc SVG path
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

// Function to convert a color value to hexadecimal
function colorToHex(color) {
    var hexadecimal = color.toString(16);
    return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
}

// Function to convert RGB values to a hexadecimal color code
const RGBtoHex = (red, green, blue) => {
    return "#" + colorToHex(red) + colorToHex(green) + colorToHex(blue);
}

// Array of dash patterns for creating animated line effects
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

// Variable to keep track of the current step in the dash array sequence
let step = 0;
// Function to animate the dash array of route lines
function animateDashArray(timestamp) {
    // Calculate the new step based on the timestamp
    // The divisor (50) controls the animation speed
    const newStep = parseInt(
        (timestamp / 50) % dashArraySequence.length
    );

    // If the step has changed, update the line-dasharray for all current routes
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

    // Request the next frame of the animation
    requestAnimationFrame(animateDashArray);
}

// Start the dash array animation
animateDashArray(0);

// Extend Array prototype with a method to remove an item at a specific index
Array.prototype.removeAt = function(iIndex) {
    var vItem = this[iIndex];
    if (vItem) {
        this.splice(iIndex, 1);
    }
    return vItem;
};

// Function to generate a series of points between two coordinates
function generateMovement(startPoint, endPoint) {
    var speedFactor = 100;
    // Calculate the difference in longitude and latitude
    var difflong = endPoint[0] - startPoint[0];
    var difflat = endPoint[1] - startPoint[1];

    // Calculate step factors for longitude and latitude
    var sflong = difflong / speedFactor;
    var sflat = difflat / speedFactor;

    var lineCoordinates = [];

    // Generate 100 points between start and end points
    for (let i = 0; i < 100; i++) {
        lineCoordinates.push([
            startPoint[0] + (sflong * (i + 1)),
            startPoint[1] + (sflat * (i + 1))
        ])
    }

    return lineCoordinates;
}

// Promise-based function to pause execution for a specified number of milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}