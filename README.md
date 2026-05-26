# Bulls Go

Bulls Go is a lightweight web app for USF students who need live Bull Runner route, stop, bus, and service alert information. It is hosted as a static GitHub Pages app and reads current data from Passio.

## Features

- Map-first view of USF Bull Runner stops and buses
- Current route colors from Passio route and vehicle data
- Searchable stops, buses, routes, and service alerts
- Route overlays with live bus filtering
- Estimated arrivals from live bus position and route shape
- Responsive desktop and mobile panels

## Tech Stack

- HTML5
- CSS3
- JavaScript with browser fetch
- Mapbox GL JS
- Local route distance helpers for estimated arrivals
- Passio API data

## Setup

1. Clone the repository:
    ```bash
    git clone https://github.com/Param-10/bullrunner-2.git
    ```

2. Navigate to the project directory:
    ```bash
    cd bullrunner-2
    ```

3. Serve the folder locally, then open the local URL:
    ```bash
    python3 -m http.server 4173
    ```

## Usage

- Open Routes to draw or hide route lines.
- Open Stops to search campus stops and view estimated arrivals.
- Open Buses to jump to a live vehicle.
- Open Alerts to read current service messages.

## API Parsing

The core of this application revolves around parsing API calls from the PassioGo API. Here's an overview of the main API endpoints and how they're handled:

- `mapGetData.php?getRoutes=1`: route names, ids, colors, and service flags
- `mapGetData.php?getStops=1`: stops, route stop order, and route geometry
- `mapGetData.php?getBuses=1`: live bus positions, route assignment, capacity, and update time
- `goServices.php?getAlertMessages=1`: current service alerts

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.


## Contact

For any inquiries, please contact [ubullrunner@gmail.com].
