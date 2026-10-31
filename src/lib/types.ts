/** Units: the viewer's own Windy units (read from @windy/metrics, see fromWindy in units.ts) */
export type WindUnit = 'kt' | 'ms' | 'kmh' | 'mph' | 'bft';
export type DistUnit = 'nm' | 'km' | 'mi';
export type HeightUnit = 'm' | 'ft';
export type TempUnit = 'C' | 'F';
export interface Settings { wind: WindUnit; dist: DistUnit; height: HeightUnit; temp: TempUnit }

export interface Place { name: string; lat: number; lon: number }
/** A link on the About tab: "Website", "Instagram"… */
export interface Link { label: string; url: string }

/**
 * The race and the person we follow: data/race.json in the GitHub repository.
 * Change this file (not the plugin) to follow someone else in another race.
 */
export interface RaceInfo {
    athlete: {
        name: string; short: string; boat: string; boatName: string; country: string; url: string;
        /** two-letter country code for the flag ("CZ") */
        flag: string;
        /** the photo for the map and the panel: a file next to race.json ("milan.jpg") or an https address */
        photo: string;
        /** a photo of the boat behind the whole panel ("boat-bg.jpg", upright), optional */
        background: string;
        /** a photo of the boat filling the top card ("boat.jpg"), optional */
        cover: string;
        /** a photo of the boat behind "The boat" on the Now page ("boat-top.jpg"), optional */
        boatPhoto: string;
        /** a few words about them (About tab) */
        about: string;
        /** their website and social media */
        links: Link[];
    };
    race: { name: string; short: string; url: string; about: string; links: Link[] };
    start: Place & { time: number };
    finish: Place;
    /** "racing" by default; "finished" or "retired" when it's over */
    status: 'racing' | 'finished' | 'retired';
    /** when they crossed the line (or stopped racing) */
    endTime: number | null;
    /** others to follow on the athlete's page: a sponsor, the organiser… */
    follow: { name: string; links: Link[] }[];
    /**
     * "Things to look out for" on the Now page: Windy layers with one line each, written by hand while the race goes on
     * (empty: racetrack's own lines for the phase, see src/lib/layers.ts)
     */
    watch: Watch[];
    /** videos from the athlete (YouTube), newest first; empty: the Video page says they're coming */
    videos: Video[];
    /** where the positions come from, shown on About */
    source: string;
    /** the track file next to race.json (or a full https URL) */
    track: string;
}

/** One position from the tracker. Speed is stored in m/s like every speed here (the file has knots). */
/** one of Windy's map layers racetrack can switch to (src/lib/layers.ts) */
/** a YouTube video: its id (11 characters), upright (a Short, or "vertical": true) or wide, a title and when it was posted */
export interface Video { id: string; vertical: boolean; title: string; date: number | null }

export type LayerId = 'wind' | 'gust' | 'waves' | 'swell1' | 'pressure' | 'currents' | 'currentsTide' | 'rain';
/** phase: only before the start, or only once racing (and after); none: always */
export interface Watch { layer: LayerId; text: string; phase?: 'before' | 'racing' }

export interface TrackPoint { t: number; lat: number; lon: number; sog: number | null; cog: number | null }
export interface RaceTrack { updated: number | null; points: TrackPoint[] }

/** Windy's forecast for one hour at one place (SI units: m/s, °C, m) */
export interface Hour {
    ts: number;
    wind: number | null; gust: number | null; dir: number | null; temp: number | null; rain: number | null;
    waves: number | null; wavesDir: number | null; wavesPeriod: number | null;
}
