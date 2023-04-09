import { Data, prettyDuration } from '@/utils';
import { Slider } from '@mui/material';
import { useMemo, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/esm/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { useLocalStorageState } from 'react-localstorage-hooks';
import { components, MultiValueRemoveProps, OptionsOrGroups, Props as SelectProps } from 'react-select';
import CreatableSelect from 'react-select/creatable';

type Props = {
  id: number;
};

type Option = {
    value: string,
    label: string,
};


function MultiValueRemove<T>(props: MultiValueRemoveProps<T>) {
  return (
    props.selectProps.isClearable ? <components.MultiValueRemove {...props} /> : <></>
  );
};

const MySelect = ({ readOnly, ...props }: SelectProps & { readOnly: boolean }) => {
  return <CreatableSelect
    {...props}
    isSearchable={!readOnly}
    isClearable={!readOnly}
    backspaceRemovesValue={!readOnly}
    menuIsOpen={readOnly ? false : undefined}
    components={{ MultiValueRemove }}
  />
};

export default ({ id }: Props) => {
  const [allTasks, setAllTasks] = useLocalStorageState<Data[]>('tasks', {
    initialState: []
  });

  const setTask = (task: Data) => {
    setAllTasks(tasks => {
      const newTasks = tasks.filter(t => t.number !== task.number);

      return [...newTasks, task];
    })
  };

  function dbg<T>(x: T): T { return (console.log(x), x); }

  const task = useMemo(() => allTasks.find(t => t.number === id), [allTasks])

  if (!task) return <div>No such task `{id}`</div>

  const [readOnly, setReadOnly] = useState(true);

  const descriptionChanged = (desc: string) => {
    setTask({ ...task, task: desc });
  };

  const equipmentOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allTasks.flatMap(row => row.equipment))].map(eq => ({ value: eq, label: eq, })), [allTasks]);
  const kinksOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allTasks.flatMap(row => row.kinks))].map(eq => ({ value: eq, label: eq, })), [allTasks]);
  
  const kinksChanged = (options: Option[]) => {
    setTask({ ...task, kinks: options.map(o => o.value) });
  };

  const equipmentChanged = (options: Option[]) => {
    setTask({ ...task, equipment: options.map(o => o.value) });
  };
  
  const defaultValue = task.equipment.map(c => ({ value: c, label: c }));

  return (
    <Container>
      <Form>
        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Number
          </Form.Label>
          <Col sm="10">
            <Form.Control plaintext readOnly defaultValue={task.number} />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Required equipment
          </Form.Label>
          <Col sm="10">
            <MySelect
              defaultValue={defaultValue}
              options={equipmentOptions}
              isMulti
              readOnly={readOnly}
              onChange={equipmentChanged}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Kinks
          </Form.Label>
          <Col sm="10">
            <MySelect
              defaultValue={task.kinks.map(c => ({ value: c, label: c }))}
              options={kinksOptions}
              isMulti
              readOnly={readOnly}
              onChange={kinksChanged}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Duration
          </Form.Label>
          <Col sm="2">
            <Form.Control plaintext={readOnly} readOnly={readOnly} defaultValue={prettyDuration(task.duration || 0)} />
          </Col>
          <Col sm="7">
            <Slider
              value={0.2}
              valueLabelDisplay="auto"
              step={0.0001}
              getAriaLabel={() => 'Task Duration Range'}
              getAriaValueText={() => "Task Duration"}
              min={0}
              max={1}
              style={{ margin: "0 1rem 0 1rem" }}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Task description
          </Form.Label>
          <Col sm="10">
            <Form.Control onChange={e => descriptionChanged(e.target.value)} plaintext={readOnly} readOnly={readOnly} as="textarea" defaultValue={task.task} />
          </Col>
        </Form.Group>
        <Form.Group>
          <Form.Check
            type="switch"
            label="Edit task"
            onChange={(x) => setReadOnly(!x.target.checked)}
          />
        </Form.Group>
      </Form>
    </Container>
  );
}
