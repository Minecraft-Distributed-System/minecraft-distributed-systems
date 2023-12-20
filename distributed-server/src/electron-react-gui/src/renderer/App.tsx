import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import {useState} from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

function Hello() {

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true)

  return (
    <div>
      <h1 className="text-white">Minecraft Distributed Server System</h1>
      <div className="base">
        <a>
          <button type="button" role="create-network" className="network-button" onClick={handleShow}>
            Create Network
          </button>
        </a>
        <a>
          <button type="button" role="join-network" className="network-button">
            Join Network
          </button>
        </a>
      </div>
      <>
        <Modal show={show} onHide={handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>Creating Network</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form>
              <label for="username">Username</label>
              <input className="form-control"/>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Save Changes
            </Button>
          </Modal.Footer>
        </Modal>
      </>

    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
