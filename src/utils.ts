import parse from "parse-duration";
import prettyMilliseconds, { Options } from "pretty-ms";
import { useCallback, useMemo } from "react";
import { useLocalStorageState } from "react-localstorage-hooks";

export const sfw = false;

export type Task = {
    number: number,
    task: string,
    duration: string | null,
    equipment: string[],
    kinks: string[],
};

export const prettyDuration = (durationSeconds: number, options?: Options) => prettyMilliseconds(durationSeconds * 1000, { ...options, unitCount: 2, separateMilliseconds: true })

export function useTasks(): [Task[], ((_: (Task[] | ((_: Task[]) => Task[]))) => void)] {
    const [allTasks, setAllTasks] = useLocalStorageState<Task[]>('tasks', {
        initialState: []
    });

    if (sfw) {
        return [useMemo(() => allTasks.map(t => ({
            ...t,
            task: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse laoreet risus aliquam pellentesque ornare. Nunc non nibh sapien. Ut nisi nulla, gravida sit amet tortor et, efficitur venenatis erat. Vivamus gravida viverra lectus. Nulla varius felis ac velit tincidunt feugiat. Integer accumsan condimentum massa vitae vehicula. Quisque auctor magna sed ligula posuere semper. Cras varius, lorem ac sollicitudin suscipit, sapien elit posuere metus, sit amet ultricies nisl quam sed dolor. Donec ac odio mi. Vestibulum congue odio quam, in tincidunt nisi maximus sed. Donec ac efficitur est, quis feugiat est. Nunc ullamcorper nisi ut lectus feugiat lacinia. ",
            equipment: ["a", "b"],
            kinks: ["1", "2"],
        })), [allTasks]), setAllTasks];
    } else {
        return [allTasks, setAllTasks];
    }
}

export function useMinMax<T>(data: T[], accessor: (_: T) => number | null) {
    return {
        min: useMemo(() => Math.min(...data.map(d => accessor(d) || Number.MAX_VALUE)), [data]),
        max: useMemo(() => Math.max(...data.map(d => accessor(d) || Number.MIN_VALUE)), [data]),
    };
}

export function useFromPercentToRange<T>({ min, max }: { min: number, max: number }) {
    return {
        percentToDuration: useCallback((percent: number) => Math.round(percent * (max - min) + min), [min, max]),
        durationToPercent: useCallback((duration: number) => (duration - min) / (max - min), [min, max]),
        inRange: useCallback(inRange(min, max), [min, max]),
    };
}

export const ser = (a: unknown) => btoa(JSON.stringify(a)).split('=')[0];
export const deser = (a: string) => JSON.parse(atob(a));

// https://stackoverflow.com/a/17102320
const x = 0;
const midpoint = 0.98;
const z = 1;

const A = (x * z - midpoint * midpoint) / (x - 2 * midpoint + z);
const B = (midpoint - x) * (midpoint - x) / (x - 2 * midpoint + z);
const C = 2 * Math.log((z - midpoint) / (midpoint - x));

export const linearToLog = (percent: number) => Math.log((percent - A) / B) / C;
export const logToLinear = (percent: number) => A + B * Math.exp(C * percent);

export const inRange = (min: number, max: number) => (x: number) => x >= min && x <= max;

export const marks = [
    "1s",
    "2s",
    "3s",
    "5s",
    "8s",
    "13s",
    "20s",
    "30s",
    "1m",
    "2m",
    "3m",
    "5m",
    "8m",
    "13m",
    "20m",
    "30m",
    "1h",
    "2h",
    "3h",
    "5h",
    "8h",
    "13h",
    "1d",
    "2d",
    "3d",
    "5d",
    "8d",
    "13d",
    "20d",
    "1month",
    "2months",
    "3months",
    "5months",
    "8months",
    "1year",
    "2years",
    "3years",
    "5years",
    "8years",
    "13years",
    "20years",
    "30years",
    "50years",
    "80years",
].map(s => parse(s, 'sec'));

export const Null = {
    map<T, R>(x: T | null, fn: (_: T) => R): R | null {
        if (x === null) {
            return null;
        } else {
            return fn(x);
        }
    }
};
