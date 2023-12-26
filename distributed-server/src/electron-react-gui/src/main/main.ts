import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {default as axios} from "axios";
import os from "os";
import {Exception} from "sass";

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let info: any;
let nodeList: any;

function getLocalIPv4Address() {
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];

    for (const iface of interfaceInfo) {
      // Check for IPv4 and exclude loopback and internal addresses
      if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal && iface.address !== "127.0.0.1" && !iface.address.startsWith('172')) {
        return iface.address;
      }
    }
  }

  return null;
}

async function getInfo() {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/info`;
  const result = await axios.get(URL);
  let info = result.data.info;
  nodeList = info.network;
  mainWindow.webContents.send("update-node-list", nodeList);
}

setInterval(getInfo, 1000);

// Listen for the 'join-network' message from the renderer process
ipcMain.handle("join-network", async (event, nodeAddress) => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/request-network`;
  console.log(nodeAddress);
  const body = {
    address: `http://${nodeAddress['ip-address']}:${8080}`,
    username: nodeAddress['username']
  };
  console.log(URL);
  try {
   const response =  await axios.put(URL, body);
   return response;
  } catch (error) {
    throw new Error(error.response.data.error);
  }
});

ipcMain.handle("create-network", async (event,arg) => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/create-network`;

  try {
    const result = await axios.post(URL, JSON.stringify(arg), {
      headers: {
        "Content-Type": "application/json", // Set the appropriate content type
      },
    });
    return result.data;
  } catch (error) {
    console.log(error);
    throw new Error(error.response.data.error);
  }
});

ipcMain.handle("get-info", () => {
  return { info, nodeList };
});

// Listen for the 'leave-network' message from the renderer process
ipcMain.handle("leave-network", async () => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/request-leave-network`;

  try {
    await axios.delete(URL);
  } catch (error) {
    throw new Error('Unable to leave Network')
  }
});


if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    resizable: false
  });

  mainWindow.loadURL(resolveHtmlPath('/'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
