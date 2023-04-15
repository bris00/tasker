import { Suspense, lazy } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { Routes, Route, useParams, useSearchParams } from "react-router-dom";

import Banner from './components/Banner';
import { createUser, UserContext } from './composable/user';
import { deser, Null } from './utils';

const theme = {
  color: {
    accent1: "#721817",
    accent2: "#0B6E4F",
    warm: "#FA9F42",
    cold1: "#2B4162",
    cold2: "#E0E0E2",
    white: "#e9eeff",
  },
  font: "Roboto, sans-serif",
};

const GlobalStyle = styled.div`
  > * {
    font-family: ${props => props.theme.font};
  }
`;

const TaskList = lazy(() => import('./components/TaskList'))
const Task = lazy(() => import('./components/Task'))
const RandomTask = lazy(() => import('./components/RandomTask'))

const IdTask = () => {
  const { id } = useParams();
  const [ searchParams ] = useSearchParams();
  
  const task = searchParams.get("perma");

  if (!id) return <div>No task selected</div>
    
  return <Task id={parseInt(id)} task={Null.map(task, deser) || undefined} />
}

function App() {
  const user = createUser();

  return (
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={user}>
        <GlobalStyle style={{ height: "100vh", display: "flex", flexFlow: "column" }}>
          <Banner />
          <Routes>
            <Route path="/list" element={
              <Suspense fallback={<>...</>}>
                <TaskList />
              </Suspense>
            } />
            <Route path="/random/:ids" element={
              <Suspense fallback={<>...</>}>
                <RandomTask />
              </Suspense>
            } />
            <Route path="/task/:id" element={
              <Suspense fallback={<>...</>}>
                <IdTask />
              </Suspense>
            } />
          </Routes>
        </GlobalStyle>
      </UserContext.Provider>
    </ThemeProvider>
  )
}

export default App
