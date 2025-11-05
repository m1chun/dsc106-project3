const width = 800;
const height = 600;

const svg = d3.select("#map");

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

const g = svg.append("g");

// Projection
const projection = d3.geoMercator()
    .center([135, -25])
    .scale(1000)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Tooltip group inside SVG
const tooltipGroup = g.append("g")
    .attr("class", "tooltip-group")
    .style("display", "none");

// Append rectangle for tooltip
tooltipGroup.append("rect")
    .attr("width", 240)   // bigger width
    .attr("height", 80)   // bigger height
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("fill", "rgba(0,0,0,0.7)");

// Append text inside tooltip
const tooltipText = tooltipGroup.append("text")
    .attr("x", 10)
    .attr("y", 20)
    .attr("fill", "white")
    .attr("font-size", "14px")  // bigger font
    .attr("font-weight", "bold"); // bold

// Top-left of Australia (rough NW corner)
const topLeftCoords = projection([113, -10]);
tooltipGroup.attr("transform", `translate(${topLeftCoords[0]}, ${topLeftCoords[1]})`);

// Load world GeoJSON and filter Australia
d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
  .then(worldData => {

    const ausData = worldData.features.find(f => f.properties.name === "Australia");

    g.append("path")
       .datum(ausData)
       .attr("d", path)
       .attr("fill", "#eee")
       .attr("stroke", "#333");

    // Annotations for cities
    const annotations = [
        {name: "Sydney", coords: [151.21, -33.87]},
        {name: "Melbourne", coords: [144.96, -37.81]},
        {name: "Perth", coords: [115.86, -31.95]},
        {name: "Brisbane", coords: [153.03, -27.47]}
    ];

    g.selectAll(".annotation")
      .data(annotations)
      .enter()
      .append("text")
      .attr("class", "annotation")
      .attr("x", d => projection(d.coords)[0])
      .attr("y", d => projection(d.coords)[1])
      .text(d => d.name)
      .attr("font-size", "12px")
      .attr("fill", "black")
      .attr("font-weight", "bold");

    // Load wildfire CSV
    d3.csv("wildfires_combined.csv").then(data => {
        console.log("Loaded data:", data);

        data.forEach(d => {
            d.latitude = +d.latitude;
            d.longitude = +d.longitude;
            d.brightness = +d.bright_ti4 || 0;
            d.frp = +d.frp || 0;
            d.confidence = d.confidence || 'n';
            d.datetime = new Date(d.datetime);
        });

        data.sort((a, b) => a.datetime - b.datetime);

        let i = 0;
        const delay = 200; // increase for slower animation

        function animate() {
            if (i >= data.length) return;

            const d = data[i];

            if (!d.latitude || !d.longitude || d.brightness <= 0) {
                i++;
                setTimeout(animate, delay);
                return;
            }

            const circle = g.append("circle")
               .attr("class", "fire")
               .attr("cx", projection([d.longitude, d.latitude])[0])
               .attr("cy", projection([d.longitude, d.latitude])[1])
               .attr("r", Math.sqrt(d.brightness)/3)
               .attr("fill", d.confidence === 'h' ? 'red' : d.confidence === 'n' ? 'orange' : 'yellow')
               .attr("opacity", 0.8)
               .on("mouseover", () => {
                   tooltipGroup.style("display", null); // show tooltip

                   // Clear old tspans
                   tooltipText.selectAll("*").remove();

                   // Add formatted lines
                   const lines = [
                       `Brightness: ${d.brightness}`,
                       `Fire Radiative Power (FRP): ${d.frp}`,
                       `Date: ${d.datetime.toLocaleString()}`
                   ];

                   lines.forEach((line, j) => {
                       tooltipText.append("tspan")
                           .attr("x", 10)
                           .attr("y", 25 + j * 20) // increased spacing for bigger font
                           .text(line);
                   });
               })
               .on("mouseout", () => {
                   tooltipGroup.style("display", "none"); // hide tooltip
               });

            // Fade out older points
            circle.transition()
                .duration(5000)
                .attr("opacity", 0.2)
                .remove();

            i++;
            setTimeout(animate, delay);
        }

        animate();
    });
});
