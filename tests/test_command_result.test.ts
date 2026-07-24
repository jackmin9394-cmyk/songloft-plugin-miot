import assert from 'node:assert/strict';
import test from 'node:test';

import { VoiceEngine } from '../src/voicecmd/engine';

(globalThis as any).songloft = {
  log: {
    info() {},
    warn() {},
    error() {},
  },
};

function createEngine(aiEnabled = false) {
  const configManager = {
    getAIConfig: async () => ({ enabled: aiEnabled }),
  };
  const engine = new VoiceEngine(
    configManager as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    aiEnabled ? {
      analyze: async () => ({
        action: 'stop',
        confidence: 'high',
        params: {},
      }),
    } as any : undefined,
  );
  return engine as any;
}

test('rule test reports matched but not executed when device operation fails', async () => {
  const engine = createEngine();
  engine.matchCommand = async () => ({
    command: { type: 'next', keywords: ['下一首'], enabled: true },
    keyword: '下一首',
    argument: '',
  });
  engine.previewSearch = async () => null;
  engine.executeCommand = async () => ({ executed: false, playedSong: null });

  const result = await engine.testCommand('下一首', 'device-1', 'account-1');
  assert.equal(result.matched, true);
  assert.equal(result.executed, false);
  assert.equal(result.note, '口令已匹配，但设备操作未成功');
});

test('rule test reports execution only after a successful device operation', async () => {
  const engine = createEngine();
  engine.matchCommand = async () => ({
    command: { type: 'stop', keywords: ['停止'], enabled: true },
    keyword: '停止',
    argument: '',
  });
  engine.previewSearch = async () => null;
  engine.executeCommand = async () => ({ executed: true, playedSong: null });

  const result = await engine.testCommand('停止', 'device-1', 'account-1');
  assert.equal(result.executed, true);
  assert.equal(result.note, undefined);
});

test('AI test propagates failed execution instead of assuming success', async () => {
  const engine = createEngine(true);
  engine.previewForAI = async () => null;
  engine.executeAIResult = async () => ({ executed: false, playedSong: null });

  const result = await engine.testCommand('停止播放', 'device-1', 'account-1');
  assert.equal(result.source, 'ai');
  assert.equal(result.matched, true);
  assert.equal(result.executed, false);
  assert.equal(result.note, '口令已识别，但设备操作未成功');
});
