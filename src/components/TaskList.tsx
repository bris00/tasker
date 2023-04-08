import React, { useMemo, useState } from 'react';

import InputGroup from 'react-bootstrap/InputGroup';

import { DataType, Table } from 'ka-table';
import { SortDirection } from 'ka-table/enums';

import Select, { OptionsOrGroups } from 'react-select';
import Container from 'react-bootstrap/Container';
import styled from 'styled-components';

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
    { number: 31, task: "1", duration: "30", equipment: ["1"], categories: ["a"] },
    { number: 41, task: "2", duration: "30", equipment: ["2", "3"], categories: ["b", "a"] },
    { number: 37, task: "3", duration: null, equipment: ["4"], categories: ["c", "d"] },
    { number: 38, task: "4", duration: "120", equipment: [], categories: [] },
];

const equipmentFilter = (availableEquipment: string[]) => (data: typeof allData[0]) => {
    return availableEquipment.length == 0 || data.equipment.every(e => availableEquipment.includes(e));
};

const categoryFilter = (availableCategories: string[]) => (data: typeof allData[0]) => {
    return availableCategories.length == 0 || !data.categories.some(e => availableCategories.includes(e));
};

export default () => {
    const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);

    const filteredData = useMemo(() => {
        return allData.slice()
            .filter(equipmentFilter(availableEquipment))
            .filter(categoryFilter(availableCategories));
    }, [availableEquipment, availableCategories]);

    const equipmentOptions: OptionsOrGroups<Option, never> = [...new Set(allData.flatMap(row => row.equipment))].map(eq => ({ value: eq, label: eq, }));
    
    const equipmentFilterChanged = (equipment: Option[]) => {
        setAvailableEquipment(equipment.map(e => e.value));
    };

    const categoriesOptions: OptionsOrGroups<Option, never> = [...new Set(allData.flatMap(row => row.categories))].map(eq => ({ value: eq, label: eq, }));
    
    const categoriesFilterChanged = (category: Option[]) => {
        setAvailableCategories(category.map(e => e.value));
    };

    return (
        <Container>
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