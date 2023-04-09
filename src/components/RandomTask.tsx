import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Task from './Task';

export default () => {
  const { ids } = useParams();

  if (!ids) return <div>No task selected</div>

  const id = useMemo(() => {
    const idsArray = ids.split(",");

    const idx = Math.floor(Math.random() * idsArray.length);

    return parseInt(idsArray[idx]);
  }, [ids]);

  return (
    <Task id={id} />
  );
}
