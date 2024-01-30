# Railway Map Renderer

TS library for rendering a map of the railway of the Shire Minecraft server on an HTML canvas element using the data provided by the website's API.

Example using [axios](https://github.com/axios/axios):

```js
const canvas = document.getElementById("railwayCanvas");
const renderer = new RailwayMapRenderer(canvas);

const connections = (await axios.get("https://shirecraft.us/api/railway/connections")).data.data; // Array of connections
const stations = (await axios.get("https://shirecraft.us/api/railway/stations")).data.data; // Array of stations

renderer.setData(stations,connections);

renderer.draw(); // The renderer will redraw automatically whenever the camera is moved.
```

## Config
The library provides a `RailwayMapRendererConfig` class for configuring a `RailwayMapRenderer`, it can be passed as an argument in the constructor or with the `setConfig()` method.

```js
class RailwayMapRendererConfig {
    bgStyle: string   = "#111";       // The style of the map's background
    fontSize: number  = 10;           // The size of the font used for station names
    fontStyle: string = "#fff";       // The font style 
    font: string      = "sans-serif"; // The font family 

    lineWidth: number           = 8;     // Line width for drawing connections
    stationGroupsOffset: number = 12;    // Offset on the x and y axes for each line connection to a station
    renderDebug: boolean        = false; // Render debug boxes around clickable areas

    showStationsWithNoConnections: boolean = true; // Show stations with no connections

    minScale: number = 0.05; // The minimum view scale
    maxScale: number = 20;   // The maximum view scale
    
    scrollSensitivity: number = .001;  // Mousewheel sensitivity for zooming the view 
    pinchSensitivity: number  = .0025; // Pinch sensitivity for zooming the view on a touchscreen device
}
```
