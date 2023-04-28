import parse from "parse-duration";
import prettyMilliseconds, { Options } from "pretty-ms";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "react-localstorage-hooks";
import papaparse from 'papaparse';
import { To, useHref } from "react-router-dom";

export const sfw = false;

export type Task = {
    number: number,
    task: string,
    duration: string | null,
    intensity: string,
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

export function mapMap<T, R, K extends string | number | symbol>(map: Map<K, T>, fn: (_: [K, T]) => R): Map<K, R> {
    const newMap = new Map<K, R>();

    for (const [k, v] of map) {
        newMap.set(k, fn([k, v]));
    }

    return newMap;
}

const wellKnownKinks = [
    "humiliation",
    "bodywriting",
    "lines",
    "ctb",
    "anal",
    "pain",
    "oral",
    "findom",
    "public",
    "bondage",
    "edging",
    "spanking",
];

const wellKnownEquipment = [
    "buttplug",
    "blender",
    "dildo",
    "nipple clamps",
    "heels",
    "plug",
    "vibrating plug",
    "collar",
    "leash",
    "gag",
    "cuffs",
    "blindfold",
    "makeup",
    "rope",
    "maid outfit",
    "gym",
    "restraints",
    "cloths pins",
    "lovense",
    "clamps",
];

function maxIdx<T, K>(iter: [K, T][], map: (_: T) => number): K | undefined {
    let maxKey = undefined;
    let maxVal = Number.MIN_SAFE_INTEGER;

    for (const [key, val] of iter) {
        const v = map(val);

        if (v > maxVal) {
            maxKey = key;
            maxVal = v;
        }
    }

    return maxKey;
}

function isTaskKey(key: string): key is keyof Task {
    const keys = ["duration", "kinks", "equipment", "task", "number", "intensity"];

    return keys.includes(key);
}

function normalizeTask(task: { [key in keyof Task]: string }): Task {
    return {
        number: parseInt(task.number),
        task: task.task,
        duration: task.duration,
        equipment: task.equipment.split(',').map(apply([toLower])),
        kinks: task.kinks.split(',').map(apply([toLower])),
        intensity: task.intensity,
    };
}

type P = (_: string) => string;

const toLower: P = (s) => s.toLowerCase();

const apply = (ps: P[]) => (s: string) => {
    let result = s;

    for (const p of ps) {
        result = p(result);
    }

    return result;
}

export function parseCsv(content: string): Task[] {
    const parsed = papaparse.parse<Record<string, string>>(content, { header: true })

    const fields = parsed.meta.fields;

    if (fields === undefined) return [];

    const filteredFields = fields.filter(Boolean);

    return parsed.data.map(d => normalizeTask({
        number: d[filteredFields[0]],
        task: d[filteredFields[1]],
        duration: d[filteredFields[2]],
        equipment: d[filteredFields[3]],
        kinks: d[filteredFields[4]],
        intensity: d[filteredFields[5]],
    }));
};

function avg(vals: number[]): number {
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function unique(vals: string[]): string[] {
    return [...new Set(vals)];
}

export function parseSheet(data: Record<string, string | number>[]): Task[] {
    const guessCol: (_: string | number, __: string) => keyof Task | "unknown" = (val, colName) => {
        if (typeof val === "number") {
            return "number";
        } else if (val.length < 20 && parse(val) !== null) {
            return "duration";
        } else if (["easy", "medium", "hard"].includes(val)) {
            return "intensity";
        } else if (avg(val.split(",").map(s => s.trim().split(" ").length)) > 3) {
            return "task";
        } else if (val.split(",").some(s => wellKnownKinks.includes(s.trim().toLowerCase()))) {
            return "kinks";
        } else if (val.split(",").some(s => wellKnownEquipment.includes(s.trim().toLowerCase()))) {
            return "equipment";
        } else {
            return "unknown";
        }
    }

    const results: Record<string, Record<keyof Task, number>> = {};

    for (const row of data) {
        for (const key in row) {
            const counts = results[key] || { "duration": 0, "kinks": 0, "equipment": 0, "task": 0, "number": 0, "intensity": 0 };

            const guess = guessCol(row[key], key);

            if (guess != "unknown") {
                counts[guess] += 1;
            }

            results[key] = counts;
        }
    }

    const colMapping: Record<keyof Task, string | null> = { "duration": null, "kinks": null, "equipment": null, "task": null, "number": null, "intensity": null };

    while (true) {
        const sheetCol = maxIdx(Object.entries(results), r => Math.max(...Object.values(r)));

        if (sheetCol === undefined) { break };

        const col = maxIdx(Object.entries(results[sheetCol]), c => c);

        if (col === undefined || !isTaskKey(col)) { break };

        colMapping[col] = sheetCol;

        for (const c in results) {
            delete results[c][col];
        }
    }

    return data.map(d => normalizeTask({
        number: Null.map(colMapping["number"], c => d[c]?.toString()) || "",
        task: Null.map(colMapping["task"], c => d[c]?.toString()) || "",
        duration: Null.map(colMapping["duration"], c => d[c]?.toString()) || "",
        equipment: Null.map(colMapping["equipment"], c => d[c]?.toString()) || "",
        kinks: Null.map(colMapping["kinks"], c => d[c]?.toString()) || "",
        intensity: Null.map(colMapping["intensity"], c => d[c]?.toString()) || "",
    }));
};

type SetHook<T> = ((_: (T | ((_: T) => T))) => void);

export function useDatasets(): [Dataset[], SetHook<Dataset[]>, number | null, SetHook<number | null>, boolean] {
    useEffect(() => {
        if (window.localStorage.getItem("datasets") === null) {
            setDatasetLoading(true);
            fetch("https://api.fureweb.com/spreadsheets/11YpYAMc1rWzjYXaEZCrL7ip3I2UJSeA048Jqvwd-3Xc")
                .then(x => x.json())
                .then(value => {
                    setDatasets([{
                        id: 1,
                        googleSheetsLink: "https://docs.google.com/spreadsheets/d/11YpYAMc1rWzjYXaEZCrL7ip3I2UJSeA048Jqvwd-3Xc",
                        name: "Chaster Community Tasks - Simp Dojo curated",
                        tasks: parseSheet(value.data),
                    }]);

                    setActiveDatasetId(1);
                    setDatasetLoading(false);
                })
                .catch(err => {
                    console.error(err);
                });
        }
    });

    const [datasets, setDatasets] = useLocalStorageState<Dataset[]>('datasets', {
        initialState: [],
    });

    const [activeDatasetId, setActiveDatasetId] = useLocalStorageState<null | number>('active_dataset', {
        initialState: null,
    });
    
    const [datasetLoading, setDatasetLoading] = useState(false);
    
    return [datasets, setDatasets, activeDatasetId, setActiveDatasetId, datasetLoading]
}

export function useTasks(): [Task[], ((_: (Task[] | ((_: Task[]) => Task[]))) => void), boolean] {
    const [datasets, setDatasets, activeDatasetId, _, datasetLoading] = useDatasets();

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
        })), [allTasks]), setAllTasks, datasetLoading];
    } else {
        return [allTasks, setAllTasks, datasetLoading];
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
