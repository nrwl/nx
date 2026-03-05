import { detectAiAgent as nativeDetectAiAgent } from '../native';
import { Agent, supportedAgents } from './utils';

export function detectAiAgent(): Agent | null {
  const detected = nativeDetectAiAgent();
  if (detected && supportedAgents.includes(detected as Agent)) {
    return detected as Agent;
  }
  return null;
}
