const width = 960;
const height = 600;

const svg = d3.select("#map")
  .attr("viewBox", [0, 0, width, height]);

// --- Layer groups ---
const gZoom = svg.append("g");  // zoomable group
const gMap = gZoom.append("g"); // map outlines
const gFires = gZoom.append("g"); // fire points

const gLegend = svg.append("g")  // color legend (fixed)
  .attr("transform", `translate(${width - 180}, 30)`); // top-right corner

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
  d3.csv("mieko_data/final_data/wildfires_combined.csv")
]).then(([world, us, data]) => {

  // --- Projection for continental North America ---
  const projection = d3.geoAlbers()
    .center([0, 25])         // move focus south (less Canada)
    .rotate([100, 0])
    .parallels([20, 60])
    .scale(900)
    .translate([width / 2, height / 2 + 50]); // shift map down slightly

  const path = d3.geoPath().projection(projection);

  // --- Filter countries to North America region ---
  const countries = topojson.feature(world, world.objects.countries).features
    .filter(d => {
      const [lon, lat] = d3.geoCentroid(d);
      return lon > -170 && lon < -30 && lat > 5 && lat < 70;
    });

  gMap.selectAll(".country")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", "#f8f8f8")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 0.5);

  // --- U.S. states (no Alaska or Hawaii) ---
  const states = topojson.feature(us, us.objects.states).features
    .filter(d => ![2, 15].includes(+d.id));

  gMap.selectAll(".state")
    .data(states)
    .join("path")
    .attr("class", "state")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#666")
    .attr("stroke-width", 0.4);

  gFires.raise();

  // --- Process wildfire data ---
  data.forEach(d => {
    d.datetime = new Date(d.datetime);
    d.latitude = +d.latitude;
    d.longitude = +d.longitude;
    d.bright_ti4 = +d.bright_ti4;
    d.frp = +d.frp;
  });

  data = data.filter(d => !isNaN(d.latitude) && !isNaN(d.longitude));

  // --- Slider setup ---
  const dates = Array.from(new Set(data.map(d => d3.timeDay.floor(d.datetime)))).sort(d3.ascending);
  const slider = d3.select("#timeSlider").attr("max", dates.length - 1);

  const colorScale = d3.scaleSequential(d3.interpolateInferno)
    .domain(d3.extent(data, d => d.bright_ti4));

  // --- Add legend (top-right corner) ---
  const legendWidth = 150;
  const legendHeight = 10;
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "color-gradient");

  gradient.selectAll("stop")
    .data(d3.ticks(0, 1, 10))
    .join("stop")
    .attr("offset", d => `${100 * d}%`)
    .attr("stop-color", d => colorScale(colorScale.domain()[0] + d * (colorScale.domain()[1] - colorScale.domain()[0])));

  gLegend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#color-gradient)")
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5);

  const legendScale = d3.scaleLinear()
    .domain(colorScale.domain())
    .range([0, legendWidth]);

  gLegend.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(d3.axisBottom(legendScale).ticks(5).tickSize(3).tickFormat(d3.format(".0f")))
    .select(".domain").remove();

  gLegend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -6)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Brightness (TI4)");

  // --- Update function ---
  const update = (dateIndex) => {
    const currentDate = dates[dateIndex];
    d3.select("#currentDate").text(currentDate.toDateString());

    const dayData = data.filter(d => d3.timeDay.floor(d.datetime).getTime() === currentDate.getTime());

    const circles = gFires.selectAll("circle")
      .data(dayData, d => `${d.latitude},${d.longitude},${d.datetime}`);

    circles.join(
      enter => enter.append("circle")
        .attr("cx", d => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[0] : null;
        })
        .attr("cy", d => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[1] : null;
        })
        .attr("r", 0)
        .attr("fill", d => colorScale(d.bright_ti4))
        .attr("opacity", 0.7)
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip.html(`FRP: ${d.frp}<br>Temp: ${d.bright_ti4}<br>${d.datetime}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
        .call(enter => enter.transition().duration(400).attr("r", 4)),
      update => update,
      exit => exit.transition().duration(300).attr("r", 0).remove()
    );
  };

  // --- Initialize ---
  update(0);
  slider.on("input", function () { update(+this.value); });

  // --- Add Zoom + Pan ---
  const zoom = d3.zoom()
    .scaleExtent([0.8, 8]) // min and max zoom
    .on("zoom", (event) => {
      gZoom.attr("transform", event.transform);
    });

  svg.call(zoom);

const initialZoom = d3.zoomIdentity
  .translate(width / 2, height / 2) // move view upward (increase this number for more)
  .scale(0.8)
  .translate(-width / 2, -height / 2);
});
