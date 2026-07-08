import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { apiGet, apiPost, login, syncBatch } from './src/api';
import { clearQueue, enqueue, getDeviceId, getQueue, queueSize } from './src/offline';

// Beginner note:
// This mobile app focuses on "field-first" operations:
// - capture data quickly
// - queue operations offline
// - sync to backend when network is available
interface Project {
  id: string;
  name: string;
  status: string;
}

interface Route {
  id: string;
  name: string;
}

interface Segment {
  id: string;
  chainage_start: string;
  chainage_end: string;
  completeness: string;
  status: string;
}

type Screen = 'login' | 'projects' | 'routes' | 'segments' | 'capture';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('engineer@demo.telecom');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const [projects, setProjects] = useState<Project[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  const [depth, setDepth] = useState('1.65');
  const [ductType, setDuctType] = useState('HDPE');

  useEffect(() => {
    void queueSize().then(setPending);
  }, [screen]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const t = await login(email);
      setToken(t);
      const projs = await apiGet<Project[]>(t, '/api/v1/projects');
      setProjects(projs);
      setScreen('projects');
    } catch {
      setError('Login failed — is the API running?');
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    if (!token) return;
    setProjects(await apiGet<Project[]>(token, '/api/v1/projects'));
    setScreen('projects');
  }

  async function loadRoutes(project: Project) {
    if (!token) return;
    setSelectedProject(project);
    setRoutes(await apiGet<Route[]>(token, `/api/v1/projects/${project.id}/routes`));
    setScreen('routes');
  }

  async function loadSegments(route: Route) {
    if (!token) return;
    setSelectedRoute(route);
    setSegments(await apiGet<Segment[]>(token, `/api/v1/routes/${route.id}/segments`));
    setScreen('segments');
  }

  async function createSegmentOffline() {
    if (!token || !selectedRoute) return;
    setLoading(true);
    try {
      const { coords } = await Location.getCurrentPositionAsync({});
      const clientId = `seg-${Date.now()}`;
      await enqueue({
        client_id: clientId,
        operation: 'create_segment',
        payload: {
          route_id: selectedRoute.id,
          chainage_start: segments.length * 500,
          chainage_end: segments.length * 500 + 500,
          surface_type: 'urban',
        },
      });
      await enqueue({
        client_id: `trench-${clientId}`,
        operation: 'upsert_trench',
        payload: { segment_id: clientId, depth_m: Number(depth), width_m: 0.45 },
      });
      setPending(await queueSize());
      setError(null);
    } catch {
      setError('Could not capture GPS or save offline');
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;
      const deviceId = await getDeviceId();
      await syncBatch(token, queue, deviceId);
      await clearQueue();
      setPending(0);
      if (selectedRoute) await loadSegments(selectedRoute);
    } catch {
      setError('Sync failed — data retained offline');
    } finally {
      setLoading(false);
    }
  }

  async function saveDuct() {
    if (!token || !selectedSegment) return;
    setLoading(true);
    try {
      await apiPost(token, `/api/v1/segments/${selectedSegment.id}/duct`, {
        duct_type: ductType,
        duct_count: 1,
        diameter_mm: 40,
      });
      await loadSegments(selectedRoute!);
      setScreen('segments');
    } catch {
      setError('Failed to save duct record');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Digital ABD Field</Text>
      {pending > 0 && <Text style={styles.badge}>{pending} item(s) pending sync</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {screen === 'login' && (
        <View style={styles.card}>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <Button title={loading ? 'Signing in...' : 'Sign In'} onPress={handleLogin} disabled={loading} />
        </View>
      )}

      {screen === 'projects' && token && (
        <View style={styles.card}>
          <Button title="Sync Offline Queue" onPress={syncNow} />
          <FlatList
            data={projects}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Text style={styles.link} onPress={() => loadRoutes(item)}>
                {item.name} ({item.status})
              </Text>
            )}
          />
        </View>
      )}

      {screen === 'routes' && (
        <View style={styles.card}>
          <Text style={styles.subtitle}>{selectedProject?.name}</Text>
          <FlatList
            data={routes}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <Text style={styles.link} onPress={() => loadSegments(item)}>
                {item.name}
              </Text>
            )}
          />
          <Button title="Back" onPress={loadProjects} />
        </View>
      )}

      {screen === 'segments' && (
        <View style={styles.card}>
          <Text style={styles.subtitle}>{selectedRoute?.name}</Text>
          <View style={styles.row}>
            <TextInput style={styles.inputSmall} value={depth} onChangeText={setDepth} keyboardType="decimal-pad" />
            <Button title="Capture Offline" onPress={createSegmentOffline} />
          </View>
          <FlatList
            data={segments}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <Text
                style={styles.link}
                onPress={() => {
                  setSelectedSegment(item);
                  setScreen('capture');
                }}
              >
                Ch {item.chainage_start}–{item.chainage_end} · {item.completeness}% · {item.status}
              </Text>
            )}
          />
          <Button title="Sync" onPress={syncNow} />
        </View>
      )}

      {screen === 'capture' && selectedSegment && (
        <View style={styles.card}>
          <Text>Segment {selectedSegment.chainage_start}–{selectedSegment.chainage_end}</Text>
          <TextInput style={styles.input} value={ductType} onChangeText={setDuctType} placeholder="Duct type (HDPE)" />
          <Button title="Save Duct (online)" onPress={saveDuct} />
          <Button title="Back" onPress={() => setScreen('segments')} />
        </View>
      )}

      {loading && <ActivityIndicator size="large" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f0f4f8' },
  title: { fontSize: 24, fontWeight: '700', color: '#1565c0', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#546e7a', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: '#cfd8dc', borderRadius: 8, padding: 10, marginBottom: 8 },
  inputSmall: { borderWidth: 1, borderColor: '#cfd8dc', borderRadius: 8, padding: 10, flex: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { paddingVertical: 12, color: '#1565c0', fontSize: 16 },
  error: { color: '#c62828', marginBottom: 8 },
  badge: { backgroundColor: '#fff3e0', color: '#e65100', padding: 8, borderRadius: 8, marginBottom: 8 },
});
