# BullRunner Web Application

BullRunner is a web application designed to help users track university buses in real-time. The application displays the closest bus stops, provides real-time bus locations, and offers navigation to the selected bus stop. This project focuses on parsing API calls from the PassioGo API.

## Features

- Display of user's current location on a map
- Search and display of nearest bus stops
- Real-time bus tracking
- Navigation to bus stops
- Notifications for bus arrival
- User settings and preferences
- Show Live Bus Location and Routes

## Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- jQuery
- Mapbox API
- Axios

### API Integration
- PassioGo API

## Setup

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/bullrunner.git
    ```

2. Navigate to the project directory:
    ```bash
    cd bullrunner
    ```

3. Open `index.html` in your preferred browser.

## Usage

- The application will fetch data from the PassioGo API to display real-time bus locations and routes.
- Users can view their current location, nearest bus stops, and navigate to selected bus stops.
- The app will notify users of bus arrivals.

## API Parsing

The core of this application revolves around parsing API calls from the PassioGo API. Here's an overview of the main API endpoints and how they're handled:

- `/routes`: Fetches all available bus routes
- `/stops`: Retrieves all bus stops
- `/vehicles`: Gets real-time locations of all buses

The `package-parse.js` file contains the main logic for parsing these API responses and transforming the data into a format usable by the frontend.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any inquiries, please contact [ubullrunner@gmail.com].# bullrunner-2
