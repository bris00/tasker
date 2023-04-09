import prettyMilliseconds, { Options } from "pretty-ms";

export type Data = {
    number: number,
    task: string,
    duration: number | null,
    equipment: string[],
    kinks: string[],
};

export const prettyDuration = (durationSeconds: number, options?: Options) => prettyMilliseconds(durationSeconds * 1000, { ...options, unitCount: 2, separateMilliseconds: true })