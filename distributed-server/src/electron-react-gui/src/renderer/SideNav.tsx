import React, { useEffect } from 'react';
import { Container, Col } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import './App.css';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';



export function SideNav() {
  const location = useLocation().pathname;

  const isLinkActive = (currentPath) => location === currentPath;


  return (
    <Container className="min-vh-100 d-flex flex-column m-0 p-1 side-nav">
      {/* Insert Logo Later */}
      <Container>
        <h3 className="text-white text-center side-nav-title pt-2">
          Minecraft Distributed Server System
        </h3>
      </Container>

      <Col className="d-flex flex-column m-1 home-tab">
        <Link
          to="/"
          className={`text-decoration-none text-white text-hover ${
            isLinkActive('/') ? 'active-tab' : ''
          }`}
        >
          <div className="d-flex align-items-center flex-wrap m-2">
            <HomeIcon className="pe-1"/> Home
          </div>
        </Link>
        <Link
          to="/settings"
          className={`text-decoration-none text-white text-hover settings-tab ${
            isLinkActive( '/settings') ? 'active-tab' : ''
          }`}
        >
          <div className="d-flex align-items-center flex-wrap m-2">
            <SettingsIcon className="pe-1" /> Settings
          </div>
        </Link>
      </Col>
    </Container>
  );
}
