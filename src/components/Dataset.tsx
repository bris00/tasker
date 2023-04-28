import { ButtonGroup, Chip, Dialog, DialogTitle, Grid, IconButton, TextField } from '@mui/material';
import Button from '@mui/lab/LoadingButton';
import { DataType, IKaTableProps, Table } from 'ka-table';
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
import { arrayToMap, Dataset, dbg, Null, parseCsv, parseSheet, Task, useDatasets } from '@/utils';
import { useLocalStorageState } from 'react-localstorage-hooks';
import { useEffect, useMemo, useState } from 'react';
import { EditableCell } from 'ka-table/models';

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

function download(content: string, filename: string, mimetype: string) {
  const anchor = document.createElement("a");

  const blob = new Blob([content], { type: mimetype });
  const url = URL.createObjectURL(blob);

  anchor.href = url;
  anchor.setAttribute("download", filename);
  anchor.className = "download-js-link";
  anchor.innerHTML = "downloading...";
  anchor.style.display = "none";

  anchor.addEventListener('click', (e) => e.stopPropagation());

  document.body.appendChild(anchor);

  setTimeout(() => {
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }, 66);
}

function assertType<T>(x: T) { }

type EditableColumn = "name" | "googleSheetsLink";

function isEditableColumn(col: unknown): col is EditableColumn {
  if (typeof col === "string" && (col === "name" || col === "googleSheetsLink")) {
    assertType<EditableColumn>(col);
    return true;
  } else {
    return false;
  }
}

type GoogleSheetData = {
  gid: string | undefined;
  value: { data: Record<string, string | number>[] } | undefined;
  status: "pending" | "failed" | "success";
};

export default () => {
  const [datasets, setDatasets, activeDatasetId, setActiveDatasetId, datasetLoading] = useDatasets();
  const [refreshSets, setRefreshSets] = useState<number[]>([]);

  const [googleSheetsData, setGoogleSheetsData] = useState<Map<number, GoogleSheetData>>(new Map());

  function setGoogleSheetData(id: number, data: GoogleSheetData) {
    setGoogleSheetsData(gsd => {
      const nMap = new Map(gsd);
      nMap.set(id, data);
      return nMap;
    });
  }

  useEffect(() => {
    for (const d of datasets) {
      if (!googleSheetsData.has(d.id)) {
        setGoogleSheetData(d.id, { gid: undefined, value: undefined, status: "success" });
      }

      const old = googleSheetsData.get(d.id);
      const match = d.googleSheetsLink?.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-]*)/);
      const gid = match?.[1];

      if (!old) {
        setGoogleSheetData(d.id, { gid: undefined, value: undefined, status: "success" });
      }

      if (gid !== old?.gid || refreshSets.includes(d.id)) {
        if (refreshSets.includes(d.id)) { setRefreshSets(rs => rs.filter(id => id !== d.id)) }

        if (gid !== undefined) {
          setGoogleSheetData(d.id, { gid, value: undefined, status: "pending" });

          fetch("https://api.fureweb.com/spreadsheets/" + gid)
            .then(x => x.json())
            .then(value => setGoogleSheetData(d.id, { gid, value, status: "success" }))
            .catch(err => {
              console.error(err);
              setGoogleSheetData(d.id, { gid, value: undefined, status: "failed" })
            });
        } else {
          setGoogleSheetData(d.id, { gid: undefined, value: undefined, status: "success" });
        }
      }
    }
  }, [datasets, refreshSets]);

  useEffect(() => {
    if (activeDatasetId === null || datasets.find(d => d.id === activeDatasetId) == undefined) {
      setActiveDatasetId(datasets.length > 0 ? datasets[0].id : null);
    }
  }, [activeDatasetId, datasets]);

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

  const setDataset = (id: number, dataset: Partial<Dataset>) => {
    setDatasets(ds => {
      return ds.map(d => d.id === id ? { ...d, ...dataset } : d)
    });
  };

  const [editableCell, setEditableCell] = useState<EditableCell | null>(null);

  return (
    <Container>
      <StyledTable
        loading={{ enabled: datasetLoading }}
        columns={[
          {
            key: 'id',
            visible: false,
          },
          {
            key: 'active',
            title: "",
            width: 40,
          },
          {
            key: 'tasks',
            title: 'Tasks',
            dataType: DataType.Number,
            width: 80,
          },
          {
            key: 'name',
            title: 'Name',
            dataType: DataType.String,
          },
          {
            key: 'googleSheetsLink',
            title: 'Sheet',
            dataType: DataType.String,
            width: 400,
          },
          {
            key: 'buttons',
            width: 170,
          },
        ]}
        data={datasets.map(d => ({ ...d, active: d.id === activeDatasetId, tasks: d.tasks.length }))}
        rowKeyField={'id'}
        childComponents={{
          cellText: {
            elementAttributes: () => ({
              onClick: (e, extendedEvent) => {
                const target = e.target;

                if ("classList" in target && target.classList instanceof DOMTokenList) {
                  const { childProps } = extendedEvent;

                  const col = childProps.column.key;

                  if (isEditableColumn(col) && target.classList.contains("ka-cell-text")) {
                    setEditableCell({
                      columnKey: col,
                      rowKeyValue: childProps.rowKeyValue,
                    })
                  }
                }
              }
            }),
            content: (props) => {
              const col = props.column.key;
              const dataset = datasets.find(d => d.id === props.rowKeyValue);

              if (dataset && isEditableColumn(col) && editableCell?.rowKeyValue === props.rowKeyValue && editableCell?.columnKey === col) {
                return <TextField size="small" onKeyDown={e => { if (e.key === "Enter") { setEditableCell(null) } }} onBlur={() => setEditableCell(null)} onChange={(e) => setDataset(dataset.id, { [col]: e.target.value })} autoFocus={true} label={props.column.title} variant="standard" value={dataset[col] || ""} />;
              } else if (dataset && props.column.key === 'googleSheetsLink') {
                const sheetData = googleSheetsData.get(props.rowData.id);

                if (sheetData && sheetData.gid) {
                  const datasetDiff = diff(dataset.tasks, sheetData.value ? parseSheet(sheetData.value.data) : dataset.tasks);

                  return <Grid display="flex" justifyContent="right" alignItems="center">
                    <Chip label={sheetData.gid.slice(0, 8)} onClick={() => {
                      setEditableCell({
                        columnKey: col,
                        rowKeyValue: props.rowKeyValue,
                      })
                    }} color="success" variant='outlined' />
                    <ButtonGroup variant="text">
                      <Button disabled={true} loading={sheetData.status === "pending"} variant="text" startIcon={<NorthIcon />}>
                        {datasetDiff.unpushed.length}
                      </Button>
                      <Button loading={sheetData.status === "pending"} variant="text" startIcon={<SouthIcon />} onClick={() => {
                        setDatasets(ds => ds.map(d => d.id !== dataset.id ? d : { ...d, tasks: [...d.tasks, ...datasetDiff.unseen] }));
                      }}>
                        {datasetDiff.unseen.length}
                      </Button>
                      <Button loading={sheetData.status === "pending"} variant="text" startIcon={<ImportExportIcon />}>
                        {datasetDiff.conflicting.length}
                      </Button>
                      <IconButton aria-label="refresh" color="primary" onClick={() => setRefreshSets(rs => [...rs, props.rowKeyValue])}><SyncIcon /></IconButton>
                    </ButtonGroup>
                  </Grid>
                } else if (sheetData && dataset.googleSheetsLink) {
                  return <Grid display="flex" justifyContent="left" alignItems="center">
                    <Chip label={dataset.googleSheetsLink} color="error" variant='outlined' onClick={() => {
                      setEditableCell({
                        columnKey: col,
                        rowKeyValue: props.rowKeyValue,
                      })
                    }} />
                  </Grid>
                }

              } else if (props.column.key === 'active') {
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
                    <IconButton color="primary" onClick={() => {
                      setDialogDatasetId(props.rowData.id);
                      setUploadFileDialogOpen(true);
                    }} aria-label="upload csv" component="label">
                      <UploadFileIcon />
                    </IconButton>
                    <IconButton aria-label="fork" color="primary" onClick={() => {
                      if (dataset === undefined) return;

                      setDatasets(ds => [...ds, { id: Math.max(...ds.map(d => d.id)) + 1, name: `Clone of: ${dataset.name}`, tasks: JSON.parse(JSON.stringify(dataset.tasks)), googleSheetsLink: null }])
                    }}><CallSplitIcon /></IconButton>
                    <IconButton aria-label="download" color="primary" onClick={() => {
                      if (dataset === undefined) return;

                      const csvContent = papaparse.unparse(dataset.tasks || []);

                      download(csvContent, `${dataset.name}.csv`, "text/csv");
                    }}><FileDownloadIcon /></IconButton>
                    <IconButton aria-label="delete" color="error" onClick={() => setDatasets(ds => ds.filter(d => d.id != props.rowData.id))}><DeleteIcon /></IconButton>
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
          },
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
