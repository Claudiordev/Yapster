import type {
  AudioProcessorOptions,
  Track,
  TrackProcessor,
} from "livekit-client";

/**
 * Scales the microphone before it is sent (the Microphone volume in Settings, 0-200%).
 * LiveKit swaps the captured track for the processed one, so everyone in the call hears
 * the result. The gain can change while the call is running.
 */
export class MicGainProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  name = "mic-gain";
  processedTrack?: MediaStreamTrack;

  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private gainNode?: GainNode;
  private destination?: MediaStreamAudioDestinationNode;

  constructor(private gain: number) {}

  async init(options: AudioProcessorOptions): Promise<void> {
    this.context = options.audioContext;
    this.source = this.context.createMediaStreamSource(
      new MediaStream([options.track]),
    );
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.gain;
    this.destination = this.context.createMediaStreamDestination();
    this.source.connect(this.gainNode).connect(this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  async restart(options: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(options);
  }

  async destroy(): Promise<void> {
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.processedTrack?.stop();
    this.source = undefined;
    this.gainNode = undefined;
    this.destination = undefined;
    this.processedTrack = undefined;
  }

  /** Smooth change of the gain (1 = unchanged), safe to call after destroy(). */
  setGain(gain: number): void {
    this.gain = gain;
    this.gainNode?.gain.setTargetAtTime(gain, this.context?.currentTime ?? 0, 0.02);
  }
}
