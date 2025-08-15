

// Load the NLCD Tree Canopy Cover dataset
var tcc = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/TCC/v2021-4")
            .select("Science_Percent_Tree_Canopy_Cover")  // Extract the science tree canopy cover band
            .mosaic();  // Merge tiles into a single image

// Load Arizona boundary (use 'USDOS/LSIB_SIMPLE/2017' or upload a shapefile)
var arizona = ee.FeatureCollection("TIGER/2018/States")
                .filter(ee.Filter.eq("NAME", "Arizona"));

// Load the data mask and apply it
var mask = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/TCC/v2021-4")
            .select("data_mask")
            .mosaic();

// Mask out non-processed areas (bit 2 == 1 means non-processing area)
var maskedTCC = tcc.updateMask(mask.bitwiseAnd(4).eq(0))  // Keep pixels where bit 2 is 0
                   .clip(arizona);  // Clip to Arizona boundary

// Visualization parameters to display on GEE
var visParams = {
  min: 0,
  max: 100,
  palette: ["ffffff", "006400"]
};

// Add to map
Map.centerObject(arizona, 6);
Map.addLayer(maskedTCC, visParams, "Tree Canopy Cover Arizona");

// Export to Drive as GeoTIFF
Export.image.toDrive({
  image: maskedTCC,
  description: "Arizona_Tree_Canopy_Cover",
  scale: 30,
  region: arizona.geometry(),
  fileFormat: "GeoTIFF",
  maxPixels: 1e13
});
