const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#sky")
    .attr("width", width)
    .attr("height", height);

const tooltip = d3.select(".tooltip");

const defs = svg.append("defs");

// =====================================================
//  NEW: LAYER GROUPS (so we can hide/show cleanly)
// =====================================================
const backgroundGroup = svg.append("g").attr("class", "background-layer");
const planetLayerGroup = svg.append("g").attr("class", "planet-layer");
const uiGroup = svg.append("g").attr("class", "ui-layer");

// =============================
// ESI Legend
// =============================

const legendWidth = 200;
const legendHeight = 10;

//  CHANGED: legend now inside uiGroup (so it can hide in system view)
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

legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#esiGradient)");

legend.append("text")
    .attr("x", 0)
    .attr("y", -5)
    .attr("fill", "white")
    .attr("font-size", "12px")
    .text("Low ESI");

legend.append("text")
    .attr("x", legendWidth - 60)
    .attr("y", -5)
    .attr("fill", "white")
    .attr("font-size", "12px")
    .text("High ESI");

legend
  .on("mouseover", (event) => {
      tooltip.style("display", "block")
          .html(`
              <strong>Earth Similarity Index (ESI)</strong><br/>
              Measures physical similarity to Earth based on:<br/>
              • Radius<br/>
              • Density<br/>
              • Surface temperature<br/>
              • Escape velocity
          `);
  })
  .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX - 150) + "px")
        .style("top", (event.pageY -150) + "px");
  })
  .on("mouseout", () => {
      tooltip.style("display", "none");
  });


// =============================
// Projection Setup
// =============================
const projection = d3.geoOrthographic()
    .scale(height / 2.2)
    .translate([width / 2, height / 2+25])
    .clipAngle(90);

const path = d3.geoPath().projection(projection);


// =============================
// Star Background
// =============================
//  CHANGED: stars now inside backgroundGroup (so they hide in system view)
for (let i = 0; i < 800; i++) {
    backgroundGroup.append("circle")
        .attr("cx", Math.random() * width)
        .attr("cy", Math.random() * height)
        .attr("r", Math.random() * 1.2)
        .attr("fill", "white")
        .attr("opacity", Math.random() * 0.8);
}
const movingStarsGroup = backgroundGroup.append("g")
    .attr("class", "moving-stars");


const movingStars = [];

for (let i = 0; i < 30; i++) {

    const star = movingStarsGroup.append("circle")
        .attr("cx", Math.random() * width)
        .attr("cy", Math.random() * height)
        .attr("r", Math.random() * 1.3)
        .attr("fill", "white")
        .attr("opacity", 0.2 + Math.random() * 0.5);

    const speed = 0.1 + Math.random() * 0.2;

    movingStars.push({
        element: star,
        speed: speed
    });
}

function animateStars() {

    movingStars.forEach(starObj => {

        let cx = +starObj.element.attr("cx");
        let cy = +starObj.element.attr("cy");

        // Diagonal motion
        cx += starObj.speed;
        cy += starObj.speed;

        // When star leaves screen, re-enter from top or left edge
        if (cx > width || cy > height) {

            // 50% chance re-enter from top, 50% from left
            if (Math.random() < 0.5) {
                cx = Math.random() * width;
                cy = -5;
            } else {
                cx = -5;
                cy = Math.random() * height;
            }
        }

        starObj.element
            .attr("cx", cx)
            .attr("cy", cy);
    });

    requestAnimationFrame(animateStars);
}

animateStars();

// =============================
// Draw Sphere (Sky)
// =============================
//  CHANGED: sphere now inside backgroundGroup
backgroundGroup.append("path")
    .datum({ type: "Sphere" })
    .attr("d", path)
    .attr("fill", "rgba(0, 0, 40, 0.75)")
    .attr("stroke", "#333")
    


// =============================
// Add RA/Dec Grid
// =============================
const graticule = d3.geoGraticule();

//  CHANGED: graticule now inside backgroundGroup
backgroundGroup.append("path")
    .datum(graticule())
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.25)")
    .attr("stroke-width", 0.6);

// =============================
// Load Dataset
// =============================
d3.csv("habitable_master_dataset.csv").then(data => {

    data.forEach(d => {
        d.ra = +d.ra;
        d.dec = +d.dec;
        d.esi = +d.esi;
        d.distance_ly = +d.distance_ly;
        d.Flux = +d.Flux;
    });

    // Pre-compute stable random angles for distance mode
    data.forEach(d => {
        d._angle = Math.random() * 2 * Math.PI;
    });

    // Better color scale
    const colorScale = d3.scaleSequential()
        .domain([0.48, 0.83])
        .interpolator(d3.interpolateYlGn);

    //  CHANGED: planets go into planetLayerGroup
    const planetGroup = planetLayerGroup.append("g");

    let systemMode = false;

    // -----------------------------------------------------
    // (Keeping your existing close button - not deleting it)
    // We'll stop using it and use a Back button instead.
    // -----------------------------------------------------
    const closeBtn = svg.append("text")
        .attr("x", width - 40)
        .attr("y", 40)
        .attr("fill", "white")
        .attr("font-size", "24px")
        .attr("cursor", "pointer")
        .text("✕")
        .style("display", "none");

    // =====================================================
    //  NEW: Back Button (left side)
    // =====================================================
    const backBtn = svg.append("text")
        .attr("x", 40)
        .attr("y", 50)
        .attr("fill", "white")
        .attr("font-size", "20px")
        .attr("font-weight", 700)
        .attr("cursor", "pointer")
        .text("← Back")
        .style("display", "none");

    function updatePlanetCount() {
        const visiblePlanets = data.filter(d =>
            d.esi >= minESI &&
            d.distance_ly <= maxDistance
        ).length;

        d3.select("#planetCount")
        .text(`Showing ${visiblePlanets} Potentially Habitable Planets`);
        
    }

    const planets = planetGroup.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", d => d.name === "Earth" ? 6 : 4)
        .attr("fill", d => d.name === "Earth" ? "blue" : colorScale(d.esi))
        .attr("stroke", d => d.name === "Earth" ? "white" : "none")
        .attr("stroke-width", 1)
        .attr("opacity", 0.9)
        .attr("filter", "url(#glow)")
        .on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(`
                    <strong>${d.name}</strong><br/>
                    ESI: ${d.esi?.toFixed(2) || "N/A"}<br/>
                    Distance: ${d.distance_ly.toFixed(1)} ly
                `);
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        })
        .on("click", (event, d) => {
            if(!systemMode) {
                focusPlanet(d, () => {
                showSystemView(d);
                systemMode = true;
            });
            }
        });

    // =============================
    // SYSTEM VIEW GROUP
    // =============================
    const systemGroup = svg.append("g")
        .attr("class", "system-view")
        .style("display", "none");

    // =====================================================
    //  NEW: Helper functions to switch UI states
    // =====================================================
    function enterSystemMode() {
        
        // Hide globe/grid/stars/labels
        backgroundGroup.style("display", "none");

        // Hide legend/UI
        uiGroup.style("display", "none");

        // Dim other planets
        planetLayerGroup
            .style("opacity", 0)
            .style("pointer-events", "none");

        // Hide HTML filters (requires #filtersContainer wrapper in HTML)
        d3.select("#filtersContainer").style("display", "none");

        // show back button
        backBtn.style("display", null);

        // keep your close button hidden
        closeBtn.style("display", "none");
    }

    function exitSystemMode() {

        d3.select("#habitabilityPanel").style("display", "none");
        systemMode = false;

        systemGroup.style("display", "none");

        // Restore UI layers
        backgroundGroup.style("display", null);
        uiGroup.style("display", null);
        planetLayerGroup.style("opacity", 1);

        d3.select("#filtersContainer").style("display", null);

        backBtn.style("display", "none");

        //  Reset Globe Projection Smoothly
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

        // Reset planet styling
        planets
            .attr("r", d => d.name === "Earth" ? 6 : 4)
            .attr("stroke", d => d.name === "Earth" ? "white" : "none")
            .attr("stroke-width", 1);
        
        planetLayerGroup
            .style("opacity", 1)
            .style("pointer-events", "all");

        if (orbitAnimationId) {
            cancelAnimationFrame(orbitAnimationId);
        }
        
    }

    function showSystemView(d) {
        enterSystemMode();
        systemGroup.style("display", null);
        drawSystemView(d);
    }

    //  Back button click
    backBtn.on("click", () => {
        exitSystemMode();
    });

    // (Keeping your closeBtn handler: not deleting)
    closeBtn.on("click", () => {
        exitSystemMode();
    });

    function drawSystemView(planet) {
        const isEarth = planet.name === "Earth";
        systemGroup.selectAll("*").remove();

        const centerX = width / 2;
        const centerY = height / 2;

        // Safer scaling (keeps everything on screen)
        const scale = Math.min(width, height) * 0.12;

        const flux = planet.Flux && planet.Flux > 0 ? planet.Flux : 1;

        // orbit distance in AU (relative, from inverse-square law)
        const orbitAU = Math.sqrt(1 / flux);

        // Habitable zone flux limits (simple teaching version)
        const innerFlux = 1.1;
        const outerFlux = 0.35;

        const innerAU = Math.sqrt(1 / innerFlux);
        const outerAU = Math.sqrt(1 / outerFlux);

        const orbitRadius = orbitAU * scale;
        const innerHZ = innerAU * scale;
        const outerHZ = outerAU * scale;

        const insideHZ = orbitAU >= innerAU && orbitAU <= outerAU;

        updateHabitabilityPanel(planet, orbitAU, insideHZ);

        // Dim background overlay (optional)
        systemGroup.append("rect")
            .attr("x", 0).attr("y", 0)
            .attr("width", width).attr("height", height)
            .attr("fill", "rgba(0,0,0,0.25)")
            .attr("pointer-events", "none");  

        // HZ band
        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", outerHZ)
            .attr("fill", "rgba(0,255,140,0.10)");

        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", innerHZ)
            .attr("fill", "rgba(0,0,40,0.85)");

        // HZ borders
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

        // Star glow (so it’s visible)
        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", 30)
            .attr("fill", "rgba(255,200,0,0.18)");

        const star = systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", 16)
            .attr("fill", "gold");

        // Orbit path
        systemGroup.append("circle")
            .attr("cx", centerX).attr("cy", centerY)
            .attr("r", orbitRadius)
            .attr("fill", "none")
            .attr("stroke", "rgba(255,255,255,0.7)")
            .attr("stroke-dasharray", "6 4");

        // Planet marker
        let angle = 0;

        const p = systemGroup.append("circle")
            .attr("cx", centerX + orbitRadius)
            .attr("cy", centerY)
            .attr("r", 8)
            .attr("fill", "cyan")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);

        let orbitAnimationId;
        let startTime = Date.now();

        // Optional: speed scaling based on distance (slower if farther)
        const angularSpeed = 1 / Math.sqrt(orbitRadius);  

        function animateOrbit() {

            const elapsed = (Date.now() - startTime) / 1000;
            angle = elapsed * angularSpeed;

            const px = centerX + orbitRadius * Math.cos(angle);
            const py = centerY + orbitRadius * Math.sin(angle);

            p.attr("cx", px)
            .attr("cy", py);

            orbitAnimationId = requestAnimationFrame(animateOrbit);
        }

        animateOrbit();

        // Labels
        systemGroup.append("text")
            .attr("x", centerX)
            .attr("y", centerY - outerHZ - 30)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "18px")
            .attr("font-weight", 700)
            .text(`${planet.name} — Host Star System`);
        
        systemGroup.append("text")
            .attr("x", width / 2)
            .attr("y", 110)
            .attr("text-anchor", "middle")
            .attr("fill", "#aaa")
            .attr("font-size", "12px")
            .attr("opacity", 0.6)
            .text("Habitable zone boundaries based on Kopparapu et al. (2013) conservative flux limits.");

        systemGroup.append("text")
            .attr("x", centerX)
            .attr("y", centerY + outerHZ + 40)
            .attr("text-anchor", "middle")
            .attr("fill", insideHZ ? "lime" : "red")
            .attr("font-size", "16px")
            .attr("font-weight", 700)
           .text(insideHZ ?"Inside Conservative Habitable Zone" :"Outside Conservative HZ (Flux Model)");

        // Distance text (AU estimate)
        systemGroup.append("text")
            .attr("x", centerX)
            .attr("y", centerY + outerHZ + 65)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.85)")
            .attr("font-size", "13px")
            .text(`Estimated orbit ≈ ${orbitAU.toFixed(2)} AU  (from Flux = ${flux.toFixed(2)})`);

        // Explanation (very important for user understanding)
        systemGroup.append("text")
            .attr("x", centerX)
            .attr("y", centerY + outerHZ + 110)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.6)")
            .attr("font-size", "12px")
            .text("Flux values are relative to Earth (Flux = 1.0). Habitable zone shown is a simplified conservative model.");
        
        systemGroup.append("text")
            .attr("x", centerX)
            .attr("y", centerY + outerHZ + 130)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.5)")
            .attr("font-size", "11px")
            .text("Planets in dataset are selected by Earth Similarity Index (ESI), not solely by orbital position.");

        // Hover details (star + planet)
        star.on("mousemove", (event) => {
            tooltip.style("display", "block")
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px")
            .html(`
                <strong>Host Star</strong><br/>
                Type: ${planet.hostname || "N/A"}<br/>
                Temp: ${planet.star_temp || "N/A"} K<br/>
                Mass: ${planet.star_mass || "N/A"} M☉<br/>
                Radius: ${planet.star_radius || "N/A"} R☉
            `);
        }).on("mouseout", () => tooltip.style("display", "none"));

        p.on("mousemove", (event) => {
            tooltip.style("display", "block")
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px")
            .html(`
                <strong>${planet.name}</strong><br/>
                Flux: ${flux.toFixed(2)}<br/>
                Orbit: ${orbitAU.toFixed(2)} AU<br/>
                ESI: ${planet.esi?.toFixed(2) || "N/A"}
            `);
        }).on("mouseout", () => tooltip.style("display", "none"));
    }

    function updateHabitabilityPanel(planet, orbitAU, insideHZ) {

    const panel = d3.select("#habitabilityPanel");
    const content = d3.select("#habitabilityContent");

    panel.style("display", "block");

    const esi = planet.esi || 0;
    const flux = planet.Flux || 0;
    const isEarth = planet.name === "Earth";

    let esiCategory = "";
    let fluxCategory = "";
    let overallAssessment = "";

    // ---- ESI Classification ----
    if (esi >= 0.8) {
        esiCategory = "Highly Earth-like";
    } else if (esi >= 0.6) {
        esiCategory = "Moderately Earth-like";
    } else if (esi >= 0.4) {
        esiCategory = "Low Earth Similarity";
    } else {
        esiCategory = "Very Low Earth Similarity";
    }

    // ---- Flux Classification ----
    if (flux < 0.5) {
        fluxCategory = "Low stellar irradiation (Cold regime)";
    } else if (flux <= 1.5) {
        fluxCategory = "Earth-like stellar irradiation";
    } else {
        fluxCategory = "High stellar irradiation (Hot regime)";
    }

    // ---- Overall Habitability Assessment ----
    if (insideHZ && esi >= 0.6) {
        overallAssessment = "Promising habitability candidate";
    } else if (insideHZ) {
        overallAssessment = "Orbitally favorable but physically dissimilar";
    } else {
        overallAssessment = "Outside conservative habitable zone";
    }

    if (isEarth) {

        d3.select("#habitabilityTitle")
            .text("Reference Benchmark: Earth");

        content.html(`
            <p><strong>Role:</strong> Baseline for ESI and stellar flux scaling</p>
            <p><strong>Climate Regime:</strong> Temperate</p>
            <p><strong>Orbital Position:</strong> Within Conservative HZ</p>
            <p><strong>Model Anchor:</strong> Flux = 1.0 defines reference scale</p>
            <hr/>
            <p class="panel-note">
                Earth serves as the calibration reference for Earth Similarity Index (ESI)
                and stellar irradiation models used in this atlas.
            </p>
        `);

    } else {

        d3.select("#habitabilityTitle")
            .text("Habitability Interpretation");

        content.html(`
            <p><strong>Earth Similarity Level:</strong> ${esiCategory}</p>
            <p><strong>Irradiation Regime:</strong> ${fluxCategory}</p>
            <p><strong>Orbital Position:</strong> 
                <span class="${insideHZ ? "hz-good" : "hz-bad"}">
                    ${insideHZ ? 
                        "Within Conservative Habitable Zone" : 
                        "Outside Conservative Habitable Zone"}
                </span>
            </p>
            
            <hr/>
            <p class="panel-note">
                Assessment combines Earth Similarity Index (ESI) with a simplified
                stellar flux-based conservative habitable zone model.
            </p>
        `);
    }
}

    // =============================
    // SLIDER FILTER LOGIC
    // =============================

    let minESI = 0.48;
    let maxDistance = 5000;

    function applyFilters() {
        const filtered = data.filter(d =>
            d.esi >= minESI &&
            d.distance_ly <= maxDistance
        );

        planets.style("display", d =>
            (d.esi >= minESI && d.distance_ly <= maxDistance) ? null : "none"
        );
        updatePlanetCount();
    }
    planets.style("opacity", 0);

    function introAnimation() {

        const startScale = height / 0.5;  // very zoomed in
        const endScale = height / 2.2;    // normal globe

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

                    // Fade planets in gradually
                    planets.style("opacity", t);
                };
            })
            .on("end", () => {
                autoRotate = true;
                spinGlobe();
            });
    }

    // ESI Slider
    d3.select("#esiSlider").on("input", function() {
        minESI = +this.value;
        d3.select("#esiValue").text(minESI.toFixed(2));
        applyFilters();
    });

    // Distance Slider
    d3.select("#distanceSlider").on("input", function() {
        maxDistance = +this.value;
        d3.select("#distanceValue").text(maxDistance);
        applyFilters();
    });

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

    //  CHANGED: labels now in backgroundGroup (so they hide in system view)
    const labelGroup = backgroundGroup.append("g");

    const labels = labelGroup.selectAll("text")
            .data(constellations)
            .enter()
            .append("text")
            .attr("fill", "white")
            .attr("font-size", "12px")
            .attr("text-anchor", "middle")
            .attr("opacity", 0.7)
            .text(d => d.name);

        function updateLabels() {
            labels
                .attr("x", d => {
                    const coords = projection([d.ra - 180, d.dec]);
                    return coords ? coords[0] : -100;
                })
                .attr("y", d => {
                    const coords = projection([d.ra - 180, d.dec]);
                    return coords ? coords[1] : -100;
                });
        }

        updateLabels();

    // =============================
    // Function to Update Positions
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

    function focusPlanet(d,onComplete) {

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
            .on("end", () => {
                if (onComplete) onComplete();
            });

        // Highlight selected planet
        planets
            .attr("r", p => p.name === d.name ? 8 : (p.name === "Earth" ? 6 : 4))
            .attr("stroke", p => p.name === d.name ? "white" : "none")
            .attr("stroke-width", p => p.name === d.name ? 2 : 0);

        // Update image
        const imagePath = `images/${d.name}.png`;
        d3.select("#planetImage")
            .attr("src", imagePath)
            .on("error", function() {
                this.src = "images/earth.png";  // fallback if missing
            });

        // Update text
        d3.select("#planetName").text(d.name);

        d3.select("#planetDetails").html(`
            <strong>ESI:</strong> ${d.esi?.toFixed(2) || "N/A"}<br/>
            <strong>Distance:</strong> ${d.distance_ly.toFixed(1)} ly<br/>
            <strong>Radius:</strong> ${d.radius_re || "N/A"} Earth radii<br/>
            <strong>Temperature:</strong> ${d.temperature_k || "N/A"} K<br/>
            <strong>Flux:</strong> ${d.Flux || "N/A"}
        `);
    }

    // =============================
    // Double Click Reset
    // =============================
    svg.on("dblclick", () => {

        //  NEW: if you dblclick during system mode, go back to main view
        if (systemMode) {
            exitSystemMode();
            return;
        }

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
            .attr("stroke", d => d.name === "Earth" ? "white" : "none");
    });

    // =============================
    // Drag Rotation
    // =============================
    svg.call(
        d3.drag().on("drag", (event) => {

            //  NEW: disable drag when in system mode (optional but clean UX)
            if (systemMode) return;

            const rotate = projection.rotate();
            const k = 0.3;

            projection.rotate([
                rotate[0] - event.dx * k,
                rotate[1] + event.dy * k
            ]);

            svg.selectAll("path").attr("d", path);
            updatePlanets();
        })
    );

});