import semarangRoadsRaw from '@/data/semarang-named-roads.json';
import semarangRoadGraphRaw from '@/data/semarang-road-graph.json';
import { NavigationRoute, RouteStep } from '@/types/navigation';

export interface SemarangRoadEntry {
  n: string; // Road / POI name
  h: string; // OSM highway type or 'poi'
  lat: number;
  lon: number;
}

interface RoadGraphSegment {
  n: string;
  h: string;
  c: [number, number][]; // [lon, lat][]
}

const EXTRA_SEMARANG_LANDMARKS: SemarangRoadEntry[] = [
  { n: 'Kawasan POJ City (Pearl of Java)', h: 'poi', lat: -6.9472, lon: 110.3882 },
  { n: 'Awann Costa POJ Semarang', h: 'poi', lat: -6.9445, lon: 110.3872 },
  { n: 'Pantai Marina Semarang', h: 'poi', lat: -6.9488, lon: 110.3895 },
  { n: 'Jalan Marina Raya', h: 'primary', lat: -6.9535, lon: 110.3908 },
  { n: 'Puri Maerokoco & PRPP', h: 'poi', lat: -6.9568, lon: 110.3888 },
  { n: 'Jalan Anjasmoro Raya', h: 'primary', lat: -6.9688, lon: 110.3905 },
  { n: 'Jalan Madukoro Raya', h: 'primary', lat: -6.9625, lon: 110.3914 },
];

const ROAD_ENTRIES: SemarangRoadEntry[] = [
  ...EXTRA_SEMARANG_LANDMARKS,
  ...(semarangRoadsRaw as SemarangRoadEntry[]),
];
const ROAD_SEGMENTS = semarangRoadGraphRaw as RoadGraphSegment[];

function isTollRoad(entry: { n: string; h: string }): boolean {
  const lower = entry.n.toLowerCase();
  return (
    entry.h === 'motorway' ||
    entry.h === 'motorway_link' ||
    entry.h === 'construction' ||
    lower.includes('jalan tol') ||
    lower.startsWith('tol ')
  );
}

const ROAD_IMPORTANCE: Record<string, number> = {
  motorway: 0,
  trunk: 1,
  primary: 2,
  poi: 2,
  secondary: 3,
  tertiary: 4,
  motorway_link: 5,
  trunk_link: 5,
  primary_link: 5,
  secondary_link: 5,
  tertiary_link: 5,
  unclassified: 6,
  residential: 7,
  living_street: 8,
  service: 9,
};

export function highwayTypeLabel(h: string): string {
  const labels: Record<string, string> = {
    motorway: 'Jalan Tol',
    trunk: 'Jalan Arteri',
    primary: 'Jalan Utama',
    secondary: 'Jalan Sekunder',
    tertiary: 'Jalan Penghubung',
    poi: 'Lokasi / Landmark',
    residential: 'Jalan Lingkungan',
    living_street: 'Jalan Pemukiman',
    unclassified: 'Jalan Lokal',
  };
  return labels[h] || 'Jalan Semarang';
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Offline search across all roads & POIs extracted from semarang.gpkg
 */
export function searchSemarangRoads(
  query: string,
  limit = 12
): SemarangRoadEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return ROAD_ENTRIES.filter(
      (r) => !isTollRoad(r) && (ROAD_IMPORTANCE[r.h] ?? 9) <= 3
    ).slice(0, limit);
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { entry: SemarangRoadEntry; score: number }[] = [];

  for (let i = 0; i < ROAD_ENTRIES.length; i++) {
    const entry = ROAD_ENTRIES[i];
    const lower = entry.n.toLowerCase();
    let matchedAll = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!lower.includes(tokens[t])) {
        matchedAll = false;
        break;
      }
    }
    if (!matchedAll) continue;

    let score = ROAD_IMPORTANCE[entry.h] ?? 9;
    if (lower === q) score -= 20;
    else if (lower.startsWith(q)) score -= 10;
    else if (lower.includes(` ${q}`)) score -= 4;

    scored.push({ entry, score });
  }

  scored.sort((a, b) => a.score - b.score || a.entry.n.localeCompare(b.entry.n));
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Snap coordinates to nearest non-toll Semarang road or landmark
 */
export function findNearestSemarangRoad(
  lat: number,
  lon: number
): SemarangRoadEntry | null {
  let best: SemarangRoadEntry | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < ROAD_ENTRIES.length; i++) {
    const r = ROAD_ENTRIES[i];
    if (isTollRoad(r)) continue;
    const dLat = r.lat - lat;
    const dLon = r.lon - lon;
    const approx = dLat * dLat + dLon * dLon;
    if (approx < bestDist) {
      bestDist = approx;
      best = r;
    }
  }
  return best;
}

/**
 * Finds the nearest real non-toll street segment polyline around (lat, lon)
 */
export function getLocalRoadSegmentCoordinates(
  lat: number,
  lon: number
): { roadName: string; coordinates: [number, number][] } {
  let bestSeg: RoadGraphSegment | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
    const seg = ROAD_SEGMENTS[i];
    if (!seg.c || seg.c.length < 2 || isTollRoad(seg)) continue;
    for (let k = 0; k < seg.c.length; k++) {
      const [sLon, sLat] = seg.c[k];
      const d = (sLat - lat) ** 2 + (sLon - lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestSeg = seg;
      }
    }
  }

  if (bestSeg && bestSeg.c.length >= 2) {
    return {
      roadName: bestSeg.n,
      coordinates: bestSeg.c,
    };
  }

  const nearest = findNearestSemarangRoad(lat, lon);
  return {
    roadName: nearest?.n || 'Jalan Lokal Semarang',
    coordinates: [
      [lon, lat],
      [nearest?.lon ?? lon + 0.0012, nearest?.lat ?? lat + 0.0012],
    ],
  };
}

// ─── Lazy A* Graph built from semarang.gpkg arterial/collector segments ─────
interface GraphEdge {
  to: number;
  dist: number;
  roadName: string;
  pts: [number, number][]; // [lon, lat][] from u -> v
}

interface GraphIndex {
  nodes: [number, number][]; // [lon, lat]
  adj: GraphEdge[][];
}

let cachedGraph: GraphIndex | null = null;

function nodeKey(lon: number, lat: number): string {
  // ~15m snapping resolution to stitch intersections cleanly across GPKG segments
  return `${Math.round(lon * 6500)}_${Math.round(lat * 6500)}`;
}

function getSemarangGraph(): GraphIndex {
  if (cachedGraph) return cachedGraph;

  const keyToId = new Map<string, number>();
  const nodes: [number, number][] = [];
  const adj: GraphEdge[][] = [];

  const getOrAdd = (lon: number, lat: number): number => {
    const k = nodeKey(lon, lat);
    const existing = keyToId.get(k);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    nodes.push([lon, lat]);
    adj.push([]);
    keyToId.set(k, id);
    return id;
  };

  for (let s = 0; s < ROAD_SEGMENTS.length; s++) {
    const seg = ROAD_SEGMENTS[s];
    if (isTollRoad(seg)) continue;
    const coords = seg.c;
    if (!coords || coords.length < 2) continue;

    // Add edges per polylines sub-run between snapped vertices
    const u = getOrAdd(coords[0][0], coords[0][1]);
    const v = getOrAdd(coords[coords.length - 1][0], coords[coords.length - 1][1]);

    let lengthMeters = 0;
    for (let k = 1; k < coords.length; k++) {
      lengthMeters += haversineMeters(
        coords[k - 1][1],
        coords[k - 1][0],
        coords[k][1],
        coords[k][0]
      );
    }

    if (u === v && coords.length > 2) {
      const midIdx = Math.floor(coords.length / 2);
      const m = getOrAdd(coords[midIdx][0], coords[midIdx][1]);
      const d1 = lengthMeters / 2;
      const forward1 = coords.slice(0, midIdx + 1);
      const forward2 = coords.slice(midIdx);
      adj[u].push({ to: m, dist: d1, roadName: seg.n, pts: forward1 });
      adj[m].push({ to: u, dist: d1, roadName: seg.n, pts: [...forward1].reverse() });
      adj[m].push({ to: v, dist: d1, roadName: seg.n, pts: forward2 });
      adj[v].push({ to: m, dist: d1, roadName: seg.n, pts: [...forward2].reverse() });
    } else if (u !== v) {
      adj[u].push({ to: v, dist: Math.max(5, lengthMeters), roadName: seg.n, pts: coords });
      adj[v].push({
        to: u,
        dist: Math.max(5, lengthMeters),
        roadName: seg.n,
        pts: [...coords].reverse(),
      });
    }
  }

  cachedGraph = { nodes, adj };
  return cachedGraph;
}

function findNearestGraphNode(
  graph: GraphIndex,
  lat: number,
  lon: number
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    if (graph.adj[i].length === 0) continue;
    const [nLon, nLat] = graph.nodes[i];
    const d = (nLat - lat) ** 2 + (nLon - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function inferTurnManeuver(
  prevBearing: number | null,
  nextBearing: number
): RouteStep['maneuver'] {
  if (prevBearing === null) return 'straight';
  let diff = nextBearing - prevBearing;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  if (Math.abs(diff) > 145) return 'uturn';
  if (diff > 32) return 'turn-right';
  if (diff < -32) return 'turn-left';
  return 'straight';
}

/**
 * Computes a Semarang route using the local GPKG-extracted arterial road network.
 * Works 100% offline inside Greater Semarang when external APIs fail.
 */
export function calculateOfflineSemarangRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): NavigationRoute | null {
  const graph = getSemarangGraph();
  if (graph.nodes.length === 0) return null;

  const startId = findNearestGraphNode(graph, origin.latitude, origin.longitude);
  const goalId = findNearestGraphNode(
    graph,
    destination.latitude,
    destination.longitude
  );

  // Guard: ensure origin & destination are within Semarang region (~25km from network)
  const startSnapDist = haversineMeters(
    origin.latitude,
    origin.longitude,
    graph.nodes[startId][1],
    graph.nodes[startId][0]
  );
  const goalSnapDist = haversineMeters(
    destination.latitude,
    destination.longitude,
    graph.nodes[goalId][1],
    graph.nodes[goalId][0]
  );
  if (startSnapDist > 25000 || goalSnapDist > 25000) {
    return null;
  }

  // Run Dijkstra/A* on the compact ~4k node graph
  const n = graph.nodes.length;
  const gScore = new Float64Array(n).fill(Infinity);
  const prevNode = new Int32Array(n).fill(-1);
  const prevEdgeIdx = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);

  gScore[startId] = 0;

  // Binary min-heap [fScore, nodeId]
  const heapF: number[] = [
    haversineMeters(
      graph.nodes[startId][1],
      graph.nodes[startId][0],
      graph.nodes[goalId][1],
      graph.nodes[goalId][0]
    ),
  ];
  const heapN: number[] = [startId];

  const pushHeap = (f: number, node: number) => {
    heapF.push(f);
    heapN.push(node);
    let idx = heapF.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heapF[parent] <= heapF[idx]) break;
      [heapF[parent], heapF[idx]] = [heapF[idx], heapF[parent]];
      [heapN[parent], heapN[idx]] = [heapN[idx], heapN[parent]];
      idx = parent;
    }
  };

  const popHeap = (): number => {
    const top = heapN[0];
    const lastF = heapF.pop()!;
    const lastN = heapN.pop()!;
    if (heapF.length > 0) {
      heapF[0] = lastF;
      heapN[0] = lastN;
      let idx = 0;
      const len = heapF.length;
      while (true) {
        const l = idx * 2 + 1;
        const r = l + 1;
        let smallest = idx;
        if (l < len && heapF[l] < heapF[smallest]) smallest = l;
        if (r < len && heapF[r] < heapF[smallest]) smallest = r;
        if (smallest === idx) break;
        [heapF[idx], heapF[smallest]] = [heapF[smallest], heapF[idx]];
        [heapN[idx], heapN[smallest]] = [heapN[smallest], heapN[idx]];
        idx = smallest;
      }
    }
    return top;
  };

  let found = false;
  while (heapF.length > 0) {
    const u = popHeap();
    if (visited[u]) continue;
    visited[u] = 1;
    if (u === goalId) {
      found = true;
      break;
    }

    const edges = graph.adj[u];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (visited[e.to]) continue;
      const tentative = gScore[u] + e.dist;
      if (tentative < gScore[e.to]) {
        gScore[e.to] = tentative;
        prevNode[e.to] = u;
        prevEdgeIdx[e.to] = i;
        const h = haversineMeters(
          graph.nodes[e.to][1],
          graph.nodes[e.to][0],
          graph.nodes[goalId][1],
          graph.nodes[goalId][0]
        );
        pushHeap(tentative + h, e.to);
      }
    }
  }

  // Reconstruct path of edges (or direct road-snapped polyline if disconnected minor gap)
  const edgePath: GraphEdge[] = [];
  if (found && startId !== goalId) {
    let cur = goalId;
    while (cur !== startId && prevNode[cur] !== -1) {
      const p = prevNode[cur];
      const eIdx = prevEdgeIdx[cur];
      edgePath.push(graph.adj[p][eIdx]);
      cur = p;
    }
    edgePath.reverse();
  }

  const coordinates: [number, number][] = [
    [origin.longitude, origin.latitude],
  ];
  const steps: RouteStep[] = [];
  let totalDist = 0;

  if (edgePath.length > 0) {
    let prevBearing: number | null = null;
    for (let i = 0; i < edgePath.length; i++) {
      const edge = edgePath[i];
      const pts = edge.pts;
      for (let k = 0; k < pts.length; k++) {
        const last = coordinates[coordinates.length - 1];
        if (last[0] !== pts[k][0] || last[1] !== pts[k][1]) {
          coordinates.push(pts[k]);
        }
      }

      const startPt = pts[0];
      const endPt = pts[pts.length - 1];
      const bearing = computeBearing(startPt[1], startPt[0], endPt[1], endPt[0]);
      const maneuver = inferTurnManeuver(prevBearing, bearing);
      prevBearing = bearing;
      totalDist += edge.dist;

      const roadLabel = edge.roadName || 'Jalan Semarang';
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.instruction.includes(roadLabel) && maneuver === 'straight') {
        lastStep.distance_meters += Math.round(edge.dist);
        lastStep.duration_seconds = Math.max(
          5,
          Math.round(lastStep.distance_meters / 8.5)
        );
        lastStep.end_location = { latitude: endPt[1], longitude: endPt[0] };
      } else {
        const prefix =
          maneuver === 'turn-left'
            ? 'Belok kiri ke'
            : maneuver === 'turn-right'
            ? 'Belok kanan ke'
            : maneuver === 'uturn'
            ? 'Putar balik ke'
            : 'Ikuti';
        steps.push({
          instruction: `${prefix} ${roadLabel}`,
          distance_meters: Math.round(edge.dist),
          duration_seconds: Math.max(5, Math.round(edge.dist / 8.5)),
          maneuver,
          start_location: { latitude: startPt[1], longitude: startPt[0] },
          end_location: { latitude: endPt[1], longitude: endPt[0] },
        });
      }
    }
  } else {
    // Graceful direct fallback when disconnected island segment
    const directDist = haversineMeters(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );
    totalDist = directDist;
    const nearestDestRoad = findNearestSemarangRoad(
      destination.latitude,
      destination.longitude
    );
    steps.push({
      instruction: `Menuju ${nearestDestRoad?.n || 'lokasi tujuan'}`,
      distance_meters: Math.round(directDist),
      duration_seconds: Math.max(15, Math.round(directDist / 8.5)),
      maneuver: 'straight',
      start_location: origin,
      end_location: destination,
    });
  }

  const finalCoord: [number, number] = [
    destination.longitude,
    destination.latitude,
  ];
  const lastCoord = coordinates[coordinates.length - 1];
  if (lastCoord[0] !== finalCoord[0] || lastCoord[1] !== finalCoord[1]) {
    coordinates.push(finalCoord);
  }

  totalDist += startSnapDist + goalSnapDist;

  if (steps.length > 0) {
    steps.push({
      instruction: 'Sampai di tujuan',
      distance_meters: Math.round(goalSnapDist),
      duration_seconds: Math.max(5, Math.round(goalSnapDist / 5)),
      maneuver: 'arrive',
      start_location: steps[steps.length - 1].end_location,
      end_location: destination,
    });
  }

  return {
    route_id: `semarang_gpkg_${Date.now()}`,
    distance_meters: Math.round(totalDist),
    duration_seconds: Math.max(30, Math.round(totalDist / 8.5)),
    polyline: '',
    coordinates,
    steps,
    traffic_segments: [],
    health_warnings: [],
    map_markers: [],
  };
}
