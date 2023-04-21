import parse from "parse-duration";
import prettyMilliseconds, { Options } from "pretty-ms";
import { useCallback, useMemo } from "react";
import { useLocalStorageState } from "react-localstorage-hooks";
import { To, useHref } from "react-router-dom";

export const sfw = false;

export type Task = {
    number: number,
    task: string,
    duration: string | null,
    equipment: string[],
    kinks: string[],
};

export type Dataset = {
  id: number,
  name: string,
  googleSheetsLink: string | null,
  tasks: Task[],
};

export const prettyDuration = (durationSeconds: number, options?: Options) => prettyMilliseconds(durationSeconds * 1000, { ...options, unitCount: 2, separateMilliseconds: true })

export function arrayToMap<T, K extends string | number | symbol>(array: T[], key: (_: T) => K): Map<K, T> {
    const map = new Map<K, T>();

    for (const x of array) {
        map.set(key(x), x);
    }

    return map;
}

export function useTasks(): [Task[], ((_: (Task[] | ((_: Task[]) => Task[]))) => void)] {
    const [datasets, setDatasets] = useLocalStorageState<Dataset[]>('datasets', {
        initialState: []
    });

    const [activeDatasetId, _] = useLocalStorageState<null | number>('active_dataset', {
        initialState: null,
    });
    
    const allTasks = useMemo<Task[]>(() => datasets.find(d => d.id === activeDatasetId)?.tasks || [], [activeDatasetId, datasets]);
    
    const setAllTasks: ((_: (Task[] | ((_: Task[]) => Task[]))) => void) = useCallback((tasks) => {
        if (Array.isArray(tasks)) {
            setAllTasks(() => tasks);
        } else {
            setDatasets(ds => ds.map(d => d.id !== activeDatasetId ? d : { ...d, tasks: tasks(d.tasks) }))
        }
    }, [activeDatasetId]);

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

export function dbg<T>(x: T): T { return (console.log(x), x); }

export function useMinMax<T>(data: T[], accessor: (_: T) => number | null) {
    return {
        min: useMemo(() => data.length <= 0 ? 0 : Math.min(...data.map(d => accessor(d) || Number.MAX_VALUE)), [data]),
        max: useMemo(() => data.length <= 0 ? 1 : Math.max(...data.map(d => accessor(d) || Number.MIN_VALUE)), [data]),
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

export function useLink(to: To) {
    const permaPath = useHref(to);

    return useMemo(() => `${window.location.protocol}//${window.location.host}${import.meta.env.BASE_URL}${permaPath}`, [permaPath])
}
