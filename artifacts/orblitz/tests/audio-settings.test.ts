import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudio } from "../src/lib/stores/useAudio";

type FakeAudioElement = {
  volume: number;
  muted: boolean;
  paused: boolean;
  currentTime: number;
  onended: (() => void) | null;
  play: () => Promise<void>;
  pause: () => void;
  removeAttribute: (name: string) => void;
  load: () => void;
};

function makeAudio(volume = 0.65): HTMLAudioElement {
  return {
    volume,
    muted: false,
    paused: false,
    currentTime: 0,
    onended: null,
    play: () => Promise.resolve(),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  } as unknown as HTMLAudioElement;
}

function makeSynthNode() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    fadeIn: vi.fn(),
    fadeOut: vi.fn(),
    setMuted: vi.fn(),
  };
}

afterEach(() => {
  useAudio.setState({
    backgroundMusic: null,
    menuMusic: null,
    synthMenuMusic: null,
    synthGameMusic: null,
    synthBossMusic: null,
    menuBgm: null,
    isMuted: false,
    volume: 1,
    currentMusicType: null,
  });
});

describe("audio settings", () => {
  it("updates active HTML audio output immediately when volume changes", () => {
    const menuBgm = makeAudio();
    const backgroundMusic = makeAudio();
    const menuMusic = makeAudio();
    useAudio.setState({ menuBgm, backgroundMusic, menuMusic, volume: 1, isMuted: false });

    useAudio.getState().setVolume(0.4);

    expect(useAudio.getState().volume).toBe(0.4);
    expect(menuBgm.volume).toBeCloseTo(0.26);
    expect(menuBgm.muted).toBe(false);
    expect(backgroundMusic.muted).toBe(false);
    expect(menuMusic.muted).toBe(false);
  });

  it("updates active WAV effects immediately and preserves their authored mix", () => {
    const previousAudio = globalThis.Audio;
    const instances: FakeAudioElement[] = [];
    class TestAudio {
      volume = 1;
      muted = false;
      paused = false;
      currentTime = 0;
      onended: (() => void) | null = null;
      constructor() {
        instances.push(this);
      }
      play = () => Promise.resolve();
      pause = vi.fn();
      removeAttribute = vi.fn();
      load = vi.fn();
    }
    globalThis.Audio = TestAudio as unknown as typeof Audio;

    try {
      useAudio.setState({ volume: 1, isMuted: false });
      useAudio.getState().setVolume(1);
      useAudio.getState().playMenuSelect();
      expect(instances).toHaveLength(6);
      expect(instances.map((audio) => audio.volume)).toEqual([0.52, 1, 1, 1, 1, 1]);

      useAudio.getState().setVolume(0.25);

      expect(instances.every((audio) => audio.volume === 0.13)).toBe(true);
    } finally {
      useAudio.getState().releaseAudio();
      globalThis.Audio = previousAudio;
    }
  });

  it("mutes and restores active outputs immediately without changing the saved volume", () => {
    const menuBgm = makeAudio();
    const synthMenuMusic = makeSynthNode();
    useAudio.setState({
      menuBgm,
      synthMenuMusic,
      currentMusicType: "menu",
      volume: 0.6,
      isMuted: false,
    });

    useAudio.getState().toggleMute();

    expect(useAudio.getState().isMuted).toBe(true);
    expect(useAudio.getState().volume).toBe(0.6);
    expect(menuBgm.muted).toBe(true);
    expect(synthMenuMusic.setMuted).toHaveBeenCalledWith(true);

    useAudio.getState().toggleMute();

    expect(useAudio.getState().isMuted).toBe(false);
    expect(useAudio.getState().volume).toBe(0.6);
    expect(menuBgm.muted).toBe(false);
    expect(menuBgm.volume).toBeCloseTo(0.39);
    expect(synthMenuMusic.setMuted).toHaveBeenCalledWith(false);
  });
});