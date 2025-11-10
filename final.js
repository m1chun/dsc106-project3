const width = 960;
const height = 600;

// --- Global data variable ---
let dataGlobal;

// --- Map SVG setup ---
const svg = d3.select("#map")
  .attr("viewBox", [0, 0, width, height]);

const gMap = svg.append("g");
const gFires = svg.append("g");

// Tooltip
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// --- Load data ---
Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
  d3.csv("mieko_data/final_data/wildfires_combined.csv")
]).then(([world, us, data]) => {

  // Parse and clean data
  data.forEach(d=>{
    d.datetime = new Date(d.datetime);
    d.latitude = +d.latitude;
    d.longitude = +d.longitude;
    d.bright_ti4 = +d.bright_ti4;
    d.frp = +d.frp;
  });
  data = data.filter(d=>!isNaN(d.latitude) && !isNaN(d.longitude));

  // --- Filter out fires lasting only 1 day ---
  const firesByLocation = d3.group(data, d => `${Math.round(d.latitude*100)/100},${Math.round(d.longitude*100)/100}`);
  const filteredData = [];
  firesByLocation.forEach(firePoints => {
    const times = firePoints.map(d => d.datetime);
    const durationDays = (d3.max(times) - d3.min(times)) / (1000*60*60*24) + 1;
    if(durationDays > 1) {
      filteredData.push(...firePoints);
    }
  });
  dataGlobal = filteredData;

  // --- Projection & path ---
  const projection = d3.geoAlbers()
    .center([0,38])
    .rotate([98,0])
    .parallels([29.5,45.5])
    .scale(1200)
    .translate([width/2,height/2]);
  
  const path = d3.geoPath().projection(projection);

  // --- Countries ---
  const countries = topojson.feature(world, world.objects.countries).features
    .filter(d=>{
      const [lon,lat] = d3.geoCentroid(d);
      return lon>-170 && lon<-30 && lat>5 && lat<70;
    });

  gMap.selectAll(".country")
    .data(countries)
    .join("path")
    .attr("class","country")
    .attr("d",path)
    .attr("fill","#f8f8f8")
    .attr("stroke","#ccc");

  // --- US states ---
  const states = topojson.feature(us, us.objects.states).features
    .filter(d=>![2,15].includes(+d.id));

  gMap.selectAll(".state")
    .data(states)
    .join("path")
    .attr("class","state")
    .attr("d",path)
    .attr("fill","none")
    .attr("stroke","#bbb");

  // --- Dates & slider ---
  const dates = Array.from(new Set(dataGlobal.map(d=>d3.timeDay.floor(d.datetime)))).sort(d3.ascending);
  const slider = d3.select("#timeSlider").attr("max",dates.length-1);

  // --- Custom Color Scale ---
  const colorBins = [200, 250, 300, 350, 400];
  const colorRange = ["#fcffa4", "#f98e09", "#bc3754", "#57106e", "#000004"];
  const colorScale = d3.scaleThreshold()
      .domain(colorBins.slice(1))
      .range(colorRange);

  // --- Radius scale for FRP ---
  const radiusScale = d3.scaleSqrt()
    .domain(d3.extent(dataGlobal,d=>d.frp))
    .range([4,20]);

  // --- Legends with background ---
  const legendWidth = 250;
  const legendHeight = 150;
  const legendX = 20;
  const legendY = height - legendHeight - 20;

  // Background rectangle
  svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "white")
      .attr("stroke", "#999")
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("opacity", 0.8);

  // Legends groups
  const gLegendColor = svg.append("g")
      .attr("transform", `translate(${legendX + 10}, ${legendY + 35})`);
  const gLegendSize = svg.append("g")
      .attr("transform", `translate(${legendX + 120}, ${legendY + 35})`);

  // --- Color Legend ---
  gLegendColor.selectAll("*").remove();
  colorBins.forEach((val,i)=>{
      gLegendColor.append("rect")
          .attr("x",0)
          .attr("y", i*20)
          .attr("width",20)
          .attr("height",20)
          .attr("fill", colorRange[i] || colorRange[colorRange.length-1]);
      gLegendColor.append("text")
          .attr("x",25)
          .attr("y", i*20 + 15)
          .attr("font-size",12)
          .text(val);
  });
  gLegendColor.append("text")
      .attr("x",0)
      .attr("y",-5)
      .text("Brightness (TI4)")
      .attr("font-size",12);

  // --- Size Legend (FRP) ---
  gLegendSize.selectAll("*").remove();
  const frpValues = [50,200,500];
  const spacing = 40;
  frpValues.forEach((val,i)=>{
      gLegendSize.append("circle")
          .attr("cx", 20)
          .attr("cy", i * spacing + radiusScale(val))
          .attr("r", radiusScale(val))
          .attr("fill", "#fc8d59")
          .attr("opacity", 0.7);
      gLegendSize.append("text")
          .attr("x", 50)
          .attr("y", i * spacing + radiusScale(val))
          .attr("alignment-baseline", "middle")
          .attr("font-size", 12)
          .text(`FRP: ${val}`);
  });
  gLegendSize.append("text")
      .attr("x", 0)
      .attr("y", -5)
      .text("Fire Intensity (FRP)")
      .attr("font-size", 12);

  // --- Update map ---
  const update = dateIndex => {
    const currentDate = dates[dateIndex];
    d3.select("#currentDate").text(currentDate.toDateString());
    const dayData = dataGlobal.filter(d=>d3.timeDay.floor(d.datetime).getTime()===currentDate.getTime());

    const circles = gFires.selectAll("circle")
      .data(dayData, d=>`${d.latitude},${d.longitude},${d.datetime}`);

    circles.join(
      enter => enter.append("circle")
        .attr("cx", d=>projection([d.longitude,d.latitude])[0])
        .attr("cy", d=>projection([d.longitude,d.latitude])[1])
        .attr("r", d=>Math.max(radiusScale(d.frp), 3))
        .attr("fill", d=>colorScale(d.bright_ti4))
        .attr("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", (event,d)=>{
          tooltip.transition().duration(200).style("opacity",0.9);
          tooltip.html(`Brightness (TI4): ${d.bright_ti4}<br>Fire Intensity (FRP): ${d.frp}`)
            .style("left",(event.pageX+10)+"px")
            .style("top",(event.pageY-20)+"px");
        })
        .on("mouseout", ()=>tooltip.transition().duration(300).style("opacity",0))
        .on("click", (event,d)=>{
          drawLineChart(d);
        }),
      update => update,
      exit => exit.transition().duration(300).attr("r",0).remove()
    );
  };

  update(0);
  slider.on("input", function(){ update(+this.value); });
});

function drawLineChart(fireData) {
    // Filter measurements near the fire location
    let fireTimeSeries = dataGlobal
        .filter(d =>
            Math.abs(d.latitude - fireData.latitude) < 0.05 &&
            Math.abs(d.longitude - fireData.longitude) < 0.05
        )
        .sort((a,b) => d3.ascending(a.datetime, b.datetime));

    if(fireTimeSeries.length === 0) return;

    // Aggregate multiple measurements per day by averaging
    const nested = d3.rollup(
        fireTimeSeries,
        v => d3.mean(v, d => d.bright_ti4),
        d => d3.timeDay.floor(d.datetime)  // group by day
    );
    fireTimeSeries = Array.from(nested, ([day, avgBright]) => ({
        datetime: day,
        bright_ti4: avgBright
    })).sort((a,b) => d3.ascending(a.datetime, b.datetime));

    const lineColor = "#f03b20";

    const svgLine = d3.select("#line-chart");
    const svgWidth = +svgLine.node().clientWidth;
    const svgHeight = +svgLine.node().clientHeight;

    svgLine.selectAll("*").remove();

    const margin = {top: 40, right: 30, bottom: 60, left: 60};
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const g = svgLine.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
        .domain(d3.extent(fireTimeSeries, d => d.datetime))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([200, 400])
        .range([chartHeight, 0]);

    // x-axis
    const xAxis = d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d3.timeFormat("%b %d")); // month and day

    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end");

    // y-axis
    g.append("g")
      .call(d3.axisLeft(y));

    // Draw line if more than 1 point, otherwise draw a single circle
    if(fireTimeSeries.length > 1) {
        const line = d3.line()
            .x(d => x(d.datetime))
            .y(d => y(d.bright_ti4));
        g.append("path")
          .datum(fireTimeSeries)
          .attr("fill", "none")
          .attr("stroke", lineColor)
          .attr("stroke-width", 2)
          .attr("d", line);
    } else {
        g.append("circle")
          .attr("cx", x(fireTimeSeries[0].datetime))
          .attr("cy", y(fireTimeSeries[0].bright_ti4))
          .attr("r", 4)
          .attr("fill", lineColor);
    }

    // Axis labels
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "black")
      .text("Date");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -margin.left + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "black")
      .text("Brightness (TI4)");

    // Chart title
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -margin.top / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 16)
      .attr("font-weight", "bold")
      .text("Fire Brightness Over Time");

    // --- Annotation: start/end dates + duration ---
    const startDate = fireTimeSeries[0].datetime;
    const endDate = fireTimeSeries[fireTimeSeries.length - 1].datetime;
    const durationDays = Math.round((endDate - startDate)/(1000*60*60*24)) + 1;

    const startedBeforeMay31 = startDate.getDate() === 31 && startDate.getMonth() === 4;
    const endedAfterAug30 = endDate.getDate() === 30 && endDate.getMonth() === 7;

    const startText = startedBeforeMay31
        ? "Fire Start: started before Jun 1"
        : `Fire Start: ${d3.timeFormat("%b %d")(startDate)}`;
    const endText = endedAfterAug30
        ? "Fire End: ended after Aug 30"
        : `Fire End: ${d3.timeFormat("%b %d")(endDate)}`;

    let durationText = durationDays >= 92
        ? "Duration: over 92 days"
        : `Duration: ${durationDays} day${durationDays > 1 ? "s" : ""}`;
    if(durationDays < 92 && (startedBeforeMay31 || endedAfterAug30)) {
        durationText += " or more";
    }

    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight * 0.8)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .attr("fill", "black")
      .append("tspan")
        .attr("x", chartWidth / 2)
        .attr("dy", "0em")
        .text(startText)
      .append("tspan")
        .attr("x", chartWidth / 2)
        .attr("dy", "1.2em")
        .text(endText)
      .append("tspan")
        .attr("x", chartWidth / 2)
        .attr("dy", "1.2em")
        .text(durationText);
}
