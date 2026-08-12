import { config } from '../config.js';
import * as mockBackend from './mockBackend.js';
import * as firestoreBackend from './firestoreBackend.js';

const backend = config.useMock ? mockBackend : firestoreBackend;

export const isMock = config.useMock;
export const app = backend.initApp(config.firebase);
export const db = backend.getDb(app);
export const { doc, getDoc, setDoc, onSnapshot, writeBatch } = backend;
