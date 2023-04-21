import { sfw, Task, useTasks, linearToLog, prettyDuration, useFromPercentToRange, logToLinear, marks, ser, useLink } from '@/utils';
import { Button, FormControl, FormControlLabel, FormGroup, Slider, Switch } from '@mui/material';
import { forwardRef, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/esm/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { components, GroupBase, MultiValue, MultiValueRemoveProps, OptionsOrGroups, Props as SelectProps } from 'react-select';
import ShareIcon from '@mui/icons-material/Share';
import CreatableSelect from 'react-select/creatable';
import parse from 'parse-duration';
import prettyMilliseconds from 'pretty-ms';
import styled from 'styled-components';
import { FormControlProps } from 'react-bootstrap/esm/FormControl';

type Props = {
  id: number;
  task?: Exclude<Task, "number">;
};

type Option = {
  value: string,
  label: string,
};

const StyledTextArea = styled(forwardRef<HTMLTextAreaElement, FormControlProps>((props, ref) => (
  <Form.Control {...props} ref={ref} as="textarea" />
)))`
textarea {
  min-height: 60px;
  overflow-y: auto;
  word-wrap: break-word
}
`;

function MultiValueRemove<T1, T2 extends boolean, T3 extends GroupBase<T1>>(props: MultiValueRemoveProps<T1, T2, T3>) {
  return (
    props.selectProps.isClearable ? <components.MultiValueRemove {...props} /> : <></>
  );
};

function MySelect<T1, T2 extends boolean, T3 extends GroupBase<T1>>({ readOnly, ...props }: SelectProps<T1, T2, T3> & { readOnly: boolean }) {
  return <CreatableSelect<T1, T2, T3>
    {...props}
    isSearchable={!readOnly}
    isClearable={!readOnly}
    backspaceRemovesValue={!readOnly}
    menuIsOpen={readOnly ? false : undefined}
    components={{ MultiValueRemove }}
  />
};

export default ({ id, task: serializedTask }: Props) => {
  const [allTasks, setAllTasks] = useTasks();

  const setTask = (task: Task) => {
    setAllTasks(tasks => {
      const newTasks = tasks.filter(t => t.number !== task.number);
      const oldTask = tasks.find(t => t.number === task.number);

      console.log({ oldTask, sfw, task });
      if (sfw && oldTask) {
        return [...newTasks, { ...task, task: oldTask.task, equipment: oldTask.equipment, kinks: oldTask.kinks }];
      } else {
        return [...newTasks, task];
      }
    })
  };

  const task = useMemo(() => serializedTask ? { ...serializedTask, number: id } : allTasks.find(t => t.number === id), [serializedTask, allTasks, id])
  const taskInDataset = useMemo(() => !!allTasks.find(t => t.number === id), [allTasks, id])

  if (!task) return <div>No such task `{id}`</div>

  const [readOnly, setReadOnly] = useState(true);

  const textarea = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => updateTextareaHeight(), [textarea]);

  const updateTextareaHeight = () => {
    if (textarea.current) {
      textarea.current.style.height = (textarea.current.scrollHeight > textarea.current.clientHeight) ? (textarea.current.scrollHeight) + "px" : "12rem";;
    }
  };

  const descriptionChanged = (desc: string) => {
    updateTextareaHeight();

    setTask({ ...task, task: desc });
  };

  const equipmentOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allTasks.flatMap(row => row.equipment))].map(eq => ({ value: eq, label: eq, })), [allTasks]);
  const kinksOptions: OptionsOrGroups<Option, never> = useMemo(() => [...new Set(allTasks.flatMap(row => row.kinks))].map(eq => ({ value: eq, label: eq, })), [allTasks]);

  const kinksChanged = (options: MultiValue<Option>) => {
    setTask({ ...task, kinks: options.map(o => o.value) });
  };

  const equipmentChanged = (options: MultiValue<Option>) => {
    setTask({ ...task, equipment: options.map(o => o.value) });
  };

  const { percentToDuration, durationToPercent, inRange } = useFromPercentToRange({ min: 0, max: parse('1d', 'sec') });
  const duration = useMemo(() => logToLinear(durationToPercent(parse(task.duration || "", "sec"))), [task, durationToPercent]);

  const equipment = task.equipment.map(c => ({ value: c, label: c }));

  const durationTextChanged = (text: string) => {
    setTask({ ...task, duration: text });
  };

  const durationChange = useCallback((_: unknown, duration: number[] | number) => {
    if (readOnly == true) return;

    if (typeof duration !== "number") {
      console.warn("WRONG TYPE IN CHANGE EVENT HANDLER");
      throw "WRONG TYPE IN CHANGE EVENT HANDLER";
    }

    setTask({ ...task, duration: prettyMilliseconds(percentToDuration(linearToLog(duration)) * 1000, { secondsDecimalDigits: 0 }) });
  }, [readOnly]);

  const marksInRange = useMemo(() => marks.filter(inRange).map(m => ({ value: logToLinear(durationToPercent(m)) })), [inRange]);

  const permaLink = useLink(useMemo(() => {
    const { number: _, ...data } = task;

    return { pathname: "/task/" + task.number, search: "perma=" + ser(data) };
  }, [task]));

  return (
    <Container>
      <Form>
        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Number
          </Form.Label>
          <Col sm="10">
            <Form.Control plaintext readOnly value={task.number} />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            Required equipment
          </Form.Label>
          <Col sm="10">
            <MySelect
              value={equipment}
              options={equipmentOptions}
              isMulti
              readOnly={readOnly}
              onChange={equipmentChanged}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm="2">
            {sfw ? "Categories" : "Kinks"}
          </Form.Label>
          <Col sm="10">
            <MySelect
              value={task.kinks.map(c => ({ value: c, label: c }))}
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
            <Form.Control onChange={e => durationTextChanged(e.target.value)} plaintext={readOnly} readOnly={readOnly} value={task.duration || ""} />
          </Col>
          <Col sm="7">
            <Slider
              value={duration}
              valueLabelDisplay="auto"
              valueLabelFormat={v => prettyDuration(percentToDuration(v))}
              marks={marksInRange}
              step={null}
              onChange={durationChange}
              scale={linearToLog}
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
            <StyledTextArea ref={textarea} onChange={e => descriptionChanged(e.target.value)} plaintext={readOnly} readOnly={readOnly} value={task.task} />
          </Col>
        </Form.Group>
      </Form>
      <FormControl component="fieldset">
        <FormGroup aria-label="position" row>
          {taskInDataset ?
            <FormControlLabel
              value="top"
              control={<Switch color="primary" value={!readOnly} onChange={e => setReadOnly(!e.target.checked)} />}
              label="Edit"
            /> : <></>
          }
          <Button variant="text" onClick={() => navigator.clipboard.writeText(permaLink)} startIcon={<ShareIcon />}>
            Share
          </Button>
        </FormGroup>
      </FormControl>
    </Container>
  );
}
