import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Slider from '@mui/material/Slider';
import debounce from 'lodash.debounce';
import prand from 'pure-rand';

import { useLocalStorageState } from 'react-localstorage-hooks';

import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';

import { DataType, Table, useTable, useTableInstance } from 'ka-table';
import { SortDirection } from 'ka-table/enums';
import { kaPropsUtils } from 'ka-table/utils';

import Select, { OptionsOrGroups } from 'react-select';
import Container from 'react-bootstrap/Container';
import styled from 'styled-components';
import { ICellTextProps } from 'ka-table/props';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Data, prettyDuration } from '@/utils';

const StyledSelect = styled(({ className, ...props }) => (
    <Select
        {...props}
        className={className}
    />
))`
  flex-grow: 1;
`;

type Option = {
    value: string,
    label: string,
};


const equipmentFilter = (availableEquipment: string[]) => (data: Data) => {
    return availableEquipment.length == 0 || data.equipment.every(e => availableEquipment.includes(e));
};

const categoryFilter = (availableLimits: string[]) => (data: Data) => {
    return availableLimits.length == 0 || !data.kinks.some(e => availableLimits.includes(e));
};

const durationFilter = ([lower, upper]: number[]) => (data: Data) => {
    const eps = 1;

    return data.duration == null || (data.duration > (lower - eps) && data.duration < (upper + eps));
};


const SelectionCell: React.FC<ICellTextProps> = ({ rowKeyValue, isSelectedRow, selectedRows }) => {
    const table = useTableInstance();

    return (
        <input
            type='checkbox'
            checked={isSelectedRow}
            onChange={(event: any) => {
                if (event.nativeEvent.shiftKey) {
                    table.selectRowsRange(rowKeyValue, [...selectedRows].pop());
                } else if (event.currentTarget.checked) {
                    table.selectRow(rowKeyValue);
                } else {
                    table.deselectRow(rowKeyValue);
                }
            }}
        />
    );
};

const SelectionHeader = () => {
    const table = useTableInstance();
    const areAllRowsSelected = kaPropsUtils.areAllVisibleRowsSelected(table.props);

    return (
        <input
            type='checkbox'
            checked={areAllRowsSelected}
            onChange={(event) => {
                if (event.currentTarget.checked) {
                    table.selectAllVisibleRows();
                } else {
                    table.deselectAllVisibleRows();
                }
            }}
        />
    );
};

const Null = {
    map<T, R>(x: T | null, fn: (_: T) => R): R | null {
        if (x === null) {
            return null;
        } else {
            return fn(x);
        }
    }
};

const EQUIPMENT_KEY = 1;
const CATEGORIES_KEY = 2;
const SEARCH_KEY = 1;
const DURATION_KEY = 2;

export default () => {
    const [allData, _] = useLocalStorageState<Data[]>('tasks', {
        initialState: [
            { number: 31, task: "Buy a new smaller/spikier/more secure/more embarrassing cage or belt.", duration: 30 * 60, equipment: ["money"], kinks: [] },
            { number: 41, task: "Stand 15 minutes with a cup of water on your head, in your highest heels and with a vibrating plug. If it falls, start over. Try at least 3 times.", duration: 10 * 24 * 60 * 60, equipment: ["heels", "vibrating plug"], kinks: ["anal", "feminization"] },
            { number: 37, task: "put on some nipple clamps to wear during the next task and roll again.", duration: null, equipment: ["nipple clamps"], kinks: ["mild pain"] },
            { number: 38, task: "make a nice picture/drawing for your keyholder. Subject of your choice, or ask keyholder if you can't think of anything.", duration: 24 * 60 * 60, equipment: [], kinks: [] },
        ]
    });

    // useEffect(() => console.log(allData), [allData]);

    const shuffleData = useCallback(() => allData.map(d => ({ ...d, randomValue: Math.random() })), [allData]);

    const maxDuration = useMemo(() => Math.max(...allData.map(d => d.duration || Number.MIN_VALUE)), [allData]);
    const minDuration = useMemo(() => Math.min(...allData.map(d => d.duration || Number.MAX_VALUE)), [allData]);

    const percentToDuration = useCallback((percent: number) => percent * (maxDuration - minDuration) + minDuration, [minDuration, maxDuration]);
    // const durationToPercent = (duration: number) => (duration - minDuration) / (maxDuration - minDuration);

    // https://stackoverflow.com/a/17102320
    const x = 0;
    const midpoint = 0.8;
    const z = 1;

    const A = (x * z - midpoint * midpoint) / (x - 2 * midpoint + z);
    const B = (midpoint - x) * (midpoint - x) / (x - 2 * midpoint + z);
    const C = 2 * Math.log((z - midpoint) / (midpoint - x));

    const linearToLog = (percent: number) => Math.log((percent - A) / B) / C;
    // const logToLinear = (percent: number) => A + B * Math.exp(C * percent);

    const [searchParams, setSearchParams] = useSearchParams();

    const ser = (a: unknown) => btoa(JSON.stringify(a)).split('=')[0];
    const deser = (a: string) => JSON.parse(atob(a));

    const profile = Null.map(searchParams.get("profile"), deser) || { [EQUIPMENT_KEY]: [], [CATEGORIES_KEY]: [] };
    const ephemeral = Null.map(searchParams.get("ephemeral"), deser) || { [DURATION_KEY]: [0, 1], [SEARCH_KEY]: undefined };

    const [availableEquipment, setAvailableEquipment] = useState<string[]>(profile[EQUIPMENT_KEY]);
    const [availableLimits, setAvailableLimits] = useState<string[]>(profile[CATEGORIES_KEY]);
    const [durationRange, setDurationRange] = useState(ephemeral[DURATION_KEY]);
    const [searchText, setSearchText] = useState<undefined | string>(ephemeral[SEARCH_KEY]);

    const [selectedData, setSelectedData] = useState<number[]>([]);

    const table = useTable({
        onDispatch: (_, tableProps) => {
            const selected = kaPropsUtils.getSelectedData(tableProps);

            setSelectedData(selected.map(s => s.number));
        },
    });

    const generateSeed = () => Date.now() ^ (Math.random() * 0x100000000);
    const [shuffleSeed, setShuffledSeed] = useState(generateSeed());

    const nthRand = (rng: prand.RandomGenerator, n: number) => {
        const [val, _] = prand.uniformIntDistribution(0, Number.MAX_SAFE_INTEGER, prand.skipN(rng, n));
        return val / Number.MAX_SAFE_INTEGER;
    };

    const filteredData = useMemo(() => {
        let rng = prand.xoroshiro128plus(shuffleSeed);
        rng = rng.jump ? rng.jump() : rng;

        return allData.slice()
            .filter(equipmentFilter(availableEquipment))
            .filter(categoryFilter(availableLimits))
            .filter(durationFilter(durationRange.map(linearToLog).map(percentToDuration)))
            .map(d => ({ ...d, randomValue: nthRand(rng, d.number), duration: d.duration !== null ? prettyDuration(d.duration) : null }));
    }, [availableEquipment, availableLimits, durationRange, allData, shuffleSeed]);

    const equipmentOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allData.flatMap(row => row.equipment))].map(eq => ({ value: eq, label: eq, })), [allData]);
    const limitsOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allData.flatMap(row => row.kinks))].map(eq => ({ value: eq, label: eq, })), [allData]);

    const equipmentFilterChanged = (equipment: Option[]) => {
        setAvailableEquipment(equipment.map(e => e.value));
    };

    const limitsFilterChanged = (category: Option[]) => {
        setAvailableLimits(category.map(e => e.value));
    };

    const durationChange = (_: unknown, range: number[] | number) => {
        if (typeof range == "number") {
            console.warn("WRONG TYPE IN CHANGE EVENT HANDLER");
            throw "WRONG TYPE IN CHANGE EVENT HANDLER";
        }

        const [lower, upper] = range;
        setDurationRange([lower, upper]);
    };

    const inputGroupTextStyle = { width: "11em" };

    const shuffleList = () => setShuffledSeed(generateSeed());

    const randomChoices = useMemo(() => {
        const filteredIds = filteredData.map(d => d.number);

        const selected = selectedData.length == 0 ? filteredIds : selectedData
            .filter(s => filteredIds.includes(s));

        return selected.sort();
    }, [filteredData, selectedData]);

    const pushHistory = useCallback(
        debounce((params) => {
            setSearchParams(old => ({ ...old, ...params, }), { replace: true });
        }, 500),
        []
    );

    useEffect(() => pushHistory({
        profile: ser({ [EQUIPMENT_KEY]: availableEquipment, [CATEGORIES_KEY]: availableLimits }),
        ephemeral: ser({ [DURATION_KEY]: durationRange, [SEARCH_KEY]: searchText })
    }), [availableEquipment, availableLimits, durationRange, searchText]);

    const navigate = useNavigate();

    const openRandom = () => {
        navigate("/random/" + randomChoices.join(","));
    };

    return (
        <Container>
            <Form>
                <Form.Group>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Limits</InputGroup.Text>
                        <StyledSelect
                            defaultValue={availableLimits.map(c => ({ value: c, label: c }))}
                            onChange={limitsFilterChanged}
                            isMulti
                            options={limitsOptions}
                            classNamePrefix="select"
                        />
                    </InputGroup>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Available Equipemnt</InputGroup.Text>
                        <StyledSelect
                            defaultValue={availableEquipment.map(c => ({ value: c, label: c }))}
                            onChange={equipmentFilterChanged}
                            isMulti
                            options={equipmentOptions}
                            classNamePrefix="select"
                        />
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Duration</InputGroup.Text>
                        <Slider
                            value={durationRange}
                            onChange={durationChange}
                            valueLabelDisplay="auto"
                            scale={linearToLog}
                            step={0.0001}
                            getAriaLabel={() => 'Task Duration Range'}
                            getAriaValueText={() => "Task Duration"}
                            valueLabelFormat={v => prettyDuration(percentToDuration(v))}
                            min={0}
                            max={1}
                            style={{ flexGrow: 1, width: "auto", margin: "0 1rem 0 1rem" }}
                        />
                    </InputGroup>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Search</InputGroup.Text>
                        <Form.Control
                            placeholder="Search..."
                            value={searchText}
                            aria-label="Search"
                            aria-describedby="basic-addon1"
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </InputGroup>
                </Form.Group>
                <hr />
                <InputGroup>
                    <Button onClick={shuffleList} variant="outline-secondary">Shuffle list</Button>
                    <Button onClick={openRandom} variant="outline-secondary">Open random (1d{randomChoices.length})</Button>
                </InputGroup>
            </Form>
            <Table
                table={table}
                columns={[
                    {
                        key: 'selection-cell',
                    },
                    {
                        key: 'randomValue',
                        dataType: DataType.Number,
                        sortDirection: SortDirection.Ascend,
                        visible: false,
                    },
                    {
                        key: 'number',
                        title: 'Number',
                        dataType: DataType.Number,
                    },
                    {
                        key: 'task',
                        title: 'Task', dataType: DataType.String,
                    },
                    {
                        key: 'duration',
                        title: 'Duration',
                        dataType: DataType.String,
                    },
                    {
                        key: 'equipment',
                        title: 'Equipment',
                        dataType: DataType.String,
                    },
                    {
                        key: 'kinks',
                        title: 'Kinks',
                        dataType: DataType.String,
                    },
                ]}
                data={filteredData}
                format={({ column, value }) => {
                    if (column.dataType === DataType.Date) {
                        return value && value.toLocaleDateString('en', { month: '2-digit', day: '2-digit', year: 'numeric' });
                    }
                }}
                searchText={searchText}
                rowKeyField={'number'}
                childComponents={{
                    cellText: {
                        content: (props) => {
                            if (props.column.key === 'selection-cell') {
                                return <SelectionCell {...props} />;
                            }
                        },
                    },
                    filterRowCell: {
                        content: (props) => {
                            if (props.column.key === 'selection-cell') {
                                return <></>;
                            }
                        },
                    },
                    headCell: {
                        content: (props) => {
                            if (props.column.key === 'selection-cell') {
                                return <SelectionHeader />;
                            }
                        },
                    },
                }}
            />
        </Container>
    );
};