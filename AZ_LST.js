
// AZ boundary(using a TIGER for Arizona)
var Arizona = ee.FeatureCollection("TIGER/2018/States")
  .filter(ee.Filter.eq('NAME', 'Arizona'))
  .geometry();

Map.centerObject(Arizona, 10);

var sum20 = ee.Filter.date('2020-05-01','2020-09-30');
var sum19 = ee.Filter.date('2019-05-01','2019-09-30');
var sum18 = ee.Filter.date('2018-05-01','2018-09-30');
var sum17 = ee.Filter.date('2017-05-01','2017-09-30');
var sum16 = ee.Filter.date('2016-05-01','2016-09-30');

var SumFilter = ee.Filter.or(sum20, sum19, sum18,sum17, sum16);


// Function to Mask Clouds and Cloud Shadows in Landsat 8 Imagery

function cloudMask(image) {
  // Define cloud shadow and cloud bitmasks (Bits 3 and 5)
  var cloudShadowBitmask = (1 << 3);
  var cloudBitmask = (1 << 5);

  // Select the Quality Assessment (QA) band for pixel quality information
  var qa = image.select('QA_PIXEL');

  // Create a binary mask to identify clear conditions (both cloud and cloud shadow bits set to 0)
  var mask = qa.bitwiseAnd(cloudShadowBitmask).eq(0)
                .and(qa.bitwiseAnd(cloudBitmask).eq(0));

  // Update the original image, masking out cloud and cloud shadow-affected pixels
  return image.updateMask(mask);
}


// Import and preprocess Landsat 8 imagery applying cloud mask and arizona boundary
var image = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
              .filterBounds(Arizona)
              .filter(SumFilter)
              .map(applyScaleFactors)
              .map(cloudMask)
              .median()
              .clip(Arizona);

//calculate total number of images in the collection
var number =  ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
              .filterBounds(Arizona)
              .filter(SumFilter)
              .map(cloudMask);
 
print ("number of images:", number.size())
print (image);

//print the date and time of each image in the collection
var imageDates = number.map(function(image) {
  var date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd HH:mm');
  return image.set('formatted_date', date);
});

//print out the list of dates
print('Image dates:', imageDates.aggregate_array('formatted_date'));


// Define visualization parameters for True Color imagery (bands 4, 3, and 2)
var visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.15,
};


// Apply scaling factors.
function applyScaleFactors(image) {
 // Scale and offset values for optical bands
 var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
 
 // Scale and offset values for thermal bands
 var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
 
 // Add scaled bands to the original image
 return image.addBands(opticalBands, null, true)
 .addBands(thermalBands, null, true);
}

//add the processed image to the map with the specified visualization
Map.addLayer(image, visualization, 'True Color 432');

// Calculate NDVI
var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');

// Define NDVI Visualization Parameters
var ndviPalette = {
 min: -1,
 max: 1,
 palette: ['blue', 'white', 'green']
};

Map.addLayer(ndvi, ndviPalette, 'NDVI')


// Calculate the minimum NDVI
var ndviMin = ee.Number(ndvi.reduceRegion({
  reducer   : ee.Reducer.min(),
  geometry  : Arizona,
  scale     : 100,
  maxPixels : 1e9
}).values().get(0));

// Calculate the maximum NDVI
var ndviMax = ee.Number(ndvi.reduceRegion({
  reducer   : ee.Reducer.max(),
  geometry  : Arizona,
  scale     : 100,
  maxPixels : 1e9
}).values().get(0));


// Print the Minimum and Maximum NDVI Values
print("Minimum NDVI:", ndviMin);
print("Maximum NDVI:", ndviMax);

// Fraction of Vegetation (FV) Calculation
// Formula: ((NDVI - NDVI_min) / (NDVI_max - NDVI_min))^2
// Calculate FV using the NDVI values within the specified range.
// NDVI_min represents the minimum NDVI value, and NDVI_max represents the maximum NDVI value

var fv = ((ndvi.subtract(ndviMin)).divide(ndviMax.subtract(ndviMin)))
          .pow(ee.Number(2))
          .rename('FV');
        
  
// Emissivity Calculation
// Formula: 0.004 * FV + 0.986
// Calculate Land Surface Emissivity (EM) using the FV.
// The 0.004 coefficient represents the emissivity variation due to vegetation,
// and the 0.986 represents the base emissivity for other surfaces.

var em = fv.multiply(ee.Number(0.004)).add(ee.Number(0.986)).rename('EM');

// Select thermal band (Band 10) and rename it
var thermal = image.select('ST_B10').rename('thermal');

// calculate the land surface temperature (LST)
// Formula: (TB / (1 + (λ * (TB / 1.438)) * ln(em))) - 273.15

var lst = thermal.expression(
  '(TB / (1 + (0.00115 * (TB / 1.438)) * log(em))) - 273.15', {
    'TB': thermal.select('thermal'), // Select the thermal band (TB)
    'em': em // Assign emissivity (em)
  }).rename('LST23');

// Calculate the minimum LST
var lstMin = ee.Number(lst.reduceRegion({
  reducer   : ee.Reducer.min(),
  geometry  : Arizona,
  scale     : 100,
  maxPixels : 1e9
}).values().get(0));

// Calculate the maximum LST
var lstMax = ee.Number(lst.reduceRegion({
  reducer   : ee.Reducer.max(),
  geometry  : Arizona,
  scale     : 100,
  maxPixels : 1e9
}).values().get(0));

// Print the Minimum and Maximum NDVI Values
print("Minimum LST:", lstMin);
print("Maximum LST:", lstMax);

// Add the LST Layer to the Map with Custom Visualization Parameters
Map.addLayer(lst, {
  min: 18.47, // Minimum LST value
  max: 42.86, // Maximum LST value
  palette: [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ]}, 'Land Surface Temperature Mean');

Export.image.toDrive({
  image: lst,
  description: 'LSTmean',
  scale: 100,
  region: Arizona,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9
});