import {MemoryRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import {useEffect, useState} from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';


function Home() {

  const [show, setShow] = useState(false);
  const [formData, setFormData] = useState({});
  const [nodeList, setNodeList] = useState([]);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  useEffect(() => {
    setInterval(() => {
      getInfo();
    }, 2000);
  })

  const handleCreateNetwork = (event) => {
    window.electron.ipcRenderer.sendMessage('create-network', formData);
    handleClose();
  }

  const handleFormChange = (event) => {
    const {target} = event;
    const {name, value} = target;
    setFormData({
      ...formData,
      [name]: value,
    });
  }

  const getInfo = async () => {
    const {info, nodeList} = await window.electron.ipcRenderer.invoke('get-info', null);
    setNodeList(nodeList);
    console.log(nodeList);
  }

  const displayNodeList = () => {
    if (nodeList.length === 0) {
      return <></>;
    }

    return (
      <>
        <h2 className="d-flex justify-content-center text-white">Network</h2>
        {nodeList.map((item) => (
          <div key={item.address} className={`text-white d-inline-flex`}>
            {item.isPrimary ? <div className="alive"/> : (item.alive ? <div className="alive"/>  : <div className="dead"/> )}
            {item.isPrimary || item.alive && <div className="alive" />}
            {item.username} | {item.address}
          </div>
        ))}
      </>
    );
  };


  return (
    <div>
      <div>
        <h1 className="text-white">Minecraft Distributed Server System</h1>
        <div className="base">
          <a>
            <button type="button" name="username" role="create-network" className="network-button" onClick={handleShow}>
              Create Network
            </button>
          </a>
          <a>
            <button type="button" role="join-network" className="network-button">
              Join Network
            </button>
          </a>
          <a>
            <button type="button" role="debug" className="network-button" onClick={getInfo}>
              Refresh Network
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
                <label>Username</label>
                <input className="form-control" name="username" onChange={handleFormChange}/>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onClick={handleCreateNetwork}>
                Create
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      </div>
    {/* Node List Display */}
      {displayNodeList()}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home/>}/>
      </Routes>
    </Router>
  );
}
