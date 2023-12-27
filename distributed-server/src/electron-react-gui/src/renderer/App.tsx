import {BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import './App.css';
import {useEffect, useState} from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import {SnackbarProvider, VariantType, useSnackbar} from 'notistack';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCrown} from '@fortawesome/free-solid-svg-icons'
import {Container} from 'react-bootstrap';
import {SideNav} from './SideNav';


function Home() {

  // hooks
  const [createShow, setCreateShow] = useState(false);
  const [joinShow, setJoinShow] = useState(false);
  const [createFormData, setCreateFormData] = useState({});
  const [joinFormData, setJoinFormData] = useState({});
  const [nodeList, setNodeList] = useState([]);
  const [inNetwork, setInNetwork] = useState(false);

  // modal setters
  const handleCreateClose = () => setCreateShow(false);
  const handleCreateShow = () => setCreateShow(true);
  const handleJoinShow = () => setJoinShow(true);
  const handleJoinClose = () => setJoinShow(false);

  const {enqueueSnackbar} = useSnackbar();


  useEffect(() => {
    setInterval(() => {
      getInfo();
    }, 1500);
  })

  const handleCreateNetwork = async () => {
    try {
      const response = await window.electron.ipcRenderer.invoke('create-network', createFormData);
      console.log(response);
      enqueueSnackbar('Successful creation', {variant: 'success'});
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Error creating network', {variant: 'error'});
    }
    await getInfo();
    handleCreateClose();
  };

  const handleJoinNetwork = async () => {
    try {
      const response = await window.electron.ipcRenderer.invoke('join-network', joinFormData);
      enqueueSnackbar('Successful creation', {variant: 'success'});
      await getInfo();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Error joining network', {variant: 'error'});
    }
    handleJoinClose();
  };

  const handleLeaveNetwork = async () => {
    try {
      await window.electron.ipcRenderer.invoke('leave-network', null);
      enqueueSnackbar('Successful Leave ', {variant: 'success'});
      await getInfo();
    } catch (error) {
      console.error(error);
      enqueueSnackbar(error.message, {variant: 'error'});
    }
    setInNetwork(false);
    await getInfo();
  }


  const handleCreateFormChange = (event) => {
    const {target} = event;
    const {name, value} = target;
    setCreateFormData({
      ...createFormData,
      [name]: value,
    });
  }

  const handleJoinFormChange = (event) => {
    const {target} = event;
    const {name, value} = target;
    setJoinFormData({
      ...joinFormData,
      [name]: value,
    });
  }

  const getInfo = async () => {
    const {nodeList} = await window.electron.ipcRenderer.invoke('get-info', null);
    setNodeList(nodeList);
    if (nodeList === undefined) {
      setInNetwork(false);
    } else {
      setInNetwork(nodeList && nodeList.length > 0);
    }
  }
  const displayNodeList = () => {
    if (!nodeList || nodeList.length === 0) {
      return <></>;
    }
    return (
      <>
        <h2 className="d-flex text-white align-self-start">Network List</h2>
        <hr className="text-white w-100"/>
        {nodeList.map((item) => (
          <div key={item.address} className={`text-white d-inline-flex align-self-start`}>
            {item.isPrimary ? <FontAwesomeIcon icon={faCrown} className="align-self-center leader"/> : (item.alive ?
              <div className="alive"/> :
              <div className="dead"/>)}
            {item.username} | {item.address}
          </div>
        ))}
      </>
    );
  };


  return (
    <Container>
      <h2 className="text-white p-3">Network Sessions</h2>
      <Container className="base p-3">
        <div className="pb-3">
          <a hidden={inNetwork}>
            <button type="button" name="username" role="create-network" className="network-button"
                    onClick={handleCreateShow}>
              Create Network
            </button>
          </a>
          <a hidden={inNetwork}>
            <button type="button" role="join-network" className="network-button" onClick={handleJoinShow}>
              Join Network
            </button>
          </a>
          <a hidden={!inNetwork}>
            <button type="button" role="leave-network" className="network-button" onClick={handleLeaveNetwork}>
              Leave Network
            </button>
          </a>
          <a>
            <button type="button" role="debug" className="network-button" onClick={getInfo}>
              Refresh Network
            </button>
          </a>
        </div>
        {/* Node List Display */}
        {displayNodeList()}

      </Container>
      <>
        <Modal show={createShow} onHide={handleCreateClose}>
          <Modal.Header closeButton>
            <Modal.Title>Creating Network</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form>
              <label>Username</label>
              <input className="form-control" name="username" onChange={handleCreateFormChange}/>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleCreateNetwork}>
              Create
            </Button>
          </Modal.Footer>
        </Modal>
      </>

      <>
        <Modal show={joinShow} onHide={handleJoinClose}>
          <Modal.Header closeButton>
            <Modal.Title>Joining a Network</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form>
              <label>Username</label>
              <input className="form-control" name="username" onChange={handleJoinFormChange}/>
              <label>IP Address (IPv4)</label>
              <input className="form-control" name="ip-address" onChange={handleJoinFormChange}/>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleJoinNetwork}>
              Join Network
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    </Container>
  );
}

export default function App() {
  return (
    <SnackbarProvider maxSnack={2}>
      <Router>
        <SideNav/>
        <Routes>
          <Route path="/" element={<Home/>}/>
          {/*<Route path="*" element={<Navigate to="/" replace />} />*/}
        </Routes>
      </Router>
    </SnackbarProvider>
  );
}
