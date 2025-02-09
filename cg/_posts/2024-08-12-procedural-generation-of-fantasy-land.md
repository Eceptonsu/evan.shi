---
layout: post  
title: Procedural Generation of Fantasy Land  
description: >  
  Procedural generation offers a dynamic, efficient alternative to traditional modeling methods, creating diverse and intricate environments.  
image: /assets/img/blog/city/city.png  
sitemap: false  
accent_image: /assets/img/blog/city/city.png  
accent_color: '#1b026e'  
theme_color: '#5225e6'
---

**Procedural generation** provides a solution to the challenges of traditional modeling, which can be time-consuming and lacks the variability needed for large-scale projects. This post explores a project developed by [Andrew Yi](https://andrewyibc.github.io/) and me for the Advanced Topics in Computer Graphics (Spring 2024) course at Yale University, where we aimed to create detailed, realistic 3D environments, focusing on urban landscapes and celestial bodies.

The project aimed to craft immersive, futuristic scenes by blending expansive cityscapes with otherworldly planets. The result is a dynamic environment that looks visually stunning and allows for significant customization and scalability.

The project is divided into two main components: **procedural city generation** and **procedural planet generation**. I focused on developing the cityscape, exploring methods to generate sprawling urban environments with intricate details, while Andrew focused on bringing planets to life with surface features and weathering effects.

## Procedural City Generation

Creating a bustling urban landscape procedurally involves several key stages, each designed to build upon the previous one to produce a rich, varied, and immersive environment. This section will explore the different steps we took to generate the city, from terrain preparation to final touches that breathe life into the scene.

#### Building Generation

Our procedural city starts with terrain preparation. A simple plane is transformed into a complex landscape using Blender's Subdivision Surface modifier, which is applied with a high subdivision level to ensure the geometry has the necessary density for the fine detail. This densely subdivided plane is then subjected to a Displacement modifier. utilizing a Clouds texture with carefully chosen settings, such as a Cell Noise basis and Hard Noise type, to introduce realistic variations in elevation. These elevation changes form the terrain that will underpin the city's layout, providing natural slopes and plateaus where buildings will be placed. Once the terrain is established, we isolate the elevated regions that will serve as the foundations for individual buildings. This is achieved by selecting vertices above a certain height threshold and using Blender's mesh separation feature. Each elevated area becomes a separate object, representing a distinct building plot. To transform these plots into fully-fledged buildings, we procedurally generates structures on each plot, leveraging Blender's extrusion and scaling operations. 

To add complexity and uniqueness, **greebles** (small, decorative elements such as antennas, vent units, and solar panels) are randomly added to the rooftops. These elements are procedurally defined with specific geometries and materials, then distributed across the cityscape based on adjustable density parameters. This method not only adds visual interest but also prevents the buildings from looking too uniform, giving each structure a unique character.

#### Architectural Diversity

Achieving architectural diversity in a procedurally generated city is crucial for breaking the monotony of repetitive structures. Our approach involves programmatically modifying building rooftops to create a variety of architectural styles. By selectively extruding and scaling the top faces of buildings, we generate different roof types, including flat, pitched, and domed variants. These modifications introduce a significant amount of visual variation, which differentiate the buildings and add richness to the urban landscape.

#### Facade and Window Texturing

Detailed facade and window texturing is crucial for creating realistic buildings. We procedurally generated windows and LED screens directly on building surfaces, adding depth and authenticity. This process begins by identifying connected groups of faces on each building, which represent individual structures. Depending on a predefined probability, vertical and horizontal subdivisions are applied to these groups to create stripes that mimic window arrangements. The selected faces are then inset with precise thickness to create window frames, followed by a slight extrusion to add dimensionality. This extrusion gives the windows a realistic depth, making them appear as part of the building's structure rather than just flat textures. For areas where windows are not added, an alternative process introduces LED screens. We randomly select these faces and applies a slight offset to create a surface suitable for LED screen placement. These screens are assigned materials from a pool of predefined LED textures, ensuring that the facades are varied and visually engaging. Each face's material is carefully chosen and applied, enhancing the overall appearance of the building.

#### Final Enhancements and Cleanup

In the final stages of city generation, we applied additional enhancements to refine the scene. We did edge beveling to smooth out geometry, and further detailing of window textures to enhance building realism. Moreover, a module for simulating spaceships and spotlights is integrated, introducing animated elements like spacecraft navigating through the city and spotlights illuminating key architectural features. These dynamic elements bring the city to life, making the environment feel more vibrant and lived-in. To ensure the cityscape is both visually appealing and optimized for further use, we perform a series of cleanup operations. These include applying all modifiers to finalize the geometry, removing unused objects, and merging similar objects to streamline the scene.

![](/assets/img/blog/city/city-partial.png){:.lead width="1920" height="1080" loading="lazy"}
Figure 1: A view of the procedurally generated city with all the previously mentioned features enabled.
{:.figcaption}

## Procedural Planet Generation

The procedural generation of celestial bodies in this project focuses on two primary types of planets: rocky planets and gas giants. By leveraging solid texturing techniques and incorporating various noise functions, we are able to create diverse and realistic planetary environments that can be customized for different visual needs.

#### Rocky Planets Generation

**Terrain Generation and Modeling:** Rocky planets begin with a base shape formed from an icosphere with a user-defined subdivision level. The terrain is shaped by applying fractal noise, with three types of noise functions available: ridged monofractal Perlin noise, ridged multifractal Perlin noise, and multifractal Perlin noise. The "ridged" noise functions, inspired by Kenton Musgrave's work, are particularly effective for generating features like mountain ranges. These noises create ridge-like patterns where the original noise crosses zero, adding natural-looking elevation changes to the terrain. The noise value at each vertex determines its distance from the planet's center, allowing users to control terrain height, roughness, and detail by adjusting amplitude, frequency, and octave. If liquid surfaces like water, ice, or lava are desired, the noise values below a certain threshold are clamped to represent these features.

**Terrain Texturing:** Rocky planets can be textured with one of three presets: Earth-like with vegetation and seas, icy with snowy landscapes, or volcanic with lava flows. Texturing is achieved by blending four key colors: minimum and maximum for both land and liquid. The colors are mapped to the noise values, with smooth transitions created using the `smoothstep` interpolation function. For liquid surfaces, colors are interpolated based on the noise value relative to the liquid threshold, adding a realistic gradient effect. Land textures are similarly interpolated, with additional variety introduced by applying small-scale noise to perturb the color distribution.

**Cloud Generation:** Clouds can be added by generating an additional, concentric icosphere around the planet. The cloud layer is shaped by adjusting the alpha value of vertices based on Perlin noise. Vertices with noise values below a lower threshold become transparent, while those above an upper threshold are opaque, creating a natural cloud formation. The user can control cloud density and the "fuzziness" of the edges by adjusting noise parameters. The clouds are colored to match the planet's overall color scheme, adding an extra layer of realism.

#### Gas Giants Generation

**Band Structure and Texturing:** Gas giants, like Jupiter or Saturn, are defined by their distinct color bands. These planets start with a simple icosphere, and their surface is divided into latitudinal bands that mimic the appearance of gas giants. Each band's color is determined by predefined presets, with smooth transitions between bands created using the `smoothstep` function. The band boundaries are further refined by applying Perlin noise to the vertices, adding turbulence and creating the swirling patterns typical of gas giants. Users can adjust the "fuzziness" and "waviness" of the bands by tweaking the noise settings, giving them control over the planet's appearance.

**Ring Generation:** For gas giants that have rings, we model them using flattened toroidal shapes. The inner and outer radii of the rings are randomly generated within a specified range, and their color is derived from the same presets used for the planet. The ring's color bands are smoothly transitioned based on radial distance, ensuring they complement the planet's overall aesthetic.

![](/assets/img/blog/city/planets.png){:.lead width="1638" height="526" loading="lazy"}
Figure 2: Examples of procedurally generated celestial bodies, showcasing a realistic icy rocky planet, a hazardous lava rocky planet, and a striking gas giant, from left to right.
{:.figcaption}

## Atmosphere and Environmental Effects

#### Atmospheric Effects and Lighting

To enhance realism, we applied atmospheric effects and sophisticated lighting setups to the cityscape. A carefully positioned light source simulates sunlight, casting realistic shadows and adding depth. We also created a foggy atmosphere by filling a large cube around the city with a Volume Scatter material. This not only makes the city more immersive but also enhances the sense of scale and distance.

#### Weather Effects

Dynamic weather effects, like rain and snow, are introduced using a particle system. Raindrops and snowflakes are modeled with simple shapes—icospheres for raindrops and slightly transparent dodecagons for snowflakes. Users can customize the size, density, and speed of the precipitation to create varied weather conditions. These effects add a dynamic element to the scene, making the environment more engaging and lifelike.


## Customizations

To give users creative control, we developed an intuitive interface that allows for extensive customization of both city and planet generation. For cityscapes, users can adjust building heights, window patterns, roof styles, and even the presence of LED screens with real-time feedback. Planet generation is equally flexible, with options to define terrain roughness, color schemes, cloud layers, and gas giant bands. This high level of customization ensures that each environment can be tailored to specific aesthetic and functional requirements, making the tool versatile for various applications, from game development to virtual simulations.

![](/assets/img/blog/city/city-model.png){:.lead width="1980" height="1080" loading="lazy"}
Figure 3: The mesh for the city and planets.
{:.figcaption}