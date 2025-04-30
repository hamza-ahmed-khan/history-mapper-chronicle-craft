
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { CountryData, MapState } from '@/types/Map';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ZoomIn, ZoomOut } from 'lucide-react';

// Default world map in TopoJSON format (simplified for MVP)
// In a real app, you'd load this from a proper TopoJSON file
const WORLD_MAP_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

const WorldMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [mapState, setMapState] = useState<MapState>({
    countries: {},
    selectedCountry: null,
    zoom: {
      scale: 200,
      translate: [480, 300],
    },
    activeColor: '#9b87f5',
    isRecordingMode: false,
  });

  const [customLabel, setCustomLabel] = useState<string>('');
  const [conquestHistory, setConquestHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // Load the world map data
  useEffect(() => {
    setLoading(true);
    
    fetch(WORLD_MAP_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load map data');
        }
        return response.json();
      })
      .then(worldData => {
        setMapData(worldData);
        setLoading(false);
        
        // Initialize country data
        const countries = (feature(worldData, worldData.objects.countries) as any).features;
        const countryData: Record<string, CountryData> = {};
        
        countries.forEach((country: any) => {
          countryData[country.id] = {
            id: country.id,
            name: country.properties?.name || `Country ${country.id}`,
            conquered: false,
          };
        });
        
        setMapState(prev => ({
          ...prev,
          countries: countryData
        }));
        
        toast("Map loaded successfully! Select countries to conquer.");
      })
      .catch(err => {
        console.error('Error loading map data:', err);
        setError('Failed to load map data. Please try again.');
        setLoading(false);
      });
  }, []);

  // Initialize and update the map when data changes
  useEffect(() => {
    if (!mapData || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    
    // Clear existing content
    svg.selectAll('*').remove();
    
    // Create projection
    const projection = d3.geoMercator()
      .scale(mapState.zoom.scale)
      .translate(mapState.zoom.translate);
      
    // Create path generator
    const pathGenerator = d3.geoPath().projection(projection);
    
    // Extract countries feature
    const countries = (feature(mapData, mapData.objects.countries) as any).features;
    
    // Draw countries
    const countryPaths = svg.selectAll('path')
      .data(countries)
      .enter()
      .append('path')
      .attr('d', pathGenerator)
      .attr('id', (d: any) => `country-${d.id}`)
      .attr('class', (d: any) => {
        const countryData = mapState.countries[d.id];
        return `country ${countryData?.conquered ? 'conquered' : ''}`;
      })
      .style('--conquered-color', (d: any) => mapState.countries[d.id]?.color || mapState.activeColor)
      .on('click', function(event, d: any) {
        handleCountryClick(d.id);
      })
      .on('mouseover', function(event, d: any) {
        const countryData = mapState.countries[d.id];
        if (!mapState.isRecordingMode) {
          d3.select(this).attr('stroke-width', 1.5);
          
          // Show tooltip with country name
          svg.append('text')
            .attr('id', 'tooltip')
            .attr('x', event.offsetX)
            .attr('y', event.offsetY - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text(countryData?.name || `Country ${d.id}`);
        }
      })
      .on('mouseout', function() {
        if (!mapState.isRecordingMode) {
          d3.select(this).attr('stroke-width', 0.5);
          svg.select('#tooltip').remove();
        }
      });
      
    // Add country labels for conquered countries
    Object.values(mapState.countries)
      .filter(country => country.conquered && country.customLabel)
      .forEach(country => {
        const countryElement = document.getElementById(`country-${country.id}`);
        
        if (countryElement) {
          const bbox = countryElement.getBBox();
          const labelX = country.labelPosition ? country.labelPosition[0] : bbox.x + bbox.width/2;
          const labelY = country.labelPosition ? country.labelPosition[1] : bbox.y + bbox.height/2;
          
          svg.append('text')
            .attr('class', 'country-label')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text(country.customLabel || country.name);
        }
      });
      
  }, [mapData, mapState]);

  // Handle country click
  const handleCountryClick = (countryId: string) => {
    setMapState(prev => {
      const updatedCountries = { ...prev.countries };
      const country = updatedCountries[countryId];
      
      if (country) {
        // Toggle conquered status
        const newConquered = !country.conquered;
        
        updatedCountries[countryId] = {
          ...country,
          conquered: newConquered,
          color: newConquered ? prev.activeColor : undefined,
          isAnimating: newConquered,
        };
        
        // If conquering, add custom label if one exists
        if (newConquered && customLabel) {
          updatedCountries[countryId].customLabel = customLabel;
        }
        
        // Record this action in history
        const newHistory = conquestHistory.slice(0, historyIndex + 1);
        newHistory.push(countryId);
        setConquestHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        
        // Apply animation class
        if (newConquered) {
          const countryElement = document.getElementById(`country-${countryId}`);
          if (countryElement) {
            countryElement.classList.add('conquering');
            setTimeout(() => {
              countryElement.classList.remove('conquering');
            }, 1000);
          }
        }
        
        return {
          ...prev,
          countries: updatedCountries,
          selectedCountry: countryId
        };
      }
      
      return prev;
    });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setMapState(prev => ({
      ...prev,
      activeColor: newColor
    }));
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setMapState(prev => {
      const scale = direction === 'in' 
        ? prev.zoom.scale * 1.5
        : prev.zoom.scale / 1.5;
        
      return {
        ...prev,
        zoom: {
          ...prev.zoom,
          scale
        }
      };
    });
  };

  const handleResetZoom = () => {
    setMapState(prev => ({
      ...prev,
      zoom: {
        scale: 200,
        translate: [480, 300]
      }
    }));
  };

  const handleClearAll = () => {
    setMapState(prev => {
      const resetCountries = Object.entries(prev.countries).reduce(
        (acc, [id, country]) => ({
          ...acc,
          [id]: {
            ...country,
            conquered: false,
            color: undefined,
            customLabel: undefined
          }
        }), 
        {}
      );
      
      return {
        ...prev,
        countries: resetCountries,
        selectedCountry: null
      };
    });
    
    setConquestHistory([]);
    setHistoryIndex(-1);
    toast("Map has been reset!");
  };

  const toggleRecordingMode = () => {
    setMapState(prev => ({
      ...prev,
      isRecordingMode: !prev.isRecordingMode
    }));
    
    if (!mapState.isRecordingMode) {
      toast("Recording mode enabled. UI controls are hidden for clean capture.");
    } else {
      toast("Editing mode enabled. UI controls are visible.");
    }
  };

  const handleHistoryNavigation = (direction: 'backward' | 'forward') => {
    if (direction === 'backward' && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const countryToToggle = conquestHistory[newIndex + 1];
      
      setHistoryIndex(newIndex);
      
      // Toggle country conquest status
      setMapState(prev => {
        const updatedCountries = { ...prev.countries };
        if (updatedCountries[countryToToggle]) {
          updatedCountries[countryToToggle] = {
            ...updatedCountries[countryToToggle],
            conquered: false,
            color: undefined
          };
        }
        
        return {
          ...prev,
          countries: updatedCountries,
          selectedCountry: null
        };
      });
      
    } else if (direction === 'forward' && historyIndex < conquestHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const countryToToggle = conquestHistory[newIndex];
      
      setHistoryIndex(newIndex);
      
      // Toggle country conquest status
      setMapState(prev => {
        const updatedCountries = { ...prev.countries };
        if (updatedCountries[countryToToggle]) {
          updatedCountries[countryToToggle] = {
            ...updatedCountries[countryToToggle],
            conquered: true,
            color: prev.activeColor
          };
        }
        
        return {
          ...prev,
          countries: updatedCountries,
          selectedCountry: countryToToggle
        };
      });
    }
  };

  const handleMapDrag = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mapState.isRecordingMode) {
      // Implement map dragging logic here
      console.log("Map dragging would be implemented here");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading world map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Map</h2>
          <p className="text-gray-700">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen p-4">
      <div className={`flex justify-between items-center mb-4 ${mapState.isRecordingMode ? 'hidden' : ''}`}>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">ChronicleMap</h1>
          <p className="text-sm text-muted-foreground">Create animated historical map videos</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm mb-1">Conquest Color</label>
            <input
              type="color"
              value={mapState.activeColor}
              onChange={handleColorChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-1">Country Label</label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Custom label"
              className="px-2 py-1 border rounded"
            />
          </div>
          
          <button
            onClick={toggleRecordingMode}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {mapState.isRecordingMode ? 'Exit Recording Mode' : 'Enter Recording Mode'}
          </button>
          
          <button
            onClick={handleClearAll}
            className="px-3 py-2 bg-destructive text-white rounded hover:bg-opacity-90"
          >
            Reset Map
          </button>
        </div>
      </div>
      
      <div className={`flex justify-center ${mapState.isRecordingMode ? 'bg-black' : 'bg-parchment'} rounded-lg shadow-lg relative`}>
        <div 
          ref={mapContainerRef}
          className="map-container w-full relative overflow-hidden rounded-lg"
          style={{ height: '70vh' }}
        >
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%" 
            onMouseDown={handleMapDrag}
            className="bg-ocean"
          >
            {/* Map will be rendered here by D3 */}
          </svg>
          
          {!mapState.isRecordingMode && (
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
              <button
                onClick={() => handleZoom('in')}
                className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={() => handleZoom('out')}
                className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
              >
                <ZoomOut size={20} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 bg-white rounded-full shadow hover:bg-gray-100 text-xs font-bold"
              >
                R
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Timeline controls */}
      <div className={`mt-4 flex justify-center items-center gap-4 ${mapState.isRecordingMode ? 'hidden' : ''}`}>
        <button
          onClick={() => handleHistoryNavigation('backward')}
          disabled={historyIndex <= 0}
          className={`p-2 rounded-full ${historyIndex <= 0 ? 'bg-gray-200 text-gray-400' : 'bg-primary text-white'}`}
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="text-sm">
          {historyIndex + 1} / {conquestHistory.length || 1} steps
        </div>
        
        <button
          onClick={() => handleHistoryNavigation('forward')}
          disabled={historyIndex >= conquestHistory.length - 1}
          className={`p-2 rounded-full ${historyIndex >= conquestHistory.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-primary text-white'}`}
        >
          <ArrowRight size={20} />
        </button>
      </div>
      
      <div className={`mt-4 ${mapState.isRecordingMode ? 'hidden' : ''}`}>
        <h2 className="text-lg font-bold mb-2">Instructions:</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Click on countries to toggle conquest status</li>
          <li>Enter a custom label before selecting a country to add text</li>
          <li>Use the color picker to change conquest color</li>
          <li>Use timeline controls to step through your conquests</li>
          <li>Enter Recording Mode for clean capture without UI elements</li>
        </ul>
      </div>
    </div>
  );
};

export default WorldMap;
