import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import 'ka-table/style.css';

import { useUser } from '@/composable/user';
import { useHref } from "react-router-dom";

export default function Banner() {
    const user = useUser();
    
    const listLink = useHref({ pathname: '/list' });
    const datasetLink = useHref({ pathname: '/dataset' });

    return (
      <Navbar collapseOnSelect expand={false} bg="dark" variant='dark'>
        <Container>
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
          <Navbar.Brand href="#">
            Tasker
          </Navbar.Brand>
          {user.id ? <Navbar.Text>{user.id.preferred_username}</Navbar.Text> : <Navbar.Text></Navbar.Text>} 
        </Container>
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="mr-auto">
            <Nav.Link href={listLink}>List Tasks</Nav.Link>
          </Nav>
          <Nav className="mr-auto">
            <Nav.Link href={datasetLink}>Dataset</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    );
}