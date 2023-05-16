import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Slider from '@mui/material/Slider';
import debounce from 'lodash.debounce';
import prand from 'pure-rand';

import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';

import { DataType, IKaTableProps, Table, useTable, useTableInstance } from 'ka-table';
import { PagingPosition, SortDirection } from 'ka-table/enums';
import { kaPropsUtils } from 'ka-table/utils';

import Select, { OptionsOrGroups } from 'react-select';
import Container from 'react-bootstrap/Container';
import styled, { StyledComponent } from 'styled-components';
import { ICellTextProps } from 'ka-table/props';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { arrayToMap, dbg, deser, linearToLog, Null, prettyDuration, ser, sfw, Task, unique, useFromPercentToRange, useMinMax, useTasks, useLink } from '@/utils';
import parse from 'parse-duration';

import Fuse from 'fuse.js'
import { StateManagerProps } from 'react-select/dist/declarations/src/useStateManager';

export type Data = {
    number: number,
    task: string,
    duration: number | null,
    equipment: string[],
    kinks: string[],
    intensity: string,
};

const StyledSelect = (props: StateManagerProps) => (
    <Select
        {...props}
        styles={{
            menu: (base) => ({ ...base, zIndex: 5 }),
            container: (base) => ({ ...base, flexGrow: 1 }),
        }}
    />
);

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

const intensityFilter = (selectedIntensities: string[]) => (data: Data) => {
    return selectedIntensities.length == 0 || selectedIntensities.includes(data.intensity);
};

const durationFilter = ([lower, upper]: number[]) => (data: Data) => {
    const eps = 1;

    return data.duration == null || (data.duration > (lower - eps) && data.duration < (upper + eps));
};

const searchFilter = (searchResults: undefined | Map<number, Fuse.FuseResult<Task>>) => (data: Data) => {
    return searchResults === undefined || searchResults.has(data.number);
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

const EQUIPMENT_KEY = 1;
const CATEGORIES_KEY = 2;
const SEARCH_KEY = 1;
const DURATION_KEY = 2;
const INTENSITY_KEY = 3;

const StyledTable: StyledComponent<(_: IKaTableProps) => JSX.Element, any, {}, never> = styled(function ({ className, ...props }) {
    return <div className={className}>
        <Table
            {...props}
        />
    </div>;
})`
  .ka-row {
    cursor: pointer;

    &:hover {
      background-color: #F7FcFd;
    }
  }
`;

export default () => {
    const [allTasks, _, tasksLoading] = useTasks();

    const fuse = useMemo(() => (new Fuse(allTasks, {
        keys: ['number', 'task', 'equipment', 'kinks', 'duration'],
        findAllMatches: true,
        includeScore: false,
        shouldSort: false,
        threshold: 0.3,
        ignoreLocation: true,
    })), [allTasks]);

    const allData = useMemo<Data[]>(() => (allTasks.map(t => ({ ...t, duration: Null.map(t.duration, d => parse(d, "sec")) }))), [allTasks]);

    const [searchParams, setSearchParams] = useSearchParams();

    const profile = Null.map(searchParams.get("profile"), deser) || { [EQUIPMENT_KEY]: null, [CATEGORIES_KEY]: null };
    const ephemeral = Null.map(searchParams.get("ephemeral"), deser) || { [DURATION_KEY]: null, [SEARCH_KEY]: null, [INTENSITY_KEY]: null };

    const [availableEquipment, setAvailableEquipment] = useState<string[]>(profile[EQUIPMENT_KEY] || []);
    const [availableLimits, setAvailableLimits] = useState<string[]>(profile[CATEGORIES_KEY] || []);
    const [selectedIntensities, setSelectedIntensities] = useState<string[]>(ephemeral[INTENSITY_KEY] || []);
    const [durationRange, setDurationRange] = useState(ephemeral[DURATION_KEY] || [0, 1]);
    const [searchText, setSearchText] = useState<undefined | string>(ephemeral[SEARCH_KEY] || undefined);

    const searchResults = useMemo(() => searchText ? arrayToMap(fuse.search(searchText), r => r.item.number) : undefined, [fuse, searchText]);

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

    const { percentToDuration } = useFromPercentToRange(useMinMax(allData, (d) => d.duration));

    const filteredData = useMemo(() => {
        let rng = prand.xoroshiro128plus(shuffleSeed);
        rng = rng.jump ? rng.jump() : rng;

        return allData.slice()
            .filter(equipmentFilter(availableEquipment))
            .filter(categoryFilter(availableLimits))
            .filter(intensityFilter(selectedIntensities))
            .filter(durationFilter(durationRange.map(linearToLog).map(percentToDuration)))
            .filter(searchFilter(searchResults))
            .map(d => ({ ...d, randomValue: nthRand(rng, d.number), duration: d.duration !== null ? prettyDuration(d.duration) : null }));
    }, [availableEquipment, availableLimits, durationRange, allData, shuffleSeed, searchResults, selectedIntensities]);

    const equipmentOptions: OptionsOrGroups<Option, never> = useMemo(() => unique(allData.flatMap(row => row.equipment)).map(eq => ({ value: eq, label: eq, })), [allData]);
    const limitsOptions: OptionsOrGroups<Option, never> = useMemo(() => unique(allData.flatMap(row => row.kinks)).map(eq => ({ value: eq, label: eq, })), [allData]);
    const intensityOptions: OptionsOrGroups<Option, never> = useMemo(() => unique(allData.map(row => row.intensity).filter(Boolean)).map(eq => ({ value: eq, label: eq, })), [allData]);

    const equipmentFilterChanged = (equipment: Option[]) => {
        setAvailableEquipment(equipment.map(e => e.value));
    };

    const limitsFilterChanged = (category: Option[]) => {
        setAvailableLimits(category.map(e => e.value));
    };

    const intensityFilterChanged = (category: Option[]) => {
        setSelectedIntensities(category.map(e => e.value));
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
        ephemeral: ser({ [DURATION_KEY]: durationRange, [SEARCH_KEY]: searchText, [INTENSITY_KEY]: selectedIntensities })
    }), [availableEquipment, availableLimits, durationRange, searchText, selectedIntensities]);

    const navigate = useNavigate();

    const openRandom = () => {
        navigate("/random/" + randomChoices.join(","));
    };

    const profileLink = useLink(useMemo(() => {
        return { pathname: "/list", search: "profile=" + ser(profile) };
    }, [profile]));

    const copyProfile = () => {
        navigator.clipboard.writeText(profileLink);
    };

    const handleTaskClick = (task: Task) => {
        navigate("/task/" + task.number);
    };

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    return (
        <Container>
            <Form>
                <Form.Group>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">{sfw ? "Unwanted Categories" : "Limits"}</InputGroup.Text>
                        <StyledSelect
                            defaultValue={availableLimits.map(c => ({ value: c, label: c }))}
                            onChange={opts => limitsFilterChanged(opts as Option[])}
                            isMulti
                            options={limitsOptions}
                            classNamePrefix="select"
                        />
                    </InputGroup>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Available Equipemnt</InputGroup.Text>
                        <StyledSelect
                            defaultValue={availableEquipment.map(c => ({ value: c, label: c }))}
                            onChange={opts => equipmentFilterChanged(opts as Option[])}
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
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Intensitiy</InputGroup.Text>
                        <StyledSelect
                            defaultValue={selectedIntensities.map(c => ({ value: c, label: c }))}
                            onChange={opts => intensityFilterChanged(opts as Option[])}
                            isMulti
                            options={intensityOptions}
                            classNamePrefix="select"
                        />
                    </InputGroup>
                    <InputGroup>
                        <InputGroup.Text style={inputGroupTextStyle} id="inputGroup-sizing-default">Search</InputGroup.Text>
                        <Form.Control
                            placeholder="Search..."
                            value={searchText || ""}
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
                    <Button onClick={copyProfile} variant="outline-secondary">Copy profile</Button>
                </InputGroup>
            </Form>
            <StyledTable
                table={table}
                loading={{ enabled: tasksLoading }}
                columns={[
                    {
                        key: 'selection-cell',
                        width: "40",
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
                        width: "80",
                    },
                    {
                        key: 'task',
                        title: 'Task', dataType: DataType.String,
                    },
                    {
                        key: 'duration',
                        title: 'Duration',
                        dataType: DataType.String,
                        width: "80",
                    },
                    {
                        key: 'intensity',
                        title: 'Intensity',
                        dataType: DataType.String,
                        width: "100",
                    },
                    {
                        key: 'equipment',
                        title: 'Equipment',
                        dataType: DataType.String,
                        width: "100",
                    },
                    {
                        key: 'kinks',
                        title: sfw ? "Categories" : 'Kinks',
                        dataType: DataType.String,
                        width: "100",
                    },
                ]}
                paging= {{
                    enabled: true,
                    pageIndex: page,
                    pageSize: pageSize,
                    pageSizes: [5, 10, 15],
                    position: PagingPosition.Bottom
                  }}
                data={filteredData}
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
                    pagingSizes: {
                        elementAttributes: () => ({
                            onClick: (e, extendedEvent) => {
                                setPageSize(parseInt(e.target.innerHTML))
                                console.log({ e, extendedEvent });
                            }
                        }),
                    },
                    pagingPages: {
                        elementAttributes: () => ({
                            onClick: (e, extendedEvent) => {
                                setPage(parseInt(e.target.innerHTML) - 1)
                                console.log({ e, extendedEvent });
                            }
                        }),
                    },
                    dataRow: {
                        elementAttributes: () => ({
                            onClick: (e, extendedEvent) => {
                                const { childProps } = extendedEvent;

                                handleTaskClick(childProps.rowData);
                            }
                        }),
                    },
                }}
            />
        </Container>
    );
};