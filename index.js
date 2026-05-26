/* global mapboxgl */

const PASSIO_SYSTEM_ID = "2343";
const PASSIO_BASE_URL = "https://passio3.com/www/mapGetData.php";
const PASSIO_SERVICE_URL = "https://passio3.com/www/goServices.php";
const REFRESH_INTERVAL_MS = 10000;
const REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_ETA_SPEED_MPS = 6.7;
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibnBpbnRvLXJ1IiwiYSI6ImNsbHhzc3p4YTIwengza3MyN2dpZHo0MjMifQ.htwTQMFArOxMhPV0vnNpXg";
const MAP_CENTER = [-82.4178, 28.0624];
const MAP_SERVICE_BOUNDS = {
    southwest: [-82.445, 28.037],
    northeast: [-82.394, 28.086]
};

const ROUTE_FALLBACK_COLORS = {
    blue: "#1d9dd9",
    green: "#006747",
    orange: "#f9ac1b",
    purple: "#b7569e",
    plum: "#8f0154",
    red: "#eb1b00",
    brown: "#81492c"
};

const state = {
    routes: new Map(),
    stops: new Map(),
    stopsById: new Map(),
    buses: new Map(),
    alerts: [],
    stopMarkers: new Map(),
    busMarkers: new Map(),
    selectedRoutes: new Set(),
    expandedRoutes: new Set(),
    routeLayerIds: new Set(),
    activeStopName: "",
    selectedBusId: "",
    refreshTimer: null,
    loaded: false,
    deviceId: `bullsgo-${Math.floor(Math.random() * 100000000)}`
};

const els = {};
let map = null;

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindUi();

    map = createTransitMap();

    if (!map) {
        setStatus("error", "Map did not load", "Mapbox was not available. Refresh the page and try again.");
        return;
    }

    if (map.loaded()) {
        initialise();
    } else {
        map.on("load", initialise);
    }
});

function createTransitMap() {
    if (typeof mapboxgl === "undefined") {
        return null;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const serviceBounds = new mapboxgl.LngLatBounds(
        MAP_SERVICE_BOUNDS.southwest,
        MAP_SERVICE_BOUNDS.northeast
    );

    const transitMap = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/light-v11",
        maxBounds: serviceBounds,
        minZoom: 12.85,
        zoom: 14.1,
        center: MAP_CENTER
    });

    transitMap.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        }),
        "bottom-left"
    );

    transitMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    window.bullsMap = transitMap;
    return transitMap;
}

function cacheElements() {
    els.status = document.getElementById("status");
    els.routeCount = document.getElementById("routeCount");
    els.busCount = document.getElementById("busCount");
    els.lastUpdated = document.getElementById("lastUpdated");
    els.alertCount = document.getElementById("alertCount");
    els.stopSearch = document.getElementById("stopSearch");
    els.busSearch = document.getElementById("busSearch");
    els.panels = Array.from(document.querySelectorAll(".sheetPanel"));
    els.controlButtons = Array.from(document.querySelectorAll("[data-panel-target]"));
    els.routesList = document.querySelector("#routesList .popupList");
    els.stopsList = document.querySelector("#stopsList .popupList");
    els.busesList = document.querySelector("#busesList .popupList");
    els.alertsList = document.querySelector("#alertsList .popupList");
    els.legendList = document.querySelector("#routeLegend .legendList");
    els.stopPanel = document.getElementById("stopContainer");
    els.stopPanelTitle = document.querySelector("#stopContainer .popupTitle");
    els.stopPanelList = document.querySelector("#stopContainer .popupList");
}

function bindUi() {
    els.controlButtons.forEach((button) => {
        button.addEventListener("click", () => openPanel(button.dataset.panelTarget));
    });

    document.querySelectorAll("[data-close-panel]").forEach((button) => {
        button.addEventListener("click", () => {
            const panel = button.closest(".sheetPanel");
            if (panel) {
                closePanel(panel.id);
            }
        });
    });

    els.stopSearch.addEventListener("input", renderStopList);
    els.busSearch.addEventListener("input", renderBusList);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAllPanels();
            hideAllBusDetails();
        }
    });
}

async function initialise() {
    setStatus("loading", "Loading Bull Runner data", "Connecting to Passio for current routes, stops, buses, and service alerts.");

    try {
        const [routeData, stopData, alertData] = await Promise.all([
            fetchRoutes(),
            fetchStops(),
            fetchAlerts()
        ]);

        loadRoutes(routeData);
        loadStops(stopData);
        loadAlerts(alertData);
        renderRouteList();
        renderStopList();
        renderAlerts();
        renderLegend();
        renderAllStops();
        await refreshBuses({ initial: true });

        state.loaded = true;
        hideStatus();
        updateCounts();

        state.refreshTimer = window.setInterval(() => {
            refreshBuses().catch((error) => {
                setStatus("error", "Live bus refresh failed", cleanError(error));
            });
        }, REFRESH_INTERVAL_MS);

        map.on("zoomend", updateRouteLineWidths);
    } catch (error) {
        setStatus("error", "Passio data is unavailable", cleanError(error));
        renderEmpty(els.routesList, "Unable to load routes", "Passio did not return route data.");
        renderEmpty(els.stopsList, "Unable to load stops", "Passio did not return stop data.");
        renderEmpty(els.busesList, "Unable to load buses", "Live vehicle data is unavailable.");
        updateCounts();
    }
}

async function refreshBuses(options = {}) {
    const busData = await fetchBuses();
    loadBuses(busData);
    renderRouteList();
    renderBusList();
    renderLegend();
    updateBusMarkers();
    updateBusVisibility();
    updateCounts(busData.time && busData.time[PASSIO_SYSTEM_ID]);

    if (state.activeStopName) {
        renderStopDetails(state.activeStopName);
    }

    if (!options.initial && state.loaded) {
        hideStatus();
    }
}

async function postPassio(baseUrl, query, payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const params = new URLSearchParams(query);
    const body = new URLSearchParams({
        json: JSON.stringify(payload)
    });

    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Passio responded with ${response.status}`);
        }

        const text = await response.text();
        const data = JSON.parse(text);

        if (data && !Array.isArray(data) && data.error) {
            throw new Error(data.error);
        }

        return data;
    } finally {
        window.clearTimeout(timeout);
    }
}

function fetchRoutes() {
    return postPassio(
        PASSIO_BASE_URL,
        {
            getRoutes: "1",
            deviceId: state.deviceId,
            wTransloc: "1"
        },
        {
            systemSelected0: PASSIO_SYSTEM_ID,
            amount: 1
        }
    );
}

function fetchStops() {
    return postPassio(
        PASSIO_BASE_URL,
        {
            getStops: "1",
            deviceId: state.deviceId,
            wTransloc: "1"
        },
        {
            s0: PASSIO_SYSTEM_ID,
            sA: 1
        }
    );
}

function fetchBuses() {
    return postPassio(
        PASSIO_BASE_URL,
        {
            getBuses: "1",
            deviceId: state.deviceId,
            wTransloc: "1"
        },
        {
            s0: PASSIO_SYSTEM_ID,
            sA: 1
        }
    );
}

function fetchAlerts() {
    return postPassio(
        PASSIO_SERVICE_URL,
        {
            getAlertMessages: "1",
            deviceId: state.deviceId
        },
        {
            systemSelected0: PASSIO_SYSTEM_ID,
            amount: 1
        }
    );
}

function loadRoutes(routeData) {
    state.routes.clear();

    if (!Array.isArray(routeData)) {
        throw new Error("Routes response had an unexpected shape.");
    }

    routeData.forEach((route) => {
        if (String(route.archive) === "1") {
            return;
        }

        const name = route.nameOrig || route.name || `Route ${route.myid}`;
        const color = normalizeColor(route.color || route.groupColor, name);

        state.routes.set(name, {
            id: String(route.myid || route.id || name),
            name,
            shortName: normalizeShortName(route.shortName, name),
            color,
            center: toLngLat(route.longitude, route.latitude),
            distance: Number(route.distance) || 0,
            serviceTime: route.serviceTimeShort || route.serviceTime || "",
            outdated: String(route.outdated) === "1",
            pathRows: [],
            coords: [],
            stopIndices: new Map(),
            buses: new Set(),
            active: false
        });
    });
}

function loadStops(stopData) {
    state.stops.clear();
    state.stopsById.clear();

    if (!stopData || !stopData.routes || !stopData.stops) {
        throw new Error("Stops response had an unexpected shape.");
    }

    Object.keys(stopData.stops).forEach((key) => {
        const stop = stopData.stops[key];
        const name = stop.name || `Stop ${stop.id || key}`;
        const position = toLngLat(stop.longitude, stop.latitude);

        if (!position || !isCampusPosition(position)) {
            return;
        }

        const model = {
            id: String(stop.id || key),
            name,
            position,
            routes: new Set(),
            routeIndices: new Map()
        };

        state.stops.set(name, model);
        state.stopsById.set(model.id, model);
    });

    Object.keys(stopData.routes).forEach((routeKey) => {
        const routeRows = stopData.routes[routeKey];
        const rawRouteName = routeRows && routeRows[0];
        if (!rawRouteName) {
            return;
        }

        const routeName = resolveRouteName(rawRouteName, routeKey);
        const route = ensureRoute(routeName, routeKey);
        route.pathRows = routeRows.slice(2);

        const points = (stopData.routePoints && (stopData.routePoints[route.id] || stopData.routePoints[routeKey])) || [];
        route.coords = points
            .map((point) => toLngLat(point.lng, point.lat))
            .filter(Boolean);

        route.pathRows.forEach((row) => {
            const stop = state.stopsById.get(String(row[1]));
            if (stop) {
                stop.routes.add(route.name);
            }
        });
    });

    state.routes.forEach((route) => {
        route.stopIndices.clear();

        if (!route.coords.length) {
            return;
        }

        route.pathRows.forEach((row) => {
            const stop = state.stopsById.get(String(row[1]));
            if (!stop) {
                return;
            }

            const index = findClosestRouteIndex(route.coords, stop.position);
            route.stopIndices.set(index, stop.name);
            stop.routeIndices.set(route.name, index);
        });
    });
}

function loadAlerts(alertData) {
    const messages = (alertData && Array.isArray(alertData.msgs)) ? alertData.msgs : [];

    state.alerts = messages.map((message) => ({
        id: String(message.id || message.createdF || message.name || Math.random()),
        heading: message.name || "Service alert",
        message: stripHtml(message.html || message.message || ""),
        time: message.createdF || ""
    }));
}

function loadBuses(busData) {
    const now = Date.now();
    const seen = new Set();

    state.routes.forEach((route) => {
        route.buses.clear();
        route.active = false;
    });

    const buses = busData && busData.buses ? busData.buses : {};

    Object.keys(buses).forEach((deviceId) => {
        const entries = Array.isArray(buses[deviceId]) ? buses[deviceId] : [];

        entries.forEach((entry) => {
            const busId = String(entry.busName || entry.bus || entry.busId || deviceId);
            const routeName = entry.route || "Unassigned";
            const route = ensureRoute(routeName, entry.routeId);
            const position = toLngLat(entry.longitude, entry.latitude);

            if (!position) {
                return;
            }

            const active = Number(entry.outOfService) !== 1 && String(entry.outdated) !== "1";
            const color = normalizeColor(entry.color || route.color, routeName);
            const previous = state.buses.get(busId);
            const speedMps = getObservedSpeed(previous, position, now);
            const occupancy = getOccupancy(entry.paxLoad, entry.totalCap);

            route.color = color || route.color;

            const bus = {
                id: busId,
                deviceId: String(deviceId),
                routeName,
                routeId: String(entry.routeId || route.id),
                color: color || route.color,
                position,
                active,
                bearing: Number(entry.calculatedCourse) || 0,
                occupancy,
                passengerLoad: Number(entry.paxLoad),
                capacity: Number(entry.totalCap),
                type: entry.busType || "",
                updatedTime: entry.createdTime || entry.created || "",
                speedMps,
                lastSeenAt: now,
                pointOnPath: 0,
                nextStop: null
            };

            setBusRouteProgress(bus);
            state.buses.set(busId, bus);
            seen.add(busId);

            if (active && !route.outdated) {
                route.buses.add(busId);
                route.active = true;
            }
        });
    });

    Array.from(state.buses.keys()).forEach((busId) => {
        if (!seen.has(busId)) {
            removeBusMarker(busId);
            state.buses.delete(busId);
        }
    });
}

function ensureRoute(routeName, routeId) {
    if (state.routes.has(routeName)) {
        return state.routes.get(routeName);
    }

    const route = {
        id: String(routeId || routeName),
        name: routeName,
        shortName: normalizeShortName("", routeName),
        color: normalizeColor("", routeName),
        center: null,
        distance: 0,
        serviceTime: "",
        outdated: false,
        pathRows: [],
        coords: [],
        stopIndices: new Map(),
        buses: new Set(),
        active: false
    };

    state.routes.set(routeName, route);
    return route;
}

function resolveRouteName(routeName, routeId) {
    if (state.routes.has(routeName)) {
        return routeName;
    }

    const cleanName = String(routeName || "").replace(/^Route\s+/i, "").trim();
    if (cleanName && state.routes.has(cleanName)) {
        return cleanName;
    }

    const byId = Array.from(state.routes.values()).find((route) => route.id === String(routeId));
    return byId ? byId.name : routeName;
}

function renderRouteList() {
    const routes = Array.from(state.routes.values())
        .sort((a, b) => {
            const activeDiff = Number(b.active) - Number(a.active);
            if (activeDiff !== 0) {
                return activeDiff;
            }
            return a.name.localeCompare(b.name);
        });

    els.routesList.replaceChildren();

    if (!routes.length) {
        renderEmpty(els.routesList, "No routes found", "Passio did not return any Bull Runner routes.");
        return;
    }

    routes.forEach((route) => {
        const row = document.createElement("div");
        row.className = "routeRow";
        row.style.setProperty("--route-color", route.color);

        if (state.expandedRoutes.has(route.name)) {
            row.classList.add("is-expanded");
        }

        const item = document.createElement("button");
        item.type = "button";
        item.className = "popupItem route";
        if (!route.active) {
            item.classList.add("is-muted");
        }
        item.addEventListener("click", () => {
            toggleRouteExpanded(route.name);
            focusRoute(route.name);
        });

        const title = document.createElement("div");
        title.className = "itemTitle";
        title.append(createRouteTitle(route));
        title.append(createBusBadge(route));

        const meta = document.createElement("div");
        meta.className = "itemMeta";
        meta.textContent = getRouteMeta(route);

        item.append(title, meta);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "routeSelector";
        toggle.setAttribute("aria-label", `${state.selectedRoutes.has(route.name) ? "Hide" : "Show"} ${route.name} route`);
        toggle.setAttribute("aria-pressed", String(state.selectedRoutes.has(route.name)));
        toggle.addEventListener("click", () => toggleRouteSelection(route.name));

        const stops = document.createElement("div");
        stops.className = "routeStops";
        renderRouteStops(route, stops);

        row.append(item, toggle, stops);
        els.routesList.append(row);
    });
}

function renderRouteStops(route, container) {
    const stops = route.pathRows
        .map((row) => state.stopsById.get(String(row[1])))
        .filter(Boolean);

    if (!stops.length) {
        const empty = document.createElement("div");
        empty.className = "itemMeta";
        empty.textContent = "Stop list unavailable for this route.";
        container.append(empty);
        return;
    }

    stops.forEach((stop) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = stop.name;
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            showStopOnMap(stop.name);
        });
        container.append(button);
    });
}

function renderStopList() {
    const query = els.stopSearch.value.trim().toLowerCase();
    const stops = Array.from(state.stops.values())
        .filter((stop) => {
            if (!query) {
                return true;
            }
            const routeNames = Array.from(stop.routes).join(" ").toLowerCase();
            return stop.name.toLowerCase().includes(query) || routeNames.includes(query);
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    els.stopsList.replaceChildren();

    if (!stops.length) {
        renderEmpty(els.stopsList, "No stops match", "Try a stop name, building, or route color.");
        return;
    }

    stops.forEach((stop) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "popupItem stop";
        item.addEventListener("click", () => showStopOnMap(stop.name));

        const title = document.createElement("div");
        title.className = "itemTitle";
        title.textContent = stop.name;

        const meta = document.createElement("div");
        meta.className = "itemMeta";
        meta.textContent = `${stop.routes.size || 0} route${stop.routes.size === 1 ? "" : "s"} serving this stop`;

        item.append(title, meta, createRouteChips(stop.routes));
        els.stopsList.append(item);
    });
}

function renderBusList() {
    const query = els.busSearch.value.trim().toLowerCase();
    const hasRouteFilter = state.selectedRoutes.size > 0;
    const buses = Array.from(state.buses.values())
        .filter((bus) => bus.active)
        .filter((bus) => !hasRouteFilter || state.selectedRoutes.has(bus.routeName))
        .filter((bus) => {
            if (!query) {
                return true;
            }
            return bus.id.toLowerCase().includes(query) || bus.routeName.toLowerCase().includes(query);
        })
        .sort((a, b) => a.routeName.localeCompare(b.routeName) || a.id.localeCompare(b.id));

    els.busesList.replaceChildren();

    if (!buses.length) {
        renderEmpty(els.busesList, "No live buses found", hasRouteFilter ? "No selected routes have live buses right now." : "Passio is not reporting live buses right now.");
        return;
    }

    buses.forEach((bus) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "busItem";
        item.style.setProperty("--route-color", bus.color);
        item.addEventListener("click", () => showBusOnMap(bus.id));

        const title = document.createElement("div");
        title.className = "itemTitle";
        title.textContent = `Bus ${bus.id}`;
        title.append(createSmallText(bus.routeName));

        const meta = document.createElement("div");
        meta.className = "itemMeta";
        meta.textContent = `${formatOccupancy(bus.occupancy)} occupancy. Updated ${bus.updatedTime || "recently"}. ${formatNextStop(bus)}`;

        item.append(title, meta);
        els.busesList.append(item);
    });
}

function renderAlerts() {
    els.alertsList.replaceChildren();

    if (!state.alerts.length) {
        renderEmpty(els.alertsList, "No current alerts", "No service alerts are posted for Bull Runner right now.");
        return;
    }

    state.alerts.forEach((alert) => {
        const item = document.createElement("div");
        item.className = "popupItem alert";

        const title = document.createElement("div");
        title.className = "itemTitle";
        title.textContent = alert.heading;

        const meta = document.createElement("div");
        meta.className = "itemMeta";
        meta.textContent = [alert.time, alert.message].filter(Boolean).join(" ");

        item.append(title, meta);
        els.alertsList.append(item);
    });
}

function renderLegend() {
    if (!els.legendList) {
        return;
    }

    const routes = Array.from(state.routes.values())
        .filter((route) => route.pathRows.length || route.active)
        .sort((a, b) => {
            const activeDiff = Number(b.active) - Number(a.active);
            if (activeDiff !== 0) {
                return activeDiff;
            }
            return a.name.localeCompare(b.name);
        });

    els.legendList.replaceChildren();

    routes.forEach((route) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "legendItem";
        item.style.setProperty("--route-color", route.color);
        item.classList.toggle("is-selected", state.selectedRoutes.has(route.name));
        item.setAttribute("aria-pressed", String(state.selectedRoutes.has(route.name)));
        item.setAttribute("aria-label", `${state.selectedRoutes.has(route.name) ? "Hide" : "Show"} ${route.name}`);
        item.addEventListener("click", () => toggleRouteSelection(route.name));

        const swatch = document.createElement("span");
        swatch.className = "legendSwatch";

        const name = document.createElement("span");
        name.className = "legendName";
        name.textContent = route.name;

        const count = document.createElement("span");
        count.className = "legendCount";
        count.textContent = route.buses.size ? String(route.buses.size) : "";

        item.append(swatch, name, count);
        els.legendList.append(item);
    });
}

function renderAllStops() {
    state.stopMarkers.forEach((marker) => marker.remove());
    state.stopMarkers.clear();

    state.stops.forEach((stop) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "stopMarker";
        element.id = `stop-${safeDomId(stop.name)}`;
        element.setAttribute("aria-label", `Show ${stop.name} arrivals`);
        element.style.setProperty("--stop-color", getPrimaryStopColor(stop));
        element.replaceChildren(createStopMarkerContent(stop));
        element.addEventListener("click", () => renderStopDetails(stop.name, { open: true }));

        const marker = new mapboxgl.Marker({ element })
            .setLngLat(stop.position)
            .addTo(map);

        state.stopMarkers.set(stop.name, marker);
    });
}

function updateBusMarkers() {
    state.buses.forEach((bus) => {
        if (!bus.active) {
            removeBusMarker(bus.id);
            return;
        }

        let marker = state.busMarkers.get(bus.id);

        if (!marker) {
            const element = createBusMarkerElement(bus);
            marker = new mapboxgl.Marker({ element })
                .setLngLat(bus.position)
                .addTo(map);
            state.busMarkers.set(bus.id, marker);
            element.classList.add("is-new");
            window.setTimeout(() => element.classList.remove("is-new"), 900);
        } else {
            animateMarkerTo(marker, bus.position);
        }

        renderBusMarker(marker.getElement(), bus);
    });
}

function createBusMarkerElement(bus) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "busMarker";
    element.setAttribute("aria-label", `Show bus ${bus.id} details`);
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        selectBus(bus.id, { fly: false, open: !element.classList.contains("is-open") });
    });

    const glyph = document.createElement("div");
    glyph.className = "busGlyph";

    const pulse = document.createElement("span");
    pulse.className = "busPulse";
    pulse.setAttribute("aria-hidden", "true");

    const body = document.createElement("span");
    body.className = "busBody";
    body.setAttribute("aria-hidden", "true");

    const icon = createBusIcon();

    const number = document.createElement("span");
    number.className = "busNumber";
    number.textContent = bus.id;

    body.append(icon);
    glyph.append(pulse, body, number);

    const detail = document.createElement("div");
    detail.className = "busDetail";

    element.append(glyph, detail);
    renderBusMarker(element, bus);
    return element;
}

function createBusIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "busIcon");
    svg.setAttribute("viewBox", "0 0 28 28");
    svg.setAttribute("aria-hidden", "true");

    const windshield = document.createElementNS("http://www.w3.org/2000/svg", "path");
    windshield.setAttribute("class", "busIconWindow");
    windshield.setAttribute("d", "M8.5 8.25h11c1.05 0 1.9.85 1.9 1.9v3.8H6.6v-3.8c0-1.05.85-1.9 1.9-1.9Z");

    const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
    body.setAttribute("class", "busIconBody");
    body.setAttribute("d", "M7.7 6.4h12.6c1.65 0 3 1.35 3 3v8.4c0 1.2-.98 2.18-2.18 2.18h-.48v1.52c0 .6-.48 1.08-1.08 1.08h-1.18c-.6 0-1.08-.48-1.08-1.08v-1.52H10.7v1.52c0 .6-.48 1.08-1.08 1.08H8.44c-.6 0-1.08-.48-1.08-1.08v-1.52h-.48c-1.2 0-2.18-.98-2.18-2.18V9.4c0-1.65 1.35-3 3-3Zm.18 10.4a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84Zm12.24 0a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84Z");

    const centerLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    centerLine.setAttribute("class", "busIconLine");
    centerLine.setAttribute("d", "M14 8.25v5.7");

    svg.append(body, windshield, centerLine);
    return svg;
}

function renderBusMarker(element, bus) {
    element.style.setProperty("--route-color", bus.color);
    element.classList.toggle("is-selected", state.selectedBusId === bus.id);

    const pointer = element.querySelector(".busPointer");
    const busNumber = element.querySelector(".busNumber");
    const detail = element.querySelector(".busDetail");

    if (pointer) {
        pointer.style.transform = `rotate(${bus.bearing}deg)`;
    }

    if (busNumber) {
        busNumber.textContent = bus.id;
    }

    if (detail) {
        detail.replaceChildren();

        const heading = document.createElement("h4");
        heading.textContent = `Bus ${bus.id}: ${bus.routeName}`;

        const body = document.createElement("p");
        body.textContent = `${formatNextStop(bus)} ${formatOccupancy(bus.occupancy)} occupied. Updated ${bus.updatedTime || "recently"}.`;

        const close = document.createElement("button");
        close.type = "button";
        close.className = "x";
        close.setAttribute("aria-label", `Close bus ${bus.id} details`);
        close.append(createIconImage("assets/x.svg"));
        close.addEventListener("click", (event) => {
            event.stopPropagation();
            element.classList.remove("is-open");
        });

        detail.append(heading, body, close);
    }
}

function animateMarkerTo(marker, targetPosition) {
    const current = marker.getLngLat();
    const start = [current.lng, current.lat];
    const distance = distanceBetweenCoordsKm(start, targetPosition);
    const element = marker.getElement();

    if (!Number.isFinite(distance) || distance < 0.002) {
        marker.setLngLat(targetPosition);
        return;
    }

    if (marker.__animationFrame) {
        cancelAnimationFrame(marker.__animationFrame);
    }

    const duration = 850;
    const startedAt = performance.now();
    element.classList.add("is-updating");

    const step = (now) => {
        const rawProgress = Math.min((now - startedAt) / duration, 1);
        const progress = easeOutCubic(rawProgress);
        marker.setLngLat([
            start[0] + ((targetPosition[0] - start[0]) * progress),
            start[1] + ((targetPosition[1] - start[1]) * progress)
        ]);

        if (rawProgress < 1) {
            marker.__animationFrame = requestAnimationFrame(step);
            return;
        }

        marker.setLngLat(targetPosition);
        marker.__animationFrame = null;
        window.setTimeout(() => element.classList.remove("is-updating"), 250);
    };

    marker.__animationFrame = requestAnimationFrame(step);
}

function removeBusMarker(busId) {
    const marker = state.busMarkers.get(busId);
    if (marker) {
        marker.remove();
        state.busMarkers.delete(busId);
    }
}

function renderStopDetails(stopName, options = {}) {
    const stop = state.stops.get(stopName);
    if (!stop) {
        return;
    }

    state.activeStopName = stopName;
    els.stopPanelTitle.textContent = stop.name;
    els.stopPanelList.replaceChildren();

    const routeNames = Array.from(stop.routes).sort();

    if (!routeNames.length) {
        renderEmpty(els.stopPanelList, "No routes at this stop", "Passio does not list any route service here.");
    } else {
        routeNames.forEach((routeName) => {
            const route = state.routes.get(routeName);
            const item = document.createElement("button");
            item.type = "button";
            item.className = "busItem";
            item.style.setProperty("--route-color", route ? route.color : normalizeColor("", routeName));

            const best = findClosestBusForStop(routeName, stop);

            const title = document.createElement("div");
            title.className = "itemTitle";
            title.textContent = routeName;

            const meta = document.createElement("div");
            meta.className = "itemMeta";

            if (best) {
                title.append(createSmallText(`Bus ${best.bus.id}`));
                meta.textContent = `${formatEta(best.etaSeconds)}. ${formatOccupancy(best.bus.occupancy)} occupied. Updated ${best.bus.updatedTime || "recently"}.`;
                item.addEventListener("click", () => showBusOnMap(best.bus.id));
            } else {
                item.classList.add("is-muted");
                meta.textContent = "No live bus reporting for this route right now.";
            }

            item.append(title, meta);
            els.stopPanelList.append(item);
        });
    }

    if (options.open) {
        openPanel("stopContainer");
    }
}

function findClosestBusForStop(routeName, stop) {
    const route = state.routes.get(routeName);
    const stopIndex = stop.routeIndices.get(routeName);

    if (!route || stopIndex === undefined) {
        return null;
    }

    const candidates = Array.from(route.buses)
        .map((busId) => state.buses.get(busId))
        .filter((bus) => bus && bus.active && bus.routeName === routeName)
        .map((bus) => ({
            bus,
            etaSeconds: estimateEta(route, bus, stopIndex)
        }))
        .filter((entry) => Number.isFinite(entry.etaSeconds))
        .sort((a, b) => a.etaSeconds - b.etaSeconds);

    return candidates[0] || null;
}

function showStopOnMap(stopName) {
    const stop = state.stops.get(stopName);
    if (!stop) {
        return;
    }

    map.flyTo({
        center: stop.position,
        zoom: Math.max(map.getZoom(), 16),
        essential: true
    });

    renderStopDetails(stop.name, { open: true });
}

function showBusOnMap(busId) {
    selectBus(busId, { fly: true, open: true });
}

function selectBus(busId, options = {}) {
    const bus = state.buses.get(busId);
    const marker = state.busMarkers.get(busId);

    if (!bus) {
        return;
    }

    state.selectedBusId = busId;
    updateSelectedBusMarkers();

    if (options.fly) {
        closeAllPanels();
        map.flyTo({
            center: bus.position,
            zoom: Math.max(map.getZoom(), 16),
            pitch: 42,
            bearing: bus.bearing ? bus.bearing - 12 : map.getBearing(),
            duration: 900,
            essential: true
        });
    }

    if (marker) {
        hideAllBusDetails(busId);
        marker.getElement().classList.toggle("is-open", Boolean(options.open));
    }
}

function updateSelectedBusMarkers() {
    state.busMarkers.forEach((marker, busId) => {
        marker.getElement().classList.toggle("is-selected", busId === state.selectedBusId);
    });
}

function toggleRouteSelection(routeName) {
    if (state.selectedRoutes.has(routeName)) {
        state.selectedRoutes.delete(routeName);
    } else {
        state.selectedRoutes.add(routeName);
    }

    displayRoutes();
    renderRouteList();
    renderBusList();
    renderLegend();
    updateBusVisibility();
}

function toggleRouteExpanded(routeName) {
    if (state.expandedRoutes.has(routeName)) {
        state.expandedRoutes.delete(routeName);
    } else {
        state.expandedRoutes.add(routeName);
    }
    renderRouteList();
}

function focusRoute(routeName) {
    const route = state.routes.get(routeName);
    if (!route || !route.coords.length) {
        return;
    }

    const bounds = route.coords.reduce((lngLatBounds, coord) => lngLatBounds.extend(coord), new mapboxgl.LngLatBounds(route.coords[0], route.coords[0]));

    map.fitBounds(bounds, {
        padding: getMapPadding(),
        maxZoom: 16,
        duration: 700
    });
}

function displayRoutes() {
    state.routeLayerIds.forEach((id) => {
        if (map.getLayer(id)) {
            map.removeLayer(id);
        }
    });

    state.routeLayerIds.forEach((id) => {
        const sourceId = id.replace("-line", "").replace("-halo", "");
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });

    state.routeLayerIds.clear();

    state.selectedRoutes.forEach((routeName) => {
        const route = state.routes.get(routeName);
        if (!route || route.coords.length < 2) {
            return;
        }

        const sourceId = `route-${safeDomId(route.id || route.name)}`;
        const haloId = `${sourceId}-halo`;
        const lineId = `${sourceId}-line`;

        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates: route.coords
                    }
                }
            });
        }

        map.addLayer({
            id: haloId,
            type: "line",
            source: sourceId,
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": "#ffffff",
                "line-width": getRouteHaloWidth(),
                "line-opacity": 0.92
            }
        });

        map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": route.color,
                "line-width": getRouteLineWidth(),
                "line-opacity": 0.96
            }
        });

        state.routeLayerIds.add(haloId);
        state.routeLayerIds.add(lineId);
    });
}

function updateRouteLineWidths() {
    state.routeLayerIds.forEach((id) => {
        if (!map.getLayer(id)) {
            return;
        }
        map.setPaintProperty(id, "line-width", id.endsWith("-halo") ? getRouteHaloWidth() : getRouteLineWidth());
    });
}

function updateBusVisibility() {
    const hasRouteFilter = state.selectedRoutes.size > 0;

    state.busMarkers.forEach((marker, busId) => {
        const bus = state.buses.get(busId);
        const visible = bus && bus.active && (!hasRouteFilter || state.selectedRoutes.has(bus.routeName));
        marker.getElement().style.display = visible ? "block" : "none";
    });
}

function setBusRouteProgress(bus) {
    const route = state.routes.get(bus.routeName);

    if (!route || !route.coords.length) {
        bus.nextStop = null;
        return;
    }

    bus.pointOnPath = findClosestRouteIndex(route.coords, bus.position);
    bus.nextStop = findNextStop(route, bus.pointOnPath);
}

function findNextStop(route, startIndex) {
    if (!route.stopIndices.size || !route.coords.length) {
        return null;
    }

    for (let offset = 1; offset <= route.coords.length; offset += 1) {
        const index = (startIndex + offset) % route.coords.length;
        if (route.stopIndices.has(index)) {
            return {
                index,
                name: route.stopIndices.get(index)
            };
        }
    }

    return null;
}

function estimateEta(route, bus, stopIndex) {
    if (!route || !route.coords.length || bus.pointOnPath === undefined || stopIndex === undefined) {
        return Infinity;
    }

    const distanceKm = distanceAlongRoute(route.coords, bus.pointOnPath, stopIndex);
    const speed = bus.speedMps && bus.speedMps > 1 ? bus.speedMps : DEFAULT_ETA_SPEED_MPS;
    return (distanceKm * 1000) / speed;
}

function distanceAlongRoute(coords, startIndex, endIndex) {
    if (startIndex === endIndex) {
        return 0;
    }

    const segment = endIndex > startIndex
        ? coords.slice(startIndex, endIndex + 1)
        : coords.slice(startIndex).concat(coords.slice(0, endIndex + 1));

    if (segment.length < 2) {
        return 0;
    }

    return routeLengthKm(segment);
}

function findClosestRouteIndex(coords, position) {
    let closestIndex = 0;
    let closestDistance = Infinity;

    coords.forEach((coord, index) => {
        const distance = distanceBetweenCoordsKm(position, coord);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });

    return closestIndex;
}

function getObservedSpeed(previous, position, now) {
    if (!previous || !previous.position || !previous.lastSeenAt) {
        return DEFAULT_ETA_SPEED_MPS;
    }

    const elapsedSeconds = Math.max((now - previous.lastSeenAt) / 1000, 1);
    const distanceKm = distanceBetweenCoordsKm(previous.position, position);
    const speed = (distanceKm * 1000) / elapsedSeconds;

    if (!Number.isFinite(speed)) {
        return previous.speedMps || DEFAULT_ETA_SPEED_MPS;
    }

    return speed;
}

function routeLengthKm(coords) {
    return coords.reduce((total, coord, index) => {
        if (index === 0) {
            return total;
        }

        return total + distanceBetweenCoordsKm(coords[index - 1], coord);
    }, 0);
}

function distanceBetweenCoordsKm(start, end) {
    if (!Array.isArray(start) || !Array.isArray(end)) {
        return Infinity;
    }

    const [startLng, startLat] = start;
    const [endLng, endLat] = end;

    if (![startLng, startLat, endLng, endLat].every(Number.isFinite)) {
        return Infinity;
    }

    const earthRadiusKm = 6371.0088;
    const deltaLat = toRadians(endLat - startLat);
    const deltaLng = toRadians(endLng - startLng);
    const startLatRad = toRadians(startLat);
    const endLatRad = toRadians(endLat);
    const a = (Math.sin(deltaLat / 2) ** 2)
        + (Math.cos(startLatRad) * Math.cos(endLatRad) * (Math.sin(deltaLng / 2) ** 2));

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function createRouteTitle(route) {
    const wrapper = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = "routeSwatch";
    swatch.style.setProperty("--route-color", route.color);
    wrapper.append(swatch, document.createTextNode(route.name));
    return wrapper;
}

function createBusBadge(route) {
    const badge = document.createElement("span");
    badge.className = "routeChip";
    badge.style.setProperty("--route-color", route.color);
    badge.textContent = `${route.buses.size} bus${route.buses.size === 1 ? "" : "es"}`;
    return badge;
}

function createRouteChips(routeSet) {
    const wrap = document.createElement("div");
    wrap.className = "routeChips";

    Array.from(routeSet).sort().forEach((routeName) => {
        const route = state.routes.get(routeName);
        const chip = document.createElement("span");
        chip.className = "routeChip";
        chip.style.setProperty("--route-color", route ? route.color : normalizeColor("", routeName));
        chip.textContent = normalizeShortName(route && route.shortName, routeName);
        wrap.append(chip);
    });

    return wrap;
}

function createSmallText(text) {
    const span = document.createElement("span");
    span.className = "routeChip";
    span.textContent = text;
    return span;
}

function createStopMarkerContent(stop) {
    const fragment = document.createDocumentFragment();
    const core = document.createElement("span");
    core.className = "stopPinCore";
    core.setAttribute("aria-hidden", "true");
    fragment.append(core);

    const count = stop.routes.size;
    if (count > 1) {
        const routeCount = document.createElement("span");
        routeCount.className = "stopRouteCount";
        routeCount.setAttribute("aria-hidden", "true");
        routeCount.textContent = String(count);
        fragment.append(routeCount);
    }

    return fragment;
}

function createIconImage(src) {
    const icon = document.createElement("img");
    icon.src = src;
    icon.className = "SVGicon";
    icon.alt = "";
    return icon;
}

function getPrimaryStopColor(stop) {
    const activeRoute = Array.from(stop.routes)
        .map((routeName) => state.routes.get(routeName))
        .filter(Boolean)
        .sort((a, b) => Number(b.active) - Number(a.active))[0];

    return activeRoute ? activeRoute.color : "#6f7b75";
}

function openPanel(panelId) {
    els.panels.forEach((panel) => {
        panel.hidden = panel.id !== panelId;
    });

    els.controlButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.panelTarget === panelId);
    });

    if (panelId === "stopsList") {
        window.setTimeout(() => els.stopSearch.focus(), 0);
    }

    if (panelId === "busesList") {
        window.setTimeout(() => els.busSearch.focus(), 0);
    }
}

function closePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.hidden = true;
    }

    if (panelId === "stopContainer") {
        state.activeStopName = "";
    }

    els.controlButtons.forEach((button) => {
        if (button.dataset.panelTarget === panelId) {
            button.classList.remove("is-active");
        }
    });
}

function closeAllPanels() {
    els.panels.forEach((panel) => {
        panel.hidden = true;
    });
    els.controlButtons.forEach((button) => button.classList.remove("is-active"));
    state.activeStopName = "";
}

function hideAllBusDetails(exceptBusId = "") {
    state.busMarkers.forEach((marker, busId) => {
        if (busId !== exceptBusId) {
            marker.getElement().classList.remove("is-open");
        }
    });
}

function easeOutCubic(progress) {
    return 1 - Math.pow(1 - progress, 3);
}

function setStatus(kind, title, message) {
    if (!els.status) {
        return;
    }

    els.status.hidden = false;
    els.status.classList.toggle("is-error", kind === "error");
    els.status.querySelector(".popupTitle").textContent = title;
    els.status.querySelector(".panelCopy").textContent = message;
}

function hideStatus() {
    if (els.status) {
        els.status.hidden = true;
    }
}

function updateCounts(passioTime = "") {
    const routes = Array.from(state.routes.values()).filter((route) => !route.outdated);
    const activeRouteCount = routes.filter((route) => route.active).length;
    const activeBuses = Array.from(state.buses.values()).filter((bus) => bus.active);
    const updated = passioTime || getLatestBusUpdate(activeBuses);

    els.routeCount.textContent = `${activeRouteCount}/${routes.length || 0} routes live`;
    els.busCount.textContent = `${activeBuses.length} bus${activeBuses.length === 1 ? "" : "es"} live`;
    els.lastUpdated.textContent = updated ? `Updated ${updated}` : "Waiting for update";

    if (state.alerts.length) {
        els.alertCount.hidden = false;
        els.alertCount.textContent = String(state.alerts.length);
    } else {
        els.alertCount.hidden = true;
    }
}

function getLatestBusUpdate(activeBuses) {
    const busWithTime = activeBuses.find((bus) => bus.updatedTime);
    return busWithTime ? busWithTime.updatedTime : "";
}

function renderEmpty(container, title, message) {
    container.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "emptyState";

    const strong = document.createElement("strong");
    strong.textContent = title;

    const copy = document.createElement("span");
    copy.textContent = message;

    empty.append(strong, copy);
    container.append(empty);
}

function normalizeColor(color, routeName = "") {
    const raw = String(color || "").trim();

    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        return raw.toLowerCase();
    }

    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
        return `#${raw.toLowerCase()}`;
    }

    const routeKey = Object.keys(ROUTE_FALLBACK_COLORS).find((key) => routeName.toLowerCase().includes(key));
    return routeKey ? ROUTE_FALLBACK_COLORS[routeKey] : "#00543c";
}

function normalizeShortName(shortName, routeName) {
    const clean = String(shortName || "").trim();
    if (clean) {
        return clean;
    }
    return String(routeName || "Route").trim();
}

function toLngLat(longitude, latitude) {
    const lng = Number(longitude);
    const lat = Number(latitude);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null;
    }

    return [lng, lat];
}

function isCampusPosition(position) {
    const [lng, lat] = position;
    return lng >= -82.6 && lng <= -82.2 && lat >= 27.8 && lat <= 28.1;
}

function getOccupancy(load, capacity) {
    const passengerLoad = Number(load);
    const totalCapacity = Number(capacity);

    if (!Number.isFinite(passengerLoad) || !Number.isFinite(totalCapacity) || totalCapacity <= 0) {
        return null;
    }

    return Math.max(0, Math.min(100, Math.round((passengerLoad / totalCapacity) * 100)));
}

function formatOccupancy(occupancy) {
    return Number.isFinite(occupancy) ? `${occupancy}%` : "Unknown";
}

function formatNextStop(bus) {
    return bus.nextStop ? `Next stop: ${bus.nextStop.name}.` : "Next stop unavailable.";
}

function formatEta(seconds) {
    if (!Number.isFinite(seconds)) {
        return "ETA unavailable";
    }

    if (seconds < 90) {
        return "Due soon";
    }

    return `About ${Math.round(seconds / 60)} min`;
}

function getRouteMeta(route) {
    if (route.active) {
        return `${route.buses.size} live bus${route.buses.size === 1 ? "" : "es"} reporting on this route.`;
    }

    if (route.outdated || route.serviceTime) {
        return route.serviceTime || "No bus in service.";
    }

    return "No live bus reporting right now.";
}

function stripHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    return template.content.textContent.trim();
}

function cleanError(error) {
    if (error && error.name === "AbortError") {
        return "The request timed out. Passio may be slow right now.";
    }
    return error && error.message ? error.message : "Something went wrong while loading transit data.";
}

function safeDomId(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function getMapPadding() {
    if (window.matchMedia("(max-width: 980px)").matches) {
        return { top: 150, right: 40, bottom: 170, left: 40 };
    }

    return { top: 120, right: 80, bottom: 80, left: 460 };
}

function getRouteLineWidth() {
    return Math.max(4, Math.min(8, map.getZoom() * 0.45));
}

function getRouteHaloWidth() {
    return getRouteLineWidth() + 4;
}

const point = (x, y, radius, angle) => [
    (x + Math.sin(angle) * radius).toFixed(2),
    (y - Math.cos(angle) * radius).toFixed(2)
];

function fullArc(x, y, outerRadius, innerRadius) {
    if (innerRadius <= 0) {
        return `M ${x - outerRadius} ${y} A ${outerRadius} ${outerRadius} 0 1 1 ${x + outerRadius} ${y} A ${outerRadius} ${outerRadius} 1 1 1 ${x - outerRadius} ${y} Z`;
    }

    return `M ${x - outerRadius} ${y} A ${outerRadius} ${outerRadius} 0 1 1 ${x + outerRadius} ${y} A ${outerRadius} ${outerRadius} 1 1 1 ${x - outerRadius} ${y} M ${x - innerRadius} ${y} A ${innerRadius} ${innerRadius} 0 1 1 ${x + innerRadius} ${y} A ${innerRadius} ${innerRadius} 1 1 1 ${x - innerRadius} ${y} Z`;
}

function partialArc(x, y, outerRadius, innerRadius, start, end) {
    const startAngle = (start / 360) * 2 * Math.PI;
    const endAngle = (end / 360) * 2 * Math.PI;
    const points = [
        point(x, y, innerRadius, startAngle),
        point(x, y, outerRadius, startAngle),
        point(x, y, outerRadius, endAngle),
        point(x, y, innerRadius, endAngle)
    ];
    const flag = endAngle - startAngle > Math.PI ? "1" : "0";

    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} A ${outerRadius} ${outerRadius} 0 ${flag} 1 ${points[2][0]} ${points[2][1]} L ${points[3][0]} ${points[3][1]} A ${innerRadius} ${innerRadius} 0 ${flag} 0 ${points[0][0]} ${points[0][1]} Z`;
}

function arc(opts = {}) {
    const { x = 0, y = 0 } = opts;
    let { R = 0, r = 0, start, end } = opts;

    [R, r] = [Math.max(R, r), Math.min(R, r)];

    if (R <= 0) {
        return "";
    }

    if (start !== +start || end !== +end) {
        return fullArc(x, y, R, r);
    }

    if (Math.abs(start - end) < 0.000001) {
        return "";
    }

    if (Math.abs(start - end) % 360 < 0.000001) {
        return fullArc(x, y, R, r);
    }

    start %= 360;
    end %= 360;

    if (start > end) {
        end += 360;
    }

    return partialArc(x, y, R, r, start, end);
}
