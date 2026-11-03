# hormuz-geo.json sources

Built by `scripts/build-plot-geo.mjs`, clipped to 51.5-61.5 E, 22.5-30.0 N and
simplified to about 400 m.

- **Vectors**: Natural Earth 10m, public domain (https://www.naturalearthdata.com,
  "All versions of Natural Earth raster + vector map data found on this website are
  in the public domain"). Layers: `ne_10m_land`, `ne_10m_coastline`,
  `ne_10m_minor_islands`, `ne_10m_bathymetry_K_200`, `_J_1000`, `_I_2000`, `_H_3000`,
  `ne_10m_admin_0_boundary_lines_land`. Fetched from the natural-earth-vector GitHub
  repository on 2026-11-03.
- **Relief**: NOAA ETOPO1 1 arc-minute global relief, public domain (US Government work),
  sampled every 0.1 degree via ERDDAP griddap `etopo180`. Used only for the tilt-mode relief.
