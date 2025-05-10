// src/components/MapComponent.js
import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents
} from 'react-leaflet';
import initialIntersections from '../data/intersections';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Tooltip } from 'react-leaflet';

// Import marker images directly
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet icon setup (fix for Webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});



// Simple Graph class with Dijkstra's algorithm
class Graph {
  constructor(nodes = []) {
    this.nodes = nodes;
    this.adjList = {};
    nodes.forEach(n => (this.adjList[n] = []));
  }

  addEdge(from, to, weight) {
    if (!this.adjList[from]) this.adjList[from] = [];
    this.adjList[from].push({ node: to, weight });
  }

  shortestPath(start, end) {
    const distances = {};
    const prev = {};
    const visited = new Set();

    // init
    this.nodes.forEach(n => {
      distances[n] = Infinity;
      prev[n] = null;
    });
    distances[start] = 0;

    while (true) {
      let current = null;
      let minDist = Infinity;
      this.nodes.forEach(n => {
        if (!visited.has(n) && distances[n] < minDist) {
          minDist = distances[n];
          current = n;
        }
      });
      if (current === null || current === end) break;

      visited.add(current);
      (this.adjList[current] || []).forEach(({ node: neighbor, weight }) => {
        if (!visited.has(neighbor)) {
          const alt = distances[current] + weight;
          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            prev[neighbor] = current;
          }
        }
      });
    }

    if (distances[end] === Infinity) return null;

    // reconstruct path
    const path = [];
    let u = end;
    while (u) {
      path.unshift(u);
      u = prev[u];
    }
    return { path, distance: distances[end] };
  }
}

// Captures clicks on the map to fill in lat/lng inputs
function ClickHandler({ setNewLat, setNewLng }) {
  const [pos, setPos] = useState(null);
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPos(e.latlng);
      setNewLat(lat.toFixed(5));
      setNewLng(lng.toFixed(5));
    }
  });
  return pos ? (
    <Marker position={pos}>
      <Popup>Lat: {pos.lat.toFixed(5)}, Lng: {pos.lng.toFixed(5)}</Popup>
    </Marker>
  ) : null;
}

export default function MapComponent() {
  // load intersections
  const [nodes, setNodes] = useState(() => {
    const stored = localStorage.getItem('traffic-nodes');
    try {
      return stored ? JSON.parse(stored) : initialIntersections;
    } catch {
      localStorage.removeItem('traffic-nodes');
      return initialIntersections;
    }
  });

  // load edges (always an array)
  const [edges, setEdges] = useState(() => {
    const stored = localStorage.getItem('traffic-edges');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        localStorage.removeItem('traffic-edges');
      }
    }
    return [];  // start with empty graph
  });

  // persist to localStorage
  useEffect(() => {
    localStorage.setItem('traffic-nodes', JSON.stringify(nodes));
  }, [nodes]);
  useEffect(() => {
    localStorage.setItem('traffic-edges', JSON.stringify(edges));
  }, [edges]);

  // form state
  const [newNodeId, setNewNodeId] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [modifyEdgeId, setModifyEdgeId] = useState('');
  const [modifyWeight, setModifyWeight] = useState('');
  const [deleteNodeId, setDeleteNodeId] = useState('');
  const [deleteEdgeId, setDeleteEdgeId] = useState('');
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');
  const [route, setRoute] = useState([]);

  // Add a new intersection
  const handleAddNode = () => {
    const lat = parseFloat(newLat), lng = parseFloat(newLng);
    if (!newNodeId || isNaN(lat) || isNaN(lng)) {
      return alert('Enter valid ID, latitude & longitude.');
    }
    if (nodes.some(n => `${n.id}` === newNodeId)) {
      return alert('That ID already exists.');
    }
    setNodes([...nodes, { id: newNodeId, name: `Intersection ${newNodeId}`, position: [lat, lng] }]);
    setNewNodeId(''); setNewLat(''); setNewLng('');
  };

  // Add a new road
  const handleAddEdge = () => {
    const w = parseFloat(newWeight);
    if (!fromId || !toId || isNaN(w)) {
      return alert('Select both endpoints and a weight.');
    }
    if (fromId === toId) {
      return alert('Cannot connect an intersection to itself.');
    }
    setEdges([...edges, { from: fromId, to: toId, weight: w }]);
    setFromId(''); setToId(''); setNewWeight('');
  };

  // Modify an existing road’s weight
  const handleModifyEdge = () => {
    const w = parseFloat(modifyWeight);
    if (!modifyEdgeId || isNaN(w)) {
      return alert('Select a road and enter a new weight.');
    }
    const [f, t] = modifyEdgeId.split('-');
    setEdges(edges.map(e => e.from === f && e.to === t ? { ...e, weight: w } : e));
    setModifyEdgeId(''); setModifyWeight('');
  };

  // Remove an intersection (and its incident roads)
  const handleRemoveNode = () => {
    if (!deleteNodeId) {
      return alert('Select an intersection to delete.');
    }
    setNodes(nodes.filter(n => `${n.id}` !== deleteNodeId));
    setEdges(edges.filter(e => e.from !== deleteNodeId && e.to !== deleteNodeId));
    setDeleteNodeId('');
  };

  // Remove a single road
  const handleRemoveEdge = () => {
    if (!deleteEdgeId) {
      return alert('Select a road to delete.');
    }
    const [f, t] = deleteEdgeId.split('-');
    setEdges(edges.filter(e => !(e.from === f && e.to === t)));
    setDeleteEdgeId('');
  };

  // Compute shortest path via Dijkstra
  const handleComputeRoute = () => {
    if (!startId || !endId) {
      return alert('Select both start and end intersections.');
    }
    const g = new Graph(nodes.map(n => `${n.id}`));
    edges.forEach(e => {
      g.addEdge(e.from, e.to, e.weight);
      g.addEdge(e.to, e.from, e.weight);
    });
    const result = g.shortestPath(startId, endId);
    if (!result) {
      alert(`No path found from ${startId} to ${endId}.`);
      setRoute([]);
    } else {
      setRoute(result.path);
    }
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 300, padding: 20, background: '#f0f0f0', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}>
        <h3>Add Intersection</h3>
        <input
          placeholder="ID"
          value={newNodeId}
          onChange={e => setNewNodeId(e.target.value)}
          style={{ width: '100%', marginBottom: 5 }}
        />
        <input
          placeholder="Latitude"
          value={newLat}
          onChange={e => setNewLat(e.target.value)}
          style={{ width: '100%', marginBottom: 5 }}
        />
        <input
          placeholder="Longitude"
          value={newLng}
          onChange={e => setNewLng(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <button onClick={handleAddNode} style={{ width: '100%' }}>Add Intersection</button>
        <p style={{ fontSize: 12, color: '#555' }}>Or click map to fill lat/lng</p>

        <hr />

        <h3>Add Road</h3>
        <select value={fromId} onChange={e => setFromId(e.target.value)} style={{ width: '100%', marginBottom: 5 }}>
          <option value="">— from —</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select value={toId} onChange={e => setToId(e.target.value)} style={{ width: '100%', marginBottom: 5 }}>
          <option value="">— to —</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <input
          placeholder="Weight"
          value={newWeight}
          onChange={e => setNewWeight(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <button onClick={handleAddEdge} style={{ width: '100%' }}>Add Road</button>

        <hr />

        <h3>Modify Road</h3>
        <select value={modifyEdgeId} onChange={e => setModifyEdgeId(e.target.value)} style={{ width: '100%', marginBottom: 5 }}>
          <option value="">— select road —</option>
          {edges.map((e, i) => (
            <option key={i} value={`${e.from}-${e.to}`}>{`${e.from}→${e.to}`}</option>
          ))}
        </select>
        <input
          placeholder="New Weight"
          value={modifyWeight}
          onChange={e => setModifyWeight(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <button onClick={handleModifyEdge} style={{ width: '100%' }}>Modify Weight</button>

        <hr />

        <h3>Delete Intersection</h3>
        <select value={deleteNodeId} onChange={e => setDeleteNodeId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">— select intersection —</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <button onClick={handleRemoveNode} style={{ width: '100%', marginBottom: 10 }}>Delete Intersection</button>

        <h3>Road Closure</h3>
        <select value={deleteEdgeId} onChange={e => setDeleteEdgeId(e.target.value)} style={{ width: '100%', marginBottom: 20 }}>
          <option value="">— select road —</option>
          {edges.map((e, i) => (
            <option key={i} value={`${e.from}-${e.to}`}>{`${e.from}→${e.to}`}</option>
          ))}
        </select>
        <button onClick={handleRemoveEdge} style={{ width: '100%' }}>Delete Road</button>

        <hr />

        <h3>Shortest Path</h3>
        <select value={startId} onChange={e => setStartId(e.target.value)} style={{ width: '100%', marginBottom: 5 }}>
          <option value="">— start —</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select value={endId} onChange={e => setEndId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">— end —</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <button onClick={handleComputeRoute} style={{ width: '100%' }}>Compute Shortest Path</button>

        <button
          onClick={() => {
            localStorage.removeItem('traffic-nodes');
            localStorage.removeItem('traffic-edges');
            window.location.reload();
          }}
          style={{ width: '100%', marginTop: 20, background: '#e74c3c', color: '#fff' }}
        >
          Reset to Default
        </button>
      </div>

      {/* Map */}
      <MapContainer center={[39.96, -75.60]} zoom={14} style={{ flex: 1, height: '100vh' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler setNewLat={setNewLat} setNewLng={setNewLng} />

        {/* Draw intersections */}
        {nodes.map(n => (
          <Marker key={n.id} position={n.position}>
            <Tooltip permanent direction="top" offset={[0, -10]}>
              {n.name}
            </Tooltip>
            <Popup>{n.name}</Popup>
          </Marker>
        ))}

        {/* Draw all roads in blue */}
        {edges.map((e, i) => {
          const a = nodes.find(n => `${n.id}` === e.from);
          const b = nodes.find(n => `${n.id}` === e.to);
          return a && b ? (
            <Polyline
              key={i}
              positions={[a.position, b.position]}
              color="blue"
              weight={e.weight}
            >
            <Tooltip permanent>{`Weight: ${e.weight}`}</Tooltip>
            </Polyline>
          ) : null;
        })}

        {/* Draw computed route in green */}
        {route.map((id, i) => {
          if (i < route.length - 1) {
            const a = nodes.find(n => `${n.id}` === id);
            const b = nodes.find(n => `${n.id}` === route[i + 1]);
            return (
              <Polyline
                key={`${id}-${route[i + 1]}`}
                positions={[a.position, b.position]}
                color="green"
                weight={5}
              />
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
}



