const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#sky")
    .attr("width", width)
    .attr("height", height);

const tooltip = d3.select(".tooltip");

const defs = svg.append("defs");

// =====================================================
//  LAYER GROUPS
// =====================================================
const backgroundGroup = svg.append("g").attr("class", "background-layer");
const planetLayerGroup = svg.append("g").attr("class", "planet-layer");
const uiGroup = svg.append("g").attr("class", "ui-layer");

// =============================
// ESI Legend
// =============================
const legendWidth = 200;
const legendHeight = 10;

const legend = uiGroup.append("g")
    .attr("transform", `translate(${width - 260}, ${height - 80})`);

const legendScale = d3.scaleLinear()
    .domain([0.48, 0.83])
    .range([0, legendWidth]);

const legendGradient = defs.append("linearGradient")
    .attr("id", "esiGradient");

legendGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", d3.interpolateYlGn(0));

legendGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", d3.interpolateYlGn(1));

// Flux gradient
const fluxGradient = defs.append("linearGradient")
    .attr("id", "fluxGradient");

fluxGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4488ff");
fluxGradient.append("stop").attr("offset", "50%").attr("stop-color", "#ffffff");
fluxGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ff3333");

const legendRect = legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#esiGradient)");

const legendLabelLeft = legend.append("text")
    .attr("x", 0).attr("y", -5)
    .attr("fill", "white").attr("font-size", "12px")
    .text("Low ESI");

const legendLabelRight = legend.append("text")
    .attr("x", legendWidth - 60).attr("y", -5)
    .attr("fill", "white").attr("font-size", "12px")
    .text("High ESI");

legend
    .on("mouseover", (event) => {
        tooltip.style("display", "block")
            .html(`<strong>Earth Similarity Index (ESI)</strong><br/>Measures physical similarity to Earth based on:<br/>• Radius<br/>• Density<br/>• Surface temperature<br/>• Escape velocity`);
    })
    .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX - 150) + "px").style("top", (event.pageY - 150) + "px");
    })
    .on("mouseout", () => { tooltip.style("display", "none"); });

// =============================
// Projection Setup
// =============================
const projection = d3.geoOrthographic()
    .scale(height / 2.2)
    .translate([width / 2, height / 2 + 25])
    .clipAngle(90);

const path = d3.geoPath().projection(projection);

// =============================
// Star Background
// =============================
for (let i = 0; i < 800; i++) {
    backgroundGroup.append("circle")
        .attr("cx", Math.random() * width)
        .attr("cy", Math.random() * height)
        .attr("r", Math.random() * 1.2)
        .attr("fill", "white")
        .attr("opacity", Math.random() * 0.8);
}

const movingStarsGroup = backgroundGroup.append("g").attr("class", "moving-stars");
const movingStars = [];

for (let i = 0; i < 30; i++) {
    const star = movingStarsGroup.append("circle")
        .attr("cx", Math.random() * width)
        .attr("cy", Math.random() * height)
        .attr("r", Math.random() * 1.3)
        .attr("fill", "white")
        .attr("opacity", 0.2 + Math.random() * 0.5);

    movingStars.push({ element: star, speed: 0.1 + Math.random() * 0.2 });
}

function animateStars() {
    movingStars.forEach(starObj => {
        let cx = +starObj.element.attr("cx");
        let cy = +starObj.element.attr("cy");
        cx += starObj.speed;
        cy += starObj.speed;
        if (cx > width || cy > height) {
            if (Math.random() < 0.5) { cx = Math.random() * width; cy = -5; }
            else { cx = -5; cy = Math.random() * height; }
        }
        starObj.element.attr("cx", cx).attr("cy", cy);
    });
    requestAnimationFrame(animateStars);
}
animateStars();

backgroundGroup.append("path")
    .datum({ type: "Sphere" })
    .attr("d", path)
    .attr("fill", "rgba(0, 0, 40, 0.75)")
    .attr("stroke", "#333");

const graticule = d3.geoGraticule();
backgroundGroup.append("path")
    .datum(graticule())
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.25)")
    .attr("stroke-width", 0.6);

// =============================
// Load Dataset
// =============================
d3.csv("habitable_master_dataset.csv?v=" + Date.now()).then(data => {

    data.forEach(d => {
        d.ra = +d.ra;
        d.dec = +d.dec;
        d.esi = +d.esi;
        d.distance_ly = +d.distance_ly;
        d.Flux = +d.Flux;
        d.radius_re = +d.radius_re || null;
        d.temperature_k = +d.temperature_k || null;
        d.discovery_year = d.discovery_year || "Unknown";
        d.detection_method = d.detection_method || "Unknown";
    });

    data.forEach(d => { d._angle = Math.random() * 2 * Math.PI; });

    // Spread planets sharing the same host star so they dont stack on the globe
    const hostGroups = {};
    data.forEach(d => {
        if (!hostGroups[d.hostname]) hostGroups[d.hostname] = [];
        hostGroups[d.hostname].push(d);
    });
    Object.values(hostGroups).forEach(group => {
        if (group.length > 1) {
            const jitter = 1.2;
            group.forEach((d, i) => {
                const angle = (i / group.length) * 2 * Math.PI;
                d.ra  = d.ra  + jitter * Math.cos(angle);
                d.dec = d.dec + jitter * Math.sin(angle);
            });
        }
    });

    // =====================================================
    // COLOR SCALES
    // =====================================================
    const esiColorScale = d3.scaleSequential()
        .domain([0.48, 0.83])
        .interpolator(d3.interpolateYlGn);

    // Flux color: blue (low) → white (Earth-like ~1.0) → red (high)
    const fluxColorScale = d3.scaleLinear()
        .domain([0.2, 1.0, 2.5])
        .range(["#4488ff", "#ffffff", "#ff3333"]);

    // =====================================================
    // COLOR MODE STATE
    // =====================================================
    let colorMode = "esi"; // "esi" or "flux"

    function getPlanetColor(d) {
        if (d.name === "Earth") return "blue";
        if (colorMode === "esi") return esiColorScale(d.esi);
        return fluxColorScale(d.Flux);
    }

    // =====================================================
    // PLANET TYPE CLASSIFICATION
    // =====================================================
    function getPlanetType(radius) {
        if (!radius || isNaN(radius)) return "Unknown";
        if (radius < 0.8) return "Sub-Earth";
        if (radius <= 1.25) return "Rocky (Earth-like)";
        if (radius <= 1.6) return "Super-Earth";
        if (radius <= 4.0) return "Mini-Neptune";
        return "Gas Giant";
    }

    function getPlanetTypeColor(type) {
        const colors = {
            "Sub-Earth": "#aabbcc",
            "Rocky (Earth-like)": "#88cc66",
            "Super-Earth": "#ffcc44",
            "Mini-Neptune": "#66aaff",
            "Gas Giant": "#ff8844",
            "Unknown": "#888888"
        };
        return colors[type] || "#888888";
    }

    function getPlanetTypeIcon(type) {
        const icons = {
            "Sub-Earth": "🪨",
            "Rocky (Earth-like)": "🌍",
            "Super-Earth": "🌏",
            "Mini-Neptune": "🔵",
            "Gas Giant": "🟠",
            "Unknown": "❓"
        };
        return icons[type] || "❓";
    }

    // =====================================================
    // PLANET GROUP
    // =====================================================
    const planetGroup = planetLayerGroup.append("g");

    let systemMode = false;
    let orbitAnimationId = null;
    let autoRotate = false;

    const closeBtn = svg.append("text")
        .attr("x", width - 40).attr("y", 40)
        .attr("fill", "white").attr("font-size", "24px")
        .attr("cursor", "pointer").text("✕")
        .style("display", "none");

    const backBtn = svg.append("text")
        .attr("x", 40).attr("y", 50)
        .attr("fill", "white").attr("font-size", "20px")
        .attr("font-weight", 700).attr("cursor", "pointer")
        .text("← Back").style("display", "none");

    function updatePlanetCount() {
        // Counted after filters applied — reads actual visible state
        const visiblePlanets = planetGroup.selectAll("circle")
            .filter(function() { return d3.select(this).style("display") !== "none"; })
            .size();
        d3.select("#planetCount").text(`Showing ${visiblePlanets} Potentially Habitable Planets`);
    }

    const planets = planetGroup.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", d => d.name === "Earth" ? 6 : 4)
        .attr("fill", d => getPlanetColor(d))
        .attr("stroke", d => d.name === "Earth" ? "white" : "none")
        .attr("stroke-width", 1)
        .attr("opacity", 0.9)
        .on("mouseover", (event, d) => {
            const type = getPlanetType(d.radius_re);
            tooltip.style("display", "block")
                .html(`
                    <strong>${d.name}</strong><br/>
                    ${getPlanetTypeIcon(type)} <span style="color:${getPlanetTypeColor(type)}">${type}</span><br/>
                    ESI: ${d.esi?.toFixed(2) || "N/A"} &nbsp;|&nbsp; Flux: ${d.Flux?.toFixed(2) || "N/A"}<br/>
                    Distance: ${d.distance_ly.toFixed(1)} ly<br/>
                    Discovered: ${d.discovery_year} (${d.detection_method})
                `);
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => { tooltip.style("display", "none"); })
        .on("click", (event, d) => {
            if (!systemMode) {
                focusPlanet(d, () => {
                    showSystemView(d);
                    systemMode = true;
                });
            }
        });

    // =====================================================
    // COLOR MODE TOGGLE (button in controls)
    // =====================================================
    d3.select("#toggleColorMode").on("click", () => {
        colorMode = colorMode === "esi" ? "flux" : "esi";

        // Update button label
        d3.select("#toggleColorMode").text(
            colorMode === "esi" ? "Color by: ESI" : "Color by: Flux"
        );

        // Update legend
        if (colorMode === "esi") {
            legendRect.attr("fill", "url(#esiGradient)");
            legendLabelLeft.text("Low ESI");
            legendLabelRight.attr("x", legendWidth - 60).text("High ESI");
        } else {
            legendRect.attr("fill", "url(#fluxGradient)");
            legendLabelLeft.text("Low Flux");
            legendLabelRight.attr("x", legendWidth - 60).text("High Flux");
        }

        // Recolor planets
        planets.attr("fill", d => getPlanetColor(d));
    });

    // =====================================================
    // SYSTEM VIEW
    // =====================================================
    const systemGroup = svg.append("g").attr("class", "system-view").style("display", "none");

    function enterSystemMode() {
        backgroundGroup.style("display", "none");
        uiGroup.style("display", "none");
        planetLayerGroup.style("opacity", 0).style("pointer-events", "none");
        d3.select("#filtersContainer").style("display", "none");
        d3.select("#typeLegend").style("display", "none");
        // Keep infoPanel visible in system view — switch to detail state
        showInfoDetail();
        backBtn.style("display", null);
        closeBtn.style("display", "none");
    }

    function exitSystemMode() {
        d3.select("#habitabilityPanel").style("display", "none");
        systemMode = false;
        systemGroup.style("display", "none");
        backgroundGroup.style("display", null);
        uiGroup.style("display", null);
        planetLayerGroup.style("opacity", 1);
        d3.select("#filtersContainer").style("display", null);
        d3.select("#typeLegend").style("display", null);
        backBtn.style("display", "none");

        d3.transition()
            .duration(1000)
            .tween("reset", () => {
                const r = d3.interpolate(projection.rotate(), [0, 0]);
                const s = d3.interpolate(projection.scale(), height / 2.2);
                return t => {
                    projection.rotate(r(t)).scale(s(t));
                    svg.selectAll("path").attr("d", path);
                    updatePlanets();
                };
            });

        planets
            .attr("r", d => d.name === "Earth" ? 6 : 4)
            .attr("stroke", d => d.name === "Earth" ? "white" : "none")
            .attr("stroke-width", 1);

        planetLayerGroup.style("opacity", 1).style("pointer-events", "all");

        if (orbitAnimationId) cancelAnimationFrame(orbitAnimationId);
        showInfoHome();
    }

    function showSystemView(d) {
        enterSystemMode();
        systemGroup.style("display", null);
        drawSystemView(d);
    }

    backBtn.on("click", () => { exitSystemMode(); });
    closeBtn.on("click", () => { exitSystemMode(); });

    function drawSystemView(planet) {
        systemGroup.selectAll("*").remove();

        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) * 0.12;

        const flux = planet.Flux && planet.Flux > 0 ? planet.Flux : 1;
        const orbitAU = Math.sqrt(1 / flux);
        const innerFlux = 1.1;
        const outerFlux = 0.35;
        const innerAU = Math.sqrt(1 / innerFlux);
        const outerAU = Math.sqrt(1 / outerFlux);
        const orbitRadius = orbitAU * scale;
        const innerHZ = innerAU * scale;
        const outerHZ = outerAU * scale;
        const insideHZ = orbitAU >= innerAU && orbitAU <= outerAU;

        updateHabitabilityPanel(planet, orbitAU, insideHZ);

        systemGroup.append("rect")
            .attr("x", 0).attr("y", 0)
            .attr("width", width).attr("height", height)
            .attr("fill", "rgba(0,0,0,0.25)")
            .attr("pointer-events", "none");

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", outerHZ)
            .attr("fill", "rgba(0,255,140,0.10)");

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", innerHZ)
            .attr("fill", "rgba(0,0,40,0.85)");

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", innerHZ)
            .attr("fill", "none")
            .attr("stroke", "rgba(0,255,140,0.55)")
            .attr("stroke-width", 2);

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", outerHZ)
            .attr("fill", "none")
            .attr("stroke", "rgba(0,255,140,0.35)")
            .attr("stroke-width", 2);

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", 30)
            .attr("fill", "rgba(255,200,0,0.18)");

        const star = systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", 16)
            .attr("fill", "gold");

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", orbitRadius)
            .attr("fill", "none")
            .attr("stroke", "rgba(255,255,255,0.7)")
            .attr("stroke-dasharray", "6 4");

        const planetType = getPlanetType(planet.radius_re);
        const pColor = planet.name === "Earth" ? "blue" : getPlanetColor(planet);

        const p = systemGroup.append("circle")
            .attr("cx", centerX + orbitRadius).attr("cy", centerY)
            .attr("r", 8)
            .attr("fill", pColor)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);

        let angle = 0;
        let startTime = Date.now();
        const angularSpeed = 1 / Math.sqrt(orbitRadius);

        function animateOrbit() {
            const elapsed = (Date.now() - startTime) / 1000;
            angle = elapsed * angularSpeed;
            p.attr("cx", centerX + orbitRadius * Math.cos(angle))
             .attr("cy", centerY + orbitRadius * Math.sin(angle));
            orbitAnimationId = requestAnimationFrame(animateOrbit);
        }
        animateOrbit();

        // Labels
        systemGroup.append("text")
            .attr("x", centerX).attr("y", centerY - outerHZ - 30)
            .attr("text-anchor", "middle").attr("fill", "white")
            .attr("font-size", "18px").attr("font-weight", 700)
            .text(`${planet.name} — Host Star System`);

        systemGroup.append("text")
            .attr("x", width / 2).attr("y", 110)
            .attr("text-anchor", "middle").attr("fill", "#aaa")
            .attr("font-size", "12px").attr("opacity", 0.6)
            .text("Habitable zone boundaries based on Kopparapu et al. (2013) conservative flux limits.");

        // ── HZ verdict (single clean line) ──
        systemGroup.append("text")
            .attr("x", centerX).attr("y", centerY + outerHZ + 38)
            .attr("text-anchor", "middle")
            .attr("fill", insideHZ ? "#00ff88" : "#ff5555")
            .attr("font-size", "15px").attr("font-weight", 700)
            .text(insideHZ ? "✓ Inside Conservative Habitable Zone" : "✗ Outside Conservative Habitable Zone");

        // ── Orbit distance (only unique orbital fact) ──
        systemGroup.append("text")
            .attr("x", centerX).attr("y", centerY + outerHZ + 62)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.6)").attr("font-size", "12px")
            .text(`Orbital distance ≈ ${orbitAU.toFixed(2)} AU  ·  HZ range: ${innerAU.toFixed(2)}–${outerAU.toFixed(2)} AU`);

        // ── Source note ──
        systemGroup.append("text")
            .attr("x", centerX).attr("y", centerY + outerHZ + 88)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.3)").attr("font-size", "10px")
            .text("Kopparapu et al. (2013) conservative flux limits  ·  Flux relative to Earth = 1.0");

        star.on("mousemove", (event) => {
            tooltip.style("display", "block")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .html(`<strong>Host Star</strong><br/>Type: ${planet.hostname || "N/A"}<br/>Temp: ${planet.star_temp || "N/A"} K<br/>Mass: ${planet.star_mass || "N/A"} M☉<br/>Radius: ${planet.star_radius || "N/A"} R☉`);
        }).on("mouseout", () => tooltip.style("display", "none"));

        p.on("mousemove", (event) => {
            tooltip.style("display", "block")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .html(`<strong>${planet.name}</strong><br/>Flux: ${flux.toFixed(2)}<br/>Orbit: ${orbitAU.toFixed(2)} AU<br/>ESI: ${planet.esi?.toFixed(2) || "N/A"}`);
        }).on("mouseout", () => tooltip.style("display", "none"));
    }

    function updateHabitabilityPanel(planet, orbitAU, insideHZ) {
        const panel = d3.select("#habitabilityPanel");
        const content = d3.select("#habitabilityContent");
        panel.style("display", "block");

        const isEarth = planet.name === "Earth";

        // Left panel = HOST STAR data exclusively
        if (isEarth) {
            d3.select("#habitabilityTitle").text("☀ Host Star: Sun");
            content.html(`
                <p><strong>Spectral Type:</strong> G2V</p>
                <p><strong>Temperature:</strong> 5,778 K</p>
                <p><strong>Mass:</strong> 1.00 M☉</p>
                <p><strong>Radius:</strong> 1.00 R☉</p>
                <p><strong>Flux at Earth:</strong> 1.00 (reference)</p>
                <hr/>
                <p class="panel-note">The Sun is the calibration anchor for all ESI and flux measurements in this atlas.</p>
            `);
        } else {
            const starName = planet.hostname || "Unknown";
            const starType = planet.star_type || "Unknown";
            const starTemp = planet.star_temp ? `${Number(planet.star_temp).toLocaleString()} K` : "N/A";
            const starMass = planet.star_mass ? `${planet.star_mass} M☉` : "N/A";
            const starRadius = planet.star_radius ? `${planet.star_radius} R☉` : "N/A";

            // Star class colour hint
            const temp = +planet.star_temp || 0;
            const starColor = temp > 6000 ? "#fff7cc" : temp > 5000 ? "#ffe080" : temp > 4000 ? "#ffbb55" : temp > 3500 ? "#ff8833" : "#ff5522";

            d3.select("#habitabilityTitle").html(`<span style="color:${starColor}">★</span> Host Star: ${starName}`);
            content.html(`
                <p><strong>Spectral Type:</strong> ${starType}</p>
                <p><strong>Temperature:</strong> ${starTemp}</p>
                <p><strong>Mass:</strong> ${starMass}</p>
                <p><strong>Radius:</strong> ${starRadius}</p>
                <p><strong>Flux at Planet:</strong> ${planet.Flux ? planet.Flux.toFixed(2) + " × Earth" : "N/A"}</p>
                <hr/>
                <p class="panel-note">Hover over the star in the diagram for quick reference. HZ boundaries are computed from this star's luminosity.</p>
            `);
        }
    }

    // =============================
    // TAB FILTER LOGIC
    // =============================
    let activeESITab  = "all";   // "all" | "high" | "mid" | "low"
    let activeTypeTab = "all";   // "all" | planet type string
    let maxDistance   = 5000;

    const ESI_RANGES = {
        all:  d => true,
        high: d => d.esi >= 0.80,
        mid:  d => d.esi >= 0.65 && d.esi < 0.80,
        low:  d => d.esi < 0.65
    };

    function passesFilters(d) {
        if (d.name === "Earth") return true;
        const esiOk  = ESI_RANGES[activeESITab](d);
        const typeOk = activeTypeTab === "all" || getPlanetType(d.radius_re) === activeTypeTab;
        const distOk = d.distance_ly <= maxDistance;
        return esiOk && typeOk && distOk;
    }

    function applyFilters() {
        if (searchActive) return; // search mode overrides filters
        planets.style("display", d => passesFilters(d) ? null : "none");
        updatePlanetCount();
    }

    // ESI tab click
    document.querySelectorAll("#esiTabs .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#esiTabs .tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeESITab = btn.dataset.esi;
            applyFilters();
        });
    });

    // Type tab click
    document.querySelectorAll("#typeTabs .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#typeTabs .tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeTypeTab = btn.dataset.type;
            applyFilters();
        });
    });

    planets.style("opacity", 0);

    function introAnimation() {
        const startScale = height / 0.5;
        const endScale = height / 2.2;
        projection.scale(startScale);

        d3.transition()
            .duration(2000)
            .ease(d3.easeCubicInOut)
            .tween("zoomOut", () => {
                const s = d3.interpolate(startScale, endScale);
                return t => {
                    projection.scale(s(t));
                    svg.selectAll("path").attr("d", path);
                    updatePlanets();
                    planets.style("opacity", t);
                };
            })
            .on("end", () => {
                autoRotate = true;
                spinGlobe();
            });
    }

    d3.select("#distanceSlider").on("input", function() {
        maxDistance = +this.value;
        d3.select("#distanceValue").text(maxDistance);
        applyFilters();
    });


    // =============================
    // SEARCH FUNCTIONALITY
    // =============================
    let searchActive = false;
    let activeIndex = -1;

    const searchInput = document.getElementById("searchInput");
    const searchSuggestions = document.getElementById("searchSuggestions");
    const searchClear = document.getElementById("searchClear");
    const searchActiveBar = document.getElementById("searchActiveBar");

    function getSuggestions(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        return data
            .filter(d => d.name !== "Earth" && d.name.toLowerCase().includes(q))
            .sort((a, b) => b.esi - a.esi)
            .slice(0, 8);
    }

    function renderSuggestions(matches) {
        searchSuggestions.innerHTML = "";
        if (matches.length === 0) {
            searchSuggestions.style.display = "none";
            return;
        }
        matches.forEach((d, i) => {
            const item = document.createElement("div");
            item.className = "suggestion-item";
            item.innerHTML = `<span>${d.name}</span><span class="suggestion-esi">ESI ${d.esi.toFixed(2)} · ${d.distance_ly.toFixed(0)} ly</span>`;
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                selectPlanet(d);
            });
            searchSuggestions.appendChild(item);
        });
        searchSuggestions.style.display = "block";
        activeIndex = -1;
    }

    function selectPlanet(d) {
        searchInput.value = d.name;
        searchSuggestions.style.display = "none";
        searchClear.style.display = "block";
        searchActive = true;

        // Show only searched planet + Earth
        planets.style("display", p => {
            if (p.name === "Earth" || p.name === d.name) return null;
            return "none";
        });

        // Dim Earth, highlight target
        planets
            .attr("opacity", p => p.name === d.name ? 1 : 0.35)
            .attr("r", p => p.name === d.name ? 9 : (p.name === "Earth" ? 6 : 4))
            .attr("stroke", p => p.name === d.name ? "white" : "none")
            .attr("stroke-width", p => p.name === d.name ? 2 : 0);

        // Update count bar
        searchActiveBar.style.display = "block";
        searchActiveBar.innerHTML = `Showing: <strong>${d.name}</strong> + Earth &nbsp;<span style="opacity:0.6;font-size:10px;">(ESI ${d.esi.toFixed(2)})</span>`;

        // Rotate globe to focus on planet
        focusPlanet(d, null);
    }

    function clearSearch() {
        searchInput.value = "";
        searchSuggestions.style.display = "none";
        searchClear.style.display = "none";
        searchActiveBar.style.display = "none";
        searchActive = false;
        activeIndex = -1;

        // Restore all planets
        planets
            .attr("opacity", 0.9)
            .attr("r", d => d.name === "Earth" ? 6 : 4)
            .attr("stroke", d => d.name === "Earth" ? "white" : "none")
            .attr("stroke-width", 1);

        applyFilters();
    }

    searchInput.addEventListener("input", function() {
        const q = this.value.trim();
        searchClear.style.display = q ? "block" : "none";
        if (!q) { clearSearch(); return; }
        renderSuggestions(getSuggestions(q));
    });

    searchInput.addEventListener("keydown", function(e) {
        const items = searchSuggestions.querySelectorAll(".suggestion-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
        } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < items.length) {
                items[activeIndex].dispatchEvent(new Event("mousedown"));
            } else {
                const q = this.value.trim().toLowerCase();
                const match = data.find(d => d.name.toLowerCase() === q);
                if (match) selectPlanet(match);
            }
        } else if (e.key === "Escape") {
            clearSearch();
        }
    });

    searchInput.addEventListener("blur", () => {
        setTimeout(() => { searchSuggestions.style.display = "none"; }, 150);
    });

    searchClear.addEventListener("click", clearSearch);

    let distanceMode = false;
    d3.select("#toggleMode").on("click", () => {
        distanceMode = !distanceMode;
        updatePlanets();
    });

    // =============================
    // Constellation Labels
    // =============================
    const constellations = [
        { name: "Cygnus", ra: 310, dec: 40 },
        { name: "Lyra", ra: 280, dec: 38 },
        { name: "Orion", ra: 83, dec: -5 },
        { name: "Draco", ra: 260, dec: 65 },
        { name: "Centaurus", ra: 210, dec: -50 }
    ];

    const labelGroup = backgroundGroup.append("g");

    const labels = labelGroup.selectAll("text")
        .data(constellations).enter()
        .append("text")
        .attr("fill", "white").attr("font-size", "12px")
        .attr("text-anchor", "middle").attr("opacity", 0.7)
        .text(d => d.name);

    function updateLabels() {
        labels
            .attr("x", d => { const c = projection([d.ra - 180, d.dec]); return c ? c[0] : -100; })
            .attr("y", d => { const c = projection([d.ra - 180, d.dec]); return c ? c[1] : -100; });
    }
    updateLabels();

    // =============================
    // Update Positions
    // =============================
    function updatePlanets() {
        const radiusScale = d3.scaleSqrt()
            .domain([0, d3.max(data, d => d.distance_ly)])
            .range([0, height / 2 - 50]);

        planets
            .attr("cx", d => {
                if (!distanceMode) {
                    const coords = projection([d.ra - 180, d.dec]);
                    return coords ? coords[0] : -100;
                } else {
                    return width / 2 + radiusScale(d.distance_ly) * Math.cos(d._angle);
                }
            })
            .attr("cy", d => {
                if (!distanceMode) {
                    const coords = projection([d.ra - 180, d.dec]);
                    return coords ? coords[1] : -100;
                } else {
                    return height / 2 + radiusScale(d.distance_ly) * Math.sin(d._angle);
                }
            });

        updateLabels();
    }

    updatePlanets();
    introAnimation();


    // =====================================================
    // PROCEDURAL PLANET RENDERER (for planets without images)
    // =====================================================
    function drawProceduralPlanet(planet) {
        const canvas = document.getElementById("planetCanvas");
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2, r = W / 2 - 4;

        ctx.clearRect(0, 0, W, H);

        const type = getPlanetType(planet.radius_re);
        const flux = planet.Flux || 1;
        const esi  = planet.esi  || 0.5;
        const seed = planet.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const rng  = (n) => Math.abs(Math.sin(seed * 9301 + n * 49297)) ;

        // Base color by planet type
        let baseColors;
        if (type === "Rocky (Earth-like)") {
            baseColors = flux > 1.2
                ? ["#c0622a","#a84e1e","#7a3010"]   // hot rocky — orange/red
                : flux < 0.5
                ? ["#7a8fa0","#5a7080","#3a5060"]   // cold rocky — icy grey-blue
                : ["#4a7a3a","#3d6e5a","#2d5e8a"];  // temperate — greens/blues
        } else if (type === "Super-Earth") {
            baseColors = flux > 1.2
                ? ["#b05030","#904020","#703010"]
                : ["#3a6a8a","#2a5a7a","#4a7a5a"];
        } else if (type === "Sub-Earth") {
            baseColors = ["#888a7a","#707268","#585a50"];
        } else if (type === "Mini-Neptune") {
            baseColors = ["#4466aa","#335588","#5577bb"];
        } else if (type === "Gas Giant") {
            baseColors = ["#c08840","#a07030","#d09850"];
        } else {
            baseColors = ["#556677","#445566","#667788"];
        }

        // Draw sphere gradient
        const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.05, cx, cy, r);
        grad.addColorStop(0,   lighten(baseColors[0], 0.5));
        grad.addColorStop(0.4, baseColors[0]);
        grad.addColorStop(1,   baseColors[2]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw surface bands / features
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        const numBands = 3 + Math.floor(rng(1) * 4);
        for (let i = 0; i < numBands; i++) {
            const bandY  = cy - r + (i / numBands) * H + rng(i+10) * 20 - 10;
            const bandH  = 8 + rng(i+20) * 25;
            const alpha  = 0.08 + rng(i+30) * 0.18;
            const bright = rng(i+40) > 0.5;
            ctx.fillStyle = bright
                ? `rgba(255,255,255,${alpha})`
                : `rgba(0,0,0,${alpha})`;
            ctx.beginPath();
            ctx.ellipse(cx, bandY, r * (0.8 + rng(i)*0.2), bandH, 0, 0, Math.PI*2);
            ctx.fill();
        }

        // Surface spots / craters for rocky planets
        if (type === "Rocky (Earth-like)" || type === "Super-Earth" || type === "Sub-Earth") {
            const numSpots = 4 + Math.floor(rng(5) * 8);
            for (let i = 0; i < numSpots; i++) {
                const sx = cx + (rng(i*3+1) - 0.5) * r * 1.6;
                const sy = cy + (rng(i*3+2) - 0.5) * r * 1.6;
                const sr = 3 + rng(i*3+3) * 12;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI*2);
                ctx.fillStyle = `rgba(0,0,0,${0.1 + rng(i)*0.15})`;
                ctx.fill();
            }
        }

        // Cloud-like swirls for gas/neptune
        if (type === "Gas Giant" || type === "Mini-Neptune") {
            for (let i = 0; i < 5; i++) {
                const sx = cx + (rng(i*7+1) - 0.5) * r * 1.4;
                const sy = cy + (rng(i*7+2) - 0.5) * r * 0.8;
                ctx.beginPath();
                ctx.ellipse(sx, sy, 20 + rng(i)*30, 6 + rng(i)*10, rng(i)*0.5, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255,255,255,${0.06 + rng(i)*0.1})`;
                ctx.fill();
            }
        }

        // Ice caps for cold planets
        if (flux < 0.5) {
            const capR = r * (0.25 + rng(99) * 0.15);
            const capGrad = ctx.createRadialGradient(cx, cy - r + 2, 2, cx, cy - r + capR*0.5, capR);
            capGrad.addColorStop(0, "rgba(220,235,255,0.9)");
            capGrad.addColorStop(1, "rgba(180,210,240,0)");
            ctx.beginPath();
            ctx.arc(cx, cy - r + capR * 0.6, capR, 0, Math.PI*2);
            ctx.fillStyle = capGrad;
            ctx.fill();
        }

        ctx.restore();

        // Atmosphere glow
        const atmColor = flux > 1.3 ? "255,120,60" : flux < 0.4 ? "140,180,255" : "100,180,255";
        const atmGrad = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.18);
        atmGrad.addColorStop(0, `rgba(${atmColor},0.35)`);
        atmGrad.addColorStop(1, `rgba(${atmColor},0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.18, 0, Math.PI*2);
        ctx.fillStyle = atmGrad;
        ctx.fill();

        // Limb darkening
        const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        limbGrad.addColorStop(0, "rgba(0,0,0,0)");
        limbGrad.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = limbGrad;
        ctx.fill();

        // Specular highlight
        const specGrad = ctx.createRadialGradient(cx - r*0.35, cy - r*0.35, 0, cx - r*0.35, cy - r*0.35, r*0.45);
        specGrad.addColorStop(0, "rgba(255,255,255,0.22)");
        specGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = specGrad;
        ctx.fill();
    }

    function lighten(hex, amt) {
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16);
        r = Math.min(255, r + Math.round(amt * 255));
        g = Math.min(255, g + Math.round(amt * 255));
        b = Math.min(255, b + Math.round(amt * 255));
        return `rgb(${r},${g},${b})`;
    }


    // =====================================================
    // TOP CANDIDATES HOME PANEL
    // =====================================================
    function buildTopCandidates() {
        const top = data
            .filter(d => d.name !== "Earth")
            .sort((a, b) => b.esi - a.esi)
            .slice(0, 5);

        const list = document.getElementById("topCandidatesList");
        list.innerHTML = "";

        top.forEach((d, i) => {
            const type = getPlanetType(d.radius_re);
            const color = getPlanetTypeColor(type);

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <span class="candidate-rank">#${i + 1}</span>
                <span class="candidate-dot" style="background:${color}"></span>
                <div class="candidate-info">
                    <div class="candidate-name">${d.name}</div>
                    <div class="candidate-meta">${type} · ${d.distance_ly.toFixed(0)} ly</div>
                </div>
                <span class="candidate-esi">${d.esi.toFixed(2)}</span>
            `;
            item.addEventListener("click", () => {
                focusPlanet(d, null);
                showInfoDetail();
            });
            list.appendChild(item);
        });
    }

    function showInfoHome() {
        document.getElementById("infoPanelHome").style.display = "block";
        document.getElementById("infoPanelDetail").style.display = "none";
    }

    function showInfoDetail() {
        document.getElementById("infoPanelHome").style.display = "none";
        document.getElementById("infoPanelDetail").style.display = "block";
    }

    // Build on load
    buildTopCandidates();

    function focusPlanet(d, onComplete) {
        const targetRotate = [-d.ra + 180, -d.dec];

        d3.transition()
            .duration(1000)
            .tween("rotate", () => {
                const r = d3.interpolate(projection.rotate(), targetRotate);
                const s = d3.interpolate(projection.scale(), height / 1.8);
                return t => {
                    projection.rotate(r(t)).scale(s(t));
                    svg.selectAll("path").attr("d", path);
                    updatePlanets();
                };
            })
            .on("end", () => { if (onComplete) onComplete(); });

        planets
            .attr("r", p => p.name === d.name ? 8 : (p.name === "Earth" ? 6 : 4))
            .attr("stroke", p => p.name === d.name ? "white" : "none")
            .attr("stroke-width", p => p.name === d.name ? 2 : 0);

        // Try real image first; if missing, draw a procedural planet on canvas
        const imgEl = document.getElementById("planetImage");
        const imagePath = `images/${d.name}.png`;
        const testImg = new Image();
        testImg.onload = () => { imgEl.src = imagePath; imgEl.style.display = "block"; document.getElementById("planetCanvas").style.display = "none"; };
        testImg.onerror = () => { imgEl.style.display = "none"; drawProceduralPlanet(d); };
        testImg.src = imagePath;

        const planetType = getPlanetType(d.radius_re);
        const typeColor = getPlanetTypeColor(planetType);
        const typeIcon = getPlanetTypeIcon(planetType);

        showInfoDetail();
        d3.select("#planetName").text(d.name);
        d3.select("#planetDetails").html(`
            <span style="color:${typeColor}; font-weight:600;">${typeIcon} ${planetType}</span><br/>
            <strong>ESI:</strong> ${d.esi?.toFixed(2) || "N/A"}<br/>
            <strong>Distance:</strong> ${d.distance_ly.toFixed(1)} ly<br/>
            <strong>Radius:</strong> ${d.radius_re || "N/A"} R⊕<br/>
            <strong>Temperature:</strong> ${d.temperature_k || "N/A"} K<br/>
            <strong>Flux:</strong> ${d.Flux || "N/A"}<br/>
            <strong>Discovered:</strong> ${d.discovery_year}<br/>
            <strong>Method:</strong> ${d.detection_method}
        `);
    }

    // =============================
    // Auto Rotate (spinGlobe)
    // =============================
    let isHovering = false;

    function spinGlobe() {
        if (!autoRotate || systemMode || isHovering) {
            requestAnimationFrame(spinGlobe);
            return;
        }
        const rotate = projection.rotate();
        projection.rotate([rotate[0] + 0.008, rotate[1]]);
        svg.selectAll("path").attr("d", path);
        updatePlanets();
        requestAnimationFrame(spinGlobe);
    }

    // Pause rotation when mouse is anywhere over the globe
    svg.on("mouseenter", () => { isHovering = true; })
       .on("mouseleave", () => { isHovering = false; });

    // =============================
    // Double Click Reset
    // =============================
    svg.on("dblclick", () => {
        if (systemMode) { exitSystemMode(); return; }
        d3.transition().duration(1000).tween("reset", () => {
            const r = d3.interpolate(projection.rotate(), [0, 0]);
            const s = d3.interpolate(projection.scale(), height / 2.2);
            return t => {
                projection.rotate(r(t)).scale(s(t));
                svg.selectAll("path").attr("d", path);
                updatePlanets();
            };
        });
        planets
            .attr("r", d => d.name === "Earth" ? 6 : 4)
            .attr("stroke", d => d.name === "Earth" ? "white" : "none");
    });

    // =============================
    // Drag Rotation
    // =============================
    svg.call(
        d3.drag().on("drag", (event) => {
            if (systemMode) return;
            autoRotate = false;
            const rotate = projection.rotate();
            const k = 0.3;
            projection.rotate([rotate[0] - event.dx * k, rotate[1] + event.dy * k]);
            svg.selectAll("path").attr("d", path);
            updatePlanets();
        })
    );
});