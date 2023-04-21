import { ButtonGroup, Dialog, DialogTitle, Grid, IconButton } from '@mui/material';
import Button from '@mui/lab/LoadingButton';
import { DataType, IKaTableProps, Table, useTableInstance } from 'ka-table';
import Form from 'react-bootstrap/Form';
import papaparse from 'papaparse';

import AddIcon from '@mui/icons-material/Add';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import ImportExportIcon from '@mui/icons-material/ImportExport';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';

import Container from 'react-bootstrap/esm/Container';
import styled, { StyledComponent } from 'styled-components';
import { arrayToMap, Dataset, Task } from '@/utils';
import { useLocalStorageState } from 'react-localstorage-hooks';
import { useMemo, useState } from 'react';

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

const addNewDataset = (ds: Dataset[]) => {
  const last = ds.slice().sort((a, b) => a.id - b.id).pop() || { id: 0 };

  return [...ds, { id: last.id + 1, name: `Dataset ${last.id + 1}`, tasks: [], googleSheetsLink: null }];
};

type P = (_: string) => string;

const toLower: P = (s) => s.toLowerCase();

const apply = (ps: P[]) => (s: string) => {
  let result = s;

  for (const p of ps) {
    result = p(result);
  }

  return result;
}

function parseCsv(content: string): Task[] {
  const parsed = papaparse.parse<Record<string, string>>(content, { header: true })

  const fields = parsed.meta.fields;

  if (fields === undefined) return [];

  const filteredFields = fields.filter(Boolean);

  return parsed.data.map(d => ({
    number: parseInt(d[filteredFields[0]]),
    task: d[filteredFields[1]],
    duration: d[filteredFields[2]],
    equipment: d[filteredFields[3]].split(',').map(apply([toLower])),
    kinks: d[filteredFields[4]].split(',').map(apply([toLower])),
    intensity: d[filteredFields[5]],
  }));
};

function diff(local: Task[], remote: Task[]) {
  const localMap = arrayToMap(local, t => t.number);
  const remoteMap = arrayToMap(remote, t => t.number);

  const unseen = [];
  const unpushed = [];
  const conflicting = [];

  for (const localTask of local) {
    const remoteTask = remoteMap.get(localTask.number)

    if (remoteTask === undefined) {
      unpushed.push(localTask);
      continue;
    }

    if (JSON.stringify(localTask) !== JSON.stringify(remoteTask)) {
      conflicting.push(localTask);
      continue;
    }
  }

  for (const remoteTask of remote) {
    const localTask = localMap.get(remoteTask.number)

    if (localTask === undefined) {
      unseen.push(remoteTask);
      continue;
    }
  }

  return { unseen, unpushed, conflicting };
}

export default () => {
  const [datasets, setDatasets] = useLocalStorageState<Dataset[]>('datasets', {
    initialState: []
  });

  const [activeDatasetId, setActiveDatasetId] = useLocalStorageState<null | number>('active_dataset', {
    initialState: null,
  });

  const [dialogDatasetId, setDialogDatasetId] = useState(0);
  const [dialogLoadingFileContents, setDialogLoadingFileContents] = useState(false);
  const [dialogFileContents, setDialogFileContents] = useState<null | string>(null);
  const dialogCsvContents = useMemo(() => dialogFileContents === null ? null : parseCsv(dialogFileContents), [dialogFileContents]);

  const dialogDataset = useMemo(() => datasets.find(d => d.id === dialogDatasetId), [dialogDatasetId, datasets]);
  const dialogDiff = useMemo(() => diff(dialogDataset?.tasks || [], dialogCsvContents || []), [dialogDataset, dialogCsvContents]);

  let [uploadFileDialogOpen, setUploadFileDialogOpen] = useState(false);

  const handleDialogInput = (target: EventTarget) => {
    if ('files' in target && target.files instanceof FileList) {
      setDialogLoadingFileContents(true);

      target.files[0].text().then(contents => {
        setDialogFileContents(contents);
      }).finally(() => setDialogLoadingFileContents(false));
    }
  };

  return (
    <Container>
      <StyledTable
        columns={[
          {
            key: 'id',
            visible: false,
          },
          {
            key: 'active',
            title: "Active",
          },
          {
            key: 'name',
            title: 'Name',
            dataType: DataType.String,
          },
          {
            key: 'tasks',
            title: 'Tasks',
            dataType: DataType.Number,
          },
          {
            key: 'googleSheetsLink',
            title: 'Sheet',
            dataType: DataType.String,
          },
          {
            key: 'buttons',
          },
        ]}
        data={datasets.map(d => ({ ...d, active: d.id === activeDatasetId, tasks: d.tasks.length }))}
        rowKeyField={'id'}
        childComponents={{
          cellText: {
            content: (props) => {
              if (props.column.key === 'active') {
                return <input
                  type='checkbox'
                  checked={props.rowData.active}
                  onChange={() => {
                    setActiveDatasetId(props.rowData.id);
                  }}
                />
              } else if (props.column.key === 'buttons') {
                return (
                  <ButtonGroup style={{ float: "right" }} variant="text">
                    <IconButton aria-label="refresh" color="primary"><SyncIcon /></IconButton>
                    <IconButton color="primary" onClick={() => {
                      setDialogDatasetId(props.rowData.id);
                      setUploadFileDialogOpen(true);
                    }} aria-label="upload csv" component="label">
                      <UploadFileIcon />
                    </IconButton>
                    <IconButton aria-label="fork" color="primary"><CallSplitIcon /></IconButton>
                    <IconButton aria-label="download" color="primary"><FileDownloadIcon /></IconButton>
                    <IconButton aria-label="delete" color="error"><DeleteIcon /></IconButton>
                  </ButtonGroup>
                )
              }
            },
          },
          headCell: {
            content: (props) => {
              if (props.column.key === 'buttons') {
                return (
                  <IconButton style={{ float: "right" }} aria-label="add" color="primary" onClick={() => setDatasets(addNewDataset)}>
                    <AddIcon />
                  </IconButton>
                )
              }
            }
          }
        }}
      />
      <Dialog onClose={(e) => setUploadFileDialogOpen(false)} open={uploadFileDialogOpen}>
        <DialogTitle>Upload File to {dialogDataset?.name || "Unknown"}</DialogTitle>
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Control type="file" accept="text/csv" onInput={(e) => handleDialogInput(e.target)} />
        </Form.Group>
        <Grid display="flex" justifyContent="center" alignItems="center">
          <ButtonGroup variant="text" aria-label="text button group">
            <Button disabled={true} loading={dialogLoadingFileContents} variant="text" startIcon={<NorthIcon />}>
              {dialogDiff.unpushed.length}
            </Button>
            <Button disabled={dialogFileContents === null} loading={dialogLoadingFileContents} variant="text" startIcon={<SouthIcon />} onClick={() => {
              setDatasets(ds => ds.map(d => d.id !== dialogDatasetId ? d : { ...d, tasks: [...d.tasks, ...dialogDiff.unseen] }));
            }}>
              {dialogDiff.unseen.length}
            </Button>
            <Button disabled={dialogFileContents === null} loading={dialogLoadingFileContents} variant="text" startIcon={<ImportExportIcon />}>
              {dialogDiff.conflicting.length}
            </Button>
          </ButtonGroup>
        </Grid>
      </Dialog>
    </Container>
  );
}
