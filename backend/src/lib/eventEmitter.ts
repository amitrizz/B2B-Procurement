import { EventEmitter } from 'events';

// Create a global event emitter for SSE
// Ensure we don't recreate it on HMR in development
const globalForEventEmitter = global as unknown as { eventEmitter: EventEmitter };

export const eventEmitter = globalForEventEmitter.eventEmitter || new EventEmitter();
eventEmitter.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  globalForEventEmitter.eventEmitter = eventEmitter;
}
