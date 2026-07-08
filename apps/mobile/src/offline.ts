import AsyncStorage from '@react-native-async-storage/async-storage';

// Offline queue keys are centralized here so all screens use one storage contract.
const QUEUE_KEY = 'abd_offline_queue';
const DEVICE_ID_KEY = 'abd_device_id';

export interface QueuedItem {
  client_id: string;
  operation: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function getDeviceId(): Promise<string> {
  // Device id is generated once and reused across sync batches.
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `mobile-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getQueue(): Promise<QueuedItem[]> {
  // Queue is persisted as JSON array in AsyncStorage.
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedItem[]) : [];
}

export async function enqueue(item: Omit<QueuedItem, 'created_at'>): Promise<void> {
  // Append-only write pattern keeps offline capture simple and reliable.
  const queue = await getQueue();
  queue.push({ ...item, created_at: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function queueSize(): Promise<number> {
  return (await getQueue()).length;
}
