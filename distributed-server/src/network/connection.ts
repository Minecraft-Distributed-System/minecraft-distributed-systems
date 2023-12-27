import os from "os";


export default class Connection {
    private address: string;
    private httpPort: number;
    private minecraftPort: number;

    getLocalIPv4Address(): string | null {
        const interfaces = os.networkInterfaces();
        for (const interfaceName in interfaces) {
            const interfaceInfo = interfaces[interfaceName];

            for (const iface of interfaceInfo) {
                // Check for IPv4 and exclude loopback and internal addresses
                if (
                    (iface.family === "IPv4" || (iface.family as any) === 4) &&
                    !iface.internal &&
                    iface.address !== "127.0.0.1" &&
                    !iface.address.startsWith("172")
                ) {
                    return iface.address;
                }
            }
        }
        return null;
    }

    constructor(address: string = null, httpPort: number = 8080, minecraftPort: number = 8082) {
       this.address =  address || this.getLocalIPv4Address();
       this.httpPort = httpPort;
       this.minecraftPort = minecraftPort;
    }

    getAddress() {
       return this.address;
    }

    getHttpPort() {
       return this.httpPort;
    }

    getMinecraftPort() {
       return this. minecraftPort;
    }

    setAddress(address: string) {
       this.address = address;
    }

    setHttpPort(httpPort: number) {
       this.httpPort = httpPort;
    }

    setMinecraftPort(minecraftPort: number) {
       this.minecraftPort = minecraftPort;
    }



}