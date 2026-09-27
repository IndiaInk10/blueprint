import { listProcesses } from '@guide/overlay-native';
import type { ProcessSource } from './GameDetector';

export const nativeProcessSource: ProcessSource = { list: listProcesses };
