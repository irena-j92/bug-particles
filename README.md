# Bug particles — Bugged out

Website header exercise, AI powered.

Plain HTML, CSS and ES-module JavaScript. No bundler or build step required.

## Run

Serve `dist` over HTTP (ES modules cannot be opened with `file://`):

```sh
python3 -m http.server 8080 --directory dist
```

Visit `http://localhost:8080`. Drag the bug horizontally, or focus it and use the left/right arrow keys. Scroll down to burst; scroll up to reconstruct it.

## Files

- `dist/index.html`: accessible hero, preloader, typography, minimal menu.
- `dist/style.css`: responsive layout and loader styling.
- `dist/main.js`: camera, rendering, drag inertia, scroll timeline, lifecycle.
- `dist/ladybug.js`: deterministic surface sampling and GLSL shaders.
- `dist/vendor`: pinned Three.js 0.170.0 and GSAP 3.13.0/ScrollTrigger distributions, with original license headers.

## How it works

The model is a procedural, detailed robotic interpretation of the supplied ladybug references. It uses separate thin-walled wing covers, a physical center gap, rolled rims and gaskets, a contoured shoulder shield, a small head with optical lenses and mandibles, segmented antennae, an abdominal chassis, six articulated leg assemblies, actuator collars, piston rods, recessed screw slots, tarsal joints and paired claws. The curves use smooth per-vertex normals; the major shell panels use a high-resolution parametric surface.

The solid uses Three.js `MeshPhysicalMaterial`: metalness, variable roughness, a clearcoat layer, analytic black spots and shoulder markings, and fine optical-eye detail. A PMREM environment captures six studio softboxes into a filtered reflection map. Two direct lights and a shadow receiver provide depth and grounding. Both the physical and shadow shaders receive the same joint animation and scroll-driven dissolve, so there is no stationary shadow left behind during the burst.

After lighting and tone mapping, the solid shader converts luminance to a monochrome halftone grid. White dot density retains the shell reflections and smooth geometry; black areas retain the dark markings. A view-dependent contour lifts the silhouette. Dot spacing is stable in CSS pixels (3.8 desktop, 2.7 mobile), and the dots apply only to the ladybug. The particle burst also uses monochrome highlights.

The particle cloud is sampled directly from the final triangle surfaces, weighted by area. Desktop uses 185,000 samples and mobile uses 92,500. The mesh and particles have identical anatomy, part IDs and joint pivots. The particle shader uses a cheaper analytic reflection approximation during dispersion.

GSAP ScrollTrigger scrubs `uBurst` across the 360svh section. At progress .025–.24 an object-space dither dissolve removes the solid; particles appear during .02–.12. Seeded staggered displacement and a curved swirl scatter every part. Scroll reversal reconstructs the form. Horizontal drag and keyboard arrows rotate the combined model.

## Tune

`CONFIG` in `main.js` controls particle density, initial orientation, point size, bitmap dot size and scrub duration. Camera elevation controls the three-quarter pose. In `ladybug.js`, `shellPoint()` defines the wing-cover shape, `layouts` defines the leg proportions, `createChromeMaterial()` controls the PBR finish, and `createStudioEnvironment()` positions the softboxes. The procedural geometry uses a single solid draw call, a separate shadow pass and one particle draw call.

Reduced-motion preference disables idle movement, inertia, intro transitions and scrub lag. Direct scroll-controlled dispersion remains available. Hidden tabs skip drawing. `window.destroyBuggedOut()` releases the geometry, materials, shadow map and environment. Remove input listeners as well when repeatedly mounting this standalone example inside a framework component.

The optional Google Fonts have local fallbacks. Three.js, GSAP and ScrollTrigger are served locally. The bitmap preloader text does not depend on a font download.

## Reference documentation

- https://threejs.org/docs/pages/Points.html
- https://threejs.org/docs/pages/ShaderMaterial.html
- https://gsap.com/docs/v3/Plugins/ScrollTrigger/

## Verification

JavaScript syntax, finite geometry attributes, triangle orientation and the custom shader hooks were checked. The earlier missing-material failure was reproduced in GLSL ES 3: `patch` is a reserved word in that shader language, although the previous desktop GLSL check accepted it. Renaming that variable fixed both the physical and particle shader compilation. The updated physical, shadow-depth and particle shaders were compiled using GLSL ES 3, matching the WebGL 2 shader language. A runtime shader-error handler now surfaces failure instead of silently leaving only the shadow. Versioned module URLs prevent reuse of the old shader source. The model was inspected in an offline OpenGL render from front, side and rear angles with approximate studio reflections and the same monochrome halftone function. This is not a browser screenshot or an exact rendering of the final PBR material. Browser runtime and target-device performance testing were unavailable. The result is a procedural interpretation of the references, not an exact asset reconstruction.
