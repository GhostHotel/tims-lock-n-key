import pink from "@/assets/radio/Pink_and_Blue.mp3.asset.json";
import wisdom from "@/assets/radio/Hidden_Wisdom_1.mp3.asset.json";
import balance from "@/assets/radio/Be_My_Balance.mp3.asset.json";
import breathing from "@/assets/radio/Still_Breathing.mp3.asset.json";

export const RADIO_TRACKS = [pink.url, wisdom.url, balance.url, breathing.url];
export class RadioPlaylist {
  private index = 0;
  private on = false;
  private disposed = false;
  constructor(
    private audio: HTMLAudioElement,
    private tracks: readonly string[] = RADIO_TRACKS,
    private onError: () => void = () => {},
  ) {
    audio.volume = 0.35;
    audio.preload = "none";
    audio.src = tracks[0] ?? "";
    audio.addEventListener("ended", this.next);
    audio.addEventListener("error", this.fail);
  }
  private play() {
    void this.audio.play().catch(() => {
      if (this.on && !this.disposed) this.fail();
    });
  }
  private fail = () => {
    if (!this.on || this.disposed) return;
    this.setOn(false);
    this.onError();
  };
  private next = () => {
    if (!this.on || this.disposed || !this.tracks.length) return;
    this.index = (this.index + 1) % this.tracks.length;
    this.audio.src = this.tracks[this.index] ?? "";
    this.play();
  };
  setOn(on: boolean) {
    this.on = on;
    if (on && this.tracks.length) this.play();
    else this.audio.pause();
  }
  setMuted(muted: boolean) {
    this.audio.muted = muted;
  }
  dispose() {
    this.disposed = true;
    this.setOn(false);
    this.audio.removeEventListener("ended", this.next);
    this.audio.removeEventListener("error", this.fail);
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
