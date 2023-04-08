import React, { useMemo, useState } from 'react';
import Slider from '@mui/material/Slider';

import InputGroup from 'react-bootstrap/InputGroup';

import { DataType, Table } from 'ka-table';
import { SortDirection } from 'ka-table/enums';

import Select, { OptionsOrGroups } from 'react-select';
import Container from 'react-bootstrap/Container';
import styled from 'styled-components';
import prettyMilliseconds from 'pretty-ms';

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

const allData = [
    { number: 31, task: "1", duration: 30 * 60, equipment: ["1"], categories: ["a"] },
    { number: 41, task: "2", duration: 10 * 24 * 60 * 60, equipment: ["2", "3"], categories: ["b", "a"] },
    { number: 37, task: "3", duration: null, equipment: ["4"], categories: ["c", "d"] },
    { number: 38, task: "4", duration: 24 * 60 * 60, equipment: [], categories: [] },
];

const equipmentFilter = (availableEquipment: string[]) => (data: typeof allData[0]) => {
    return availableEquipment.length == 0 || data.equipment.every(e => availableEquipment.includes(e));
};

const categoryFilter = (availableCategories: string[]) => (data: typeof allData[0]) => {
    return availableCategories.length == 0 || !data.categories.some(e => availableCategories.includes(e));
};

const durationFilter = ([lower, upper]: number[]) => (data: typeof allData[0]) => {
    const eps = 1;

    return data.duration == null || (data.duration > (lower - eps) && data.duration < (upper + eps));
};

const prettyDuration = (durationSeconds: number) => prettyMilliseconds(durationSeconds * 1000, { unitCount: 2, separateMilliseconds: true })

export default () => {
    const maxDuration = Math.max(...allData.map(d => d.duration || Number.MIN_VALUE));
    const minDuration = Math.min(...allData.map(d => d.duration || Number.MAX_VALUE));

    const percentToDuration = (percent: number) => percent * (maxDuration - minDuration) + minDuration;
    // const durationToPercent = (duration: number) => (duration - minDuration) / (maxDuration - minDuration);

    // https://stackoverflow.com/a/17102320
    const x = 0;
    const midpoint = 0.8;
    const z = 1;

    const A = (x*z - midpoint*midpoint) / (x - 2*midpoint + z);
    const B = (midpoint - x)*(midpoint - x) / (x - 2*midpoint + z);
    const C = 2 * Math.log((z-midpoint) / (midpoint-x));

    const linearToLog = (percent: number) => Math.log((percent - A) / B) / C;
    // const logToLinear = (percent: number) => A + B * Math.exp(C * percent);

    const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [durationRange, setDurationRange] = useState([0, 1]);

    const filteredData = useMemo(() => {
        return allData.slice()
            .filter(equipmentFilter(availableEquipment))
            .filter(categoryFilter(availableCategories))
            .filter(durationFilter(durationRange.map(linearToLog).map(percentToDuration)))
            .map(d => ({ ...d, duration: d.duration !== null ? prettyDuration(d.duration) : null }));
    }, [availableEquipment, availableCategories, durationRange]);

    const equipmentOptions: OptionsOrGroups<Option, never> = [...new Set(allData.flatMap(row => row.equipment))].map(eq => ({ value: eq, label: eq, }));

    const equipmentFilterChanged = (equipment: Option[]) => {
        setAvailableEquipment(equipment.map(e => e.value));
    };

    const categoriesOptions: OptionsOrGroups<Option, never> = [...new Set(allData.flatMap(row => row.categories))].map(eq => ({ value: eq, label: eq, }));

    const categoriesFilterChanged = (category: Option[]) => {
        setAvailableCategories(category.map(e => e.value));
    };

    const durationChange = (e: unknown, range: number[] | number) => {
        if (typeof range == "number") {
            console.warn("WRONG TYPE IN CHANGE EVENT HANDLER");
            throw "WRONG TYPE IN CHANGE EVENT HANDLER";
        }

        const [lower, upper] = range;
        setDurationRange([lower, upper]);
    };

    return (
        <Container>
            <InputGroup>
                <InputGroup.Text id="inputGroup-sizing-default">Duration</InputGroup.Text>
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
                <InputGroup.Text id="inputGroup-sizing-default">Unwanted categories</InputGroup.Text>
                <StyledSelect
                    defaultValue={[]}
                    onChange={categoriesFilterChanged}
                    isMulti
                    options={categoriesOptions}
                    classNamePrefix="select"
                />
            </InputGroup>
            <InputGroup>
                <InputGroup.Text id="inputGroup-sizing-default">Available Equipemnt</InputGroup.Text>
                <StyledSelect
                    defaultValue={[]}
                    onChange={equipmentFilterChanged}
                    isMulti
                    options={equipmentOptions}
                    classNamePrefix="select"
                />
            </InputGroup>
            <Table
                columns={[
                    {
                        key: 'number',
                        title: 'Number', dataType: DataType.Number, sortDirection: SortDirection.Ascend,
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
                        key: 'categories',
                        title: 'Categories',
                        dataType: DataType.String,
                    },
                ]}
                data={filteredData}
                format={({ column, value }) => {
                    if (column.dataType === DataType.Date) {
                        return value && value.toLocaleDateString('en', { month: '2-digit', day: '2-digit', year: 'numeric' });
                    }
                }}
                rowKeyField={'number'}
                childComponents={{
                    headFilterButton: {
                        content: ({ column: { key } }) => key === 'name' && <></>,
                    },
                }}
            />
        </Container>
    );
};