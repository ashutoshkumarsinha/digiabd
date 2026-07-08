import { createHmac } from 'node:crypto';
import { Kafka, type Producer } from 'kafkajs';
import type { AppConfig } from '../config.js';
import { getKafkaBrokers } from '../config.js';
import type { AbdEventType } from '../types/events.js';

export interface AbdEvent {
  event_id: string;
  event_type: AbdEventType;
  event_version: string;
  timestamp: string;
  org_id: string;
  correlation_id?: string;
  payload: Record<string, unknown>;
}

let producer: Producer | null = null;
let kafkaEnabled = false;

export async function initEventBus(config: AppConfig): Promise<void> {
  if (!config.KAFKA_ENABLED) return;

  const kafka = new Kafka({
    clientId: 'digiabd-api',
    brokers: getKafkaBrokers(config),
    retry: { retries: 3 },
  });

  producer = kafka.producer();
  await producer.connect();
  kafkaEnabled = true;
}

export async function closeEventBus(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    kafkaEnabled = false;
  }
}

export function isEventBusEnabled(): boolean {
  return kafkaEnabled;
}

export async function publishEvent(event: AbdEvent): Promise<void> {
  if (!producer || !kafkaEnabled) return;

  const topic = `org.${event.org_id}.abd.events`;
  await producer.send({
    topic,
    messages: [
      {
        key: event.event_type,
        value: JSON.stringify(event),
        headers: {
          event_type: event.event_type,
          correlation_id: event.correlation_id ?? event.event_id,
        },
      },
    ],
  });
}

export function signWebhookPayload(secret: string, body: string, timestamp: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}
