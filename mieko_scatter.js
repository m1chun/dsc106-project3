const width = 800;
const height = 600;
const margin = {top: 50, right: 50, bottom: 60, left: 70};

const svg = d3.select("#scatter")
  .attr("width", width)
  .attr("height", height);

const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

// Load CSV
d3.csv("wildfires_combined.csv").then(data => {

    data.forEach(d => {
        d.brightness = +d.bright_ti4;
        d.frp = +d.frp;
        d.confidence = d.confidence || 'n';
    });

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.frp)*1.1])
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.brightness)*1.1])
        .range([innerHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(['h','n','l'])
        .range(['red','orange','yellow']);

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y);

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth/2)
      .attr("y", 40)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .text("FRP (MW)");

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight/2)
      .attr("y", -50)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .text("Brightness");

    // Draw points
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.frp))
      .attr("cy", d => y(d.brightness))
      .attr("r", 4)
      .attr("fill", d => color(d.confidence))
      .attr("opacity", 0.7)
      .on("mouseover", (event, d) => {
          tooltip.style("display", "block")
            .html(
              `Brightness: ${d.brightness}<br/>FRP: ${d.frp}<br/>Confidence: ${d.confidence}`
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 30) + "px");
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
});

// Legend for confidence colors (bottom-right with background)
const legendData = [
  {label: "High confidence (h)", color: "red"},
  {label: "Nominal confidence (n)", color: "orange"},
  {label: "Low confidence (l)", color: "yellow"}
];

// Create a group for the legend
const legend = svg.append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${width - 200}, ${height - 175})`); // bottom-right

// Background rectangle
legend.append("rect")
  .attr("x", -10)
  .attr("y", -10)
  .attr("width", 180)
  .attr("height", legendData.length * 25 + 10)
  .attr("fill", "rgba(0,0,0,0.5)")
  .attr("rx", 8)  // rounded corners
  .attr("ry", 8);

// Add color boxes
legend.selectAll("rect.color")
  .data(legendData)
  .enter()
  .append("rect")
    .attr("class", "color")
    .attr("x", 0)
    .attr("y", (d,i) => i * 25)
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", d => d.color);

// Add labels
legend.selectAll("text")
  .data(legendData)
  .enter()
  .append("text")
    .attr("x", 25)
    .attr("y", (d,i) => i * 25 + 14)
    .text(d => d.label)
    .attr("font-size", "12px")
    .attr("fill", "white");

